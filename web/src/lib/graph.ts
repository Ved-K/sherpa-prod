// src/lib/graph.ts
import { useMsal } from '@azure/msal-react';
import { graphScopes } from '../auth/msal';

/**
 * Hook that returns an authenticated Graph fetch wrapper.
 * Uses MSAL to silently acquire a token for Microsoft Graph.
 */
export function useGraph() {
  const { instance, accounts } = useMsal();

  async function getAccessToken(): Promise<string> {
    const account = accounts[0];
    if (!account) throw new Error('No signed-in account');

    const res = await instance.acquireTokenSilent({
      ...graphScopes,
      account,
    });

    return res.accessToken;
  }

  async function graphFetch<T = any>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const token = await getAccessToken();

    const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph error ${res.status}: ${text}`);
    }

    // Graph returns 204 No Content for deletes/patches sometimes
    if (res.status === 204) return null as T;

    return (await res.json()) as T;
  }

  return { graphFetch, getAccessToken };
}
