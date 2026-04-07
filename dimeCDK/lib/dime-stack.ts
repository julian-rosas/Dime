import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
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
    const legacySessionsTable = new dynamodb.Table(this, "DimeLegacySessions", {
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
    usersTable.addGlobalSecondaryIndex({
      indexName: "phone-index",
      partitionKey: { name: "phone", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const authSessionsTable = new dynamodb.Table(this, "DimeAuthSessions", {
      tableName: createTableName(prefix, "auth-sessions"),
      partitionKey: { name: "sessionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy,
    });
    authSessionsTable.addGlobalSecondaryIndex({
      indexName: "userId-createdAt-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const conversationsTable = new dynamodb.Table(this, "DimeConversations", {
      tableName: createTableName(prefix, "conversations"),
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "conversationId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    });
    conversationsTable.addGlobalSecondaryIndex({
      indexName: "userId-updatedAt-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "updatedAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
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
    userContactsTable.addGlobalSecondaryIndex({
      indexName: "contactUserId-index",
      partitionKey: { name: "contactUserId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const savingsGoalsTable = new dynamodb.Table(this, "DimeSavingsGoals", {
      tableName: createTableName(prefix, "savings-goals"),
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "goalId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    });
    savingsGoalsTable.addGlobalSecondaryIndex({
      indexName: "userId-status-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "status", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const transactionsTable = new dynamodb.Table(this, "DimeTransactions", {
      tableName: createTableName(prefix, "transactions"),
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAtTxId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    });
    transactionsTable.addGlobalSecondaryIndex({
      indexName: "userId-status-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "status", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    transactionsTable.addGlobalSecondaryIndex({
      indexName: "contactUserId-createdAt-index",
      partitionKey: { name: "contactUserId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    transactionsTable.addGlobalSecondaryIndex({
      indexName: "goalId-createdAt-index",
      partitionKey: { name: "goalId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
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
        SESSIONS_TABLE: legacySessionsTable.tableName,
        TRANSACTIONS_TABLE: transactionsTable.tableName,
        USERS_TABLE: usersTable.tableName,
        AUTH_SESSIONS_TABLE: authSessionsTable.tableName,
        CONVERSATIONS_TABLE: conversationsTable.tableName,
        CONVERSATION_MESSAGES_TABLE: conversationMessagesTable.tableName,
        USER_CONTACTS_TABLE: userContactsTable.tableName,
        SAVINGS_GOALS_TABLE: savingsGoalsTable.tableName,
        ANTHROPIC_SECRET_ARN: anthropicSecret.secretArn,
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
      { methodResponses: [{ statusCode: "200" }] }
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
