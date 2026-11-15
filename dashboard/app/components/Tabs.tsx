"use client";

import { useId, useRef, useState, type ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  render: () => ReactNode; // only the open tab renders, so it fetches on open
}

interface Props {
  label: string; // accessible name for the tab list
  tabs: Tab[];
}

// WAI-ARIA tabs: arrow keys, Home and End move between tabs.
export default function Tabs({ label, tabs }: Props) {
  const [active, setActive] = useState(tabs[0].id);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(tabs[next].id);
    refs.current[next]?.focus();
  }

  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 border-b-2 border-ink">
        {tabs.map((t, i) => {
          const selected = t.id === current.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`${base}-tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`-mb-0.5 rounded-t-md border-2 px-4 py-2 text-lg font-extrabold ${
                selected
                  ? "border-ink border-b-page bg-page"
                  : "border-transparent text-concrete hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div
        id={`${base}-panel-${current.id}`}
        role="tabpanel"
        aria-labelledby={`${base}-tab-${current.id}`}
        className="pt-3"
      >
        {current.render()}
      </div>
    </div>
  );
}
