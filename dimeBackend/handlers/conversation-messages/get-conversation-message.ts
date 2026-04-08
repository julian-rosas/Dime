import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getPathParam, requireAuthenticatedUserId } from "../../http/request";
import { respond } from "../../http/response";
import { getConversationMessage } from "../../services/conversation-messages";

export async function handleGetConversationMessage(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = requireAuthenticatedUserId(event);
    const conversationId = getPathParam(event, "conversationId") ?? "";
    const messageId = getPathParam(event, "messageId") ?? "";
    const message = await getConversationMessage(userId, conversationId, messageId);
    return respond(200, message);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Ocurrio un error obteniendo el mensaje de la conversacion.";
    return respond(400, { error: message });
  }
}
