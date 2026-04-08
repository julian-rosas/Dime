import jwt, {
  Algorithm,
  JwtHeader,
  JwtPayload,
  SigningKeyCallback,
} from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const LOGGER = console;

const UNAUTHORIZED_RESPONSE = {
  policyDocument: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "*",
        Resource: ["*"],
        Effect: "Deny",
      },
    ],
  },
};

const BASE_ISSUER_URL = `https://cognito-idp.${process.env.API_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`;
const JWKS_URL = `${BASE_ISSUER_URL}/.well-known/jwks.json`;

const VALID_TOKEN_USE = ["id"];

function buildAuthorizedResponse(decodedToken: JwtPayload) {
  return {
    principalId:
      decodedToken.sub ??
      decodedToken["cognito:username"]?.toString() ??
      "authenticated-user",
    context: {
      userId: decodedToken.sub?.toString() ?? "",
      cognitoUsername:
        decodedToken["cognito:username"]?.toString() ?? "",
      email: decodedToken.email?.toString() ?? "",
    },
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Resource: [
            `arn:aws:execute-api:${process.env.API_REGION}:${process.env.ACCOUNT_ID}:${process.env.API_ID}*`,
          ],
          Effect: "Allow",
        },
      ],
    },
  };
}

function validToken(token: any, audience: string): boolean {
  const expiryTime = token.exp;
  if (!expiryTime) {
    LOGGER.error("Token does not contain 'exp' key");
    return false;
  }

  if (Math.floor(Date.now() / 1000) > expiryTime) {
    LOGGER.error("Token has expired");
    return false;
  }

  const aud = token.aud;
  if (!aud) {
    LOGGER.error("Missing 'aud' key in token");
    return false;
  }

  if (aud !== audience) {
    LOGGER.error(`Audience client ${aud} does not match`);
    return false;
  }

  const iss = token.iss;
  if (!iss) {
    LOGGER.error("Missing 'iss' key in token");
    return false;
  }

  if (iss !== BASE_ISSUER_URL) {
    LOGGER.error(`Issuer URL ${iss} did not match`);
    return false;
  }

  const tokenUse = token.token_use;
  if (!tokenUse) {
    LOGGER.error("token_use missing from token");
    return false;
  }

  if (!VALID_TOKEN_USE.includes(tokenUse)) {
    LOGGER.error(`token_use ${tokenUse} is not a valid option`);
    return false;
  }

  LOGGER.info("Decoded token is verified to be valid");
  return true;
}

const client = jwksClient({
  jwksUri: JWKS_URL,
});

function getKey(header: JwtHeader, callback: SigningKeyCallback) {
  if (!header.kid) {
    callback(new Error("No kid found in token header"));
    return;
  }

  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err, undefined);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export const handler = async (event: any, context: any) => {

  const authToken = event.authorizationToken;
  if (!authToken) {
    LOGGER.error("No authorizationToken passed in");
    return UNAUTHORIZED_RESPONSE;
  }

  const tokenString = authToken.replace("Bearer ", "");
  if (!tokenString) {
    LOGGER.error("empty token provided");
    return UNAUTHORIZED_RESPONSE;
  }

  LOGGER.info("Attempting to extract headers from the token string");

  let decodedHeader: JwtHeader;
  try {
    decodedHeader = jwt.decode(tokenString, { complete: true })?.header as JwtHeader;
  } catch (err) {
    LOGGER.error(`Unable to extract headers: ${err}`);
    return UNAUTHORIZED_RESPONSE;
  }

  if (!decodedHeader) {
    LOGGER.error("Invalid token header");
    return UNAUTHORIZED_RESPONSE;
  }

  const algorithm = decodedHeader.alg;
  if (!algorithm) {
    LOGGER.error("Token header did not contain the alg key");
    return UNAUTHORIZED_RESPONSE;
  }

  const audienceClient = process.env.COGNITO_APP_CLIENT_ID as string;

  LOGGER.info(`Trying to decode the token string for client: ${audienceClient}`);

  try {
    const decodedToken: any = await new Promise((resolve, reject) => {
      jwt.verify(
        tokenString,
        getKey,
        {
          algorithms: [algorithm as Algorithm],
          audience: audienceClient,
        },
        (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded);
        }
      );
    });

    if (!validToken(decodedToken, audienceClient)) {
      return UNAUTHORIZED_RESPONSE;
    }

    return buildAuthorizedResponse(decodedToken);
  } catch (err: any) {
    LOGGER.error(`Token verification failed: ${err.message}`);
    return UNAUTHORIZED_RESPONSE;
  }
};
