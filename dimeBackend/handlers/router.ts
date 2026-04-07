import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getRouteKey } from "../http/request";
import { respond } from "../http/response";
import { handleLogin } from "./auth/login";
import { handleSignup } from "./auth/signup";
import { handlePostMessage } from "./chat/post-message";

type RouteHandler = (
  event: APIGatewayProxyEvent
) => Promise<APIGatewayProxyResult>;

const routes = new Map<string, RouteHandler>([
  ["POST /auth/signup", handleSignup],
  ["POST /auth/login", handleLogin],
  ["POST /message", handlePostMessage],
]);

export async function routeRequest(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const routeKey = getRouteKey(event);
  const handler = routes.get(routeKey);

  if (!handler) {
    return respond(404, { error: `Ruta no encontrada: ${routeKey}` });
  }

  return handler(event);
}
