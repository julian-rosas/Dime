import axios from "axios";
import { getApiKey } from "../nessiUtils";
import { Account } from "aws-sdk";

const API_KEY = getApiKey();
const BASE_URL = "http://api.reimaginebanking.com";

export async function getAllAccounts() {
  try {
    const res = await axios.get(`${BASE_URL}/accounts`, {
      params: { key: API_KEY },
    });
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

export async function getAccountById(id: string) {
  try {
    const res = await axios.get(`${BASE_URL}/accounts/${id}`, {
      params: { key: API_KEY },
    });
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

export async function updateAccount(id: string, newAccount: Account) {
  try {
    const res = await axios.put(
      `${BASE_URL}/accounts/${id}`,
      newAccount,
      { params: { key: API_KEY } }
    );
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

export async function deleteAccount(id: string, account: Account) {
  try {
    const res = await axios.delete(`${BASE_URL}/accounts/${id}`, {
      params: { key: API_KEY },
    });
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

export async function createAccount(customerId: string, account: any) {
  try {
    const response = await axios.post(
      `${BASE_URL}/customers/${customerId}/accounts`,
    account,
      { params: { key: API_KEY } }
    );
    return response.data;
  } catch (err: any) {
    throw err.response?.data || err.message
  }
}
