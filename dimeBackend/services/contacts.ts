import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const USERS_TABLE = process.env.USERS_TABLE ?? "";
const USER_CONTACTS_TABLE = process.env.USER_CONTACTS_TABLE ?? "";

interface UserRecord {
  userId: string;
  email?: string;
  phone?: string;
  phoneVerified?: boolean;
  displayName?: string;
  preferredLanguage?: string;
  balanceAvailable?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface UserContactRecord {
  userId: string;
  contactUserId: string;
  nickname?: string;
  aliasForMe?: string[];
  isFavorite?: boolean;
  status: "active";
  createdAt: string;
  updatedAt: string;
}

interface CreateContactInput {
  contactUserId: string;
  nickname?: string;
  aliasForMe?: string[];
  isFavorite?: boolean;
}

interface UpdateContactInput {
  nickname?: string | null;
  aliasForMe?: string[] | null;
  isFavorite?: boolean;
}

function areTablesConfigured(): boolean {
  return Boolean(USERS_TABLE && USER_CONTACTS_TABLE);
}

function normalizeString(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeAliases(aliases?: string[] | null): string[] | undefined {
  if (!aliases) {
    return undefined;
  }

  const normalizedAliases = Array.from(
    new Set(
      aliases
        .map((alias) => alias.trim())
        .filter((alias) => alias.length > 0)
    )
  );

  return normalizedAliases.length > 0 ? normalizedAliases : undefined;
}

function sanitizeUser(user: UserRecord) {
  return {
    userId: user.userId,
    email: user.email ?? null,
    phone: user.phone ?? null,
    phoneVerified: user.phoneVerified ?? false,
    displayName: user.displayName ?? "Usuario Dime",
    preferredLanguage: user.preferredLanguage ?? "es-MX",
    balanceAvailable: user.balanceAvailable ?? 0,
    createdAt: user.createdAt ?? null,
    updatedAt: user.updatedAt ?? null,
  };
}

function mapContact(contact: UserContactRecord, user: UserRecord) {
  return {
    contactUserId: contact.contactUserId,
    nickname: contact.nickname ?? null,
    aliasForMe: contact.aliasForMe ?? [],
    isFavorite: contact.isFavorite ?? false,
    status: contact.status,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
    contactUser: sanitizeUser(user),
  };
}

function validateContactUserId(currentUserId: string, contactUserId?: string): string {
  const normalized = normalizeString(contactUserId);

  if (!normalized) {
    throw new Error("Debes enviar contactUserId.");
  }

  if (normalized === currentUserId) {
    throw new Error("No puedes agregarte a ti mismo como contacto.");
  }

  return normalized;
}

async function getUserById(userId: string): Promise<UserRecord | undefined> {
  if (!areTablesConfigured()) {
    throw new Error("Las tablas de usuarios y contactos no estÃ¡n configuradas.");
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId },
    })
  );

  return result.Item as UserRecord | undefined;
}

async function ensureTargetUserExists(contactUserId: string): Promise<UserRecord> {
  const user = await getUserById(contactUserId);

  if (!user) {
    throw new Error("El usuario que intentas agregar no existe en Dime.");
  }

  return user;
}

async function getContactRecord(
  userId: string,
  contactUserId: string
): Promise<UserContactRecord | undefined> {
  if (!areTablesConfigured()) {
    throw new Error("La tabla de contactos no estÃ¡ configurada.");
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: USER_CONTACTS_TABLE,
      Key: { userId, contactUserId },
    })
  );

  return result.Item as UserContactRecord | undefined;
}

async function saveContact(contact: UserContactRecord): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: USER_CONTACTS_TABLE,
      Item: contact,
    })
  );
}

async function getUsersByIds(userIds: string[]): Promise<Map<string, UserRecord>> {
  const uniqueUserIds = Array.from(new Set(userIds));
  const usersById = new Map<string, UserRecord>();

  if (uniqueUserIds.length === 0) {
    return usersById;
  }

  const result = await ddb.send(
    new BatchGetCommand({
      RequestItems: {
        [USERS_TABLE]: {
          Keys: uniqueUserIds.map((userId) => ({ userId })),
        },
      },
    })
  );

  const users = (result.Responses?.[USERS_TABLE] ?? []) as UserRecord[];
  users.forEach((user) => usersById.set(user.userId, user));
  return usersById;
}

