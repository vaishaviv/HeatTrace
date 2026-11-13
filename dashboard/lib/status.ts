import type { WorkerStatus } from "@/lib/types";

// Each status gets a colour, an icon and a text label,
// so colour is never the only signal.
export const STATUS_META: Record<
  WorkerStatus,
  { label: string; icon: string; pill: string; row: string; rank: number }
> = {
escalated: {
  label: "Escalated", icon: "▲▲",
  pill: "bg-red-700 text-white",
  row: "bg-red-50 dark:bg-red-950/50",
  rank: 0,
},
alert: {
  label: "Alert", icon: "▲",
  pill: "bg-red-100 text-red-800 ring-1 ring-red-300 dark:bg-red-900/60 dark:text-red-100 dark:ring-red-700",
  row: "bg-orange-50 dark:bg-orange-950/40",
  rank: 1,
},
offline: {
  label: "Offline", icon: "○",
  pill: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  row: "",
  rank: 2,
},
resting: {
  label: "Resting", icon: "◆",
  pill: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-100",
  row: "",
  rank: 3,
},
ok: {
  label: "OK", icon: "●",
  pill: "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-100",
  row: "",
  rank: 4,
},
};