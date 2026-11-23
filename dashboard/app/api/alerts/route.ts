import { connection, NextRequest, NextResponse } from "next/server";
import type { Alert } from "@/lib/types";
import { rebase } from "@/lib/mock";
import { withAcks } from "@/lib/mockState";
import { intParam } from "@/lib/params";
import { mockMode, proxy } from "@/lib/upstream";
import alertsData from "@/mock/alerts.json";

// GET /api/alerts?since=<unix seconds>
export async function GET(req: NextRequest) {
  await connection();
  const since = intParam(req.nextUrl.searchParams.get("since"), {
    fallback: 0,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
  });
  if (since === null) {
    return NextResponse.json(
      { error: "since must be a whole number of Unix seconds, 0 or more." },
      { status: 400 }
    );
  }
  if (!mockMode()) return proxy(`/alerts?since=${since}`);

  const alerts = withAcks(rebase(alertsData as unknown as Alert[]))
    .filter((a) => a.raised_ts >= since)
    .sort((a, b) => b.raised_ts - a.raised_ts); // newest first

  return NextResponse.json(alerts);
}
