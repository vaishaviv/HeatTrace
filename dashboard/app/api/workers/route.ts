import { connection, NextResponse } from "next/server";
import type { Worker } from "@/lib/types";
import { rebase } from "@/lib/mock";
import { mockMode, proxy } from "@/lib/upstream";
import workersData from "@/mock/workers.json";

// GET /api/workers
export async function GET() {
  await connection(); // run at request time, so rebase() uses the current time
  if (!mockMode()) return proxy("/workers");

  const workers = rebase(workersData as unknown as Worker[]);
  return NextResponse.json(workers);
}
