"use client";

import type { Order } from "@/lib/types";

export interface WinOpt {
  id: string;
  label: string;
}

/** Lista de ventanas presentes en los pedidos + la ventana activa, más reciente primero. */
export function deriveWindows(orders: Order[], active: WinOpt): WinOpt[] {
  const m = new Map<string, string>();
  if (active.id) m.set(active.id, active.label);
  for (const o of orders) if (o.windowId && !m.has(o.windowId)) m.set(o.windowId, o.windowLabel);
  return [...m.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => b.id.localeCompare(a.id)); // la activa (cierre más tardío) primero
}

/** Pedidos de ventanas anteriores a la activa que siguen sin completar. */
export function pastPendingOrders(orders: Order[], activeId: string): Order[] {
  return orders.filter((o) => o.windowId < activeId && !o.completed);
}

const shortWin = (label: string) => label.replace(/^Entrega\s+/i, "");

export function WindowTabs({
  windows,
  selected,
  activeId,
  onSelect,
  includeAll = false,
}: {
  windows: WinOpt[];
  selected: string;
  activeId: string;
  onSelect: (id: string) => void;
  includeAll?: boolean;
}) {
  return (
    <div className="wtabs" role="tablist" aria-label="Ventana de entrega">
      {includeAll && (
        <button
          type="button"
          role="tab"
          aria-selected={selected === "all"}
          className={`wtab${selected === "all" ? " on" : ""}`}
          onClick={() => onSelect("all")}
        >
          Todas
        </button>
      )}
      {windows.map((w) => (
        <button
          key={w.id}
          type="button"
          role="tab"
          aria-selected={selected === w.id}
          className={`wtab${selected === w.id ? " on" : ""}${w.id === activeId ? " active-win" : ""}`}
          onClick={() => onSelect(w.id)}
        >
          {shortWin(w.label)}
          {w.id === activeId && <span className="wtab-dot" aria-label="ventana activa" />}
        </button>
      ))}
    </div>
  );
}
