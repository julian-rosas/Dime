import { randomBytes } from "crypto";
import {
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";
import { createCustomer } from "../nessi/service/customerService";
import { Customer } from "../nessi/models/customer";
import { createAccount } from "../nessi/service/accountService";
import { Account } from "../nessi/models/account";

const cognito = new CognitoIdentityProviderClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const USERS_TABLE = process.env.USERS_TABLE ?? "";
const AUTH_SESSIONS_TABLE = process.env.AUTH_SESSIONS_TABLE ?? "";
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? "";
const APP_CLIENT_ID = process.env.COGNITO_APP_CLIENT_ID ?? "";

interface UserRecord {
  userId: string;
  nessieId?: string;
  primaryAccountId?: string;
  cognitoUsername: string;
  email?: string;
  phone?: string;
  phoneVerified?: boolean;
  displayName: string;
  preferredLanguage: string;
  balanceAvailable: number;
  createdAt: string;
  updatedAt: string;
}

interface AuthSessionRecord {
  sessionId: string;
  userId: string;
  cognitoUsername: string;
  authMethod: "cognito_jwt";
  tokenType: string;
  createdAt: string;
  expiresAt: string;
  ttl: number;
}

interface CognitoClaims {
  sub?: string;
  email?: string;
  phone_number?: string;
  name?: string;
  "cognito:username"?: string;
  exp?: number;
  token_use?: string;
}

export interface SignupInput {
  email?: string;
  phone?: string;
  password: string;
  displayName?: string;
  firstName: string;
  lastName: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

function requireEnv(value: string, name: string): string {
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}.`);
  }

  return value;
}

function normalizeEmail(value?: string): string | undefined {
  const email = value?.trim().toLowerCase();
  return email ? email : undefined;
}

function normalizePhone(value?: string): string | undefined {
  const phone = value?.trim();
  return phone ? phone : undefined;
}

function getUsername(email?: string, phone?: string): string {
  const username = email ?? phone;
  if (!username) {
    throw new Error("Debes enviar email o phone.");
  }

  return username;
}

function validatePassword(password?: string): string {
  const normalized = password?.trim();
  if (!normalized || normalized.length < 8) {
    throw new Error("La contrasena debe tener al menos 8 caracteres.");
  }

  return normalized;
}

function decodeIdToken(idToken: string): CognitoClaims {
  const claims = jwt.decode(idToken);
  if (!claims || typeof claims !== "object") {
    throw new Error("No se pudo decodificar el idToken de Cognito.");
  }

  return claims as CognitoClaims;
}

function sanitizeUser(user: UserRecord) {
  return {
    userId: user.userId,
    email: user.email ?? null,
    phone: user.phone ?? null,
    phoneVerified: user.phoneVerified ?? false,
    displayName: user.displayName,
    preferredLanguage: user.preferredLanguage,
    balanceAvailable: user.balanceAvailable,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function saveUser(user: UserRecord): Promise<void> {
  if (!USERS_TABLE) {
    return;
  }

  await ddb.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: user,
    })
  );
}

async function saveAuthSession(session: AuthSessionRecord): Promise<void> {
  if (!AUTH_SESSIONS_TABLE) {
    return;
  }

  await ddb.send(
    new PutCommand({
      TableName: AUTH_SESSIONS_TABLE,
      Item: session,
    })
  );
}

async function buildUserRecordFromClaimsSignup(
  claims: CognitoClaims,
  firstName: string,
  lastName: string,
  fallbackDisplayName?: string
): Promise<UserRecord> {
  const now = new Date().toISOString();
  const userId = claims.sub;
  const cognitoUsername = claims["cognito:username"];

  if (!userId || !cognitoUsername) {
    throw new Error("El token de Cognito no contiene la identidad esperada.");
  }

  const customer: Customer = {
    first_name: firstName,
    last_name: lastName,
    address : {
      "street_number": "98",
      "street_name": "saturno",
      "city": "chalco",
      "state": "IN",
      "zip": "99999"
    }
  } 

  const nessieCustomer = await createCustomer(customer);
  const nessieCustomerId = nessieCustomer.objectCreated._id;

  const initialAccount: Account = {
    type:  "Savings",
    nickname: "libreton-basico",
    rewards: 0,
    balance: 0
  };

  const nessieAccount = await createAccount(nessieCustomerId, initialAccount);
  const primaryAccountId = nessieAccount?.objectCreated?._id;
  
  return {
    userId,
    nessieId: nessieCustomerId,
    primaryAccountId,
    cognitoUsername,
    email: normalizeEmail(claims.email),
    phone: normalizePhone(claims.phone_number),
    phoneVerified: false,
    displayName: claims.name?.trim() || fallbackDisplayName || "Usuario Dime",
    preferredLanguage: "es-MX",
    balanceAvailable: 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function buildUserRecordFromClaimsLogin(
  claims: CognitoClaims,
  fallbackDisplayName?: string
): Promise<UserRecord> {
  const now = new Date().toISOString();
  const userId = claims.sub;
  const cognitoUsername = claims["cognito:username"];

  if (!userId || !cognitoUsername) {
    throw new Error("El token de Cognito no contiene la identidad esperada.");
  }
  
  return {
    userId,
    cognitoUsername,
    email: normalizeEmail(claims.email),
    phone: normalizePhone(claims.phone_number),
    phoneVerified: false,
    displayName: claims.name?.trim() || fallbackDisplayName || "Usuario Dime",
    preferredLanguage: "es-MX",
    balanceAvailable: 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function createLocalSession(
  claims: CognitoClaims
): Promise<{ sessionId: string; expiresAt: string }> {
  const sessionId = `auth_${randomBytes(16).toString("hex")}`;
  const createdAt = new Date().toISOString();
  const exp = claims.exp;

  if (!exp) {
    throw new Error("El token de Cognito no contiene expiracion.");
  }

  const expiresAt = new Date(exp * 1000).toISOString();

  await saveAuthSession({
    sessionId,
    userId: claims.sub ?? "",
    cognitoUsername: claims["cognito:username"] ?? "",
    authMethod: "cognito_jwt",
    tokenType: claims.token_use ?? "id",
    createdAt,
    expiresAt,
    ttl: exp,
  });

  return {
    sessionId,
    expiresAt,
  };
}

async function authenticateWithCognito(username: string, password: string) {
  const response = await cognito.send(
    new AdminInitiateAuthCommand({
      UserPoolId: requireEnv(USER_POOL_ID, "COGNITO_USER_POOL_ID"),
      ClientId: requireEnv(APP_CLIENT_ID, "COGNITO_APP_CLIENT_ID"),
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    })
  );

  const auth = response.AuthenticationResult;
  if (!auth?.IdToken || !auth.AccessToken) {
    throw new Error("Cognito no regreso tokens de autenticacion.");
  }

  return auth;
}

function mapCognitoError(error: unknown): never {
  const name = error instanceof Error ? error.name : "";

  switch (name) {
    case "UsernameExistsException":
      throw new Error("Ya existe un usuario con ese email o telefono.");
    case "InvalidPasswordException":
      throw new Error("La contrasena no cumple con la politica de Cognito.");
    case "UserNotFoundException":
    case "NotAuthorizedException":
      throw new Error("Credenciales invalidas.");
    case "CodeMismatchException":
    case "ExpiredCodeException":
      throw new Error("No se pudo confirmar el usuario.");
    default:
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Ocurrio un error procesando la autenticacion.");
  }
}

async function finalizeAuthResponseSignup(
  authResult: Awaited<ReturnType<typeof authenticateWithCognito>>,
  firstName: string,
  lastName: string,
  fallbackDisplayName?: string
) {
  const claims = decodeIdToken(authResult.IdToken!);
  const user = await buildUserRecordFromClaimsSignup(claims, firstName, lastName, fallbackDisplayName);
  const session = await createLocalSession(claims);

  await saveUser(user);

  return {
    user: sanitizeUser(user),
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
    token: authResult.IdToken,
    idToken: authResult.IdToken,
    accessToken: authResult.AccessToken,
    refreshToken: authResult.RefreshToken ?? null,
    tokenType: authResult.TokenType ?? "Bearer",
  };
}

async function finalizeAuthResponseLogin(
  authResult: Awaited<ReturnType<typeof authenticateWithCognito>>,
  fallbackDisplayName?: string
) {
  const claims = decodeIdToken(authResult.IdToken!);
  const user = await buildUserRecordFromClaimsLogin(claims, fallbackDisplayName);
  const session = await createLocalSession(claims);

  return {
    user: sanitizeUser(user),
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
    token: authResult.IdToken,
    idToken: authResult.IdToken,
    accessToken: authResult.AccessToken,
    refreshToken: authResult.RefreshToken ?? null,
    tokenType: authResult.TokenType ?? "Bearer",
  };
}

export async function signup(input: SignupInput) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const firstName = input.firstName;
  const lastName = input.lastName;
  const password = validatePassword(input.password);
  const displayName = input.displayName?.trim() || "Usuario Dime";
  const username = getUsername(email, phone);

  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: requireEnv(USER_POOL_ID, "COGNITO_USER_POOL_ID"),
        Username: username,
        UserAttributes: [
          ...(email ? [{ Name: "email", Value: email }] : []),
          ...(phone ? [{ Name: "phone_number", Value: phone }] : []),
          ...(email ? [{ Name: "email_verified", Value: "true" }] : []),
          ...(phone ? [{ Name: "phone_number_verified", Value: "true" }] : []),
          { Name: "name", Value: displayName },
        ],
        MessageAction: "SUPPRESS",
      })
    );

    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: requireEnv(USER_POOL_ID, "COGNITO_USER_POOL_ID"),
        Username: username,
        Password: password,
        Permanent: true,
      })
    );

    const authResult = await authenticateWithCognito(username, password);
    return finalizeAuthResponseSignup(authResult, firstName, lastName, displayName);
  } catch (error) {
    console.error("Error en signup:", error);
    mapCognitoError(error);
  }
}

export async function login(input: LoginInput) {
  const identifier = input.identifier?.trim();
  const password = validatePassword(input.password);

  if (!identifier) {
    throw new Error("Se requieren identifier y password.");
  }

  try {
    const authResult = await authenticateWithCognito(identifier, password);
    return finalizeAuthResponseLogin(authResult);
  } catch (error) {
    console.error("Error en login:", error);
    mapCognitoError(error);
  }
}
