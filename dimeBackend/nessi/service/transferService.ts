import axios from "axios";

const API_KEY = "b0f85320c5b6ffb169bdbcaa572e4b68";
const BASE_URL = "http://api.reimaginebanking.com";

export async function getAllAccountTransfers(id: number) {
  try {
    const response = await axios.get(
      `${BASE_URL}/accounts/${id}/transfers`,
      { params: { key: API_KEY } }
    );

    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
}

export async function getTransferById(transferId: string) {
  try {
    const response = await axios.get(
      `${BASE_URL}/transfers/${transferId}`,
      { params: { key: API_KEY } }
    );

    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
}

export async function createAccountTransfer(
  fromId: number,
  toId: number,
  amount: number,
  description: string = "Transfer"
) {
  try {
    const newTransfer = {
      medium: "balance",
      payee_id: toId,
      amount: amount,
      transaction_date: new Date().toISOString().split("T")[0],
      description: description,
    };

    const response = await axios.post(
      `${BASE_URL}/accounts/${fromId}/transfers`,
      newTransfer,
      {
        params: { key: API_KEY },
        headers: { "Content-Type": "application/json" },
      }
    );

    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
}
