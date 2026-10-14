"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order, ComboTier, MonthlyIncome } from "@/lib/types";
import { crc } from "@/lib/format";
import { crMonthKey, currentMonthKey, monthLabel, reconcileMonths } from "@/lib/months";
import { DaySelect, type DayOpt } from "./DaySelect";

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

export function AnaliticaView({
  initial,
}: {
  initial: { orders: Order[]; combos: ComboTier[]; history: MonthlyIncome[] };
}) {
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const combos = initial.combos;
  const history = initial.history;
  const [prodWin, setProdWin] = useState<string>("all");

  // Mes elegido: "cur" = mes en curso (se corre solo al cambiar de mes), "all" = todo el tiempo, o "YYYY-MM".
  const [sel, setSel] = useState<string>("cur");
  const [now, setNow] = useState<Date>(() => new Date());

  // Ingreso por mes: pedidos pagados por fecha del pedido (hora CR) + consolidado manual, sin duplicar.
  const monthly = useMemo(() => reconcileMonths(orders, history, now), [orders, history, now]);
  const curKey = currentMonthKey(now);
  const selKey = sel === "cur" ? curKey : sel;
  const scoped = useMemo(
    () => (sel === "all" ? orders : orders.filter((o) => crMonthKey(o.createdAt) === selKey)),
    [orders, sel, selKey]
  );
  const monthOptions = useMemo<DayOpt[]>(() => {
    const opts: DayOpt[] = [
      { id: "cur", label: `${monthLabel(curKey)} (mes actual)` },
      { id: "all", label: "Todo el tiempo" },
    ];
    for (const r of [...monthly].reverse()) {
      if (r.month !== curKey && r.orders > 0) opts.push({ id: r.month, label: r.label });
    }
    return opts;
  }, [monthly, curKey]);
  const selRow = monthly.find((r) => r.month === selKey);

  // Histórico del negocio (todos los meses, más reciente primero), con la variación contra el mes anterior.
  const hist = useMemo(() => {
    const withData = monthly.filter((r) => r.income > 0);
    const total = withData.reduce((s, r) => s + r.income, 0);
    const avg = withData.length ? Math.round(total / withData.length) : 0;
    const best = withData.length ? withData.reduce((m, r) => (r.income > m.income ? r : m), withData[0]) : null;
    const current = monthly.find((r) => r.month === curKey) || null;
    const rows = monthly
      .map((r, i) => {
        const prev = i > 0 ? monthly[i - 1].income : 0;
        // el mes en curso está a medias: compararlo contra un mes completo engaña
        const delta = r.month === curKey || i === 0 || prev <= 0 ? null : Math.round(((r.income - prev) / prev) * 100);
        return { ...r, delta };
      })
      .reverse();
    return { total, avg, best, current, rows };
  }, [monthly, curKey]);

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d.orders)) setOrders(d.orders);
      setNow(new Date()); // el mes en curso se corre solo al cambiar de mes
    } catch {
      /* silencioso */
    }
  }, []);
  useEffect(() => {
    const id = setInterval(refetch, 20000);
    return () => clearInterval(id);
  }, [refetch]);

  const a = useMemo(() => {
    const paid = scoped.filter((o) => o.status === "pagado");
    const ingreso = paid.reduce((s, o) => s + o.total, 0);
    const ingresoPlatos = paid.reduce((s, o) => s + o.dishesTotal + (o.extrasTotal || 0), 0);
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

    // Proyectado = todos los pedidos (pendientes + pagados); por cobrar = lo que falta confirmar
    const proyectado = scoped.reduce((s, o) => s + o.total, 0);
    const porCobrar = proyectado - ingreso;
    const tasaPago = scoped.length ? Math.round((paid.length / scoped.length) * 100) : 0;

    // Ventanas disponibles para la producción (más recientes primero)
    const winSeen: Record<string, { id: string; label: string }> = {};
    for (const o of scoped) {
      if (!winSeen[o.windowId]) winSeen[o.windowId] = { id: o.windowId, label: o.windowLabel || o.windowId };
    }
    const prodWindows = Object.values(winSeen).sort((x, y) => y.id.localeCompare(x.id));

    return {
      proyectado, porCobrar, tasaPago, prodWindows,
      ingreso, ingresoPlatos, ingresoMarket, platos, marketItems, ticket,
      pagados: paid.length, total: scoped.length, pendientes: scoped.length - paid.length,
      topDishes, topMarket, byWindow, comboDist: comboDist.filter((c) => c.value > 0),
    };
  }, [scoped, combos]);

  // Producción por plato: pendiente + pagado de la ventana elegida (o de todas)
  const prod = useMemo(() => {
    const inWin = prodWin === "all" ? scoped : scoped.filter((o) => o.windowId === prodWin);
    const map: Record<string, { total: number; paid: number }> = {};
    for (const o of inWin) {
      for (const d of o.dishes) {
        const m = (map[d.name] = map[d.name] || { total: 0, paid: 0 });
        m.total += d.qty;
        if (o.status === "pagado") m.paid += d.qty;
      }
    }
    const rows = Object.entries(map)
      .map(([label, m]) => ({
        label,
        value: m.total,
        sub: m.total === m.paid ? `${m.paid} pagados` : `${m.paid} pagados · ${m.total - m.paid} por confirmar`,
      }))
      .sort((x, y) => y.value - x.value);
    return { rows, units: rows.reduce((s, r) => s + r.value, 0), orders: inWin.length };
  }, [scoped, prodWin]);

  const hasOrders = a.total > 0;

  const headIncome = sel === "all" ? hist.total : selRow?.income ?? 0;
  const headSub =
    sel === "all"
      ? `${monthly.filter((r) => r.income > 0).length} meses`
      : selRow && selRow.source === "manual" && (selRow.manual ?? 0) > 0
      ? `Registro manual · la plataforma registra ${crc(selRow.platform)}`
      : `${selRow?.paidOrders ?? 0} pedidos pagados`;

  return (
    <>
      <div className="wtabs">
        <DaySelect
          label="Mes"
          options={monthOptions}
          value={sel}
          onChange={(v) => {
            setSel(v);
            setProdWin("all");
          }}
        />
      </div>

      <div className="astat">
        <div className="box accent">
          <div className="k">{sel === "all" ? "Ingreso total" : "Ingreso del mes"}</div>
          <div className="v tnum">{crc(headIncome)}</div>
          <div style={{ fontSize: 11.5, color: "var(--crema-soft)", marginTop: 3 }}>{headSub}</div>
        </div>
        <div className="box">
          <div className="k">Ingreso proyectado</div>
          <div className="v tnum">{crc(a.proyectado)}</div>
        </div>
        <div className="box">
          <div className="k">Por cobrar</div>
          <div className="v tnum">{crc(a.porCobrar)}</div>
        </div>
        <div className="box">
          <div className="k">Tasa de pago</div>
          <div className="v">{a.tasaPago}%<span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 400 }}> · {a.pagados} / {a.total}</span></div>
        </div>
      </div>

      <div className="astat" style={{ marginTop: 12 }}>
        <div className="box">
          <div className="k">Ticket promedio</div>
          <div className="v tnum" style={{ fontSize: "1.35rem" }}>{crc(a.ticket)}</div>
        </div>
        <div className="box">
          <div className="k">Ingreso en platos (pagados)</div>
          <div className="v tnum" style={{ fontSize: "1.35rem" }}>{crc(a.ingresoPlatos)}</div>
        </div>
        <div className="box">
          <div className="k">Ingreso en Market (pagados)</div>
          <div className="v tnum" style={{ fontSize: "1.35rem" }}>{crc(a.ingresoMarket)}</div>
        </div>
        <div className="box">
          <div className="k">Pedidos pendientes</div>
          <div className="v">{a.pendientes}</div>
        </div>
      </div>

      <div className="klabel" style={{ marginTop: 24 }}>
        Ingreso por mes
        <span className="kprog">{hist.rows.length} meses</span>
      </div>
      <div className="astat" style={{ marginTop: 0 }}>
        <div className="box accent">
          <div className="k">Total global</div>
          <div className="v tnum">{crc(hist.total)}</div>
        </div>
        <div className="box">
          <div className="k">Promedio mensual</div>
          <div className="v tnum" style={{ fontSize: "1.35rem" }}>{crc(hist.avg)}</div>
        </div>
        <div className="box">
          <div className="k">Mejor mes</div>
          <div className="v tnum" style={{ fontSize: "1.35rem" }}>{crc(hist.best?.income ?? 0)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{hist.best?.label ?? "—"}</div>
        </div>
        <div className="box">
          <div className="k">Mes en curso</div>
          <div className="v tnum" style={{ fontSize: "1.35rem" }}>{crc(hist.current?.income ?? 0)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{monthLabel(curKey)}</div>
        </div>
      </div>
      <div className="otable" style={{ marginTop: 14 }}>
        <div className="orow head" style={{ gridTemplateColumns: "1.6fr auto auto" }}>
          <span>Mes</span>
          <span>Ingreso</span>
          <span>vs. mes anterior</span>
        </div>
        {hist.rows.map((r) => (
          <div className="orow" key={r.month} style={{ gridTemplateColumns: "1.6fr auto auto" }}>
            <span className="oname">
              {r.label}
              <small>
                {r.month === curKey ? "mes en curso · " : ""}
                {r.source === "plataforma" ? "plataforma" : "registro manual"}
                {r.receivable > 0 ? ` · por cobrar ${crc(r.receivable)}` : ""}
              </small>
            </span>
            <span className="ototal tnum">{crc(r.income)}</span>
            <span
              className="tnum"
              style={{
                color: r.delta === null ? "var(--muted)" : r.delta > 0 ? "var(--ok)" : r.delta < 0 ? "var(--bordo)" : "var(--muted)",
                fontWeight: 600,
              }}
            >
              {r.delta === null ? "—" : `${r.delta > 0 ? "+" : ""}${r.delta}%`}
            </span>
          </div>
        ))}
      </div>
      <p className="wa-note" style={{ textAlign: "left", marginTop: 10 }}>
        El ingreso de cada mes son los pedidos <b>pagados</b>, agrupados por la <b>fecha del pedido</b> (hora de
        Costa Rica), y se actualiza solo. Si en <b>Contenido</b> cargaste un consolidado manual para ese mes, se
        muestra el <b>mayor</b> de los dos (así no se duplica ni se pierde nada). El mes en curso se compara
        recién cuando termina.
      </p>

      {!hasOrders ? (
        <div className="otable" style={{ marginTop: 20 }}>
          <div className="empty" style={{ padding: 20 }}>Todavía no hay pedidos {sel === "all" ? "" : "en este mes"}.</div>
        </div>
      ) : (
        <>
          <div className="aprod-head">
            <div className="klabel" style={{ margin: 0 }}>Producción por plato</div>
            <select
              className="aprod-sel"
              value={prodWin}
              onChange={(e) => setProdWin(e.target.value)}
              aria-label="Entrega"
            >
              <option value="all">Todas las entregas</option>
              {a.prodWindows.map((w) => (
                <option key={w.id} value={w.id}>{w.label.replace(/^Entrega\s+/i, "")}</option>
              ))}
            </select>
          </div>
          <p className="aprod-note">
            {prod.units} platos a preparar en {prod.orders} pedidos — cuenta <b>pagados y pendientes</b>.
          </p>
          <RankBars rows={prod.rows} unit="ud" />

          <div className="klabel" style={{ marginTop: 22 }}>Platos más vendidos (pagados)</div>
          <RankBars rows={a.topDishes} unit="ud" />

          <div className="klabel">Sano Market más vendido (pagados)</div>
          <RankBars rows={a.topMarket} unit="ud" />

          {a.comboDist.length > 0 && (
            <>
              <div className="klabel">Tamaño de pedido (pagados)</div>
              <RankBars rows={a.comboDist} unit="ped." />
            </>
          )}

          <div className="klabel">Ingreso confirmado por entrega</div>
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
        Las métricas de arriba corresponden al mes elegido. <b>Proyectado</b> = todos los pedidos (pagados y
        pendientes); <b>Por cobrar</b> = lo que falta marcar como pagado. El resto cuenta solo pedidos pagados. Se
        actualiza solo cada 20 s.
      </p>
    </>
  );
}
