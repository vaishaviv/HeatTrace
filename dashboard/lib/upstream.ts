// Server-only: the route handlers use this to switch between the mock JSON
// and the cloud read API. HT_API_KEY is read here and never reaches the
// browser (no NEXT_PUBLIC_ prefix, and no client component imports this file).
import { NextResponse } from "next/server";

const TIMEOUT_MS = 8000;

// Mock is the default, so a fresh clone or a preview deploy with no env vars
// still renders. Set HT_USE_MOCK=false to read from AWS.
export function mockMode(): boolean {
  return process.env.HT_USE_MOCK !== "false";
}

// Forwards a request to HT_API_URL + path with the x-api-key header.
// Upstream 4xx (for example an unknown worker) passes through; anything else
// that goes wrong becomes a 502 with a JSON { error } body.
export async function proxy(path: string, init: RequestInit = {}): Promise<NextResponse> {
  const base = process.env.HT_API_URL;
  const key = process.env.HT_API_KEY;
  if (!base || !key) {
    return NextResponse.json(
      { error: "HT_API_URL and HT_API_KEY must be set when HT_USE_MOCK=false." },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(base.replace(/\/$/, "") + path, {
      ...init,
      headers: { ...init.headers, "x-api-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text();
    if (res.ok || (res.status >= 400 && res.status < 500)) {
      return new NextResponse(body, {
        status: res.status,
        headers: { "content-type": "application/json" },
      });
    }
    return NextResponse.json(
      { error: `Read API returned ${res.status} for ${path}.` },
      { status: 502 }
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Read API unreachable for ${path}: ${reason}` },
      { status: 502 }
    );
  }
}
