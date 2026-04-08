import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE ?? "";

type ConversationStatus = "active" | "archived";

interface ConversationRecord {
  userId: string;
  conversationId: string;
  title?: string;
  status: ConversationStatus;
  agentMode?: string;
  lastMessagePreview?: string;
  linkedPendingOperation?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateConversationInput {
  title?: string;
  agentMode?: string;
}

interface UpdateConversationInput {
  title?: string | null;
  status?: string;
  agentMode?: string | null;
  lastMessagePreview?: string | null;
  linkedPendingOperation?: Record<string, unknown> | null;
}

function ensureTableConfigured(): void {
  if (!CONVERSATIONS_TABLE) {
    throw new Error("La tabla de conversaciones no esta configurada.");
  }
}

function normalizeOptionalString(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStatus(value?: string): ConversationStatus | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "active" || normalized === "archived") {
    return normalized;
  }

  throw new Error("status debe ser 'active' o 'archived'.");
}

function sanitizeLinkedPendingOperation(
  value: Record<string, unknown> | null | undefined
): Record<string, unknown> | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("linkedPendingOperation debe ser un objeto o null.");
  }

  return value;
}

function mapConversation(record: ConversationRecord) {
  return {
    conversationId: record.conversationId,
    title: record.title ?? "Nuevo chat",
    status: record.status,
    agentMode: record.agentMode ?? "default",
    lastMessagePreview: record.lastMessagePreview ?? null,
    linkedPendingOperation: record.linkedPendingOperation ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function getConversationRecord(
  userId: string,
  conversationId: string
): Promise<ConversationRecord | undefined> {
  ensureTableConfigured();

  const normalizedConversationId = normalizeOptionalString(conversationId);
  if (!normalizedConversationId) {
    throw new Error("Debes enviar conversationId.");
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: { userId, conversationId: normalizedConversationId },
    })
  );

  return result.Item as ConversationRecord | undefined;
}

function buildConversationRecord(
  userId: string,
  input: {
    conversationId: string;
    title?: string;
    status?: ConversationStatus;
    agentMode?: string;
    lastMessagePreview?: string;
    linkedPendingOperation?: Record<string, unknown> | null;
  },
  previous?: ConversationRecord
): ConversationRecord {
  const now = new Date().toISOString();

  const linkedPendingOperation =
    input.linkedPendingOperation !== undefined
      ? input.linkedPendingOperation
      : previous?.linkedPendingOperation ?? null;

  return {
    userId,
    conversationId: input.conversationId,
    title: normalizeOptionalString(input.title) ?? previous?.title ?? "Nuevo chat",
    status: input.status ?? previous?.status ?? "active",
    agentMode:
      normalizeOptionalString(input.agentMode) ?? previous?.agentMode ?? "default",
    lastMessagePreview:
      normalizeOptionalString(input.lastMessagePreview) ?? previous?.lastMessagePreview,
    linkedPendingOperation,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

export async function listConversations(userId: string) {
  ensureTableConfigured();

  const result = await ddb.send(
    new QueryCommand({
      TableName: CONVERSATIONS_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    })
  );

  const conversations = (result.Items ?? []) as ConversationRecord[];

  return conversations
    .filter((conversation) => conversation.status !== "archived")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(mapConversation);
}

export async function createConversation(
  userId: string,
  input: CreateConversationInput
) {
  ensureTableConfigured();

  const conversation = buildConversationRecord(userId, {
    conversationId: randomUUID(),
    title: input.title,
    agentMode: input.agentMode,
    status: "active",
    linkedPendingOperation: null,
  });

  await ddb.send(
    new PutCommand({
      TableName: CONVERSATIONS_TABLE,
      Item: conversation,
    })
  );

  return mapConversation(conversation);
}

export async function getConversation(userId: string, conversationId: string) {
  const conversation = await getConversationRecord(userId, conversationId);

  if (!conversation) {
    throw new Error("Conversacion no encontrada.");
  }

  return mapConversation(conversation);
}

export async function updateConversation(
  userId: string,
  conversationId: string,
  input: UpdateConversationInput
) {
  const existing = await getConversationRecord(userId, conversationId);

  if (!existing) {
    throw new Error("Conversacion no encontrada.");
  }

  const updated = buildConversationRecord(
    userId,
    {
      conversationId: existing.conversationId,
      title: input.title === null ? undefined : input.title,
      status: normalizeStatus(input.status) ?? existing.status,
      agentMode: input.agentMode === null ? undefined : input.agentMode,
      lastMessagePreview:
        input.lastMessagePreview === null ? undefined : input.lastMessagePreview,
      linkedPendingOperation: sanitizeLinkedPendingOperation(
        input.linkedPendingOperation
      ),
    },
    existing
  );

  if (input.title === null) {
    updated.title = "Nuevo chat";
  }

  if (input.agentMode === null) {
    updated.agentMode = "default";
  }

  if (input.lastMessagePreview === null) {
    delete updated.lastMessagePreview;
  }

  await ddb.send(
    new PutCommand({
      TableName: CONVERSATIONS_TABLE,
      Item: updated,
    })
  );

  return mapConversation(updated);
}

export async function archiveConversation(userId: string, conversationId: string) {
  const existing = await getConversationRecord(userId, conversationId);

  if (!existing) {
    throw new Error("Conversacion no encontrada.");
  }

  const archived = buildConversationRecord(
    userId,
    {
      conversationId: existing.conversationId,
      title: existing.title,
      status: "archived",
      agentMode: existing.agentMode,
      lastMessagePreview: existing.lastMessagePreview,
      linkedPendingOperation: existing.linkedPendingOperation ?? null,
    },
    existing
  );

  await ddb.send(
    new PutCommand({
      TableName: CONVERSATIONS_TABLE,
      Item: archived,
    })
  );

  return {
    archived: true,
    conversation: mapConversation(archived),
  };
}
