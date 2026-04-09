import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { signup } from "../../services/auth";
import { parseJsonBody } from "../../http/request";
import { respond } from "../../http/response";

export async function handleSignup(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = parseJsonBody<{
      email?: string;
      phone?: string;
      password?: string;
      displayName?: string;
      firstName?: string;
      lastName?: string;
    }>(event);

    const result = await signup({
      email: body.email,
      phone: body.phone,
      password: body.password ?? "",
      displayName: body.displayName,
      firstName: body.firstName ?? "",
      lastName: body.lastName ?? "",
    });

    return respond(201, result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ocurrió un error procesando el registro.";
    return respond(400, { error: message });
  }
}
