import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { createAccount, getAllAccounts } from "../nessi/service/accountService";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const USERS_TABLE = process.env.USERS_TABLE ?? "";

export interface StoredUserRecord {
  userId: string;
  nessieId?: string;
  nessieAccountId?: string;
  cognitoUsername: string;
  email?: string;
  phone?: string;
  phoneVerified?: boolean;
  displayName: string;
  preferredLanguage: string;
  balanceAvailable: number;
  createdAt: string;
  updatedAt: string;
}

function ensureUsersTable(): string {
  if (!USERS_TABLE) {
    throw new Error("La tabla de usuarios no esta configurada.");
  }

  return USERS_TABLE;
}

export async function getStoredUserById(
  userId: string
): Promise<StoredUserRecord | undefined> {
  if (!USERS_TABLE || !userId) {
    return undefined;
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId },
    })
  );

  return result.Item as StoredUserRecord | undefined;
}

export async function saveStoredUser(user: StoredUserRecord): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: ensureUsersTable(),
      Item: user,
    })
  );
}

async function findPrimaryAccountIdForCustomer(
  nessieCustomerId: string
): Promise<string | undefined> {
  if (!nessieCustomerId) {
    return undefined;
  }

  try {
    const accounts = await getAllAccounts();
    const primary = (accounts ?? []).find(
      (account: any) => account?.customer_id === nessieCustomerId
    );
    return primary?._id;
  } catch (error) {
    console.error("No se pudo buscar la cuenta principal en Nessie:", error);
    return undefined;
  }
}

async function createDefaultAccountForCustomer(
  nessieCustomerId: string
): Promise<string | undefined> {
  try {
    const accountResponse = await createAccount(nessieCustomerId, {
      type: "Checking",
      nickname: "principal",
      rewards: 0,
      balance: 0,
    });

    return accountResponse?.objectCreated?._id;
  } catch (error) {
    console.error("No se pudo crear la cuenta principal en Nessie:", error);
    return undefined;
  }
}

export async function ensureStoredUserFinancialProfile(
  user: StoredUserRecord
): Promise<StoredUserRecord> {
  if (!user.nessieId || user.nessieAccountId) {
    return user;
  }

  const resolvedAccountId =
    (await findPrimaryAccountIdForCustomer(user.nessieId)) ??
    (await createDefaultAccountForCustomer(user.nessieId));

  if (!resolvedAccountId) {
    return user;
  }

  const updatedUser: StoredUserRecord = {
    ...user,
    nessieAccountId: resolvedAccountId,
    updatedAt: new Date().toISOString(),
  };

  if (USERS_TABLE) {
    await saveStoredUser(updatedUser);
  }

  return updatedUser;
}
