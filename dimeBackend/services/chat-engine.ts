import { parseIntent, generateConversationalResponse } from "./ai";
import { getSession, saveSession } from "./session";
import {
  executeTransfer,
  createSavingsGoal,
  depositToSavings,
  formatBalance,
  resolveContact,
  UserState,
} from "./finance";

export interface ProcessedChatMessage {
  reply: string;
  state: UserState;
}

export async function processUserMessage(
  sessionId: string,
  message: string,
  userId?: string
): Promise<ProcessedChatMessage> {
  const state = await getSession(sessionId);
  state.userId = userId ?? state.userId ?? sessionId;

  let reply: string;
  if (state.pendingOperation) {
    reply = await handlePendingConfirmation(message, state);
  } else {
    const intent = await parseIntent(message, state);
    console.log(`[${sessionId}] Intencion detectada:`, intent);
    reply = await handleIntent(intent, message, state);
  }

  await saveSession(sessionId, state);

  return { reply, state };
}

async function handlePendingConfirmation(
  message: string,
  state: UserState
): Promise<string> {
  const intent = await parseIntent(message, state);
  const op = state.pendingOperation!;

  if (intent.type === "confirm") {
    state.pendingOperation = null;

    if (op.type === "transfer" && op.amount && op.recipient) {
      const result = executeTransfer(state, op.amount, op.recipient);
      return result.message;
    }

    if (op.type === "savings_create" && op.savingsGoalName && op.amount) {
      const result = createSavingsGoal(state, op.savingsGoalName, op.amount);
      return result.message;
    }

    if (op.type === "savings_deposit" && op.savingsGoalId && op.amount) {
      const result = depositToSavings(state, op.savingsGoalId, op.amount);
      return result.message;
    }

    return "Operacion confirmada.";
  }

  if (intent.type === "cancel") {
    state.pendingOperation = null;
    return "Operacion cancelada. En que mas te puedo ayudar?";
  }

  return `${op.description}\n\nConfirmas? Escribe *si* para proceder o *no* para cancelar.`;
}

async function handleIntent(
  intent: Awaited<ReturnType<typeof parseIntent>>,
  originalMessage: string,
  state: UserState
): Promise<string> {
  switch (intent.type) {
    case "check_balance":
      return formatBalance(state);

    case "transfer": {
      if (!intent.amount || !intent.recipient) {
        return "Entendi que quieres transferir, pero necesito saber el monto y a quien. Ejemplo: *enviar 200 a Juan*";
      }

      const contact = resolveContact(intent.recipient, state.contacts);
      const recipientName = contact?.name ?? intent.recipient;

      if (!contact) {
        return `No tengo a "${intent.recipient}" en tus contactos. Quieres que lo agregue o lo escribiste diferente?`;
      }

      state.pendingOperation = {
        type: "transfer",
        amount: intent.amount,
        recipient: recipientName,
        description: `Vas a enviar *$${intent.amount.toFixed(2)} MXN* a *${recipientName}*.\n\nConfirmas? Escribe *si* o *no*.`,
      };

      return state.pendingOperation.description;
    }

    case "savings_create": {
      if (!intent.savingsGoalName && !intent.savingsTarget) {
        return "Para crear una cajita necesito el nombre y la meta. Ejemplo: *quiero ahorrar para vacaciones, meta 3000*";
      }

      if (intent.savingsGoalName && !intent.savingsTarget) {
        return `Ya entendi que quieres ahorrar para *${intent.savingsGoalName}*. Ahora dime cual es tu meta. Ejemplo: *meta 3000*`;
      }

      if (!intent.savingsGoalName && intent.savingsTarget) {
        return `Ya entendi la meta de *$${intent.savingsTarget.toFixed(2)} MXN*. Ahora dime como quieres llamar tu cajita.`;
      }

      state.pendingOperation = {
        type: "savings_create",
        savingsGoalName: intent.savingsGoalName,
        amount: intent.savingsTarget,
        description: `Vas a crear la cajita *"${intent.savingsGoalName}"* con meta de *$${intent.savingsTarget.toFixed(2)} MXN*.\n\nConfirmas? Escribe *si* o *no*.`,
      };

      return state.pendingOperation.description;
    }

    case "savings_deposit": {
      if (state.savings.length === 0) {
        return "Aun no tienes cajitas de ahorro. Quieres crear una? Ejemplo: *quiero ahorrar para un celular, meta 5000*";
      }

      if (!intent.amount || !intent.savingsGoalId) {
        if (state.savings.length === 1 && intent.amount) {
          const goal = state.savings[0];
          state.pendingOperation = {
            type: "savings_deposit",
            amount: intent.amount,
            savingsGoalId: goal.id,
            description: `Vas a guardar *$${intent.amount.toFixed(2)} MXN* en *"${goal.name}"*.\n\nConfirmas? Escribe *si* o *no*.`,
          };
          return state.pendingOperation.description;
        }

        const list = state.savings.map((g, i) => `${i + 1}. ${g.name}`).join("\n");
        return `A cual cajita quieres depositar?\n${list}\n\nEjemplo: *depositar 300 a vacaciones*`;
      }

      const goal = state.savings.find((g) => g.id === intent.savingsGoalId);
      if (!goal) {
        return "No encontre esa cajita. Escribe *mis ahorros* para ver tus cajitas.";
      }

      state.pendingOperation = {
        type: "savings_deposit",
        amount: intent.amount,
        savingsGoalId: goal.id,
        description: `Vas a guardar *$${intent.amount.toFixed(2)} MXN* en *"${goal.name}"*.\n\nConfirmas? Escribe *si* o *no*.`,
      };

      return state.pendingOperation.description;
    }

    case "savings_view":
      if (state.savings.length === 0) {
        return "Aun no tienes cajitas de ahorro.\n\nCrea una con: *quiero ahorrar para X, meta $Y*";
      }
      return formatBalance(state);

    case "help":
      return [
        "Hola, soy Dime. Puedo ayudarte con:",
        "",
        "Transferir dinero: \"enviar 500 a Juan\"",
        "Ver tu saldo: \"cuanto tengo?\"",
        "Crear una cajita: \"quiero ahorrar para vacaciones, meta 3000\"",
        "Depositar a cajita: \"guardar 200 en vacaciones\"",
        "Ver tus cajitas: \"mis ahorros\"",
        "",
        "Con que empezamos?",
      ].join("\n");

    case "unknown":
    default:
      try {
        return await generateConversationalResponse(
          `El usuario de una app de finanzas escribio: "${originalMessage}". No entendiste su intencion. Pidele que clarifique de forma amigable, menciona brevemente que puedes hacer (transferir, ver saldo, ahorrar).`,
          state
        );
      } catch {
        return "No entendi bien eso.\n\nPuedo ayudarte a *transferir dinero*, *ver tu saldo* o *administrar tus ahorros*.\n\nEscribe *ayuda* para ver mas opciones.";
      }
  }
}
