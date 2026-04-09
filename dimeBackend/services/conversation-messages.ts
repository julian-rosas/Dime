import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { processUserMessage } from "./chat-engine";
import { UserState } from "./finance";
import { getConversationRecord, updateConversation } from "./conversations";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CONVERSATION_MESSAGES_TABLE = process.env.CONVERSATION_MESSAGES_TABLE ?? "";

type MessageRole = "user" | "assistant";

interface ConversationMessageRecord {
  conversationId: string;
  createdAtMessageId: string;
  messageId: string;
  userId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

function ensureTableConfigured(): void {
  if (!CONVERSATION_MESSAGES_TABLE) {
    throw new Error("La tabla de mensajes de conversacion no esta configurada.");
  }
}

function normalizeOptionalString(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function buildSortKey(createdAt: string, messageId: string): string {
  return `${createdAt}#${messageId}`;
}

function mapMessage(record: ConversationMessageRecord) {
  return {
    messageId: record.messageId,
    conversationId: record.conversationId,
    role: record.role,
    content: record.content,
    createdAt: record.createdAt,
  };
}

async function ensureConversationAccess(userId: string, conversationId: string) {
  const conversation = await getConversationRecord(userId, conversationId);
  if (!conversation) {
    throw new Error("Conversacion no encontrada.");
  }

  return conversation;
}

async function storeMessage(
  userId: string,
  conversationId: string,
  role: MessageRole,
  content: string
) {
  ensureTableConfigured();

  const createdAt = new Date().toISOString();
  const messageId = randomUUID();

  const record: ConversationMessageRecord = {
    conversationId,
    createdAtMessageId: buildSortKey(createdAt, messageId),
    messageId,
    userId,
    role,
    content,
    createdAt,
  };

  await ddb.send(
    new PutCommand({
      TableName: CONVERSATION_MESSAGES_TABLE,
      Item: record,
    })
  );

  return record;
}

async function syncConversationMetadata(
  userId: string,
  conversationId: string,
  preview: string,
  state: UserState
) {
  await updateConversation(userId, conversationId, {
    lastMessagePreview: preview.slice(0, 160),
    linkedPendingOperation: state.pendingOperation ?? null,
  });
}

export async function listConversationMessages(
  userId: string,
  conversationId: string
) {
  ensureTableConfigured();
  await ensureConversationAccess(userId, conversationId);

  const result = await ddb.send(
    new QueryCommand({
      TableName: CONVERSATION_MESSAGES_TABLE,
      KeyConditionExpression: "conversationId = :conversationId",
      ExpressionAttributeValues: {
        ":conversationId": conversationId,
      },
    })
  );

  const messages = (result.Items ?? []) as ConversationMessageRecord[];

  return messages
    .sort((left, right) =>
      left.createdAtMessageId.localeCompare(right.createdAtMessageId)
    )
    .map(mapMessage);
}

export async function getConversationMessage(
  userId: string,
  conversationId: string,
  messageId: string
) {
  const normalizedMessageId = normalizeOptionalString(messageId);
  if (!normalizedMessageId) {
    throw new Error("Debes enviar messageId.");
  }

  const messages = await listConversationMessages(userId, conversationId);
  const message = messages.find(
    (conversationMessage) => conversationMessage.messageId === normalizedMessageId
  );

  if (!message) {
    throw new Error("Mensaje no encontrado.");
  }

  return message;
}

export async function createConversationMessage(
  userId: string,
  conversationId: string,
  message: string
) {
  const normalizedMessage = normalizeOptionalString(message);
  if (!normalizedMessage) {
    throw new Error("Debes enviar message.");
  }

  const conversation = await ensureConversationAccess(userId, conversationId);
  if (conversation.status === "archived") {
    throw new Error("No puedes enviar mensajes a una conversacion archivada.");
  }

  const userMessageRecord = await storeMessage(
    userId,
    conversationId,
    "user",
    normalizedMessage
  );

  const { reply, state } = await processUserMessage(
    conversationId,
    normalizedMessage,
    userId
  );

  const assistantMessageRecord = await storeMessage(
    userId,
    conversationId,
    "assistant",
    reply
  );

  await syncConversationMetadata(userId, conversationId, reply, state);

  return {
    message: mapMessage(userMessageRecord),
    reply: mapMessage(assistantMessageRecord),
    state,
  };
}