function buildContactRecord(
  userId: string,
  input: CreateContactInput,
  previous?: UserContactRecord
): UserContactRecord {
  const now = new Date().toISOString();

  return {
    userId,
    contactUserId: input.contactUserId,
    nickname: normalizeString(input.nickname),
    aliasForMe: normalizeAliases(input.aliasForMe),
    isFavorite: input.isFavorite ?? previous?.isFavorite ?? false,
    status: "active",
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

export async function listContacts(userId: string) {
  if (!areTablesConfigured()) {
    throw new Error("La tabla de contactos no estÃ¡ configurada.");
  }

  const result = await ddb.send(
    new QueryCommand({
      TableName: USER_CONTACTS_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    })
  );

  const contacts = (result.Items ?? []) as UserContactRecord[];
  const usersById = await getUsersByIds(
    contacts.map((contact) => contact.contactUserId)
  );

  return contacts
    .filter((contact) => usersById.has(contact.contactUserId))
    .sort((a, b) => {
      if ((a.isFavorite ?? false) !== (b.isFavorite ?? false)) {
        return a.isFavorite ? -1 : 1;
      }

      const leftName = a.nickname ?? usersById.get(a.contactUserId)?.displayName ?? "";
      const rightName = b.nickname ?? usersById.get(b.contactUserId)?.displayName ?? "";
      return leftName.localeCompare(rightName, "es");
    })
    .map((contact) => mapContact(contact, usersById.get(contact.contactUserId)!));
}

export async function createContact(userId: string, input: CreateContactInput) {
  if (!areTablesConfigured()) {
    throw new Error("La tabla de contactos no estÃ¡ configurada.");
  }

  const contactUserId = validateContactUserId(userId, input.contactUserId);
  const existing = await getContactRecord(userId, contactUserId);

  if (existing) {
    throw new Error("Ese usuario ya existe en tus contactos.");
  }

  const user = await ensureTargetUserExists(contactUserId);
  const contact = buildContactRecord(userId, {
    ...input,
    contactUserId,
  });

  await saveContact(contact);
  return mapContact(contact, user);
}

export async function getContact(userId: string, contactUserId: string) {
  const normalizedContactUserId = validateContactUserId(userId, contactUserId);
  const contact = await getContactRecord(userId, normalizedContactUserId);

  if (!contact) {
    throw new Error("Contacto no encontrado.");
  }

  const user = await ensureTargetUserExists(normalizedContactUserId);
  return mapContact(contact, user);
}

export async function updateContact(
  userId: string,
  contactUserId: string,
  input: UpdateContactInput
) {
  const normalizedContactUserId = validateContactUserId(userId, contactUserId);
  const existing = await getContactRecord(userId, normalizedContactUserId);

  if (!existing) {
    throw new Error("Contacto no encontrado.");
  }

  const user = await ensureTargetUserExists(normalizedContactUserId);
  const contact = buildContactRecord(
    userId,
    {
      contactUserId: normalizedContactUserId,
      nickname: input.nickname ?? undefined,
      aliasForMe: input.aliasForMe ?? undefined,
      isFavorite: input.isFavorite ?? existing.isFavorite ?? false,
    },
    existing
  );

  if (input.nickname === null) {
    delete contact.nickname;
  }

  if (input.aliasForMe === null) {
    delete contact.aliasForMe;
  }

  await saveContact(contact);
  return mapContact(contact, user);
}

export async function deleteContact(userId: string, contactUserId: string) {
  const normalizedContactUserId = validateContactUserId(userId, contactUserId);
  const existing = await getContactRecord(userId, normalizedContactUserId);

  if (!existing) {
    throw new Error("Contacto no encontrado.");
  }

  await ddb.send(
    new DeleteCommand({
      TableName: USER_CONTACTS_TABLE,
      Key: { userId, contactUserId: normalizedContactUserId },
    })
  );

  return {
    deleted: true,
    contactUserId: normalizedContactUserId,
  };
}

export async function searchUsers(input: {
  currentUserId: string;
  email?: string;
  phone?: string;
  displayName?: string;
}) {
  if (!areTablesConfigured()) {
    throw new Error("La tabla de usuarios no estÃ¡ configurada.");
  }

  const email = normalizeString(input.email)?.toLowerCase();
  const phone = normalizeString(input.phone);
  const displayName = normalizeString(input.displayName)?.toLowerCase();

  if (!email && !phone && !displayName) {
    throw new Error("Debes enviar al menos uno de estos filtros: email, phone o displayName.");
  }

  const result = await ddb.send(
    new ScanCommand({
      TableName: USERS_TABLE,
      Limit: 50,
    })
  );

  const users = (result.Items ?? []) as UserRecord[];
  const contacts = await listContacts(input.currentUserId);
  const existingContacts = new Set(
    contacts.map((contact) => contact.contactUserId)
  );

  return users
    .filter((user) => user.userId !== input.currentUserId)
    .filter((user) => {
      const matchesEmail = email ? user.email?.toLowerCase() === email : true;
      const matchesPhone = phone ? user.phone === phone : true;
      const matchesDisplayName = displayName
        ? user.displayName?.toLowerCase().includes(displayName) ?? false
        : true;

      return matchesEmail && matchesPhone && matchesDisplayName;
    })
    .slice(0, 10)
    .map((user) => ({
      ...sanitizeUser(user),
      isAlreadyContact: existingContacts.has(user.userId),
    }));
}
