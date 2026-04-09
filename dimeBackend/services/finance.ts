import {
  createAccount,
  getAccountByCustomerId,
} from "../nessi/service/accountService";
import { createAccountTransfer } from "../nessi/service/transferService";
import { mapAccountToUserState } from "./nessieFinanceMapper";
import {
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const USERS_TABLE = process.env.USERS_TABLE ?? "";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

/* ===================== MODELS ===================== */

export interface Contact {
  name: string;
  alias: string[];
  phone?: string;
  contactUserId?: string;
  primaryAccountId?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  createdAt: string;
  accountId?: string;
}

export interface UserState {
  userId: string;
  nessieId: string;
  accounts: any[];
  contacts: Contact[];
  savings: SavingsGoal[];
  pendingOperation?: PendingOperation | null;
}

export interface PendingOperation {
  type: "transfer" | "savings_deposit" | "savings_create";
  amount?: number;
  recipient?: string;
  recipientName?: string;
  savingsGoalId?: string;
  savingsGoalName?: string;
  description: string;
}

export interface FinancialResult {
  success: boolean;
  message: string;
  newBalance?: number;
  updatedGoal?: SavingsGoal;
}

/* ===================== INITIAL STATE ===================== */

export async function createInitialState(userId: string) : Promise<UserState> {
  try {
    const result = await ddb.send(
      new GetCommand({ TableName: USERS_TABLE, Key: { userId } })
    );

    if (result.Item) {
      const userAccounts = await getAccountByCustomerId(
        result.Item.nessieId
      );

      return mapAccountToUserState(
        userAccounts,
        userId,
        result.Item.nessieId
      );
    }

    return mapAccountToUserState(
      [],
      userId,
      ""
    );
    
  } catch (err) {
    console.error("Error leyendo sesión de DynamoDB:", err);
    return mapAccountToUserState(
      [],
      userId,
      ""
    )
  }
}

/* ===================== HELPERS ===================== */

function getMainAccount(state: UserState) {
  const account = state.accounts.find(
    (acc: any) => acc.nickname === "libreton-basico"
  );

  if (!account) {
    throw new Error("No se encontró la cuenta libreton-basico");
  }

  return account;
}

async function refreshAccounts(state: UserState) {
  const accounts = await getAccountByCustomerId(state.nessieId);
  state.accounts = accounts;
}

/* ===================== CONTACTS ===================== */

export function resolveContact(
  name: string,
  contacts: Contact[]
): Contact | null {
  const normalized = name.toLowerCase().trim();

  return (
    contacts.find(
      (c) =>
        c.name.toLowerCase().includes(normalized) ||
        c.alias.includes(normalized)
    ) ?? null
  );
}

/* ===================== TRANSFERS ===================== */

export async function executeTransfer(
  state: UserState,
  amount: number,
  recipientAccountId: string,
  recipientName: string
): Promise<FinancialResult> {
  if (amount <= 0) {
    return { success: false, message: "El monto debe ser mayor a cero." };
  }

  try {
    const mainAccount = getMainAccount(state);

    if (amount > mainAccount.balance) {
      return {
        success: false,
        message: `No tienes saldo suficiente. Tu saldo es $${mainAccount.balance.toFixed(
          2
        )} MXN.`,
      };
    }

    await createAccountTransfer(
      mainAccount._id,
      recipientAccountId,
      amount
    );

    await refreshAccounts(state);

    const updatedMain = getMainAccount(state);
    const newBalance = mainAccount.balance - amount;

    return {
      success: true,
      message: `✅ Transferiste $${amount.toFixed(
        2
      )} MXN a ${recipientName}. Tu nuevo saldo es $${newBalance.toFixed(
        2
      )} MXN.`,
      newBalance: newBalance,
    };
  } catch (error: any) {
    return {
      success: false,
      message: "❌ Ocurrió un error al transferir",
    };
  }
}

/* ===================== SAVINGS ===================== */

export async function createSavingsGoal(
  state: UserState,
  name: string,
  target: number
): Promise<FinancialResult> {
  if (target <= 0) {
    return {
      success: false,
      message: "La meta debe ser mayor a cero.",
    };
  }

  try {
    const response = await createAccount(state.nessieId, {
      type: "Savings",
      nickname: name,
      rewards: 0,
      balance: 0,
    });

    const accountId = response.objectCreated?._id;

    const goal: SavingsGoal = {
      id: `goal_${Date.now()}`,
      name,
      target,
      current: 0,
      createdAt: new Date().toISOString(),
      accountId,
    };

    state.savings.push(goal);

    await refreshAccounts(state);

    return {
      success: true,
      message: `🎯 Creé tu cajita "${name}" con meta de $${target.toFixed(
        2
      )} MXN.`,
      updatedGoal: goal,
    };
  } catch (error: any) {
    return {
      success: false,
      message: "❌ Error al crear la cajita",
    };
  }
}

export async function depositToSavings(
  state: UserState,
  goalId: string,
  amount: number
): Promise<FinancialResult> {
  const goal = state.savings.find((g) => g.id === goalId);

  if (!goal) {
    return { success: false, message: "No encontré esa cajita." };
  }

  if (!goal.accountId) {
    return {
      success: false,
      message: "La cajita no tiene cuenta asociada.",
    };
  }

  if (amount <= 0) {
    return {
      success: false,
      message: "El monto debe ser mayor a cero.",
    };
  }

  try {
    const mainAccount = getMainAccount(state);

    if (amount > mainAccount.balance) {
      return {
        success: false,
        message: `No tienes saldo suficiente. Tu saldo es $${mainAccount.balance.toFixed(
          2
        )} MXN.`,
      };
    }

    await createAccountTransfer(
      mainAccount._id,
      goal.accountId,
      amount,
      `Ahorro: ${goal.name}`
    );

    await refreshAccounts(state);

    goal.current += amount;

    const percent = Math.min(
      100,
      Math.round((goal.current / goal.target) * 100)
    );

    return {
      success: true,
      message: `💰 Guardaste $${amount.toFixed(
        2
      )} MXN en "${goal.name}" (${percent}%).`,
      newBalance: getMainAccount(state).balance,
      updatedGoal: goal,
    };
  } catch (error: any) {
    return {
      success: false,
      message: "❌ Error al depositar",
    };
  }
}

/* ===================== UI ===================== */

function buildProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

export function formatBalance(state: UserState): string {
  const mainAccount = getMainAccount(state);

  let msg = `💳 Tu saldo: $${mainAccount.balance.toFixed(2)} MXN\n`;

  if (state.savings.length > 0) {
    msg += "\n📦 Tus cajitas:\n";

    for (const g of state.savings) {
      const percent = Math.min(
        100,
        Math.round((g.current / g.target) * 100)
      );

      msg += `• ${g.name}: $${g.current.toFixed(
        2
      )} / $${g.target.toFixed(2)} (${percent}%)\n`;
    }
  }

  return msg.trim();
}
