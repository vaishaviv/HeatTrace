import type { HistoryPoint, Worker } from "@/lib/types";

const STEP_S = 600; // one reading every 10 min is plenty for an 8 h chart

// Small deterministic PRNG so a worker's mock history is the same on every
// request (the chart does not jump around between opens).
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// A plausible working day: cooler and more humid early, warming toward the
// worker's current reading. The last point equals the live row exactly, and an
// offline worker's series stops at last_seen.
export function mockHistory(worker: Worker, hours: number): HistoryPoint[] {
  const rand = seeded(worker.worker_id);
  const end = worker.last_seen;
  const start = end - hours * 3600;
  const rise = 2.5 + rand() * 2; // how much hotter it got over the window
  const gap = worker.t_air - worker.wbgt; // air temp runs above WBGT

  const points: HistoryPoint[] = [];
  for (let ts = start; ts < end; ts += STEP_S) {
    const f = (ts - start) / (end - start); // 0 at start, 1 now
    const wobble = (rand() - 0.5) * 0.8;
    const wbgt = worker.wbgt - (1 - f) * rise + wobble;
    points.push({
      ts,
      wbgt: round1(wbgt),
      t_air: round1(wbgt + gap + (rand() - 0.5) * 0.4),
      rh: Math.round(worker.rh + (1 - f) * 8 + (rand() - 0.5) * 3),
    });
  }
  points.push({ ts: end, wbgt: worker.wbgt, t_air: worker.t_air, rh: worker.rh });
  return points;
}
