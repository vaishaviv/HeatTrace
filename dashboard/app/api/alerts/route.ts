import { connection, NextRequest, NextResponse } from "next/server";
import type { Alert } from "@/lib/types";
import { rebase } from "@/lib/mock";
import { withAcks } from "@/lib/mockState";
import { mockMode, proxy } from "@/lib/upstream";
import alertsData from "@/mock/alerts.json";

// GET /api/alerts?since=<unix seconds>
export async function GET(req: NextRequest) {
  await connection();
  const since = Number(req.nextUrl.searchParams.get("since") ?? 0) || 0;
  if (!mockMode()) return proxy(`/alerts?since=${since}`);

  const alerts = withAcks(rebase(alertsData as unknown as Alert[]))
    .filter((a) => a.raised_ts >= since)
    .sort((a, b) => b.raised_ts - a.raised_ts); // newest first

  return NextResponse.json(alerts);
}
