"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/types";
import { crc } from "@/lib/format";
import type { WinOpt } from "./WindowTabs";

interface Data {
  orders: Order[];
  cuposTotales: number;
  cycleWindows: WinOpt[];   // entregas del ciclo actual (viernes + lunes)
  deliveryWindows: WinOpt[]; // rango de viernes/lunes para reasignar un pedido
}

const shortWinLabel = (label: string) => label.replace(/^Entrega\s+/i, "");

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("es-CR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function itemsSummary(o: Order): string {
  const parts = o.dishes.map((d) => `${d.qty}× ${d.name}`);
  o.market.forEach((m) => parts.push(`${m.qty}× ${m.name}`));
  return parts.join(" · ");
}

export function OrdersView({ initial }: { initial: Data }) {
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const [busyId, setBusyId] = useState<string>("");
  const [selTab, setSelTab] = useState<string>(initial.cycleWindows[0]?.id || "hist");

  const cuposTotales = initial.cuposTotales;
  const cycleIds = useMemo(() => new Set(initial.cycleWindows.map((w) => w.id)), [initial.cycleWindows]);

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
    const id = setInterval(refetch, 15000);
    return () => clearInterval(id);
  }, [refetch]);

  async function patchOrder(o: Order, patch: { status?: Order["status"]; completed?: boolean }) {
    setBusyId(o.id);
    try {
      const r = await fetch(`/api/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await r.json();
      if (r.ok) setOrders((prev) => prev.map((x) => (x.id === o.id ? d.order : x)));
    } finally {
      setBusyId("");
    }
  }
  const togglePaid = (o: Order) =>
    patchOrder(o, { status: o.status === "pagado" ? "pendiente" : "pagado" });
  const toggleCompleted = (o: Order) => patchOrder(o, { completed: !o.completed });

  async function changeWindow(o: Order, windowId: string) {
    if (windowId === o.windowId) return;
    setBusyId(o.id);
    try {
      const r = await fetch(`/api/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ window: windowId }),
      });
      const d = await r.json();
      if (r.ok) refetch();
      else alert(d.error || "No se pudo cambiar la entrega.");
    } finally {
      setBusyId("");
    }
  }

  async function renumberOrder(o: Order) {
    const input = window.prompt(
      `Nuevo número de orden para ${o.customerName} (actual: ${o.seq}).\nSe usa para alinear con la numeración real del sistema.`,
      String(o.seq)
    );
    if (input == null) return;
    const n = parseInt(input.trim(), 10);
    if (!Number.isFinite(n) || n < 1) {
      alert("Ingresá un número válido (mayor a 0).");
      return;
    }
    if (n === o.seq) return;
    setBusyId(o.id);
    try {
      const r = await fetch(`/api/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renumber: n }),
      });
      const d = await r.json();
      if (r.ok) refetch();
      else alert(d.error || "No se pudo renumerar el pedido.");
    } finally {
      setBusyId("");
    }
  }

  async function removeOrder(o: Order) {
    if (!confirm(`¿Eliminar el pedido ${o.id} de ${o.customerName}?\nEsta acción no se puede deshacer.`)) return;
    setBusyId(o.id);
    try {
      const r = await fetch(`/api/orders/${o.id}`, { method: "DELETE" });
      if (r.ok) {
        setOrders((prev) => prev.filter((x) => x.id !== o.id));
        refetch();
      }
    } finally {
      setBusyId("");
    }
  }

  // Opciones de entrega para un pedido: el rango de viernes/lunes + su ventana actual.
  const winOptionsFor = (o: Order): WinOpt[] => {
    const m = new Map<string, string>();
    m.set(o.windowId, o.windowLabel);
    for (const w of initial.deliveryWindows) m.set(w.id, w.label);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([id, label]) => ({ id, label }));
  };

  const isHist = selTab === "hist";
  const scoped = useMemo(
    () => (isHist ? orders.filter((o) => !cycleIds.has(o.windowId)) : orders.filter((o) => o.windowId === selTab)),
    [orders, isHist, selTab, cycleIds]
  );
  const histPending = useMemo(
    () => orders.filter((o) => !cycleIds.has(o.windowId) && !o.completed).length,
    [orders, cycleIds]
  );

  const stats = useMemo(() => {
    const paid = scoped.filter((o) => o.status === "pagado");
    return {
      pedidos: scoped.length,
      confirmados: paid.length,
      revenue: paid.reduce((s, o) => s + o.total, 0),
      disponibles: isHist ? null : Math.max(0, cuposTotales - paid.length),
    };
  }, [scoped, isHist, cuposTotales]);

  const tabLabel = isHist ? "Histórico" : shortWinLabel(initial.cycleWindows.find((w) => w.id === selTab)?.label || "");

  return (
    <>
      <div className="wtabs" role="tablist" aria-label="Entrega">
        {initial.cycleWindows.map((w) => (
          <button
            key={w.id}
            type="button"
            role="tab"
            aria-selected={selTab === w.id}
            className={`wtab${selTab === w.id ? " on" : ""}`}
            onClick={() => setSelTab(w.id)}
          >
            {shortWinLabel(w.label)}
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={isHist}
          className={`wtab${isHist ? " on" : ""}`}
          onClick={() => setSelTab("hist")}
        >
          Histórico
          {histPending > 0 && <span className="wtab-badge">{histPending}</span>}
        </button>
      </div>

      <div className="astat">
        <div className="box">
          <div className="k">Pedidos · {tabLabel}</div>
          <div className="v">{stats.pedidos}</div>
        </div>
        <div className="box">
          <div className="k">Confirmados</div>
          <div className="v">{stats.confirmados}</div>
        </div>
        <div className="box accent">
          <div className="k">Cupos disponibles</div>
          <div className="v">{stats.disponibles === null ? "—" : `${stats.disponibles} / ${cuposTotales}`}</div>
        </div>
        <div className="box">
          <div className="k">Ingreso confirmado</div>
          <div className="v tnum">{crc(stats.revenue)}</div>
        </div>
      </div>

      {scoped.length === 0 ? (
        <div className="otable">
          <div className="empty" style={{ padding: 20 }}>
            {isHist ? "No hay pedidos en el histórico." : "No hay pedidos en esta entrega."}
          </div>
        </div>
      ) : (
        <div className="otable">
          <div className="orow head">
            <span>N°</span>
            <span>Cliente</span>
            <span>Pedido</span>
            <span>Total</span>
            <span>Estado</span>
          </div>
          {scoped.map((o) => (
            <div className={`orow${o.completed ? " done" : ""}`} key={o.id}>
              <button
                className="ono ono-btn"
                onClick={() => renumberOrder(o)}
                disabled={busyId === o.id}
                title="Editar número de orden"
              >
                {o.id}
              </button>
              <span className="oname">
                {o.customerName}
                <small>
                  {o.whatsapp ? o.whatsapp + " · " : ""}
                  {fmtDate(o.createdAt)}
                </small>
                <select
                  className="wsel"
                  value={o.windowId}
                  onChange={(e) => changeWindow(o, e.target.value)}
                  disabled={busyId === o.id}
                  aria-label={`Día de entrega de ${o.id}`}
                  title="Cambiar día de entrega"
                >
                  {winOptionsFor(o).map((w) => (
                    <option key={w.id} value={w.id}>{shortWinLabel(w.label)}</option>
                  ))}
                </select>
              </span>
              <span className="oitems">
                {itemsSummary(o)}
                {o.notes ? ` — 📝 ${o.notes}` : ""}
              </span>
              <span className="ototal tnum">{crc(o.total)}</span>
              <span className="oact" style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <span className={`pill ${o.completed ? "done" : o.status === "pagado" ? "paid" : "pend"}`}>
                  {o.completed ? "Completado" : o.status === "pagado" ? "Pagado" : "Pendiente"}
                </span>
                <button className={`obtn ${o.status === "pagado" ? "paid" : ""}`} onClick={() => togglePaid(o)} disabled={busyId === o.id}>
                  {busyId === o.id ? "…" : o.status === "pagado" ? "Deshacer pago" : "Marcar pagado"}
                </button>
                <button className="obtn" onClick={() => toggleCompleted(o)} disabled={busyId === o.id}>
                  {o.completed ? "Reabrir" : "Completar"}
                </button>
                <button className="obtn danger" onClick={() => removeOrder(o)} disabled={busyId === o.id} title="Eliminar pedido" aria-label="Eliminar pedido">
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="wa-note" style={{ textAlign: "left", marginTop: 12 }}>
        Ves las entregas del <b>viernes</b> y <b>lunes</b> de esta semana; el resto queda en <b>Histórico</b>. Al
        marcar <b>pagado</b> se descuenta 1 cupo del contador del cliente. Tocá el <b>N°</b> para ajustar la
        numeración, o el <b>día de entrega</b> para mover un pedido. Se actualiza solo cada 15 s.
      </p>
    </>
  );
}
