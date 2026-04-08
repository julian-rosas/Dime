import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { requireAuthenticatedUserId } from "../../http/request";
import { respond } from "../../http/response";
import { listConversations } from "../../services/conversations";

export async function handleListConversations(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = requireAuthenticatedUserId(event);
    const conversations = await listConversations(userId);
    return respond(200, { conversations });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Ocurrio un error obteniendo las conversaciones.";
    return respond(400, { error: message });
  }
}
