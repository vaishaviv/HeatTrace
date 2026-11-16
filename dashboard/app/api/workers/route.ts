import { connection, NextResponse } from "next/server";
import type { Worker } from "@/lib/types";
import { rebase } from "@/lib/mock";
import workersData from "@/mock/workers.json";

export async function GET() {
  await connection(); // run at request time, so rebase() uses the current time
  const workers = rebase(workersData as unknown as Worker[]);
  return NextResponse.json(workers);
}