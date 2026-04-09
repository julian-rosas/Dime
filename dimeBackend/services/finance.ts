import { createAccount, getAccountById } from "../nessi/service/accountService";
import { createAccountTransfer } from "../nessi/service/transferService";

export interface Contact {
  name: string;
  alias: string[];
  phone?: string;
  accountId?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  createdAt: string;
}

export interface UserState {
  userId: string;
  accountId: string;
  balance: number;
  contacts: Contact[];
  savings: SavingsGoal[];
  pendingOperation?: PendingOperation | null;
}

export interface PendingOperation {
  type: "transfer" | "savings_deposit" | "savings_create";
  amount?: number;
  recipient?: string;
  recipientAccountId?: string;
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

export function createInitialState(seedId: string): UserState {
  return {
    userId: seedId,
    accountId: "",
    balance: 1500,
    contacts: [
      { name: "Juan Garcia", alias: ["juan", "juancho"] },
      { name: "Maria Lopez", alias: ["maria", "mary", "mama"] },
      { name: "Carlos Perez", alias: ["carlos", "carlitos"] },
    ],
    savings: [],
    pendingOperation: null,
  };
}

export function resolveContact(name: string, contacts: Contact[]): Contact | null {
  const normalized = name.toLowerCase().trim();
  return (
    contacts.find(
      (contact) =>
        contact.name.toLowerCase().includes(normalized) ||
        contact.alias.some((alias) => alias === normalized)
    ) ?? null
  );
}

export async function executeTransfer(
  state: UserState,
  amount: number,
  recipientName: string,
  recipientAccountId?: string
): Promise<FinancialResult> {
  if (amount <= 0) {
    return { success: false, message: "El monto debe ser mayor a cero." };
  }

  if (amount > state.balance) {
    return {
      success: false,
      message: `No tienes saldo suficiente. Tu saldo es $${state.balance.toFixed(2)} MXN.`,
    };
  }

  if (!state.accountId) {
    return {
      success: false,
      message: "No pude identificar tu cuenta principal para transferir.",
    };
  }

  if (!recipientAccountId) {
    return {
      success: false,
      message: `No pude identificar la cuenta de ${recipientName}. Vuelve a registrar ese contacto.`,
    };
  }

  try {
    await createAccountTransfer(state.accountId, recipientAccountId, amount);
    state.balance -= amount;

    return {
      success: true,
      message: `Transferiste $${amount.toFixed(2)} MXN a ${recipientName}. Tu nuevo saldo es $${state.balance.toFixed(2)} MXN.`,
      newBalance: state.balance,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Ocurrio un error al transferir: ${error?.message || error}`,
    };
  }
}

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
    const accountResponse = await createAccount(state.userId, {
      type: "Savings",
      nickname: name,
      rewards: 0,
      balance: 0,
    });

    const goal: SavingsGoal = {
      id: accountResponse.objectCreated?._id,
      name,
      target,
      current: 0,
      createdAt: new Date().toISOString(),
    };

    state.savings.push(goal);

    return {
      success: true,
      message: `Cree tu cajita "${name}" con meta de $${target.toFixed(2)} MXN.`,
      updatedGoal: goal,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error al crear la cajita: ${error?.message || error}`,
    };
  }
}

export async function depositToSavings(
  state: UserState,
  goalId: string,
  amount: number
): Promise<FinancialResult> {
  let goal: any;

  try {
    goal = await getAccountById(goalId);
  } catch {
    return { success: false, message: "No encontre esa cajita de ahorro." };
  }

  if (amount <= 0) {
    return {
      success: false,
      message: "El monto debe ser mayor a cero.",
    };
  }

  if (amount > state.balance) {
    return {
      success: false,
      message: `No tienes saldo suficiente. Tu saldo es $${state.balance.toFixed(2)} MXN.`,
    };
  }

  if (!state.accountId) {
    return {
      success: false,
      message: "No pude identificar tu cuenta principal para ahorrar.",
    };
  }

  try {
    await createAccountTransfer(
      state.accountId,
      goal._id ?? goal.accountId,
      amount,
      `Ahorro: ${goal.nickname ?? goal.name ?? "cajita"}`
    );

    state.balance -= amount;

    const updatedGoal = state.savings.find((saving) => saving.id === goalId);
    if (updatedGoal) {
      updatedGoal.current += amount;
    }

    const current = updatedGoal?.current ?? amount;
    const target = updatedGoal?.target ?? goal.target ?? amount;
    const percent = Math.min(100, Math.round((current / target) * 100));
    const progressBar = buildProgressBar(percent);

    return {
      success: true,
      message: `Guardaste $${amount.toFixed(2)} MXN en "${updatedGoal?.name ?? goal.nickname ?? goal.name}".\n${progressBar} ${percent}% de tu meta.\nSaldo restante: $${state.balance.toFixed(2)} MXN.`,
      newBalance: state.balance,
      updatedGoal,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error al depositar: ${error?.message || error}`,
    };
  }
}

function buildProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  return "#".repeat(filled) + "-".repeat(10 - filled);
}

export function formatBalance(state: UserState): string {
  let message = `Tu saldo: $${state.balance.toFixed(2)} MXN\n`;
  if (state.savings.length > 0) {
    message += "\nTus cajitas:\n";
    for (const goal of state.savings) {
      const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
      message += `• ${goal.name}: $${goal.current.toFixed(2)} / $${goal.target.toFixed(2)} (${percent}%)\n`;
    }
  }
  return message.trim();
}
