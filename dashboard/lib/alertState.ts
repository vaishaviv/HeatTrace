import type { Alert } from "@/lib/types";

export type AlertState = "raised" | "acknowledged" | "escalated" | "cleared";

// Treat null, undefined and 0 as "not set yet".
const isSet = (v: number | null | undefined): v is number =>
  typeof v === "number" && v > 0;

// Lifecycle is read from the timestamps. Status itself is the cloud's job;
// this only labels where an alert is in Raised, Acknowledged, Escalated, Cleared.
export function alertState(a: Alert): AlertState {
  if (isSet(a.cleared_ts)) return "cleared";
  if (isSet(a.escalated_ts)) return "escalated";
  if (isSet(a.ack_ts)) return "acknowledged";
  return "raised";
}

// Escalated and not yet cleared: this is the red row.
export function isOpenEscalation(a: Alert): boolean {
  return isSet(a.escalated_ts) && !isSet(a.cleared_ts);
}

export const ALERT_STATE_META: Record<
  AlertState,
  { label: string; icon: string; pill: string }
> = {
  raised: {
    label: "Raised",
    icon: "▲",
    pill: "bg-critical text-white",
  },
  acknowledged: {
    label: "Acknowledged",
    icon: "◆",
    pill: "bg-rest text-white",
  },
  escalated: {
    label: "Escalated",
    icon: "▲▲",
    pill: "bg-ink text-white ring-2 ring-critical",
  },
  cleared: {
    label: "Cleared",
    icon: "✓",
    pill: "bg-white text-safe ring-1 ring-safe",
  },
};