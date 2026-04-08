import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { requireAuthenticatedUserId } from "../../http/request";
import { respond } from "../../http/response";
import { listContacts } from "../../services/contacts";

export async function handleListContacts(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = requireAuthenticatedUserId(event);
    const contacts = await listContacts(userId);
    return respond(200, { contacts });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ocurrió un error obteniendo los contactos.";
    return respond(400, { error: message });
  }
}
