// services/finance.ts
// Motor financiero mock — guarda el estado en DynamoDB por sesión.
// En producción, esto se conectaría a una fintech/banco real.

import { createAccount, getAccountById } from "../nessi/service/accountService";
import { createAccountTransfer } from "../nessi/service/transferService";
import { mapAccountToUserState } from "./nessieFinanceMapper";

export interface Contact {
  name: string;
  alias: string[]; // nombres que el usuario puede usar para referirse a este contacto
  phone?: string;
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
  savingsGoalId?: string;
  savingsGoalName?: string;
  description: string; // descripción humana para mostrar en confirmación
}

export interface FinancialResult {
  success: boolean;
  message: string;
  newBalance?: number;
  updatedGoal?: SavingsGoal;
}

// Estado inicial para un usuario nuevo (mock)
export function createInitialState(accountId: string): UserState {
  return mapAccountToUserState(accountId);
}

// Resuelve un nombre a un contacto conocido
export function resolveContact(name: string, contacts: Contact[]): Contact | null {
  const normalized = name.toLowerCase().trim();
  return (
    contacts.find(
      (c) =>
        c.name.toLowerCase().includes(normalized) ||
        c.alias.some((a) => a === normalized)
    ) ?? null
  );
}

// Ejecuta una transferencia
export async function executeTransfer(
  state: UserState,
  amount: number,
  recipientName: string
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

  try {
    // 2. Call API
    await createAccountTransfer(
      state.userId,   // ⚠️ make sure this is accountId, not customerId
      recipientName,
      amount
    );

    // 3. Update local state ONLY if API succeeds
    state.balance -= amount;

    return {
      success: true,
      message: `✅ Transferiste $${amount.toFixed(2)} MXN a ${recipientName}. Tu nuevo saldo es $${state.balance.toFixed(2)} MXN.`,
      newBalance: state.balance,
    };

  } catch (error: any) {
    return {
      success: false,
      message: `❌ Ocurrio un error al transferir`,
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
    // 1. Create account in API
    const newAccountPayload = {
      type: "Credit Card", // ⚠️ you may want "Savings"
      nickname: name,
      rewards: 0,
      balance: 0
    };

    const accountResponse = await createAccount(
      state.userId, // ⚠️ must be customer_id
      newAccountPayload
    );

    const goal: SavingsGoal = {
      id:accountResponse.objectCreated?._id ,
      name,
      target,
      current: 0,
      createdAt: new Date().toISOString()
    };

    state.savings.push(goal);

    return {
      success: true,
      message: `🎯 Creé tu cajita "${name}" con meta de $${target.toFixed(2)} MXN.`,
      updatedGoal: goal,
    };

  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error al crear la cajita: ${error?.message || error}`,
    };
  }
}


// Deposita a una cajita de ahorro
export async function depositToSavings(
  state: UserState,
  goalId: string,
  amount: number
): Promise<FinancialResult> {
  
  var goal: any;

  try {
    goal = getAccountById(goalId);
  } catch (err: any){
    return { success: false, message: "No encontré esa cajita de ahorro." };
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

  try {
    await createAccountTransfer(
      state.accountId,    
      goal.accountId,     
      amount,
      `Ahorro: ${goal.name}`
    );

    state.balance -= amount;
    goal.current += amount;

    const percent = Math.min(
      100,
      Math.round((goal.current / goal.target) * 100)
    );

    const progressBar = buildProgressBar(percent);

    return {
      success: true,
      message: `💰 Guardaste $${amount.toFixed(2)} MXN en "${goal.name}".\n${progressBar} ${percent}% de tu meta.\nSaldo restante: $${state.balance.toFixed(2)} MXN.`,
      newBalance: state.balance,
      updatedGoal: goal,
    };

  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error al depositar: ${error?.message || error}`,
    };
  }
}


function buildProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

// Formatea el estado completo para mostrárselo al usuario
export function formatBalance(state: UserState): string {
  let msg = `💳 Tu saldo: $${state.balance.toFixed(2)} MXN\n`;
  if (state.savings.length > 0) {
    msg += "\n📦 Tus cajitas:\n";
    for (const g of state.savings) {
      const percent = Math.min(100, Math.round((g.current / g.target) * 100));
      msg += `• ${g.name}: $${g.current.toFixed(2)} / $${g.target.toFixed(2)} (${percent}%)\n`;
    }
  }
  return msg.trim();
}
