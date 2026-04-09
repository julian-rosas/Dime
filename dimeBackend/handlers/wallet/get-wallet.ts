import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { requireAuthenticatedUserId } from "../../http/request";
import { respond } from "../../http/response";
import { getWallet } from "../../services/wallet";

export async function handleGetWallet(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = requireAuthenticatedUserId(event);
    const wallet = await getWallet(userId);
    return respond(200, wallet);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ocurrio un error obteniendo la wallet.";
    return respond(400, { error: message });
  }
}
