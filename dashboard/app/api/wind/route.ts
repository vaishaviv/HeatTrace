import { connection, NextResponse } from "next/server";
import type { Wind } from "@/lib/types";
import { SITE } from "@/lib/site";

// Live NEA wind speed from data.gov.sg (public, no key). This is not part of
// the cloud read API, so it is the same in mock and proxy mode.
const NEA_URL = "https://api-open.data.gov.sg/v2/real-time/api/wind-speed";
const FRESH_MS = 60_000; // NEA itself only updates every few minutes
const STALE_OK_MS = 10 * 60_000; // if NEA is down, an older reading still helps

interface NeaResponse {
  data: {
    stations: { id: string; name: string; location: { latitude: number; longitude: number } }[];
    readings: { timestamp: string; data: { stationId: string; value: number }[] }[];
  };
}

// One cached reading per server instance, shared by every phone polling the
// board, so N supervisors cost one NEA request a minute instead of N.
// Kept on globalThis so dev hot reloads do not drop it.
interface Cache {
  wind?: Wind;
  at?: number;
  inflight?: Promise<Wind>;
}
const store = globalThis as typeof globalThis & { __heattraceWind?: Cache };
const cache: Cache = (store.__heattraceWind ??= {});

// Squared distance is enough to rank stations a few km apart.
const dist2 = (lat: number, lng: number) =>
  (lat - SITE.lat) ** 2 + ((lng - SITE.lng) * Math.cos((SITE.lat * Math.PI) / 180)) ** 2;

async function fetchWind(): Promise<Wind> {
  const res = await fetch(NEA_URL, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`NEA returned ${res.status}`);
  const { data } = (await res.json()) as NeaResponse;

  const reading = data.readings[0];
  if (!reading) throw new Error("NEA returned no readings");
  const values = new Map(reading.data.map((d) => [d.stationId, d.value]));

  const nearest = data.stations
    .filter((s) => values.has(s.id))
    .sort(
      (a, b) =>
        dist2(a.location.latitude, a.location.longitude) -
        dist2(b.location.latitude, b.location.longitude)
    )[0];
  if (!nearest) throw new Error("No station reported a value");

  return {
    knots: values.get(nearest.id)!,
    station: nearest.name,
    ts: Math.floor(Date.parse(reading.timestamp) / 1000),
  };
}

const ok = (wind: Wind) =>
  NextResponse.json(wind, {
    // Lets Vercel's edge answer repeat requests too.
    headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=120" },
  });

// GET /api/wind -> { knots, station, ts } for the station nearest the site
export async function GET() {
  await connection();
  const now = Date.now();
  if (cache.wind && cache.at && now - cache.at < FRESH_MS) return ok(cache.wind);

  try {
    // Concurrent requests share one NEA call.
    cache.inflight ??= fetchWind().finally(() => {
      cache.inflight = undefined;
    });
    const wind = await cache.inflight;
    cache.wind = wind;
    cache.at = Date.now();
    return ok(wind);
  } catch (err) {
    if (cache.wind && cache.at && now - cache.at < STALE_OK_MS) return ok(cache.wind);
    const reason = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Wind speed unavailable: ${reason}` }, { status: 503 });
  }
}
