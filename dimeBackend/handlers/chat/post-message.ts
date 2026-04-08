import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parseJsonBody } from "../../http/request";
import { respond } from "../../http/response";
import { processUserMessage } from "../../services/chat-engine";

export async function handlePostMessage(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  let sessionId: string;
  let message: string;

  try {
    const body = parseJsonBody<{ sessionId?: string; message?: string }>(event);
    sessionId = body.sessionId?.trim() ?? "";
    message = body.message?.trim() ?? "";

    if (!sessionId || !message) {
      return respond(400, { error: "Se requieren sessionId y message." });
    }
  } catch (err) {
    const error =
      err instanceof Error ? err.message : "JSON invalido en el cuerpo de la peticion.";
    return respond(400, { error });
  }

  console.log(`[${sessionId}] Mensaje: "${message}"`);

  const { reply, state } = await processUserMessage(sessionId, message);

  console.log(`[${sessionId}] Respuesta: "${reply}"`);

  return respond(200, { reply, state });
}
