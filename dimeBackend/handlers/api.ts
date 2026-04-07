import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { routeRequest } from "./router";
import { respond } from "../http/response";

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (event.httpMethod === "OPTIONS") {
    return respond(200, {});
  }

  return routeRequest(event);
}
