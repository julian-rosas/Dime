const API_BASE_URL = 'http://localhost:8082';

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

export { API_BASE_URL };
