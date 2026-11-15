import { connection, NextResponse } from "next/server";
import type { Wind } from "@/lib/types";
import { SITE } from "@/lib/site";

// Live NEA wind speed from data.gov.sg (public, no key). This is not part of
// the cloud read API, so it is the same in mock and proxy mode.
const NEA_URL = "https://api-open.data.gov.sg/v2/real-time/api/wind-speed";

interface NeaResponse {
  data: {
    stations: { id: string; name: string; location: { latitude: number; longitude: number } }[];
    readings: { timestamp: string; data: { stationId: string; value: number }[] }[];
  };
}

// Squared distance is enough to rank stations a few km apart.
const dist2 = (lat: number, lng: number) =>
  (lat - SITE.lat) ** 2 + ((lng - SITE.lng) * Math.cos((SITE.lat * Math.PI) / 180)) ** 2;

// GET /api/wind -> { knots, station, ts } for the station nearest the site
export async function GET() {
  await connection();
  try {
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

    const wind: Wind = {
      knots: values.get(nearest.id)!,
      station: nearest.name,
      ts: Math.floor(Date.parse(reading.timestamp) / 1000),
    };
    return NextResponse.json(wind);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Wind speed unavailable: ${reason}` }, { status: 503 });
  }
}
