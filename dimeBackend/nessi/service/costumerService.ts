import axios from "axios";

const API_KEY = "b0f85320c5b6ffb169bdbcaa572e4b68";
const BASE_URL = "http://api.reimaginebanking.com";

let service: any = {};

service.getAllAccounts = getAllAccounts;
service.getAccountById = getAccountById;
service.updateAccount = updateAccount;
service.deleteAccount = deleteAccount;

module.exports = service;

async function getAllAccounts() {
  try {
    const res = await axios.get(`${BASE_URL}/accounts`, {
      params: { key: API_KEY },
    });
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

async function getAccountById(id: number) {
  try {
    const res = await axios.get(`${BASE_URL}/accounts/${id}`, {
      params: { key: API_KEY },
    });
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

async function updateAccount(id: number, newAccount: any) {
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

async function deleteAccount(id: number) {
  try {
    const res = await axios.delete(`${BASE_URL}/accounts/${id}`, {
      params: { key: API_KEY },
    });
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

