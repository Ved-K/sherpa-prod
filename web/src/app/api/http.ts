// src/app/api/http.ts
type JsonInit = Omit<RequestInit, 'body'> & { body?: any };

const RAW_BASE = (import.meta as any).env?.VITE_API_BASE_URL as
  | string
  | undefined;
const BASES = RAW_BASE ? [RAW_BASE.replace(/\/$/, '')] : ['', '/api']; // supports both "/lines" and "/api/lines"

function join(base: string, path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}

async function readError(res: Response): Promise<string> {
  try {
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const j = await res.json();
      return j?.message ?? j?.error ?? JSON.stringify(j);
    }
    const t = await res.text();
    return t?.trim() || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function looksLikeFrontendHtml(res: Response) {
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('text/html');
}

export async function apiJson<T>(
  path: string,
  init: JsonInit = {},
): Promise<T> {
  const { body, headers, ...rest } = init;

  let lastErr = 'Request failed';
  for (const base of BASES) {
    const url = join(base, path);

    try {
      const res = await fetch(url, {
        ...rest,
        credentials: 'include', // <-- IMPORTANT for cookie/session auth
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(headers ?? {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      // If we accidentally hit the frontend (index.html), try next base
      if (res.ok && looksLikeFrontendHtml(res)) {
        lastErr = 'Hit frontend HTML instead of API';
        continue;
      }

      if (!res.ok) {
        lastErr = await readError(res);
        continue;
      }

      // Some endpoints may return 204 No Content
      if (res.status === 204) return undefined as unknown as T;

      return (await res.json()) as T;
    } catch (e: any) {
      lastErr = e?.message ?? lastErr;
    }
  }

  throw new Error(lastErr);
}
