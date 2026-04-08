import axios from "axios";
import { getApiKey } from "../nessiUtils";

const API_KEY = getApiKey();
const BASE_URL = "http://api.reimaginebanking.com";

let service: any = {};

service.getAllAccountDeposits = getAllAccountDeposits;
service.createAccountDeposit = createAccountDeposit;

module.exports = service;

async function getAllAccountDeposits(id: number) {
  try {
    const res = await axios.get(`${BASE_URL}/accounts/${id}/deposits`, {
      params: { key: API_KEY },
    });
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

async function createAccountDeposit(id: number, newDeposit: any) {
  try {
    const res = await axios.post(
      `${BASE_URL}/accounts/${id}/deposits`,
      newDeposit,
      { params: { key: API_KEY } }
    );
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

