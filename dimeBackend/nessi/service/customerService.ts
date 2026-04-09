import axios from "axios";
import { getApiKey } from "../nessiUtils";
import { Customer } from "../models/customer";
import { Address } from "../models/address";

const BASE_URL = "http://api.nessieisreal.com";


export async function getAllCustomers() {
  try {
    const apiKey = await getApiKey();
    const res = await axios.get(`${BASE_URL}/customers`, {
      params: { key: apiKey },
    });
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

export async function getCustomerById(id: string) {
  try {
    const apiKey = await getApiKey();
    const res = await axios.get(`${BASE_URL}/customers/${id}`, {
      params: { key: apiKey },
    });
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

export async function getCustomerByAccountId(accountId: string) {
  try {
    const apiKey = await getApiKey();
    const res = await axios.get(
      `${BASE_URL}/accounts/${accountId}/customer`,
      { params: { key: apiKey } }
    );
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

export async function createCustomer(newCustomer: Customer) { 
  try {
    const apiKey = await getApiKey();
    const res = await axios.post(
      `${BASE_URL}/customers`,
      newCustomer,
      { params: { key: apiKey } }
    );
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}

export async function updateCustomer(id: string, updatedCustomer: Address) {
  try {
    const apiKey = await getApiKey();
    const res = await axios.put(
      `${BASE_URL}/customers/${id}`,
      updatedCustomer,
      { params: { key: apiKey } }
    );
    return res.data;
  } catch (err: any) {
    throw err.response?.data || err.message;
  }
}
