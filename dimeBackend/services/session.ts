// services/session.ts
// Persiste el estado de cada usuario en DynamoDB.
// Si no hay tabla configurada (desarrollo local), usa memoria.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { UserState, createInitialState } from "./finance";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

// Cache en memoria para desarrollo local / si DynamoDB no está disponible
const memoryStore = new Map<string, UserState>();

const TABLE = process.env.SESSIONS_TABLE ?? "";

export async function getSession(sessionId: string): Promise<UserState> {
  // Si no hay tabla configurada, usa memoria (útil para pruebas locales)
  if (!TABLE) {
    if (!memoryStore.has(sessionId)) {
      memoryStore.set(sessionId, createInitialState(sessionId));
    }
    return memoryStore.get(sessionId)!;
  }

  try {
    const result = await ddb.send(
      new GetCommand({ TableName: TABLE, Key: { sessionId } })
    );
    if (result.Item) {
      return result.Item as UserState;
    }
    // Usuario nuevo — estado inicial
    return createInitialState(sessionId);
  } catch (err) {
    console.error("Error leyendo sesión de DynamoDB:", err);
    // Fallback a memoria si DynamoDB falla durante el hackathon
    if (!memoryStore.has(sessionId)) {
      memoryStore.set(sessionId, createInitialState(sessionId));
    }
    return memoryStore.get(sessionId)!;
  }
}

export async function saveSession(sessionId: string, state: UserState): Promise<void> {
  if (!TABLE) {
    memoryStore.set(sessionId, state);
    return;
  }

  try {
    const ttl = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // expira en 7 días
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: { sessionId, ttl, ...state },
      })
    );
    memoryStore.set(sessionId, state); // cache local también
  } catch (err) {
    console.error("Error guardando sesión en DynamoDB:", err);
    memoryStore.set(sessionId, state); // al menos guarda en memoria
  }
}
