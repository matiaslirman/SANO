"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/types";
import { crc } from "@/lib/format";
import { WindowTabs, deriveWindows, pastPendingOrders, type WinOpt } from "./WindowTabs";

interface Cupos {
  totales: number;
  disponibles: number;
  confirmados: number;
}
interface Data {
  orders: Order[];
  cupos: Cupos;
  window: WinOpt;
}

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
  const [cupos, setCupos] = useState<Cupos>(initial.cupos);
  const [activeWin, setActiveWin] = useState<WinOpt>(initial.window);
  const [selWin, setSelWin] = useState<string>(initial.window.id);
  const [busyId, setBusyId] = useState<string>("");

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { cache: "no-store" });
      if (!r.ok) return;
      const d: Data = await r.json();
      setOrders(d.orders);
      setCupos(d.cupos);
      setActiveWin(d.window);
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
      if (r.ok) {
        setOrders((prev) => prev.map((x) => (x.id === o.id ? d.order : x)));
        setCupos(d.cupos);
      }
    } finally {
      setBusyId("");
    }
  }
  const togglePaid = (o: Order) =>
    patchOrder(o, { status: o.status === "pagado" ? "pendiente" : "pagado" });
  const toggleCompleted = (o: Order) => patchOrder(o, { completed: !o.completed });

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

  const windows = useMemo(() => deriveWindows(orders, activeWin), [orders, activeWin]);
  const selLabel = selWin === "all" ? "Todas las ventanas" : windows.find((w) => w.id === selWin)?.label || activeWin.label;

  const scoped = useMemo(
    () => (selWin === "all" ? orders : orders.filter((o) => o.windowId === selWin)),
    [orders, selWin]
  );

  const pending = useMemo(() => pastPendingOrders(orders, activeWin.id), [orders, activeWin.id]);
  const jumpWin = useMemo(() => pending.reduce((mx, o) => (o.windowId > mx ? o.windowId : mx), ""), [pending]);

  const stats = useMemo(() => {
    const paid = scoped.filter((o) => o.status === "pagado");
    const revenue = paid.reduce((s, o) => s + o.total, 0);
    const disponibles =
      selWin === "all" ? cupos.disponibles : Math.max(0, cupos.totales - paid.length);
    return { pedidos: scoped.length, confirmados: paid.length, revenue, disponibles };
  }, [scoped, selWin, cupos]);

  return (
    <>
      {pending.length > 0 && selWin !== jumpWin && (
        <div className="walert">
          <span>
            ⚠️ Tenés <b>{pending.length}</b> pedido{pending.length > 1 ? "s" : ""} de entregas anteriores sin
            completar — no se te pierden.
          </span>
          <button className="walert-btn" onClick={() => setSelWin(jumpWin)}>
            Ver esos pedidos →
          </button>
        </div>
      )}

      <WindowTabs windows={windows} selected={selWin} activeId={activeWin.id} onSelect={setSelWin} includeAll />

      <div className="astat">
        <div className="box">
          <div className="k">Pedidos · {selWin === "all" ? "Todas" : selLabel.replace(/^Entrega\s+/i, "")}</div>
          <div className="v">{stats.pedidos}</div>
        </div>
        <div className="box">
          <div className="k">Confirmados</div>
          <div className="v">{stats.confirmados}</div>
        </div>
        <div className="box accent">
          <div className="k">Cupos disponibles</div>
          <div className="v">
            {stats.disponibles} / {cupos.totales}
          </div>
        </div>
        <div className="box">
          <div className="k">Ingreso confirmado</div>
          <div className="v tnum">{crc(stats.revenue)}</div>
        </div>
      </div>

      {scoped.length === 0 ? (
        <div className="otable">
          <div className="empty" style={{ padding: 20 }}>
            No hay pedidos en esta ventana.
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
                  {fmtDate(o.createdAt)} · {o.windowLabel}
                </small>
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
        Al marcar un pedido como <b>pagado</b> se descuenta 1 cupo automáticamente del contador que ven los
        clientes. Se actualiza solo cada 15 s. Tocá el <b>N°</b> de un pedido para ajustarlo a tu numeración real.
      </p>
    </>
  );
}
