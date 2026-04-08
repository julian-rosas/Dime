import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  getPathParam,
  parseJsonBody,
  requireAuthenticatedUserId,
} from "../../http/request";
import { respond } from "../../http/response";
import { updateContact } from "../../services/contacts";

export async function handleUpdateContact(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = requireAuthenticatedUserId(event);
    const contactUserId = getPathParam(event, "contactUserId") ?? "";
    const body = parseJsonBody<{
      nickname?: string | null;
      aliasForMe?: string[] | null;
      isFavorite?: boolean;
    }>(event);

    const contact = await updateContact(userId, contactUserId, body);
    return respond(200, contact);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ocurrió un error actualizando el contacto.";
    return respond(400, { error: message });
  }
}
