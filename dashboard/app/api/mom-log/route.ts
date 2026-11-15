import { connection, NextRequest, NextResponse } from "next/server";
import type { Zone } from "@/lib/types";
import { mockMom } from "@/lib/mockMom";
import { sgtToday } from "@/lib/time";
import { mockMode, proxy } from "@/lib/upstream";
import zonesData from "@/mock/zones.json";

// GET /api/mom-log?date=YYYY-MM-DD (Singapore date, defaults to today)
// The hourly WBGT record that replaces the manual meter reading.
export async function GET(req: NextRequest) {
  await connection();
  const date = req.nextUrl.searchParams.get("date") ?? sgtToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return NextResponse.json(
      { error: `Date must look like 2026-11-15, got "${date}".` },
      { status: 400 }
    );
  }
  if (!mockMode()) return proxy(`/mom-log?date=${date}`);

  const now = Math.floor(Date.now() / 1000);
  return NextResponse.json(mockMom(date, zonesData as unknown as Zone[], now));
}
