// src/app/api/client.ts
const API_BASE = '/api';

function actor() {
  return (
    localStorage.getItem('tmicc_actor') ||
    localStorage.getItem('userEmail') ||
    localStorage.getItem('displayName') ||
    'anonymous'
  );
}

type ApiInit = Omit<RequestInit, 'body'> & {
  body?: any; // allow object bodies
};

function isPlainObject(x: any) {
  return (
    x != null &&
    typeof x === 'object' &&
    !(x instanceof FormData) &&
    !(x instanceof Blob) &&
    !(x instanceof ArrayBuffer)
  );
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers = new Headers(init.headers || {});
  headers.set('x-actor', actor());

  const originalBody = init.body;

  let body: BodyInit | undefined;

  if (originalBody === undefined || originalBody === null) {
    body = undefined;
  } else if (typeof originalBody === 'string') {
    body = originalBody;
  } else if (originalBody instanceof FormData) {
    body = originalBody; // browser sets boundary
  } else if (originalBody instanceof Blob) {
    body = originalBody;
  } else if (originalBody instanceof ArrayBuffer) {
    body = originalBody;
  } else if (isPlainObject(originalBody) || Array.isArray(originalBody)) {
    body = JSON.stringify(originalBody);
    if (!headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json');
  } else {
    body = JSON.stringify(originalBody);
    if (!headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...init, headers, body });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;

  if (!res.ok) {
    try {
      const j = JSON.parse(text);
      throw new Error(
        j?.message || j?.error || `Request failed (${res.status})`,
      );
    } catch {
      throw new Error(`Request failed (${res.status}). ${text.slice(0, 200)}`);
    }
  }

  return JSON.parse(text) as T;
}
