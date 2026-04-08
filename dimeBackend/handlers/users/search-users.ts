import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getQueryParam, requireAuthenticatedUserId } from "../../http/request";
import { respond } from "../../http/response";
import { searchUsers } from "../../services/contacts";

export async function handleSearchUsers(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const currentUserId = requireAuthenticatedUserId(event);
    const users = await searchUsers({
      currentUserId,
      email: getQueryParam(event, "email"),
      phone: getQueryParam(event, "phone"),
      displayName: getQueryParam(event, "displayName"),
    });

    return respond(200, { users });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "OcurriÃ³ un error buscando usuarios.";
    return respond(400, { error: message });
  }
}
