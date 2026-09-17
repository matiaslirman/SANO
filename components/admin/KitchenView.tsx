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
  done,
  onToggle,
}: {
  rows: [string, number][];
  kind: Kind;
  done: Set<string>;
  onToggle: (key: string, next: boolean) => void;
}) {
  const max = rows.length ? rows[0][1] : 1;
  if (rows.length === 0) return <div className="empty" style={{ padding: 16 }}>Sin ítems todavía.</div>;
  return (
    <div className="kgrid">
      {rows.map(([name, qty]) => {
        const key = itemKey(kind, name);
        const isDone = done.has(key);
        return (
          <div className={`krow${isDone ? " done" : ""}`} key={key}>
            <button
              type="button"
              className="kcheck"
              aria-pressed={isDone}
              aria-label={isDone ? `Reabrir ${name}` : `Completar ${name}`}
              title={isDone ? "Reabrir" : "Marcar completado"}
              onClick={() => onToggle(key, !isDone)}
            >
              {isDone ? "✓" : ""}
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

function progress(rows: [string, number][], kind: Kind, done: Set<string>) {
  const total = rows.length;
  const listos = rows.reduce((n, [name]) => n + (done.has(itemKey(kind, name)) ? 1 : 0), 0);
  return { total, listos };
}

export function KitchenView({ initial }: { initial: { orders: Order[]; window: Win; done: string[] } }) {
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const [win, setWin] = useState<Win>(initial.window);
  const [onlyPaid, setOnlyPaid] = useState(false);
  const [done, setDone] = useState<Set<string>>(() => new Set(initial.done || []));

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setOrders(d.orders);
      setWin(d.window);
      if (Array.isArray(d.kitchenDone)) setDone(new Set<string>(d.kitchenDone));
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refetch, 12000);
    return () => clearInterval(id);
  }, [refetch]);

  const toggle = useCallback(
    async (key: string, next: boolean) => {
      // Optimista: reflejar el cambio de inmediato.
      setDone((prev) => {
        const s = new Set(prev);
        if (next) s.add(key);
        else s.delete(key);
        return s;
      });
      try {
        const r = await fetch("/api/kitchen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ windowId: win.id, key, done: next }),
        });
        if (r.ok) {
          const d = await r.json();
          if (Array.isArray(d.done)) setDone(new Set<string>(d.done));
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
  const dishProg = progress(agg.dishes, "dish", done);
  const marketProg = progress(agg.market, "market", done);

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
        {dishProg.total > 0 && (
          <span className={`kprog${dishProg.listos === dishProg.total ? " all" : ""}`}>
            {dishProg.listos}/{dishProg.total} listos
          </span>
        )}
      </div>
      <Bars rows={agg.dishes} kind="dish" done={done} onToggle={toggle} />

      <div className="klabel">
        Sano Market — a preparar
        {marketProg.total > 0 && (
          <span className={`kprog${marketProg.listos === marketProg.total ? " all" : ""}`}>
            {marketProg.listos}/{marketProg.total} listos
          </span>
        )}
      </div>
      <Bars rows={agg.market} kind="market" done={done} onToggle={toggle} />

      <p className="wa-note" style={{ textAlign: "left", marginTop: 12 }}>
        Marcá cada ítem como <b>completado</b> a medida que lo producís — el check se comparte con las otras
        pantallas de cocina y se sincroniza en tiempo real (cada 12 s).
      </p>
    </>
  );
}
