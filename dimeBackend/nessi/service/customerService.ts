import axios from "axios";
import { getApiKey } from "../nessiUtils";
import { Customer } from "../models/customer";
import { Address } from "../models/address";

const API_KEY = getApiKey();
const BASE_URL = "http://api.reimaginebanking.com";


export async function getAllCustomers() {
  try {
    const res = await axios.get(`${BASE_URL}/customers`, {
      params: { key: API_KEY },
    });
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

export async function getCustomerById(id: string) {
  try {
    const res = await axios.get(`${BASE_URL}/customers/${id}`, {
      params: { key: API_KEY },
    });
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

export async function getCustomerByAccountId(accountId: string) {
  try {
    const res = await axios.get(
      `${BASE_URL}/accounts/${accountId}/customer`,
      { params: { key: API_KEY } }
    );
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

export async function createCustomer(newCustomer: Customer) { 
  try {
    const res = await axios.post(
      `${BASE_URL}/customers`,
      newCustomer,
      { params: { key: API_KEY } }
    );
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

export async function updateCustomer(id: string, updatedCustomer: Address) {
  try {
    const res = await axios.put(
      `${BASE_URL}/customers/${id}`,
      updatedCustomer,
      { params: { key: API_KEY } }
    );
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}
