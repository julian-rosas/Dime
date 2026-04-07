import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import * as path from "path";

export interface DimeStackProps extends cdk.StackProps {
  stage: "dev" | "prod";
}

export class DimeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DimeStackProps) {
    super(scope, id, props);

    const stage = props.stage;
    const prefix = `dime-${stage}`;
    const backendPath = path.join(__dirname, "../../dimeBackend");
    const cdkRoot = path.join(__dirname, "..");
    const removalPolicy =
      stage === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    const sessionsTable = new dynamodb.Table(this, "DimeSessions", {
      tableName: `${prefix}-sessions`,
      partitionKey: { name: "sessionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy,
    });

    const transactionsTable = new dynamodb.Table(this, "DimeTransactions", {
      tableName: `${prefix}-transactions`,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    });

    const anthropicSecret = new secretsmanager.Secret(this, "AnthropicApiKey", {
      secretName: `dime/${stage}/anthropic-api-key`,
      description: `API Key de Anthropic para Dime (${stage})`,
      secretStringValue: cdk.SecretValue.unsafePlainText("REEMPLAZA_CON_TU_API_KEY"),
      removalPolicy,
    });

    const messageHandler = new lambda.Function(this, "DimeMessageHandler", {
      functionName: `${prefix}-message-handler`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "message.handler",
      code: lambda.Code.fromAsset(backendPath, {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          local: {
            tryBundle(outputDir: string) {
              const { execSync } = require("child_process");

              try {
                execSync(
                  `npx --prefix "${cdkRoot}" esbuild "${path.join(
                    backendPath,
                    "handlers/message.ts"
                  )}" --bundle --platform=node --target=node20 --outfile="${path.join(
                    outputDir,
                    "message.js"
                  )}"`,
                  { stdio: "inherit" }
                );
                return true;
              } catch {
                return false;
              }
            },
          },
          command: [
            "bash",
            "-c",
            "npx esbuild handlers/message.ts --bundle --platform=node --target=node20 --outfile=/asset-output/message.js",
          ],
        },
      }),
      environment: {
        SESSIONS_TABLE: sessionsTable.tableName,
        TRANSACTIONS_TABLE: transactionsTable.tableName,
        ANTHROPIC_SECRET_ARN: anthropicSecret.secretArn,
        NODE_ENV: "production",
        STAGE: stage,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    sessionsTable.grantReadWriteData(messageHandler);
    transactionsTable.grantReadWriteData(messageHandler);
    anthropicSecret.grantRead(messageHandler);

    const api = new apigateway.RestApi(this, "DimeApi", {
      restApiName: `${prefix}-api`,
      description: `API de Dime - finanzas conversacionales (${stage})`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["POST", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });
    
    const userPool = new cognito.UserPool(this, "DimeUserPool", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const appIntegrationClient = userPool.addClient("DimeClient", {
      userPoolClientName: "DimeWebClient",
      idTokenValidity: cdk.Duration.days(1),
      accessTokenValidity: cdk.Duration.days(1),
      authFlows: {
        adminUserPassword: true
      },
      oAuth: {
        flows: {authorizationCodeGrant: true},
        scopes: [cognito.OAuthScope.OPENID]
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO]
    });

    const jwtHandler = new lambda.Function(this, "DimeJWTHandler", {
      functionName: `${prefix}-jwt-handler`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "jwtHandler.handler",
      code: lambda.Code.fromAsset(backendPath, {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          local: {
            tryBundle(outputDir: string) {
              const { execSync } = require("child_process");

              try {
                execSync(
                  `npx --prefix "${cdkRoot}" esbuild "${path.join(
                    backendPath,
                    "handlers/jwtHandler.ts"
                  )}" --bundle --platform=node --target=node20 --outfile="${path.join(
                    outputDir,
                    "jwt.js"
                  )}"`,
                  { stdio: "inherit" }
                );
                return true;
              } catch {
                return false;
              }
            },
          },
          command: [
            "bash",
            "-c",
            "npx esbuild handlers/jwtHandler.ts --bundle --platform=node --target=node20 --outfile=/asset-output/jwt.js",
          ],
        },
      }),
      environment: {
        "API_ID": api.restApiId,
        "API_REGION": this.region,
        "ACCOUNT_ID": this.account,
        "COGNITO_USER_POOL_ID": userPool.userPoolId,
        "COGNITO_APP_CLIENT_ID": appIntegrationClient.userPoolClientId    
    },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const tokenAuthorizer = new apigateway.TokenAuthorizer(this, 'jwttokenAuth', {
      handler: jwtHandler,
      validationRegex: "^(Bearer )[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)$"
      });

      const messageResource = api.root.addResource("message");
      messageResource.addMethod(
        "POST",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        })
      );
  
      const healthResource = api.root.addResource("health");
      healthResource.addMethod(
        "GET",
        new apigateway.MockIntegration({
          integrationResponses: [
            {
              statusCode: "200",
              responseTemplates: {
                "application/json": `{"status":"ok","service":"dime","stage":"${stage}"}`,
              },
            },
          ],
          passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
          requestTemplates: { "application/json": '{"statusCode": 200}' },
        }),
        { methodResponses: [{ statusCode: "200" }],
          authorizer: tokenAuthorizer },
      );

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "URL base del API",
      exportName: `DimeApiUrl-${stage}`,
    });

    new cdk.CfnOutput(this, "MessageEndpoint", {
      value: `${api.url}message`,
      description: "POST endpoint para mensajes",
    });

    new cdk.CfnOutput(this, "AnthropicSecretName", {
      value: anthropicSecret.secretName,
      description: "Secret donde se guarda la API key de Anthropic",
    });

    new cdk.CfnOutput(this, "Stage", {
      value: stage,
      description: "Ambiente desplegado",
    });
  }
}
