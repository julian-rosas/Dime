import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parseJsonBody, requireAuthenticatedUserId } from "../../http/request";
import { respond } from "../../http/response";
import { createContact } from "../../services/contacts";

export async function handleCreateContact(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = requireAuthenticatedUserId(event);
    const body = parseJsonBody<{
      contactUserId?: string;
      nickname?: string;
      aliasForMe?: string[];
      isFavorite?: boolean;
    }>(event);

    const contact = await createContact(userId, {
      contactUserId: body.contactUserId ?? "",
      nickname: body.nickname,
      aliasForMe: body.aliasForMe,
      isFavorite: body.isFavorite,
    });

    return respond(201, contact);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ocurrió un error creando el contacto.";
    return respond(400, { error: message });
  }
}
