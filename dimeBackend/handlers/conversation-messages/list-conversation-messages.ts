import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getPathParam, requireAuthenticatedUserId } from "../../http/request";
import { respond } from "../../http/response";
import { listConversationMessages } from "../../services/conversation-messages";

export async function handleListConversationMessages(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = requireAuthenticatedUserId(event);
    const conversationId = getPathParam(event, "conversationId") ?? "";
    const messages = await listConversationMessages(userId, conversationId);
    return respond(200, { messages });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Ocurrio un error obteniendo los mensajes de la conversacion.";
    return respond(400, { error: message });
  }
}
