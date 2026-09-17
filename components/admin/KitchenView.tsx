"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/types";

interface Win {
  id: string;
  label: string;
}

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
  if (rows.length === 0) return <div className="empty" style={{ padding: 16 }}>Sin ítems todavía.</div>;
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
  initial: { orders: Order[]; window: Win; done: Record<string, number> };
}) {
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const [win, setWin] = useState<Win>(initial.window);
  const [onlyPaid, setOnlyPaid] = useState(false);
  // clave -> cantidad con la que se marcó completado
  const [doneMap, setDoneMap] = useState<Map<string, number>>(
    () => new Map(Object.entries(initial.done || {}))
  );

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setOrders(d.orders);
      setWin(d.window);
      if (d.kitchenDone && typeof d.kitchenDone === "object") {
        setDoneMap(new Map(Object.entries(d.kitchenDone as Record<string, number>)));
      }
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refetch, 12000);
    return () => clearInterval(id);
  }, [refetch]);

  // Un ítem está completado sólo mientras la cantidad completada cubra la actual.
  // Si entran pedidos nuevos que la aumentan, se reabre solo (trazabilidad).
  const isDone = useCallback(
    (key: string, qty: number) => {
      const dq = doneMap.get(key);
      return dq !== undefined && qty <= dq;
    },
    [doneMap]
  );

  const toggle = useCallback(
    async (key: string, qty: number, next: boolean) => {
      // Optimista
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
          body: JSON.stringify({ windowId: win.id, key, done: next, qty }),
        });
        if (r.ok) {
          const d = await r.json();
          if (d.done && typeof d.done === "object") {
            setDoneMap(new Map(Object.entries(d.done as Record<string, number>)));
          }
        } else {
          refetch(); // revertir al estado del servidor
        }
      } catch {
        refetch();
      }
    },
    [win.id, refetch]
  );

  const windowOrders = useMemo(() => orders.filter((o) => o.windowId === win.id), [orders, win.id]);
  const agg = useMemo(() => aggregate(windowOrders, onlyPaid), [windowOrders, onlyPaid]);

  const countDone = (rows: [string, number][], kind: Kind) =>
    rows.reduce((n, [name, qty]) => n + (isDone(itemKey(kind, name), qty) ? 1 : 0), 0);
  const dishDone = countDone(agg.dishes, "dish");
  const marketDone = countDone(agg.market, "market");

  return (
    <>
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
          <div className="v" style={{ fontSize: "1.05rem" }}>{win.label}</div>
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
        completado, se reabre solo para no perder de vista lo que falta.
      </p>
    </>
  );
}
