import { connection, NextResponse } from "next/server";
import type { Zone } from "@/lib/types";
import { mockMode, proxy } from "@/lib/upstream";
import zonesData from "@/mock/zones.json";

// GET /api/zones
export async function GET() {
  await connection(); // never serve a cached copy of live readings
  if (!mockMode()) return proxy("/zones");

  return NextResponse.json(zonesData as unknown as Zone[]);
}
