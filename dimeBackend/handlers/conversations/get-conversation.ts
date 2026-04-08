import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getPathParam, requireAuthenticatedUserId } from "../../http/request";
import { respond } from "../../http/response";
import { getConversation } from "../../services/conversations";

export async function handleGetConversation(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = requireAuthenticatedUserId(event);
    const conversationId = getPathParam(event, "conversationId") ?? "";
    const conversation = await getConversation(userId, conversationId);
    return respond(200, conversation);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Ocurrio un error obteniendo la conversacion.";
    return respond(400, { error: message });
  }
}
