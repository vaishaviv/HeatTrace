// Status pill used by the worker table, alert log and drill-down: icon plus
// label, so colour is never the only signal.
interface Props {
  icon: string;
  label: string;
  className: string; // colour classes from a *_META map
}

export default function Pill({ icon, label, className }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
