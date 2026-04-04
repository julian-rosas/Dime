import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as path from "path";

export class DimeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─────────────────────────────────────────────
    // 1. DYNAMODB — sesiones y transacciones
    // ─────────────────────────────────────────────
    const sessionsTable = new dynamodb.Table(this, "DimeSessions", {
      tableName: "dime-sessions",
      partitionKey: { name: "sessionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // gratis en tier free
      timeToLiveAttribute: "ttl", // limpia sesiones viejas automáticamente
      removalPolicy: cdk.RemovalPolicy.DESTROY, // para hackathon — fácil de recrear
    });

    const transactionsTable = new dynamodb.Table(this, "DimeTransactions", {
      tableName: "dime-transactions",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─────────────────────────────────────────────
    // 2. SECRET — API Key de Anthropic (Claude)
    //    Después del deploy, pon tu key aquí:
    //    AWS Console → Secrets Manager → dime/anthropic-api-key → Edit
    // ─────────────────────────────────────────────
    const anthropicSecret = new secretsmanager.Secret(this, "AnthropicApiKey", {
      secretName: "dime/anthropic-api-key",
      description: "API Key de Anthropic para Dime",
      secretStringValue: cdk.SecretValue.unsafePlainText("REEMPLAZA_CON_TU_API_KEY"),
    });

    // ─────────────────────────────────────────────
    // 3. LAMBDA — handler principal /message
    // ─────────────────────────────────────────────
    const messageHandler = new lambda.Function(this, "DimeMessageHandler", {
      functionName: "dime-message-handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "message.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../dimeBackend"), {
        bundling: {
          // Usa esbuild para empaquetar sin necesitar Docker
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          local: {
            tryBundle(outputDir: string) {
              // Fallback local con esbuild
              const { execSync } = require("child_process");
              try {
                execSync(
                  `cd ${path.join(__dirname, "../../dimeBackend")} && ` +
                  `npx esbuild handlers/message.ts --bundle --platform=node --target=node20 --outfile=${outputDir}/message.js`,
                  { stdio: "inherit" }
                );
                return true;
              } catch {
                return false;
              }
            },
          },
          command: [
            "bash", "-c",
            "npx esbuild handlers/message.ts --bundle --platform=node --target=node20 --outfile=/asset-output/message.js",
          ],
        },
      }),
      environment: {
        SESSIONS_TABLE: sessionsTable.tableName,
        TRANSACTIONS_TABLE: transactionsTable.tableName,
        ANTHROPIC_SECRET_ARN: anthropicSecret.secretArn,
        NODE_ENV: "production",
      },
      timeout: cdk.Duration.seconds(30), // Claude puede tardar ~5s
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Permisos para que Lambda lea/escriba las tablas
    sessionsTable.grantReadWriteData(messageHandler);
    transactionsTable.grantReadWriteData(messageHandler);

    // Permiso para que Lambda lea el secret de Anthropic
    anthropicSecret.grantRead(messageHandler);

    // ─────────────────────────────────────────────
    // 4. API GATEWAY — expone POST /message
    // ─────────────────────────────────────────────
    const api = new apigateway.RestApi(this, "DimeApi", {
      restApiName: "dime-api",
      description: "API de Dime — finanzas conversacionales",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // en prod, reemplaza con tu dominio
        allowMethods: ["POST", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    const messageResource = api.root.addResource("message");
    messageResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(messageHandler, {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' },
      })
    );

    // Health check básico para verificar que el API está vivo
    const healthResource = api.root.addResource("health");
    healthResource.addMethod(
      "GET",
      new apigateway.MockIntegration({
        integrationResponses: [{ statusCode: "200", responseTemplates: { "application/json": '{"status":"ok","service":"dime"}' } }],
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestTemplates: { "application/json": '{"statusCode": 200}' },
      }),
      { methodResponses: [{ statusCode: "200" }] }
    );

    // ─────────────────────────────────────────────
    // 5. OUTPUTS — imprime las URLs al terminar el deploy
    // ─────────────────────────────────────────────
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "URL base del API — úsala en el frontend",
      exportName: "DimeApiUrl",
    });

    new cdk.CfnOutput(this, "MessageEndpoint", {
      value: `${api.url}message`,
      description: "POST a este endpoint con { sessionId, message }",
    });

    new cdk.CfnOutput(this, "AnthropicSecretName", {
      value: anthropicSecret.secretName,
      description: "Pon aquí tu API Key de Anthropic después del deploy",
    });
  }
}
