import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getPathParam, requireAuthenticatedUserId } from "../../http/request";
import { respond } from "../../http/response";
import { getContact } from "../../services/contacts";

export async function handleGetContact(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = requireAuthenticatedUserId(event);
    const contactUserId = getPathParam(event, "contactUserId") ?? "";
    const contact = await getContact(userId, contactUserId);
    return respond(200, contact);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ocurrió un error leyendo el contacto.";
    return respond(400, { error: message });
  }
}
