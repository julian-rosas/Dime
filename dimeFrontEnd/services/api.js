const API_BASE_URL = 'https://tkh20sglm5.execute-api.us-east-1.amazonaws.com/prod';

function buildUrl(path, queryParams) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);

  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

async function request(path, options = {}) {
  const {
    token,
    headers,
    body,
    query,
    ...rest
  } = options;

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'No se pudo completar la solicitud.');
  }

  return payload;
}

export function signup(body) {
  return request('/auth/signup', {
    method: 'POST',
    body,
  });
}

export function login(body) {
  return request('/auth/login', {
    method: 'POST',
    body,
  });
}

export function listConversations(token) {
  return request('/me/conversations', {
    method: 'GET',
    token,
  });
}

export function createConversation(token, body = {}) {
  return request('/me/conversations', {
    method: 'POST',
    token,
    body,
  });
}

export function updateConversation(token, conversationId, body) {
  return request(`/me/conversations/${conversationId}`, {
    method: 'PATCH',
    token,
    body,
  });
}

export function archiveConversation(token, conversationId) {
  return request(`/me/conversations/${conversationId}`, {
    method: 'DELETE',
    token,
  });
}

export function listConversationMessages(token, conversationId) {
  return request(`/me/conversations/${conversationId}/messages`, {
    method: 'GET',
    token,
  });
}

export function createConversationMessage(token, conversationId, body) {
  return request(`/me/conversations/${conversationId}/messages`, {
    method: 'POST',
    token,
    body,
  });
}

export function listContacts(token) {
  return request('/me/contacts', {
    method: 'GET',
    token,
  });
}

export function getWallet(token) {
  return request('/me/wallet', {
    method: 'GET',
    token,
  });
}

export function searchUsers(token, query) {
  return request('/users/search', {
    method: 'GET',
    token,
    query,
  });
}

export function createContact(token, body) {
  return request('/me/contacts', {
    method: 'POST',
    token,
    body,
  });
}

export { API_BASE_URL };
