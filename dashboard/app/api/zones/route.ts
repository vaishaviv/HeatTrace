import { NextResponse } from "next/server";
import type { Zone } from "@/lib/types";
import zonesData from "@/mock/zones.json";

export async function GET() {
  return NextResponse.json(zonesData as unknown as Zone[]);
}