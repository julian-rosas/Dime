// handlers/message.ts
// Handler principal de la Lambda.
// Recibe: POST /message { sessionId: string, message: string }
// Devuelve: { reply: string, state: UserState }

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parseIntent, generateConversationalResponse } from "../services/ai";
import { getSession, saveSession } from "../services/session";
import {
  executeTransfer,
  createSavingsGoal,
  depositToSavings,
  formatBalance,
  resolveContact,
  UserState,
} from "../services/finance";

// Headers CORS — necesarios para que el frontend React pueda llamar al API
const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function respond(statusCode: number, body: object): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Maneja preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return respond(200, {});
  }

  let sessionId: string;
  let message: string;

  try {
    const body = JSON.parse(event.body ?? "{}");
    sessionId = body.sessionId?.trim();
    message = body.message?.trim();

    if (!sessionId || !message) {
      return respond(400, { error: "Se requieren sessionId y message." });
    }
  } catch {
    return respond(400, { error: "JSON inválido en el cuerpo de la petición." });
  }

  console.log(`[${sessionId}] Mensaje: "${message}"`);

  // 1. Carga el estado de la sesión del usuario
  const state = await getSession(sessionId);

  let reply: string;

  // 2. ¿Hay una operación pendiente de confirmación?
  if (state.pendingOperation) {
    reply = await handlePendingConfirmation(message, state);
  } else {
    // 3. Parsea la intención con Claude
    const intent = await parseIntent(message, state);
    console.log(`[${sessionId}] Intención detectada:`, intent);
    reply = await handleIntent(intent, message, state);
  }

  // 4. Guarda el estado actualizado
  await saveSession(sessionId, state);

  console.log(`[${sessionId}] Respuesta: "${reply}"`);

  return respond(200, { reply, state });
};

// ─── Maneja la confirmación o cancelación de una operación pendiente ─────────
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

    return "Operación confirmada ✅";
  }

  if (intent.type === "cancel") {
    state.pendingOperation = null;
    return "Operación cancelada. ¿En qué más te puedo ayudar?";
  }

  // No entendió confirm/cancel — recuérdale
  return `${op.description}\n\n¿Confirmas? Escribe *sí* para proceder o *no* para cancelar.`;
}

// ─── Maneja una intención nueva ──────────────────────────────────────────────
async function handleIntent(
  intent: ReturnType<typeof parseIntent> extends Promise<infer T> ? T : never,
  originalMessage: string,
  state: UserState
): Promise<string> {
  switch (intent.type) {
    // ── Ver saldo ──────────────────────────────────────────────────────────
    case "check_balance":
      return formatBalance(state);

    // ── Transferencia ──────────────────────────────────────────────────────
    case "transfer": {
      if (!intent.amount || !intent.recipient) {
        return "Entendí que quieres transferir, pero necesito saber el monto y a quién. Ejemplo: *enviar 200 a Juan*";
      }

      const contact = resolveContact(intent.recipient, state.contacts);
      const recipientName = contact?.name ?? intent.recipient;

      if (!contact) {
        return `No tengo a "${intent.recipient}" en tus contactos. ¿Quieres que lo agregue o lo escribiste diferente?`;
      }

      // Guarda operación pendiente y pide confirmación
      state.pendingOperation = {
        type: "transfer",
        amount: intent.amount,
        recipient: recipientName,
        description: `💸 Vas a enviar *$${intent.amount.toFixed(2)} MXN* a *${recipientName}*.\n\n¿Confirmas? Escribe *sí* o *no*.`,
      };

      return state.pendingOperation.description;
    }

    // ── Crear cajita ───────────────────────────────────────────────────────
    case "savings_create": {
      if (!intent.savingsGoalName || !intent.savingsTarget) {
        return "Para crear una cajita necesito el nombre y la meta. Ejemplo: *quiero ahorrar para vacaciones, meta 3000*";
      }

      state.pendingOperation = {
        type: "savings_create",
        savingsGoalName: intent.savingsGoalName,
        amount: intent.savingsTarget,
        description: `🎯 Vas a crear la cajita *"${intent.savingsGoalName}"* con meta de *$${intent.savingsTarget.toFixed(2)} MXN*.\n\n¿Confirmas? Escribe *sí* o *no*.`,
      };

      return state.pendingOperation.description;
    }

    // ── Depositar a cajita ─────────────────────────────────────────────────
    case "savings_deposit": {
      if (state.savings.length === 0) {
        return "Aún no tienes cajitas de ahorro. ¿Quieres crear una? Ejemplo: *quiero ahorrar para un celular, meta 5000*";
      }

      if (!intent.amount || !intent.savingsGoalId) {
        // Si solo hay una cajita, úsala automáticamente
        if (state.savings.length === 1 && intent.amount) {
          const goal = state.savings[0];
          state.pendingOperation = {
            type: "savings_deposit",
            amount: intent.amount,
            savingsGoalId: goal.id,
            description: `💰 Vas a guardar *$${intent.amount.toFixed(2)} MXN* en *"${goal.name}"*.\n\n¿Confirmas? Escribe *sí* o *no*.`,
          };
          return state.pendingOperation.description;
        }

        const list = state.savings.map((g, i) => `${i + 1}. ${g.name}`).join("\n");
        return `¿A cuál cajita quieres depositar?\n${list}\n\nEjemplo: *depositar 300 a vacaciones*`;
      }

      const goal = state.savings.find((g) => g.id === intent.savingsGoalId);
      if (!goal) {
        return "No encontré esa cajita. Escribe *mis ahorros* para ver tus cajitas.";
      }

      state.pendingOperation = {
        type: "savings_deposit",
        amount: intent.amount,
        savingsGoalId: goal.id,
        description: `💰 Vas a guardar *$${intent.amount.toFixed(2)} MXN* en *"${goal.name}"*.\n\n¿Confirmas? Escribe *sí* o *no*.`,
      };

      return state.pendingOperation.description;
    }

    // ── Ver cajitas ────────────────────────────────────────────────────────
    case "savings_view":
      if (state.savings.length === 0) {
        return "Aún no tienes cajitas de ahorro. 🐷\n\nCrea una con: *quiero ahorrar para X, meta $Y*";
      }
      return formatBalance(state);

    // ── Ayuda ──────────────────────────────────────────────────────────────
    case "help":
      return [
        "Hola, soy Dime 👋 Puedo ayudarte con:",
        "",
        "💸 *Transferir dinero*: \"enviar 500 a Juan\"",
        "💳 *Ver tu saldo*: \"¿cuánto tengo?\"",
        "🎯 *Crear una cajita*: \"quiero ahorrar para vacaciones, meta 3000\"",
        "💰 *Depositar a cajita*: \"guardar 200 en vacaciones\"",
        "📦 *Ver tus cajitas*: \"mis ahorros\"",
        "",
        "¿Con qué empezamos?",
      ].join("\n");

    // ── No se entendió ─────────────────────────────────────────────────────
    case "unknown":
    default: {
      // Usa Claude para generar una respuesta conversacional de fallback
      try {
        const fallback = await generateConversationalResponse(
          `El usuario de una app de finanzas escribió: "${originalMessage}". No entendiste su intención. Pídele que clarifique de forma amigable, menciona brevemente qué puedes hacer (transferir, ver saldo, ahorrar).`,
          state
        );
        return fallback;
      } catch {
        return `No entendí bien eso 😅\n\nPuedo ayudarte a *transferir dinero*, *ver tu saldo* o *administrar tus ahorros*.\n\nEscribe *ayuda* para ver más opciones.`;
      }
    }
  }
}
