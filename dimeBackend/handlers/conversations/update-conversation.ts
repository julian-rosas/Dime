import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  getPathParam,
  parseJsonBody,
  requireAuthenticatedUserId,
} from "../../http/request";
import { respond } from "../../http/response";
import { updateConversation } from "../../services/conversations";

export async function handleUpdateConversation(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = requireAuthenticatedUserId(event);
    const conversationId = getPathParam(event, "conversationId") ?? "";
    const body = parseJsonBody<{
      title?: string | null;
      status?: string;
      agentMode?: string | null;
      lastMessagePreview?: string | null;
      linkedPendingOperation?: Record<string, unknown> | null;
    }>(event);

    const conversation = await updateConversation(userId, conversationId, body);
    return respond(200, conversation);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Ocurrio un error actualizando la conversacion.";
    return respond(400, { error: message });
  }
}
