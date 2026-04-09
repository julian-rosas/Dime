import axios from "axios";
import { getApiKey } from "../nessiUtils";

const BASE_URL = "http://api.nessieisreal.com";

export async function getAllAccountDeposits(id: string) {
  try {
    const apiKey = await getApiKey();
    const res = await axios.get(`${BASE_URL}/accounts/${id}/deposits`, {
      params: { key: apiKey },
    });
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

export async function createAccountDeposit(id: string, newDeposit: any) {
  try {
    const apiKey = await getApiKey();
    const res = await axios.post(
      `${BASE_URL}/accounts/${id}/deposits`,
      newDeposit,
      { params: { key: apiKey } }
    );
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

