import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

// Standard response envelope: {data, meta} / {error, meta}.

export function ok(data: unknown, requestId: string, extraMeta: Record<string, unknown> = {}) {
  return NextResponse.json({ data, meta: { request_id: requestId, ...extraMeta } });
}

export function fail(
  code: string,
  message: string,
  status: number,
  requestId: string,
  opts: { field_errors?: Record<string, string>; retryable?: boolean; retry_after?: number } = {}
) {
  const res = NextResponse.json(
    {
      error: {
        code,
        message,
        field_errors: opts.field_errors ?? null,
        retryable: opts.retryable ?? false,
      },
      meta: { request_id: requestId },
    },
    { status }
  );
  if (opts.retry_after) res.headers.set("Retry-After", String(opts.retry_after));
  return res;
}

export function requestId(req: NextRequest): string {
  return req.headers.get("x-request-id") || randomUUID();
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public fieldErrors?: Record<string, string>
  ) {
    super(message);
  }
}

// Wrap a handler with uniform error translation.
export function handler(
  fn: (req: NextRequest, ctx: { rid: string; params: Record<string, string> }) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    const rid = requestId(req);
    try {
      const params = context?.params ? await context.params : {};
      return await fn(req, { rid, params });
    } catch (e) {
      if (e instanceof ApiError) {
        return fail(e.code, e.message, e.status, rid, { field_errors: e.fieldErrors });
      }
      console.error("Unhandled API error", e);
      return fail("INTERNAL", "Something went wrong.", 500, rid, { retryable: true });
    }
  };
}
