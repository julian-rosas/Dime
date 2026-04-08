import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getPathParam, requireAuthenticatedUserId } from "../../http/request";
import { respond } from "../../http/response";
import { deleteContact } from "../../services/contacts";

export async function handleDeleteContact(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = requireAuthenticatedUserId(event);
    const contactUserId = getPathParam(event, "contactUserId") ?? "";
    const result = await deleteContact(userId, contactUserId);
    return respond(200, result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ocurrió un error eliminando el contacto.";
    return respond(400, { error: message });
  }
}
