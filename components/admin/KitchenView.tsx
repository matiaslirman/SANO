"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/types";

interface Win {
  id: string;
  label: string;
}

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

function Bars({ rows }: { rows: [string, number][] }) {
  const max = rows.length ? rows[0][1] : 1;
  if (rows.length === 0) return <div className="empty" style={{ padding: 16 }}>Sin ítems todavía.</div>;
  return (
    <div className="kgrid">
      {rows.map(([name, qty]) => (
        <div className="krow" key={name}>
          <span className="kqty tnum">{qty}×</span>
          <div style={{ flex: 1 }}>
            <div className="kname">{name}</div>
          </div>
          <div className="kbar">
            <i style={{ width: `${Math.round((qty / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function KitchenView({ initial }: { initial: { orders: Order[]; window: Win } }) {
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const [win, setWin] = useState<Win>(initial.window);
  const [onlyPaid, setOnlyPaid] = useState(false);

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setOrders(d.orders);
      setWin(d.window);
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refetch, 12000);
    return () => clearInterval(id);
  }, [refetch]);

  const windowOrders = useMemo(() => orders.filter((o) => o.windowId === win.id), [orders, win.id]);
  const agg = useMemo(() => aggregate(windowOrders, onlyPaid), [windowOrders, onlyPaid]);

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

      <div className="klabel" style={{ marginTop: 6 }}>Platos listos — a producir</div>
      <Bars rows={agg.dishes} />

      <div className="klabel">Sano Market — a preparar</div>
      <Bars rows={agg.market} />

      <p className="wa-note" style={{ textAlign: "left", marginTop: 12 }}>
        Se consolida en tiempo real (cada 12 s) a medida que entran pedidos — base para compras de insumos y
        planificación de cocina.
      </p>
    </>
  );
}
