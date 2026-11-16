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