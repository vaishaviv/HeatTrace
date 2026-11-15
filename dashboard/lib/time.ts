// Timestamps are Unix seconds, UTC. Display in Singapore time.

export function timeAgo(ts: number, now: number | null): string {
  if (now === null) return ""; // before the client clock is ready
  const diff = Math.max(0, now - ts);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff} s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}

export function formatSGT(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("en-SG", {
    timeZone: "Asia/Singapore",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// e.g. "13 Nov, 14:32" in Singapore time
export function formatSGTDateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SGT_OFFSET_H = 8;

// Unix seconds for HH:00 on a YYYY-MM-DD day in Singapore time.
export function sgtHourTs(date: string, hour: number): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, hour - SGT_OFFSET_H) / 1000;
}

// Today's date in Singapore as YYYY-MM-DD.
export function sgtToday(): string {
  return new Date(Date.now() + SGT_OFFSET_H * 3600_000).toISOString().slice(0, 10);
}
