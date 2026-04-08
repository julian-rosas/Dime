import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parseJsonBody, requireAuthenticatedUserId } from "../../http/request";
import { respond } from "../../http/response";
import { createConversation } from "../../services/conversations";

export async function handleCreateConversation(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = requireAuthenticatedUserId(event);
    const body = parseJsonBody<{
      title?: string;
      agentMode?: string;
    }>(event);

    const conversation = await createConversation(userId, {
      title: body.title,
      agentMode: body.agentMode,
    });

    return respond(201, conversation);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ocurrio un error creando la conversacion.";
    return respond(400, { error: message });
  }
}
