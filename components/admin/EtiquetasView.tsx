"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/types";
import { PROTEIN_EXTRA_LABEL } from "@/lib/pricing";
import type { WinOpt } from "./WindowTabs";
import { DaySelect, type DayOpt } from "./DaySelect";
import { LabelPrint, buildLabels, LABEL_FORMATS } from "./LabelPrint";

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
  // "lista" = el checklist para escribir a mano; "etiquetas" = el pliego imprimible.
  const [mode, setMode] = useState<"lista" | "etiquetas">("lista");
  const [fmtId, setFmtId] = useState<string>(LABEL_FORMATS[0].id);
  const fmt = LABEL_FORMATS.find((f) => f.id === fmtId) || LABEL_FORMATS[0];

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

  const units = useMemo(() => buildLabels(customers), [customers]);

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
        <div className="etq-modes" role="group" aria-label="Cómo ver las etiquetas">
          <button
            type="button"
            className={`etq-mode${mode === "lista" ? " on" : ""}`}
            aria-pressed={mode === "lista"}
            onClick={() => setMode("lista")}
          >
            Lista para escribir
          </button>
          <button
            type="button"
            className={`etq-mode${mode === "etiquetas" ? " on" : ""}`}
            aria-pressed={mode === "etiquetas"}
            onClick={() => setMode("etiquetas")}
          >
            Etiquetas para imprimir
          </button>
        </div>

        <div className="etq-prog">
          {mode === "lista" ? (
            <>
              <b className="tnum">{totals.ready}</b> / {totals.lines} etiquetas hechas
            </>
          ) : (
            <>
              <b className="tnum">{units.length}</b> etiquetas · {customers.length}{" "}
              {customers.length === 1 ? "cliente" : "clientes"}
            </>
          )}
        </div>

        <div className="etq-actions">
          {mode === "etiquetas" && (
            <select
              className="etq-fmt"
              value={fmtId}
              onChange={(e) => setFmtId(e.target.value)}
              aria-label="Formato de etiqueta"
            >
              {LABEL_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label} — {f.hint}
                </option>
              ))}
            </select>
          )}
          {mode === "lista" && (
            <button type="button" className="etq-btn ghost" onClick={() => persist({})} disabled={totals.ready === 0}>
              Reiniciar
            </button>
          )}
          <button
            type="button"
            className="etq-btn"
            onClick={() => window.print()}
            disabled={mode === "lista" ? customers.length === 0 : units.length === 0}
          >
            Imprimir
          </button>
        </div>
      </div>

      {mode === "etiquetas" && units.length > 0 && (
        <p className="etq-tip no-print">
          Se ven al tamaño real. En el diálogo de impresión: escala 100 % y sin márgenes, o las
          etiquetas salen corridas.
        </p>
      )}

      {customers.length === 0 ? (
        <div className="otable" style={{ marginTop: 16 }}>
          <div className="empty" style={{ padding: 20 }}>Todavía no hay pedidos con platos para esta entrega.</div>
        </div>
      ) : mode === "etiquetas" ? (
        <LabelPrint units={units} format={fmt} />
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
