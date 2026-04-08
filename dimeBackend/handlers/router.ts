import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getRouteKey } from "../http/request";
import { respond } from "../http/response";
import { handleLogin } from "./auth/login";
import { handleSignup } from "./auth/signup";
import { handlePostMessage } from "./chat/post-message";
import { handleCreateConversation } from "./conversations/create-conversation";
import { handleDeleteConversation } from "./conversations/delete-conversation";
import { handleGetConversation } from "./conversations/get-conversation";
import { handleListConversations } from "./conversations/list-conversations";
import { handleUpdateConversation } from "./conversations/update-conversation";
import { handleCreateContact } from "./contacts/create-contact";
import { handleDeleteContact } from "./contacts/delete-contact";
import { handleGetContact } from "./contacts/get-contact";
import { handleListContacts } from "./contacts/list-contacts";
import { handleUpdateContact } from "./contacts/update-contact";
import { handleSearchUsers } from "./users/search-users";

type RouteHandler = (
  event: APIGatewayProxyEvent
) => Promise<APIGatewayProxyResult>;

const routes = new Map<string, RouteHandler>([
  ["POST /auth/signup", handleSignup],
  ["POST /auth/login", handleLogin],
  ["POST /message", handlePostMessage],
  ["GET /me/conversations", handleListConversations],
  ["POST /me/conversations", handleCreateConversation],
  ["GET /me/conversations/{conversationId}", handleGetConversation],
  ["PATCH /me/conversations/{conversationId}", handleUpdateConversation],
  ["DELETE /me/conversations/{conversationId}", handleDeleteConversation],
  ["GET /me/contacts", handleListContacts],
  ["POST /me/contacts", handleCreateContact],
  ["GET /me/contacts/{contactUserId}", handleGetContact],
  ["PATCH /me/contacts/{contactUserId}", handleUpdateContact],
  ["DELETE /me/contacts/{contactUserId}", handleDeleteContact],
  ["GET /users/search", handleSearchUsers],
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
