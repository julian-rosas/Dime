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
