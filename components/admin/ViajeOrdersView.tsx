"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order, ViajeEstado } from "@/lib/types";
import { crc } from "@/lib/format";
import { DaySelect, type DayOpt } from "./DaySelect";
import {
  PORTIONS_PER_TRAY,
  VIAJE_CATS,
  confirmPickupMessage,
  longDate,
  shortDate,
  orderTrays,
  plural,
  waNumber,
} from "@/lib/viaje";

interface Data {
  orders: Order[];
  today: string; // fecha de hoy en Costa Rica (AAAA-MM-DD)
  estado: ViajeEstado;
}

const ESTADO_TXT: Record<ViajeEstado, string> = {
  oculto: "Oculto: nadie lo ve",
  pronto: "«Disponible pronto»: los clientes ven la tarjeta atenuada",
  abierto: "Abierto: los clientes pueden pedir",
};

const fmtCreated = (iso: string) =>
  new Date(iso).toLocaleString("es-CR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const linesText = (o: Order) => (o.viaje || []).map((l) => `${l.qty}× ${l.name}`).join(" · ");

export function ViajeOrdersView({ initial }: { initial: Data }) {
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const [busyId, setBusyId] = useState("");
  const [sel, setSel] = useState("prox");
  const today = initial.today;

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/viaje/orders", { cache: "no-store" });
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

  async function patch(o: Order, body: Record<string, unknown>): Promise<boolean> {
    setBusyId(o.id);
    try {
      const r = await fetch(`/api/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (r.ok) {
        setOrders((prev) => prev.map((x) => (x.id === o.id ? d.order : x)));
        return true;
      }
      alert(d.error || "No se pudo guardar el cambio.");
      return false;
    } finally {
      setBusyId("");
    }
  }

  async function removeOrder(o: Order) {
    if (!confirm(`¿Eliminar el pedido ${o.id} de ${o.customerName}?\nEsta acción no se puede deshacer.`)) return;
    setBusyId(o.id);
    try {
      const r = await fetch(`/api/orders/${o.id}`, { method: "DELETE" });
      if (r.ok) setOrders((prev) => prev.filter((x) => x.id !== o.id));
    } finally {
      setBusyId("");
    }
  }

  /** Abre WhatsApp con la fecha escrita y deja la fecha marcada como confirmada. */
  async function confirmByWhatsApp(o: Order) {
    const num = waNumber(o.whatsapp);
    const link = num ? `https://wa.me/${num}?text=${encodeURIComponent(confirmPickupMessage(o))}` : "";
    if (link) window.open(link, "_blank", "noopener");
    if (!o.pickupConfirmed) await patch(o, { pickupConfirmed: true });
  }

  // Próximos retiros = no completados con fecha de hoy en adelante (o sin fecha). Histórico = el resto.
  const isUpcoming = useCallback((o: Order) => !o.completed && (o.pickupDate || today) >= today, [today]);
  const upcoming = useMemo(
    () => orders.filter(isUpcoming).sort((a, b) => (a.pickupDate || "").localeCompare(b.pickupDate || "") || a.seq - b.seq),
    [orders, isUpcoming]
  );
  const dates = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of upcoming) if (o.pickupDate) m.set(o.pickupDate, (m.get(o.pickupDate) || 0) + 1);
    return [...m.entries()];
  }, [upcoming]);
  const histCount = orders.length - upcoming.length;

  const options = useMemo<DayOpt[]>(
    () => [
      { id: "prox", label: "Todos los próximos retiros", badge: upcoming.length },
      ...dates.map(([d, n]) => ({ id: d, label: longDate(d), badge: n })),
      { id: "hist", label: "Histórico (entregados o pasados)", badge: histCount },
    ],
    [upcoming.length, dates, histCount]
  );
  // si la fecha elegida ya no tiene pedidos (se movieron), volvemos a «próximos»
  const selValid = options.some((o) => o.id === sel) ? sel : "prox";

  const scoped = useMemo(() => {
    if (selValid === "prox") return upcoming;
    if (selValid === "hist")
      return orders.filter((o) => !isUpcoming(o)).sort((a, b) => (b.pickupDate || "").localeCompare(a.pickupDate || "") || b.seq - a.seq);
    return upcoming.filter((o) => o.pickupDate === selValid);
  }, [selValid, upcoming, orders, isUpcoming]);

  // Qué cocinar: total por producto, agrupado por categoría (las bandejas, además, en porciones).
  const cook = useMemo(() => {
    const byItem = new Map<string, { id: string; cat: string; name: string; qty: number }>();
    for (const o of scoped) {
      for (const l of o.viaje || []) {
        const k = l.id;
        const cur = byItem.get(k);
        if (cur) cur.qty += l.qty;
        else byItem.set(k, { id: l.id, cat: l.cat, name: l.name, qty: l.qty });
      }
    }
    return VIAJE_CATS.map((c) => ({
      cat: c,
      items: [...byItem.values()].filter((i) => i.cat === c.id),
    })).filter((g) => g.items.length > 0);
  }, [scoped]);
  const totalTrays = useMemo(() => scoped.reduce((s, o) => s + orderTrays(o.viaje || []), 0), [scoped]);

  const stats = useMemo(() => {
    const paid = scoped.filter((o) => o.status === "pagado");
    return {
      pedidos: scoped.length,
      porConfirmar: scoped.filter((o) => !o.pickupConfirmed && isUpcoming(o)).length,
      revenue: paid.reduce((s, o) => s + o.total, 0),
      pending: scoped.filter((o) => o.status !== "pagado").reduce((s, o) => s + o.total, 0),
    };
  }, [scoped, isUpcoming]);

  return (
    <>
      <div className={`vj-estado ${initial.estado}`}>
        <span className="dot" aria-hidden="true" />
        <span>
          <b>Estado en el sitio:</b> {ESTADO_TXT[initial.estado]}. Se cambia en <a href="/admin/contenido#viaje">Contenido → Viaje Sano</a>.
        </span>
      </div>

      <div className="wtabs">
        <DaySelect options={options} value={selValid} onChange={setSel} label="Retiro" />
      </div>

      <div className="astat">
        <div className="box">
          <div className="k">Pedidos</div>
          <div className="v">{stats.pedidos}</div>
        </div>
        <div className="box accent">
          <div className="k">Bandejas a cocinar</div>
          <div className="v">{totalTrays}</div>
        </div>
        <div className="box">
          <div className="k">Fecha por confirmar</div>
          <div className="v">{stats.porConfirmar}</div>
        </div>
        <div className="box">
          <div className="k">Cobrado · por cobrar</div>
          <div className="v tnum" style={{ fontSize: "1.05rem" }}>
            {crc(stats.revenue)} · {crc(stats.pending)}
          </div>
        </div>
      </div>

      {cook.length > 0 && (
        <div className="editcard vj-cook">
          <h3>Qué cocinar</h3>
          <p className="sub">
            Suma de los pedidos de esta vista. 1 bandeja = {PORTIONS_PER_TRAY} porciones. Los extras (proteínas, salsas, arroz…) se cuentan por unidad.
          </p>
          <div className="vj-cook-grid">
            {cook.map(({ cat, items }) => {
              const catQty = items.reduce((s, i) => s + i.qty, 0);
              return (
                <div className="vj-cook-cat" key={cat.id}>
                  <div className="vj-cook-h">
                    <span>{cat.name}</span>
                    <b>
                      {catQty} {cat.tray ? plural(catQty, "bandeja", "bandejas") : plural(catQty, "unidad", "unidades")}
                      {cat.tray ? ` · ${catQty * PORTIONS_PER_TRAY} porciones` : ""}
                    </b>
                  </div>
                  <ul>
                    {items.map((i) => (
                      <li key={i.id}>
                        <span>{i.name}</span>
                        <b>×{i.qty}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {scoped.length === 0 ? (
        <div className="otable">
          <div className="empty" style={{ padding: 20 }}>
            {selValid === "hist" ? "No hay pedidos en el histórico." : "Todavía no hay pedidos de Viaje Sano en esta vista."}
          </div>
        </div>
      ) : (
        <div className="otable vj-otable">
          <div className="orow head">
            <span>N°</span>
            <span>Cliente · retiro</span>
            <span>Pedido</span>
            <span>Total</span>
            <span>Estado</span>
          </div>
          {scoped.map((o) => {
            const busy = busyId === o.id;
            const num = waNumber(o.whatsapp);
            return (
              <div className={`orow${o.completed ? " done" : ""}`} key={o.id}>
                <span className="ono">{o.id}</span>
                <span className="oname">
                  {o.customerName}
                  <small>
                    {o.whatsapp ? o.whatsapp + " · " : ""}
                    {fmtCreated(o.createdAt)}
                  </small>
                  <span className="vj-date">
                    <input
                      type="date"
                      value={o.pickupDate || ""}
                      onChange={(e) => e.target.value && patch(o, { pickupDate: e.target.value })}
                      disabled={busy}
                      aria-label={`Fecha de retiro de ${o.id}`}
                      title="Cambiar la fecha de retiro (queda por confirmar de nuevo)"
                    />
                    <span className={`pill ${o.pickupConfirmed ? "paid" : "pend"}`}>
                      {o.pickupConfirmed ? "Fecha confirmada" : "Por confirmar"}
                    </span>
                  </span>
                </span>
                <span className="oitems">
                  {o.viajePack ? <b>Pack {o.viajePack}: </b> : null}
                  {linesText(o)}
                  {o.viajeGift ? ` — 🎁 ${o.viajeGift}` : ""}
                  {o.notes ? ` — 📝 ${o.notes}` : ""}
                  <small className="vj-trays">
                    {orderTrays(o.viaje || [])} {plural(orderTrays(o.viaje || []), "bandeja", "bandejas")} · {shortDate(o.pickupDate || today)}
                  </small>
                </span>
                <span className="ototal tnum">{crc(o.total)}</span>
                <span className="oact" style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <span className={`pill ${o.completed ? "done" : o.status === "pagado" ? "paid" : "pend"}`}>
                    {o.completed ? "Entregado" : o.status === "pagado" ? "Pagado" : "Pendiente"}
                  </span>
                  <button
                    className="obtn remind"
                    onClick={() => confirmByWhatsApp(o)}
                    disabled={busy || !num}
                    title={num ? `Escribirle a ${o.whatsapp} para confirmar fecha y hora` : "El cliente no dejó teléfono"}
                  >
                    {o.pickupConfirmed ? "Reenviar fecha" : "Confirmar fecha"}
                  </button>
                  <button
                    className={`obtn ${o.status === "pagado" ? "paid" : ""}`}
                    onClick={() => patch(o, { status: o.status === "pagado" ? "pendiente" : "pagado" })}
                    disabled={busy}
                  >
                    {busy ? "…" : o.status === "pagado" ? "Deshacer pago" : "Marcar pagado"}
                  </button>
                  <button className="obtn" onClick={() => patch(o, { completed: !o.completed })} disabled={busy}>
                    {o.completed ? "Reabrir" : "Entregado"}
                  </button>
                  <button className="obtn danger" onClick={() => removeOrder(o)} disabled={busy} title="Eliminar pedido" aria-label="Eliminar pedido">
                    ✕
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="wa-note" style={{ textAlign: "left", marginTop: 12 }}>
        Los pedidos de Viaje Sano <b>no usan cupos</b> ni aparecen en Pedidos, Resumen cocina, Etiquetas ni en las métricas
        del menú semanal: el ingreso sí suma al mes en Analítica. El cliente elige la fecha; vos la confirmás por WhatsApp
        con <b>Confirmar fecha</b> (abre el mensaje ya escrito). Si movés la fecha, queda <b>Por confirmar</b> otra vez.
        {" "}Se actualiza solo cada 15 s.
      </p>
    </>
  );
}
