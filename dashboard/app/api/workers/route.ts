import { connection, NextResponse } from "next/server";
import type { Alert, Worker } from "@/lib/types";
import { rebase } from "@/lib/mock";
import { withResting } from "@/lib/mockState";
import { mockMode, proxy } from "@/lib/upstream";
import workersData from "@/mock/workers.json";
import alertsData from "@/mock/alerts.json";

// GET /api/workers
export async function GET() {
  await connection(); // run at request time, so rebase() uses the current time
  if (!mockMode()) return proxy("/workers");

  const now = Math.floor(Date.now() / 1000);
  const workers = withResting(
    rebase(workersData as unknown as Worker[]),
    rebase(alertsData as unknown as Alert[]),
    now
  );
  return NextResponse.json(workers);
}
