"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/types";
import { WindowTabs, deriveWindows, pastPendingOrders, type WinOpt } from "./WindowTabs";

type Kind = "dish" | "market";
const itemKey = (kind: Kind, name: string) => `${kind}:${name}`;

function aggregate(orders: Order[], onlyPaid: boolean) {
  const dishes: Record<string, number> = {};
  const market: Record<string, number> = {};
  let dishTotal = 0;
  let marketTotal = 0;
  for (const o of orders) {
    if (onlyPaid && o.status !== "pagado") continue;
    for (const d of o.dishes) {
      dishes[d.name] = (dishes[d.name] || 0) + d.qty;
      dishTotal += d.qty;
    }
    for (const m of o.market) {
      market[m.name] = (market[m.name] || 0) + m.qty;
      marketTotal += m.qty;
    }
  }
  const sort = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1]);
  return { dishes: sort(dishes), market: sort(market), dishTotal, marketTotal };
}

function Bars({
  rows,
  kind,
  isDone,
  onToggle,
}: {
  rows: [string, number][];
  kind: Kind;
  isDone: (key: string, qty: number) => boolean;
  onToggle: (key: string, qty: number, next: boolean) => void;
}) {
  const max = rows.length ? rows[0][1] : 1;
  if (rows.length === 0) return <div className="empty" style={{ padding: 16 }}>Sin ítems en esta ventana.</div>;
  return (
    <div className="kgrid">
      {rows.map(([name, qty]) => {
        const key = itemKey(kind, name);
        const done = isDone(key, qty);
        return (
          <div className={`krow${done ? " done" : ""}`} key={key}>
            <button
              type="button"
              className="kcheck"
              aria-pressed={done}
              aria-label={done ? `Reabrir ${name}` : `Completar ${name}`}
              title={done ? "Reabrir" : "Marcar completado"}
              onClick={() => onToggle(key, qty, !done)}
            >
              {done ? "✓" : ""}
            </button>
            <span className="kqty tnum">{qty}×</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="kname">{name}</div>
            </div>
            <div className="kbar">
              <i style={{ width: `${Math.round((qty / max) * 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KitchenView({
  initial,
}: {
  initial: { orders: Order[]; window: WinOpt; done: Record<string, number> };
}) {
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const [activeWin, setActiveWin] = useState<WinOpt>(initial.window);
  const [selWin, setSelWin] = useState<string>(initial.window.id);
  const [onlyPaid, setOnlyPaid] = useState(false);
  const [doneMap, setDoneMap] = useState<Map<string, number>>(
    () => new Map(Object.entries(initial.done || {}))
  );

  const refetchOrders = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setOrders(d.orders);
      if (d.window) setActiveWin(d.window);
    } catch {
      /* silencioso */
    }
  }, []);

  const fetchDone = useCallback(async (windowId: string) => {
    try {
      const r = await fetch(`/api/kitchen?windowId=${encodeURIComponent(windowId)}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      if (d.done && typeof d.done === "object") {
        setDoneMap(new Map(Object.entries(d.done as Record<string, number>)));
      }
    } catch {
      /* silencioso */
    }
  }, []);

  // Al cambiar de ventana, traer su checklist.
  useEffect(() => {
    fetchDone(selWin);
  }, [selWin, fetchDone]);

  // Refresco periódico: pedidos + checklist de la ventana seleccionada.
  useEffect(() => {
    const id = setInterval(() => {
      refetchOrders();
      fetchDone(selWin);
    }, 12000);
    return () => clearInterval(id);
  }, [refetchOrders, fetchDone, selWin]);

  const isDone = useCallback(
    (key: string, qty: number) => {
      const dq = doneMap.get(key);
      return dq !== undefined && qty <= dq;
    },
    [doneMap]
  );

  const toggle = useCallback(
    async (key: string, qty: number, next: boolean) => {
      setDoneMap((prev) => {
        const m = new Map(prev);
        if (next) m.set(key, qty);
        else m.delete(key);
        return m;
      });
      try {
        const r = await fetch("/api/kitchen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ windowId: selWin, key, done: next, qty }),
        });
        if (r.ok) {
          const d = await r.json();
          if (d.done && typeof d.done === "object") {
            setDoneMap(new Map(Object.entries(d.done as Record<string, number>)));
          }
        } else {
          fetchDone(selWin);
        }
      } catch {
        fetchDone(selWin);
      }
    },
    [selWin, fetchDone]
  );

  const windows = useMemo(() => deriveWindows(orders, activeWin), [orders, activeWin]);
  const selLabel = windows.find((w) => w.id === selWin)?.label || activeWin.label;
  const windowOrders = useMemo(() => orders.filter((o) => o.windowId === selWin), [orders, selWin]);
  const agg = useMemo(() => aggregate(windowOrders, onlyPaid), [windowOrders, onlyPaid]);

  const pending = useMemo(() => pastPendingOrders(orders, activeWin.id), [orders, activeWin.id]);
  const jumpWin = useMemo(
    () => pending.reduce((mx, o) => (o.windowId > mx ? o.windowId : mx), ""),
    [pending]
  );

  const countDone = (rows: [string, number][], kind: Kind) =>
    rows.reduce((n, [name, qty]) => n + (isDone(itemKey(kind, name), qty) ? 1 : 0), 0);
  const dishDone = countDone(agg.dishes, "dish");
  const marketDone = countDone(agg.market, "market");

  return (
    <>
      {pending.length > 0 && selWin !== jumpWin && (
        <div className="walert">
          <span>
            ⚠️ Tenés <b>{pending.length}</b> pedido{pending.length > 1 ? "s" : ""} de entregas anteriores sin
            completar.
          </span>
          <button className="walert-btn" onClick={() => setSelWin(jumpWin)}>
            Ver esa ventana →
          </button>
        </div>
      )}

      <WindowTabs windows={windows} selected={selWin} activeId={activeWin.id} onSelect={setSelWin} />

      <div className="astat">
        <div className="box">
          <div className="k">Total platos listos</div>
          <div className="v">{agg.dishTotal}</div>
        </div>
        <div className="box">
          <div className="k">Ítems de Market</div>
          <div className="v">{agg.marketTotal}</div>
        </div>
        <div className="box accent">
          <div className="k">Ventana</div>
          <div className="v" style={{ fontSize: "1.05rem" }}>{selLabel}</div>
        </div>
        <div className="box">
          <div className="k">Mostrando</div>
          <div className="v" style={{ fontSize: "1.05rem" }}>{onlyPaid ? "Solo pagados" : "Todos"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className={`obtn ${!onlyPaid ? "paid" : ""}`} onClick={() => setOnlyPaid(false)}>
          Todos los pedidos
        </button>
        <button className={`obtn ${onlyPaid ? "paid" : ""}`} onClick={() => setOnlyPaid(true)}>
          Solo pagados
        </button>
      </div>

      <div className="klabel" style={{ marginTop: 6 }}>
        Platos listos — a producir
        {agg.dishes.length > 0 && (
          <span className={`kprog${dishDone === agg.dishes.length ? " all" : ""}`}>
            {dishDone}/{agg.dishes.length} listos
          </span>
        )}
      </div>
      <Bars rows={agg.dishes} kind="dish" isDone={isDone} onToggle={toggle} />

      <div className="klabel">
        Sano Market — a preparar
        {agg.market.length > 0 && (
          <span className={`kprog${marketDone === agg.market.length ? " all" : ""}`}>
            {marketDone}/{agg.market.length} listos
          </span>
        )}
      </div>
      <Bars rows={agg.market} kind="market" isDone={isDone} onToggle={toggle} />

      <p className="wa-note" style={{ textAlign: "left", marginTop: 12 }}>
        Marcá cada ítem como <b>completado</b> a medida que lo producís — el check se comparte con las otras
        pantallas de cocina (cada 12 s). Si entra un pedido que aumenta la cantidad de un ítem ya
        completado, se reabre solo. Cambiá de <b>ventana</b> arriba para producir entregas de otros días.
      </p>
    </>
  );
}
