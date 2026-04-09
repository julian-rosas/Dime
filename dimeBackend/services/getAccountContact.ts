import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const CONTACTS_TABLE = process.env.USER_CONTACTS_TABLE!;
const USERS_TABLE = process.env.USERS_TABLE!;

export async function getContactAccountId(
  userId: string,
  nickname: string
): Promise<string> {
  try {
    const normalizedNickname = nickname.trim().toLowerCase();
    const contactsResult = await ddb.send(
      new QueryCommand({
        TableName: CONTACTS_TABLE,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: {
          ":uid": userId,
        },
      })
    );

    if (!contactsResult.Items || contactsResult.Items.length === 0) {
      return "";
    }

    const contact = contactsResult.Items.find((c: any) => {
      const nicknameMatch = c.nickname?.toLowerCase() === normalizedNickname;
      const aliasMatch = Array.isArray(c.aliasForMe)
        ? c.aliasForMe.some((alias: string) => alias?.toLowerCase() === normalizedNickname)
        : false;

      return nicknameMatch || aliasMatch;
    });

    if (!contact) {
      return "";
    }

    const otherUserId = contact.contactUserId;

    const userResult = await ddb.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId: otherUserId },
      })
    );

    if (!userResult.Item) {
      return "";
    }

    return userResult.Item.primaryAccountId ?? "";

  } catch (error) {
    console.error("Error getting contact accountId:", error);
    throw error;
  }
}
