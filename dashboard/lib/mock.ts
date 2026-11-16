// Shifts the mock timestamps so they look current.
const MOCK_REF_TS = 1762270000;
const TS_KEYS = new Set([
  "last_seen",
  "raised_ts",
  "ack_ts",
  "escalated_ts",
  "cleared_ts",
  "ts",
]);

export function rebase<T>(rows: T[]): T[] {
  const offset = Math.floor(Date.now() / 1000) - MOCK_REF_TS;
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };
    for (const key of Object.keys(out)) {
      const value = out[key];
      if (TS_KEYS.has(key) && typeof value === "number") {
        out[key] = value + offset;
      }
    }
    return out as T;
  });
}