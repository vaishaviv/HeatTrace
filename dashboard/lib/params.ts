// Strict query-parameter checks for the route handlers. Anything that is not
// exactly what the read API expects is rejected with a 400 instead of being
// passed upstream or silently coerced.

// A whole number written as plain digits, within [min, max]. Returns the
// fallback when the parameter is absent, and null when it is present but
// invalid (negative, decimal, exponent, text or out of range).
export function intParam(
  raw: string | null,
  { fallback, min, max }: { fallback: number; min: number; max: number }
): number | null {
  if (raw === null || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

// YYYY-MM-DD that is a real calendar day (rejects 2026-02-30, 2026-13-01).
export function isCalendarDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}
