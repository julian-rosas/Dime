import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getAccountById, getAllAccounts } from "../nessi/service/accountService";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const USERS_TABLE = process.env.USERS_TABLE ?? "";

interface UserRecord {
  userId: string;
  nessieId?: string;
  primaryAccountId?: string;
  balanceAvailable?: number;
}

interface NessieAccount {
  _id?: string;
  balance?: number;
  type?: string;
  nickname?: string;
  customer_id?: string;
}

function requireUsersTable(): string {
  if (!USERS_TABLE) {
    throw new Error("La tabla de usuarios no esta configurada.");
  }

  return USERS_TABLE;
}

async function getUserRecord(userId: string): Promise<UserRecord> {
  const result = await ddb.send(
    new GetCommand({
      TableName: requireUsersTable(),
      Key: { userId },
    })
  );

  const user = result.Item as UserRecord | undefined;
  if (!user) {
    throw new Error("No se encontro el usuario autenticado.");
  }

  return user;
}

async function resolvePrimaryAccount(user: UserRecord): Promise<NessieAccount> {
  if (user.primaryAccountId) {
    return (await getAccountById(user.primaryAccountId)) as NessieAccount;
  }

  if (!user.nessieId) {
    throw new Error("El usuario no tiene una cuenta bancaria vinculada.");
  }

  const accounts = (await getAllAccounts()) as NessieAccount[];
  const account = accounts.find((item) => item.customer_id === user.nessieId);

  if (!account?._id) {
    throw new Error("No se encontro una cuenta principal en Nessie para este usuario.");
  }

  return account;
}

export async function getWallet(userId: string) {
  const user = await getUserRecord(userId);
  const account = await resolvePrimaryAccount(user);

  return {
    currency: "MXN",
    availableBalance: Number(account.balance ?? user.balanceAvailable ?? 0),
    accountId: account._id ?? user.primaryAccountId ?? null,
    accountType: account.type ?? null,
    accountNickname: account.nickname ?? null,
  };
}
