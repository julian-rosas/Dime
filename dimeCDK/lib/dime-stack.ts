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

function createTableName(prefix: string, suffix: string): string {
  return `${prefix}-${suffix}`;
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

    // Compatibilidad temporal con el backend actual del MVP.
    const legacySessionsTable = new dynamodb.Table(this, "DimeSessions", {
      tableName: createTableName(prefix, "sessions"),
      partitionKey: { name: "sessionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy,
    });

    const usersTable = new dynamodb.Table(this, "DimeUsers", {
      tableName: createTableName(prefix, "users"),
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    });

    const authSessionsTable = new dynamodb.Table(this, "DimeAuthSessions", {
      tableName: createTableName(prefix, "auth-sessions"),
      partitionKey: { name: "sessionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy,
    });

    const conversationsTable = new dynamodb.Table(this, "DimeConversations", {
      tableName: createTableName(prefix, "conversations"),
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "conversationId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    });

    const conversationMessagesTable = new dynamodb.Table(
      this,
      "DimeConversationMessages",
      {
        tableName: createTableName(prefix, "conversation-messages"),
        partitionKey: {
          name: "conversationId",
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: "createdAtMessageId",
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy,
      }
    );

    const userContactsTable = new dynamodb.Table(this, "DimeUserContacts", {
      tableName: createTableName(prefix, "user-contacts"),
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "contactUserId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    });

    const savingsGoalsTable = new dynamodb.Table(this, "DimeSavingsGoals", {
      tableName: createTableName(prefix, "savings-goals"),
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "goalId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    });

    const transactionsTable = new dynamodb.Table(this, "DimeTransactions", {
      tableName: createTableName(prefix, "transactions"),
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      // Keep the existing dev stack schema so CloudFormation can update in place.
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    });

    const openaiSecret = new secretsmanager.Secret(this, "OpenAIApiKey", {
      secretName: `dime/${stage}/openai-api-key`,
      description: `API Key de OpenAI para Dime (${stage})`,
      secretStringValue: cdk.SecretValue.unsafePlainText("REEMPLAZA_CON_TU_API_KEY"),
      removalPolicy,
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

    const messageHandler = new lambda.Function(this, "DimeMessageHandler", {
      functionName: `${prefix}-message-handler`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "api.handler",
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
                    "handlers/api.ts"
                  )}" --bundle --platform=node --target=node20 --outfile="${path.join(
                    outputDir,
                    "api.js"
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
            "npx esbuild handlers/api.ts --bundle --platform=node --target=node20 --outfile=/asset-output/api.js",
          ],
        },
      }),
      environment: {
        SESSIONS_TABLE: legacySessionsTable.tableName,
        TRANSACTIONS_TABLE: transactionsTable.tableName,
        USERS_TABLE: usersTable.tableName,
        AUTH_SESSIONS_TABLE: authSessionsTable.tableName,
        CONVERSATIONS_TABLE: conversationsTable.tableName,
        CONVERSATION_MESSAGES_TABLE: conversationMessagesTable.tableName,
        USER_CONTACTS_TABLE: userContactsTable.tableName,
        SAVINGS_GOALS_TABLE: savingsGoalsTable.tableName,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_APP_CLIENT_ID: appIntegrationClient.userPoolClientId,
        OPENAI_SECRET_ARN: openaiSecret.secretArn,
        NODE_ENV: "production",
        STAGE: stage,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    legacySessionsTable.grantReadWriteData(messageHandler);
    usersTable.grantReadWriteData(messageHandler);
    authSessionsTable.grantReadWriteData(messageHandler);
    conversationsTable.grantReadWriteData(messageHandler);
    conversationMessagesTable.grantReadWriteData(messageHandler);
    userContactsTable.grantReadWriteData(messageHandler);
    savingsGoalsTable.grantReadWriteData(messageHandler);
    transactionsTable.grantReadWriteData(messageHandler);
    openaiSecret.grantRead(messageHandler);
    messageHandler.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminInitiateAuth",
          "cognito-idp:AdminSetUserPassword",
        ],
        resources: [userPool.userPoolArn],
      })
    );

    const api = new apigateway.RestApi(this, "DimeApi", {
      restApiName: `${prefix}-api`,
      description: `API de Dime - finanzas conversacionales (${stage})`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
      },
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
                    "jwtHandler.js"
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
            "npx esbuild handlers/jwtHandler.ts --bundle --platform=node --target=node20 --outfile=/asset-output/jwtHandler.js",
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

      const authResource = api.root.addResource("auth");
      const signupResource = authResource.addResource("signup");
      signupResource.addMethod(
        "POST",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        })
      );
      const loginResource = authResource.addResource("login");
      loginResource.addMethod(
        "POST",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        })
      );

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

      const meResource = api.root.addResource("me");
      const conversationsResource = meResource.addResource("conversations");
      const contactsResource = meResource.addResource("contacts");
      const conversationByIdResource =
        conversationsResource.addResource("{conversationId}");
      const conversationMessagesResource =
        conversationByIdResource.addResource("messages");
      const conversationMessageByIdResource =
        conversationMessagesResource.addResource("{messageId}");
      const contactByIdResource = contactsResource.addResource("{contactUserId}");

      conversationsResource.addMethod(
        "GET",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        }),
        { authorizer: tokenAuthorizer }
      );
      conversationsResource.addMethod(
        "POST",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        }),
        { authorizer: tokenAuthorizer }
      );

      conversationByIdResource.addMethod(
        "GET",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        }),
        { authorizer: tokenAuthorizer }
      );
      conversationByIdResource.addMethod(
        "PATCH",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        }),
        { authorizer: tokenAuthorizer }
      );
      conversationByIdResource.addMethod(
        "DELETE",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        }),
        { authorizer: tokenAuthorizer }
      );

      conversationMessagesResource.addMethod(
        "GET",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        }),
        { authorizer: tokenAuthorizer }
      );
      conversationMessagesResource.addMethod(
        "POST",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        }),
        { authorizer: tokenAuthorizer }
      );
      conversationMessageByIdResource.addMethod(
        "GET",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        }),
        { authorizer: tokenAuthorizer }
      );

      contactsResource.addMethod(
        "GET",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        }),
        { authorizer: tokenAuthorizer }
      );
      contactsResource.addMethod(
        "POST",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        }),
        { authorizer: tokenAuthorizer }
      );

      contactByIdResource.addMethod(
        "GET",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        }),
        { authorizer: tokenAuthorizer }
      );
      contactByIdResource.addMethod(
        "PATCH",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        }),
        { authorizer: tokenAuthorizer }
      );
      contactByIdResource.addMethod(
        "DELETE",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        }),
        { authorizer: tokenAuthorizer }
      );

      const usersResource = api.root.addResource("users");
      const searchUsersResource = usersResource.addResource("search");
      searchUsersResource.addMethod(
        "GET",
        new apigateway.LambdaIntegration(messageHandler, {
          requestTemplates: { "application/json": '{ "statusCode": "200" }' },
        }),
        { authorizer: tokenAuthorizer }
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

    new cdk.CfnOutput(this, "AuthSignupEndpoint", {
      value: `${api.url}auth/signup`,
      description: "POST endpoint para registro con Cognito",
    });

    new cdk.CfnOutput(this, "AuthLoginEndpoint", {
      value: `${api.url}auth/login`,
      description: "POST endpoint para login con Cognito",
    });

    new cdk.CfnOutput(this, "ContactsEndpoint", {
      value: `${api.url}me/contacts`,
      description: "GET/POST endpoint para gestionar contactos del usuario",
    });

    new cdk.CfnOutput(this, "ConversationsEndpoint", {
      value: `${api.url}me/conversations`,
      description: "GET/POST endpoint para gestionar conversaciones del usuario",
    });

    new cdk.CfnOutput(this, "ConversationByIdEndpoint", {
      value: `${api.url}me/conversations/{conversationId}`,
      description: "GET/PATCH/DELETE endpoint para una conversacion puntual",
    });

    new cdk.CfnOutput(this, "ContactByIdEndpoint", {
      value: `${api.url}me/contacts/{contactUserId}`,
      description: "GET/PATCH/DELETE endpoint para un contacto puntual",
    });

    new cdk.CfnOutput(this, "UserSearchEndpoint", {
      value: `${api.url}users/search`,
      description: "GET endpoint para buscar usuarios de Dime",
    });

    new cdk.CfnOutput(this, "CognitoUserPoolId", {
      value: userPool.userPoolId,
      description: "User Pool de Cognito para autenticacion",
    });

    new cdk.CfnOutput(this, "CognitoAppClientId", {
      value: appIntegrationClient.userPoolClientId,
      description: "App Client de Cognito para autenticacion",
    });

    new cdk.CfnOutput(this, "OpenAISecretName", {
      value: openaiSecret.secretName,
      description: "Secret donde se guarda la API key de OpenAI",
    });

    new cdk.CfnOutput(this, "LegacySessionsTableName", {
      value: legacySessionsTable.tableName,
      description: "Tabla legacy de estado conversacional del MVP actual",
    });

    new cdk.CfnOutput(this, "UsersTableName", {
      value: usersTable.tableName,
      description: "Tabla principal de usuarios",
    });

    new cdk.CfnOutput(this, "AuthSessionsTableName", {
      value: authSessionsTable.tableName,
      description: "Tabla de sesiones de autenticacion",
    });

    new cdk.CfnOutput(this, "ConversationsTableName", {
      value: conversationsTable.tableName,
      description: "Tabla menu de conversaciones por usuario",
    });

    new cdk.CfnOutput(this, "ConversationMessagesTableName", {
      value: conversationMessagesTable.tableName,
      description: "Tabla de mensajes por conversacion",
    });

    new cdk.CfnOutput(this, "UserContactsTableName", {
      value: userContactsTable.tableName,
      description: "Tabla de contactos entre usuarios",
    });

    new cdk.CfnOutput(this, "SavingsGoalsTableName", {
      value: savingsGoalsTable.tableName,
      description: "Tabla de cajitas o metas de ahorro",
    });

    new cdk.CfnOutput(this, "TransactionsTableName", {
      value: transactionsTable.tableName,
      description: "Tabla de movimientos financieros",
    });

    new cdk.CfnOutput(this, "Stage", {
      value: stage,
      description: "Ambiente desplegado",
    });
  }
}
