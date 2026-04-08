import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  getPathParam,
  parseJsonBody,
  requireAuthenticatedUserId,
} from "../../http/request";
import { respond } from "../../http/response";
import { createConversationMessage } from "../../services/conversation-messages";

export async function handleCreateConversationMessage(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = requireAuthenticatedUserId(event);
    const conversationId = getPathParam(event, "conversationId") ?? "";
    const body = parseJsonBody<{ message?: string }>(event);

    const result = await createConversationMessage(
      userId,
      conversationId,
      body.message ?? ""
    );

    return respond(201, result);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Ocurrio un error enviando el mensaje de la conversacion.";
    return respond(400, { error: message });
  }
}
