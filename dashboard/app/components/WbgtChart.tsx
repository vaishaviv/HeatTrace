"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryPoint } from "@/lib/types";
import { formatSGT } from "@/lib/time";

export const WBGT_LIMIT = 32; // °C, the dashed line the guide asks for

// Colours come from the theme tokens so the chart matches the rest of the board.
const INK = "var(--color-ink)";
const RULE = "var(--color-rule)";
const CRITICAL = "var(--color-critical)";
const CONCRETE = "var(--color-concrete)";

interface Props {
  points: HistoryPoint[];
}

export default function WbgtChart({ points }: Props) {
  const values = points.map((p) => p.wbgt);
  const lo = Math.floor(Math.min(WBGT_LIMIT - 2, ...values));
  const hi = Math.ceil(Math.max(WBGT_LIMIT + 1, ...values));

  return (
    <div className="h-64 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={RULE} vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(ts: number) => formatSGT(ts)}
            tick={{ fill: CONCRETE, fontSize: 12 }}
            stroke={RULE}
            minTickGap={32}
          />
          <YAxis
            domain={[lo, hi]}
            tickFormatter={(v: number) => `${v}°`}
            tick={{ fill: CONCRETE, fontSize: 12 }}
            stroke={RULE}
            allowDecimals={false}
          />
          <ReferenceLine
            y={WBGT_LIMIT}
            stroke={CRITICAL}
            strokeWidth={2}
            strokeDasharray="6 4"
            label={{
              value: `${WBGT_LIMIT} °C`,
              position: "insideTopLeft",
              fill: CRITICAL,
              fontSize: 12,
              fontWeight: 600,
            }}
          />
          <Tooltip
            labelFormatter={(ts) => formatSGT(Number(ts))}
            formatter={(v) => [`${Number(v).toFixed(1)} °C`, "WBGT"]}
            contentStyle={{ border: `2px solid ${INK}`, borderRadius: 6 }}
          />
          <Line
            type="monotone"
            dataKey="wbgt"
            stroke={INK}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: INK }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
