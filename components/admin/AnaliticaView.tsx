"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order, ComboTier } from "@/lib/types";
import { crc } from "@/lib/format";

function RankBars({ rows, unit }: { rows: { label: string; value: number; sub?: string }[]; unit?: string }) {
  if (rows.length === 0) return <div className="empty" style={{ padding: 16 }}>Sin datos todavía.</div>;
  const max = rows[0]?.value || 1;
  return (
    <div className="kgrid">
      {rows.map((r, i) => (
        <div className="krow" key={r.label}>
          <span className="kqty tnum">
            {r.value}
            {unit ? <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}> {unit}</span> : null}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kname">
              <span style={{ color: "var(--muted)", fontWeight: 700, marginRight: 6 }}>{i + 1}.</span>
              {r.label}
            </div>
            {r.sub && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{r.sub}</div>}
          </div>
          <div className="kbar">
            <i style={{ width: `${Math.round((r.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnaliticaView({ initial }: { initial: { orders: Order[]; combos: ComboTier[] } }) {
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const combos = initial.combos;

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

  const a = useMemo(() => {
    const paid = orders.filter((o) => o.status === "pagado");
    const ingreso = paid.reduce((s, o) => s + o.total, 0);
    const ingresoPlatos = paid.reduce((s, o) => s + o.dishesTotal, 0);
    const ingresoMarket = paid.reduce((s, o) => s + o.marketTotal, 0);
    const platos = paid.reduce((s, o) => s + o.dishesQty, 0);
    const marketItems = paid.reduce((s, o) => s + o.market.reduce((x, m) => x + m.qty, 0), 0);
    const ticket = paid.length ? Math.round(ingreso / paid.length) : 0;

    const dishMap: Record<string, number> = {};
    const mkMap: Record<string, { qty: number; rev: number }> = {};
    const winMap: Record<string, { label: string; count: number; ingreso: number }> = {};
    for (const o of paid) {
      for (const d of o.dishes) dishMap[d.name] = (dishMap[d.name] || 0) + d.qty;
      for (const m of o.market) {
        mkMap[m.name] = mkMap[m.name] || { qty: 0, rev: 0 };
        mkMap[m.name].qty += m.qty;
        mkMap[m.name].rev += m.subtotal;
      }
      const w = (winMap[o.windowId] = winMap[o.windowId] || {
        label: o.windowLabel || o.windowId,
        count: 0,
        ingreso: 0,
      });
      w.count += 1;
      w.ingreso += o.total;
    }

    const topDishes = Object.entries(dishMap)
      .map(([label, value]) => ({ label, value }))
      .sort((x, y) => y.value - x.value)
      .slice(0, 8);
    const topMarket = Object.entries(mkMap)
      .map(([label, v]) => ({ label, value: v.qty, sub: crc(v.rev) }))
      .sort((x, y) => y.value - x.value)
      .slice(0, 8);
    const byWindow = Object.values(winMap).sort((x, y) => y.ingreso - x.ingreso);

    // Distribución por tamaño de pedido (combos)
    const tiers = [...combos].sort((x, y) => x.min - y.min);
    const comboDist = tiers.map((t, i) => {
      const nextMin = tiers[i + 1]?.min ?? Infinity;
      const count = paid.filter((o) => o.dishesQty >= t.min && o.dishesQty < nextMin).length;
      return { label: `Combo ${t.min}${nextMin === Infinity ? "+" : `–${nextMin - 1}`} platos`, value: count };
    });
    const sueltos = paid.filter((o) => o.dishesQty > 0 && (tiers.length === 0 || o.dishesQty < tiers[0].min)).length;
    if (sueltos > 0) comboDist.unshift({ label: "Sueltos (sin combo)", value: sueltos });

    return {
      ingreso, ingresoPlatos, ingresoMarket, platos, marketItems, ticket,
      pagados: paid.length, total: orders.length, pendientes: orders.length - paid.length,
      topDishes, topMarket, byWindow, comboDist: comboDist.filter((c) => c.value > 0),
    };
  }, [orders, combos]);

  const hasPaid = a.pagados > 0;

  return (
    <>
      <div className="astat">
        <div className="box accent">
          <div className="k">Ingreso confirmado</div>
          <div className="v tnum">{crc(a.ingreso)}</div>
        </div>
        <div className="box">
          <div className="k">Pedidos pagados</div>
          <div className="v">{a.pagados}<span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 400 }}> / {a.total}</span></div>
        </div>
        <div className="box">
          <div className="k">Ticket promedio</div>
          <div className="v tnum">{crc(a.ticket)}</div>
        </div>
        <div className="box">
          <div className="k">Platos vendidos</div>
          <div className="v">{a.platos}</div>
        </div>
      </div>

      <div className="astat" style={{ marginTop: 12 }}>
        <div className="box">
          <div className="k">Ingreso en platos</div>
          <div className="v tnum" style={{ fontSize: "1.35rem" }}>{crc(a.ingresoPlatos)}</div>
        </div>
        <div className="box">
          <div className="k">Ingreso en Market</div>
          <div className="v tnum" style={{ fontSize: "1.35rem" }}>{crc(a.ingresoMarket)}</div>
        </div>
        <div className="box">
          <div className="k">Ítems de Market</div>
          <div className="v">{a.marketItems}</div>
        </div>
        <div className="box">
          <div className="k">Pendientes por cobrar</div>
          <div className="v">{a.pendientes}</div>
        </div>
      </div>

      {!hasPaid ? (
        <div className="otable" style={{ marginTop: 20 }}>
          <div className="empty" style={{ padding: 20 }}>
            Todavía no hay pedidos <b>pagados</b>. La analítica cuenta solo pedidos confirmados (pagados) para que
            los números sean 100% reales.
          </div>
        </div>
      ) : (
        <>
          <div className="klabel" style={{ marginTop: 22 }}>Platos más vendidos</div>
          <RankBars rows={a.topDishes} unit="ud" />

          <div className="klabel">Sano Market más vendido</div>
          <RankBars rows={a.topMarket} unit="ud" />

          {a.comboDist.length > 0 && (
            <>
              <div className="klabel">Tamaño de pedido</div>
              <RankBars rows={a.comboDist} unit="ped." />
            </>
          )}

          <div className="klabel">Ingreso por entrega</div>
          <div className="otable">
            <div className="orow head" style={{ gridTemplateColumns: "1.6fr auto auto" }}>
              <span>Entrega</span>
              <span>Pedidos</span>
              <span>Ingreso</span>
            </div>
            {a.byWindow.map((w) => (
              <div className="orow" key={w.label} style={{ gridTemplateColumns: "1.6fr auto auto" }}>
                <span className="oname">{w.label.replace(/^Entrega\s+/i, "")}</span>
                <span className="tnum">{w.count}</span>
                <span className="ototal tnum">{crc(w.ingreso)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="wa-note" style={{ textAlign: "left", marginTop: 12 }}>
        Todos los números salen de los pedidos marcados como <b>pagados</b> — sin estimaciones. Se actualiza solo
        cada 20 s.
      </p>
    </>
  );
}
