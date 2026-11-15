import type { WorkerStatus } from "@/lib/types";

// Each status gets a colour, an icon and a text label, so colour is never the
// only signal. Only states that need action get a solid sign fill; OK stays an
// outline so the board stays quiet when nothing is wrong.
// Class names are written out in full so Tailwind can find them.
export const STATUS_META: Record<
  WorkerStatus,
  { label: string; icon: string; pill: string; row: string; rank: number }
> = {
  escalated: {
    label: "Escalated",
    icon: "▲▲",
    pill: "bg-ink text-white ring-2 ring-critical",
    row: "bg-critical/15",
    rank: 0,
  },
  alert: {
    label: "Alert",
    icon: "▲",
    pill: "bg-critical text-white",
    row: "bg-critical/10",
    rank: 1,
  },
  offline: {
    label: "Offline",
    icon: "○",
    pill: "bg-white text-concrete ring-1 ring-concrete",
    row: "text-concrete",
    rank: 2,
  },
  resting: {
    label: "Resting",
    icon: "◆",
    pill: "bg-rest text-white",
    row: "",
    rank: 3,
  },
  ok: {
    label: "OK",
    icon: "●",
    pill: "bg-white text-safe ring-1 ring-safe",
    row: "",
    rank: 4,
  },
};
