"use client";

export interface DayOpt {
  id: string;
  label: string;
  badge?: number; // pendientes; se muestra entre paréntesis
}

/** Dropdown para elegir el día/entrega en el panel (reemplaza a las pills). */
export function DaySelect({
  options,
  value,
  onChange,
  label = "Entrega",
}: {
  options: DayOpt[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  return (
    <label className="dsel">
      <span className="dsel-k">{label}</span>
      <select className="dsel-sel" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
            {o.badge ? ` (${o.badge})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
