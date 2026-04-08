import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getPathParam, requireAuthenticatedUserId } from "../../http/request";
import { respond } from "../../http/response";
import { archiveConversation } from "../../services/conversations";

export async function handleDeleteConversation(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = requireAuthenticatedUserId(event);
    const conversationId = getPathParam(event, "conversationId") ?? "";
    const result = await archiveConversation(userId, conversationId);
    return respond(200, result);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Ocurrio un error archivando la conversacion.";
    return respond(400, { error: message });
  }
}
