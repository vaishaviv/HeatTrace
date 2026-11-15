"use client";

interface Props {
  onExport: () => void;
  disabled?: boolean;
}

export default function CsvButton({ onExport, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled}
      className="rounded border-2 border-ink bg-white px-3 py-1.5 text-sm font-semibold hover:bg-ink hover:text-white disabled:opacity-50"
    >
      Export CSV
    </button>
  );
}
