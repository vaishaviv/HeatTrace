import type { ZoneBand } from "@/lib/types";

// Zone cards are drawn as safety-sign plates: a solid band fill with an ink
// border. Text colour is chosen per fill for contrast (black on yellow and
// orange, white on green and red), and every band has an icon and a label.
// Class names are written out in full so Tailwind can find them.
export const BAND_META: Record<
  ZoneBand,
  { label: string; icon: string; plate: string }
> = {
  safe: {
    label: "Safe",
    icon: "✓",
    plate: "bg-safe text-white",
  },
  caution: {
    label: "Caution",
    icon: "!",
    plate: "bg-caution text-ink",
  },
  high: {
    label: "High",
    icon: "!!",
    plate: "bg-high text-ink",
  },
  critical: {
    label: "Critical",
    icon: "!!!",
    plate: "bg-critical text-white",
  },
};
