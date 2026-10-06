"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/types";
import { PROTEIN_EXTRA_LABEL } from "@/lib/pricing";
import type { WinOpt } from "./WindowTabs";
import { DaySelect, type DayOpt } from "./DaySelect";

interface Data {
  orders: Order[];
  cycleWindows: WinOpt[];
  event: { label: string } | null;
}

const shortWinLabel = (label: string) => label.replace(/^Entrega\s+/i, "");
const storeKey = (scope: string) => `sano:etiquetas:${scope}`;

/** Una línea = un plato de un pedido: "3× Milanesa" para "Diego". */
const lineKey = (o: Order, dish: string) => `${o.id}|${dish}`;

export function EtiquetasView({ initial }: { initial: Data }) {
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const [sel, setSel] = useState<string>(initial.cycleWindows[0]?.id || (initial.event ? "event" : ""));
  const [done, setDone] = useState<Record<string, number>>({}); // key -> cantidad tachada

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d.orders)) setOrders(d.orders);
    } catch {
      /* silencioso */
    }
  }, []);
  useEffect(() => {
    const id = setInterval(refetch, 20000);
    return () => clearInterval(id);
  }, [refetch]);

  // Lo tachado se recuerda en este navegador (por entrega) para no perderlo al recargar.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey(sel));
      setDone(raw ? JSON.parse(raw) : {});
    } catch {
      setDone({});
    }
  }, [sel]);
  const persist = (next: Record<string, number>) => {
    setDone(next);
    try {
      localStorage.setItem(storeKey(sel), JSON.stringify(next));
    } catch {
      /* sin storage: solo en memoria */
    }
  };

  const options = useMemo<DayOpt[]>(() => {
    const o: DayOpt[] = initial.cycleWindows.map((w) => ({ id: w.id, label: shortWinLabel(w.label) }));
    if (initial.event) o.push({ id: "event", label: `★ ${initial.event.label}` });
    return o;
  }, [initial.cycleWindows, initial.event]);

  const customers = useMemo(() => {
    const scoped = sel === "event" ? orders.filter((o) => o.eventId) : orders.filter((o) => o.windowId === sel && !o.eventId);
    return scoped
      .filter((o) => o.dishes.some((d) => d.qty > 0))
      .sort((a, b) => a.customerName.localeCompare(b.customerName, "es") || a.seq - b.seq);
  }, [orders, sel]);

  // Se considera hecha una línea solo si lo tachado coincide con la cantidad actual
  // (si el cliente sube la cantidad, reaparece sin tachar).
  const isDone = (o: Order, d: { name: string; qty: number }) => done[lineKey(o, d.name)] === d.qty;
  const toggle = (o: Order, d: { name: string; qty: number }) => {
    const k = lineKey(o, d.name);
    const next = { ...done };
    if (isDone(o, d)) delete next[k];
    else next[k] = d.qty;
    persist(next);
  };

  const totals = useMemo(() => {
    let lines = 0;
    let ready = 0;
    for (const o of customers)
      for (const d of o.dishes) {
        if (d.qty <= 0) continue;
        lines++;
        if (done[lineKey(o, d.name)] === d.qty) ready++;
      }
    return { lines, ready };
  }, [customers, done]);

  return (
    <>
      <div className="wtabs no-print">
        <DaySelect options={options} value={sel} onChange={setSel} />
      </div>

      <div className="etq-bar no-print">
        <div className="etq-prog">
          <b className="tnum">{totals.ready}</b> / {totals.lines} etiquetas hechas
        </div>
        <div className="etq-actions">
          <button type="button" className="etq-btn ghost" onClick={() => persist({})} disabled={totals.ready === 0}>
            Reiniciar
          </button>
          <button type="button" className="etq-btn" onClick={() => window.print()} disabled={customers.length === 0}>
            Imprimir
          </button>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="otable" style={{ marginTop: 16 }}>
          <div className="empty" style={{ padding: 20 }}>Todavía no hay pedidos con platos para esta entrega.</div>
        </div>
      ) : (
        <div className="etq-list">
          {customers.map((o) => {
            const lines = o.dishes.filter((d) => d.qty > 0);
            const allDone = lines.every((d) => isDone(o, d));
            return (
              <section className={`etq-card${allDone ? " all-done" : ""}`} key={o.id}>
                <h2 className="etq-name">{o.customerName}</h2>
                <ul className="etq-lines">
                  {lines.map((d) => {
                    const on = isDone(o, d);
                    return (
                      <li key={d.name}>
                        <label className={`etq-line${on ? " done" : ""}`}>
                          <input type="checkbox" checked={on} onChange={() => toggle(o, d)} />
                          <span className="etq-box" aria-hidden="true">{on ? "✓" : ""}</span>
                          <span className="etq-qty tnum">{d.qty}×</span>
                          <span className="etq-dish">
                            {d.name}
                            {d.extraQty ? (
                              <span className="etq-extra">
                                💪 {PROTEIN_EXTRA_LABEL}
                                {d.extraQty < d.qty ? ` ×${d.extraQty}` : ""}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
