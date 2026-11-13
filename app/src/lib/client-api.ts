"use client";

/** Appel JSON vers les routes de l'app ; lève une Error avec le message français du serveur. */
export async function apiJson<T = Record<string, unknown>>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error ?? `Erreur ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (method !== "GET") window.dispatchEvent(new Event("content-changed"));
  return json as T;
}

export const isConflict = (e: unknown) => (e as { status?: number })?.status === 409;
