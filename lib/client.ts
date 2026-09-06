"use client";

// Thin client for the /api/v1 surface. Adds request IDs and surfaces the error envelope.

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public fieldErrors?: Record<string, string> | null
  ) {
    super(message);
  }
}

function uuid() {
  return crypto.randomUUID();
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; idempotencyKey?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = { "X-Request-ID": uuid() };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const res = await fetch(`/api/v1${path}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json.error ?? {};
    throw new ApiClientError(
      err.code ?? "ERROR",
      err.message ?? "Something went wrong.",
      res.status,
      err.field_errors
    );
  }
  return json.data as T;
}

export function newIdempotencyKey() {
  return uuid();
}
