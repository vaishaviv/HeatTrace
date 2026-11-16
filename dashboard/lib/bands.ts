import type { ZoneBand } from "@/lib/types";

// Colour, icon and label per band, so colour is never the only signal.
// Class names are written out in full so Tailwind can find them.
export const BAND_META: Record<
  ZoneBand,
  { label: string; icon: string; card: string }
> = {
  safe: {
    label: "Safe",
    icon: "✓",
    card: "bg-green-100 border-green-300 text-green-950",
  },
  caution: {
    label: "Caution",
    icon: "!",
    card: "bg-yellow-100 border-yellow-400 text-yellow-950",
  },
  high: {
    label: "High",
    icon: "!!",
    card: "bg-orange-200 border-orange-400 text-orange-950",
  },
  critical: {
    label: "Critical",
    icon: "!!!",
    card: "bg-red-200 border-red-500 text-red-950",
  },
};