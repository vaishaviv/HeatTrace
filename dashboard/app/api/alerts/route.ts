import { connection, NextRequest, NextResponse } from "next/server";
import type { Alert } from "@/lib/types";
import { rebase } from "@/lib/mock";
import alertsData from "@/mock/alerts.json";

// GET /api/alerts?since=<unix seconds>
export async function GET(req: NextRequest) {
  await connection();
  const since = Number(req.nextUrl.searchParams.get("since") ?? 0);

  const alerts = rebase(alertsData as unknown as Alert[])
    .filter((a) => a.raised_ts >= since)
    .sort((a, b) => b.raised_ts - a.raised_ts); // newest first

  return NextResponse.json(alerts);
}