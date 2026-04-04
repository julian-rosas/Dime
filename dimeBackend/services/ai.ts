// services/ai.ts
// Llama a Claude para:
//  1. Clasificar la intención del mensaje del usuario
//  2. Generar respuestas en lenguaje natural

import Anthropic from "@anthropic-ai/sdk";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { UserState, Contact, SavingsGoal } from "./finance";

let anthropicClient: Anthropic | null = null;

// Lazy-load el cliente de Anthropic (cachea la API key)
async function getClient(): Promise<Anthropic> {
  if (anthropicClient) return anthropicClient;

  let apiKey = process.env.ANTHROPIC_API_KEY;

  // Si estamos en AWS, lee la key desde Secrets Manager
  if (!apiKey && process.env.ANTHROPIC_SECRET_ARN) {
    const sm = new SecretsManagerClient({});
    const secret = await sm.send(
      new GetSecretValueCommand({ SecretId: process.env.ANTHROPIC_SECRET_ARN })
    );
    apiKey = secret.SecretString;
  }

  if (!apiKey) {
    throw new Error("No se encontró ANTHROPIC_API_KEY ni ANTHROPIC_SECRET_ARN");
  }

  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

// ─── Tipos de intención que puede detectar el sistema ───────────────────────
export type IntentType =
  | "transfer"          // enviar dinero
  | "check_balance"     // ver saldo
  | "savings_create"    // crear cajita
  | "savings_deposit"   // depositar a cajita
  | "savings_view"      // ver cajitas
  | "confirm"           // confirmar una operación pendiente
  | "cancel"            // cancelar operación pendiente
  | "help"              // ayuda
  | "unknown";          // no se entendió

export interface ParsedIntent {
  type: IntentType;
  amount?: number;           // monto en pesos
  recipient?: string;        // nombre del destinatario
  savingsGoalName?: string;  // nombre de la cajita
  savingsTarget?: number;    // meta de la cajita
  savingsGoalId?: string;    // id de cajita existente
  confidence: "high" | "low";
}

// Construye el system prompt con el contexto del usuario
function buildSystemPrompt(state: UserState): string {
  const contactList = state.contacts.map((c) => `- ${c.name} (alias: ${c.alias.join(", ")})`).join("\n");
  const savingsList =
    state.savings.length > 0
      ? state.savings.map((g) => `- id=${g.id} nombre="${g.name}" meta=$${g.target} actual=$${g.current}`).join("\n")
      : "ninguna";

  return `Eres el asistente financiero de Dime, una app que ayuda a personas en México a manejar su dinero de forma simple y conversacional. Tu tono es amigable, claro y directo — como un amigo de confianza que sabe de finanzas.

ESTADO ACTUAL DEL USUARIO:
- Saldo: $${state.balance.toFixed(2)} MXN
- Contactos registrados:
${contactList}
- Cajitas de ahorro:
${savingsList}

TU TRABAJO:
Analiza el mensaje del usuario y responde SOLO con un JSON válido (sin texto extra, sin markdown, sin backticks).

INTENCIONES DISPONIBLES:
- "transfer": el usuario quiere enviar dinero. Extrae "amount" (número) y "recipient" (string con el nombre mencionado).
- "check_balance": quiere ver su saldo.
- "savings_create": quiere crear una cajita de ahorro. Extrae "savingsGoalName" y "savingsTarget" (número).
- "savings_deposit": quiere depositar a una cajita existente. Extrae "amount" y "savingsGoalId" (del id de la cajita en estado).
- "savings_view": quiere ver sus cajitas.
- "confirm": dice "sí", "confirma", "dale", "ok", "si", "claro", o cualquier afirmación.
- "cancel": dice "no", "cancela", "mejor no", o cualquier negación.
- "help": pide ayuda o no sabe qué hacer.
- "unknown": no se puede determinar la intención.

FORMATO DE RESPUESTA (siempre este JSON exacto):
{
  "type": "<intención>",
  "amount": <número o null>,
  "recipient": "<string o null>",
  "savingsGoalName": "<string o null>",
  "savingsTarget": <número o null>,
  "savingsGoalId": "<string o null>",
  "confidence": "high" o "low"
}

EJEMPLOS:
"enviar 500 a juan" → {"type":"transfer","amount":500,"recipient":"juan","savingsGoalName":null,"savingsTarget":null,"savingsGoalId":null,"confidence":"high"}
"manda 200 pesos a mi mamá" → {"type":"transfer","amount":200,"recipient":"mamá","savingsGoalName":null,"savingsTarget":null,"savingsGoalId":null,"confidence":"high"}
"cuánto tengo" → {"type":"check_balance","amount":null,"recipient":null,"savingsGoalName":null,"savingsTarget":null,"savingsGoalId":null,"confidence":"high"}
"quiero ahorrar para un celular, meta 5000" → {"type":"savings_create","amount":null,"recipient":null,"savingsGoalName":"celular","savingsTarget":5000,"savingsGoalId":null,"confidence":"high"}
"sí confirmo" → {"type":"confirm","amount":null,"recipient":null,"savingsGoalName":null,"savingsTarget":null,"savingsGoalId":null,"confidence":"high"}`;
}

// Genera una respuesta conversacional cuando hay que pedirle algo al usuario
export async function generateConversationalResponse(
  prompt: string,
  state: UserState
): Promise<string> {
  const client = await getClient();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001", // haiku es rápido y barato — ideal para hackathon
    max_tokens: 200,
    system: `Eres el asistente amigable de Dime, una app financiera para México. Responde de forma muy breve, clara y en español mexicano casual. Máximo 2 oraciones. Sin emojis excesivos.`,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

// Parsea la intención del mensaje del usuario
export async function parseIntent(
  message: string,
  state: UserState
): Promise<ParsedIntent> {
  const client = await getClient();

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: buildSystemPrompt(state),
      messages: [{ role: "user", content: message }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Limpia posibles backticks que el modelo agregue a pesar del prompt
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as ParsedIntent;
    return parsed;
  } catch (err) {
    console.error("Error parseando intención:", err);
    // Fallback robusto con reglas simples
    return fallbackParse(message);
  }
}

// Reglas hardcodeadas de respaldo para cuando la API falla o es lenta
function fallbackParse(message: string): ParsedIntent {
  const lower = message.toLowerCase();

  if (/\b(sí|si|confirmo|dale|ok|claro|va|sale)\b/.test(lower)) {
    return { type: "confirm", confidence: "high" };
  }
  if (/\b(no|cancela|cancelar|mejor no)\b/.test(lower)) {
    return { type: "cancel", confidence: "high" };
  }

  // Detecta transferencia: "envía/manda/transfiere X a Y"
  const transferMatch = lower.match(
    /(?:env[íi]a?|manda?|transfiere?|deposita?)\s+\$?([\d,]+(?:\.\d{1,2})?)\s+(?:pesos?\s+)?(?:a|para)\s+(\w+)/
  );
  if (transferMatch) {
    return {
      type: "transfer",
      amount: parseFloat(transferMatch[1].replace(",", "")),
      recipient: transferMatch[2],
      confidence: "high",
    };
  }

  if (/\b(saldo|cuánto|cuanto|tengo|dinero)\b/.test(lower)) {
    return { type: "check_balance", confidence: "high" };
  }

  return { type: "unknown", confidence: "low" };
}
