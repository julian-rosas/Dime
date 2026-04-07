import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { login } from "../../services/auth";
import { parseJsonBody } from "../../http/request";
import { respond } from "../../http/response";

export async function handleLogin(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = parseJsonBody<{
      identifier?: string;
      password?: string;
    }>(event);

    const result = await login({
      identifier: body.identifier ?? "",
      password: body.password ?? "",
    });

    return respond(200, result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ocurrió un error procesando el login.";
    return respond(400, { error: message });
  }
}
