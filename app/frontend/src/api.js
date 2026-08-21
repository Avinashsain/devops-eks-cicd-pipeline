async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  let body = null;
  if (res.status !== 204) {
    body = await res.json().catch(() => null);
  }

  if (!res.ok) {
    const error = new Error(body?.error || `Request failed with status ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return body;
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  del: (path) => request(path, { method: 'DELETE' }),
};
