import AWS from "aws-sdk";

const secretsManager = new AWS.SecretsManager();

export async function getApiKey() {
  const data = await secretsManager.getSecretValue({
    SecretId: process.env.NESSIE_SECRET_ARN!,
  }).promise();

  const secret = JSON.parse(data.SecretString!);
  return secret.nessieApiKey;
}
