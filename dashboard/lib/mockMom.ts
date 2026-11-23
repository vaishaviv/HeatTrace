import type { MomRow, Zone } from "@/lib/types";
import { seeded } from "@/lib/seeded";
import { sgtHourTs } from "@/lib/time";

const FIRST_HOUR = 7; // site day runs 07:00 to 19:00 SGT
const LAST_HOUR = 18; // the 18:00 to 19:00 hour is the last row
const REST_AT = 32; // mock stand-in for the cloud's rest rule

// One row per zone per hour, from 07:00 up to the current hour (today) or the
// whole working day (past dates). Heat climbs to a peak around 14:00. The same
// date always gives the same rows.
export function mockMom(date: string, zones: Zone[], now: number): MomRow[] {
  const rows: MomRow[] = [];
  for (const z of zones) {
    const rand = seeded(`${date}:${z.zone}`);
    for (let h = FIRST_HOUR; h <= LAST_HOUR; h++) {
      const hour_ts = sgtHourTs(date, h);
      if (hour_ts > now) break;
      const curve = Math.sin((Math.PI * (h - FIRST_HOUR)) / (LAST_HOUR - FIRST_HOUR + 2));
      const max_wbgt = Math.round((z.max_wbgt - 3.5 + 4 * curve + (rand() - 0.5)) * 10) / 10;
      rows.push({ zone: z.zone, hour_ts, max_wbgt, rest_triggered: max_wbgt >= REST_AT });
    }
  }
  return rows.sort((a, b) => a.hour_ts - b.hour_ts || a.zone.localeCompare(b.zone));
}
