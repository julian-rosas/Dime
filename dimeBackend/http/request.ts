import { APIGatewayProxyEvent } from "aws-lambda";

export function getRouteKey(event: APIGatewayProxyEvent): string {
  return `${event.httpMethod} ${event.resource ?? event.path}`;
}

export function parseJsonBody<T>(event: APIGatewayProxyEvent): T {
  try {
    return JSON.parse(event.body ?? "{}") as T;
  } catch {
    throw new Error("JSON inválido en el cuerpo de la petición.");
  }
}

export function getPathParam(
  event: APIGatewayProxyEvent,
  name: string
): string | undefined {
  const value = event.pathParameters?.[name]?.trim();
  return value ? value : undefined;
}

export function getQueryParam(
  event: APIGatewayProxyEvent,
  name: string
): string | undefined {
  const value = event.queryStringParameters?.[name]?.trim();
  return value ? value : undefined;
}

export function requireAuthenticatedUserId(event: APIGatewayProxyEvent): string {
  const userId = event.requestContext.authorizer?.userId;

  if (!userId || typeof userId !== "string") {
    throw new Error("No se pudo resolver el usuario autenticado.");
  }

  return userId;
}
