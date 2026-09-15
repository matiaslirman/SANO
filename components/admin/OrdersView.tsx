"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/types";
import { crc } from "@/lib/format";

interface Cupos {
  totales: number;
  disponibles: number;
  confirmados: number;
}
interface Win {
  id: string;
  label: string;
}
interface Data {
  orders: Order[];
  cupos: Cupos;
  window: Win;
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
  const [win, setWin] = useState<Win>(initial.window);
  const [busyId, setBusyId] = useState<string>("");

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { cache: "no-store" });
      if (!r.ok) return;
      const d: Data = await r.json();
      setOrders(d.orders);
      setCupos(d.cupos);
      setWin(d.window);
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refetch, 15000);
    return () => clearInterval(id);
  }, [refetch]);

  async function togglePaid(o: Order) {
    setBusyId(o.id);
    const nextStatus = o.status === "pagado" ? "pendiente" : "pagado";
    try {
      const r = await fetch(`/api/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
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

  const stats = useMemo(() => {
    const inWindow = orders.filter((o) => o.windowId === win.id);
    const paidWindow = inWindow.filter((o) => o.status === "pagado");
    const revenue = paidWindow.reduce((s, o) => s + o.total, 0);
    return { pedidos: inWindow.length, confirmados: paidWindow.length, revenue };
  }, [orders, win.id]);

  return (
    <>
      <div className="astat">
        <div className="box">
          <div className="k">Pedidos · {win.label}</div>
          <div className="v">{stats.pedidos}</div>
        </div>
        <div className="box">
          <div className="k">Confirmados</div>
          <div className="v">{stats.confirmados}</div>
        </div>
        <div className="box accent">
          <div className="k">Cupos disponibles</div>
          <div className="v">
            {cupos.disponibles} / {cupos.totales}
          </div>
        </div>
        <div className="box">
          <div className="k">Ingreso confirmado</div>
          <div className="v tnum">{crc(stats.revenue)}</div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="otable">
          <div className="empty" style={{ padding: 20 }}>
            Todavía no hay pedidos. Aparecerán acá apenas un cliente envíe uno.
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
          {orders.map((o) => (
            <div className="orow" key={o.id}>
              <span className="ono">{o.id}</span>
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
              <span className="oact" style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                <span className={`pill ${o.status === "pagado" ? "paid" : "pend"}`}>
                  {o.status === "pagado" ? "Pagado" : "Pendiente"}
                </span>
                <button className={`obtn ${o.status === "pagado" ? "paid" : ""}`} onClick={() => togglePaid(o)} disabled={busyId === o.id}>
                  {busyId === o.id ? "…" : o.status === "pagado" ? "Deshacer" : "Marcar pagado"}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="wa-note" style={{ textAlign: "left", marginTop: 12 }}>
        Al marcar un pedido como <b>pagado</b> se descuenta 1 cupo automáticamente del contador que ven los
        clientes. Se actualiza solo cada 15 s.
      </p>
    </>
  );
}
