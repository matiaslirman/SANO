"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BscPrep, BscSettings, Order } from "@/lib/types";
import { crc } from "@/lib/format";
import {
  BSC_CATS, PREP_FLOW, PREP_LABEL, accountsCsv, bscState, buildAccounts, crDateTimeLabel, crTime, eventTotals, prepOf,
  type BscAccount,
} from "@/lib/bsc";
import { BscEditor } from "./BscEditor";

type Filter = "todas" | "pendientes" | "abiertas";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "pendientes", label: "Pendientes de preparar" },
  { id: "abiertas", label: "Cuentas abiertas" },
];
const STATE_TXT = { before: "Todavía no abre", open: "Recibiendo pedidos", ended: "Ventana cerrada" } as const;

const nextPrep = (p: BscPrep): BscPrep => PREP_FLOW[Math.min(PREP_FLOW.indexOf(p) + 1, PREP_FLOW.length - 1)];
const prevPrep = (p: BscPrep): BscPrep => PREP_FLOW[Math.max(PREP_FLOW.indexOf(p) - 1, 0)];

export function BscView({ initial }: { initial: { orders: Order[]; settings: BscSettings } }) {
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const [settings, setSettings] = useState<BscSettings>(initial.settings);
  const [filter, setFilter] = useState<Filter>("todas");
  const [busy, setBusy] = useState("");
  const [now, setNow] = useState(() => new Date());

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/bsc/orders", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d.orders)) setOrders(d.orders);
      if (d.settings) setSettings(d.settings);
      setNow(new Date());
    } catch {
      /* silencioso */
    }
  }, []);
  useEffect(() => {
    const id = setInterval(refetch, 8000); // durante el servicio: se actualiza solo
    return () => clearInterval(id);
  }, [refetch]);

  const accounts = useMemo(() => buildAccounts(orders), [orders]);
  const totals = useMemo(() => eventTotals(accounts), [accounts]);
  const shown = useMemo(
    () =>
      accounts.filter((a) =>
        filter === "pendientes" ? a.pendingPrep > 0 : filter === "abiertas" ? !a.paid : true
      ),
    [accounts, filter]
  );
  const state = bscState(now, settings);
  const toPrepare = totals.items.filter((i) => i.pending > 0);

  const merge = (updated: Order[]) =>
    setOrders((prev) => prev.map((o) => updated.find((u) => u.id === o.id) || o));

  async function setPrep(o: Order, prep: BscPrep) {
    setBusy(o.id);
    try {
      const r = await fetch(`/api/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bscPrep: prep }),
      });
      const d = await r.json();
      if (r.ok) merge([d.order]);
      else alert(d.error || "No se pudo cambiar el estado.");
    } finally {
      setBusy("");
    }
  }

  async function setPaid(a: BscAccount, status: "pagado" | "pendiente") {
    setBusy(a.key);
    try {
      const r = await fetch("/api/bsc/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: a.orders.map((o) => o.id), status }),
      });
      const d = await r.json();
      if (r.ok) merge(d.orders);
      else alert(d.error || "No se pudo actualizar la cuenta.");
    } finally {
      setBusy("");
    }
  }

  async function removeOrder(o: Order) {
    if (!confirm(`¿Eliminar el pedido ${o.id} de ${o.customerName}?\nEsta acción no se puede deshacer.`)) return;
    setBusy(o.id);
    try {
      const r = await fetch(`/api/orders/${o.id}`, { method: "DELETE" });
      if (r.ok) setOrders((prev) => prev.filter((x) => x.id !== o.id));
    } finally {
      setBusy("");
    }
  }

  function downloadCsv() {
    const blob = new Blob([accountsCsv(accounts)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bistro-social-club-comanda.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className={`bsc-adm-state ${state}`}>
        <span className="dot" aria-hidden="true" />
        <span>
          <b>{settings.name}:</b> {STATE_TXT[state]}
          {!settings.enabled && " · interruptor APAGADO (sin pestaña ni pedidos)"}
          {" · "}
          {crDateTimeLabel(settings.availableFrom)} → {crDateTimeLabel(settings.availableUntil)} (hora de Costa Rica)
        </span>
        <a className="obtn" href="/bistro-social-club" target="_blank" rel="noopener noreferrer">Ver la página ↗</a>
      </div>

      <div className="astat bsc-adm-stats">
        <div className="box accent">
          <div className="k">Ventas del evento</div>
          <div className="v tnum">{crc(totals.ventas)}</div>
        </div>
        <div className="box">
          <div className="k">Cobrado</div>
          <div className="v tnum">{crc(totals.cobrado)}</div>
        </div>
        <div className="box">
          <div className="k">Por cobrar</div>
          <div className="v tnum">{crc(totals.porCobrar)}</div>
        </div>
        <div className="box">
          <div className="k">Cuentas abiertas</div>
          <div className="v">{totals.abiertas}<span className="of"> / {totals.cuentas}</span></div>
        </div>
        <div className="box">
          <div className="k">Promos aplicadas</div>
          <div className="v">{totals.promos}<span className="of"> · −{crc(totals.promoMonto)}</span></div>
        </div>
      </div>

      <div className="editcard bsc-adm-prep">
        <h3>Qué preparar ahora</h3>
        <p className="sub">Lo pedido que todavía no se entregó, para la barra y la cocina.</p>
        {toPrepare.length === 0 ? (
          <div className="empty">Nada pendiente. ✓</div>
        ) : (
          <div className="bsc-adm-prep-grid">
            {BSC_CATS.map((cat) => {
              const rows = toPrepare.filter((i) => i.cat === cat.id);
              if (!rows.length) return null;
              return (
                <div className="cat" key={cat.id}>
                  <div className="h">{cat.name}</div>
                  <ul>
                    {rows.map((i) => (
                      <li key={i.key}>
                        <span>{i.name}{i.variantName ? ` · ${i.variantName}` : ""}</span>
                        <b>×{i.pending}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bsc-adm-bar">
        <div className="bsc-adm-filters" role="group" aria-label="Filtrar cuentas">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={filter === f.id ? "on" : ""} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="bsc-adm-actions">
          <button type="button" className="obtn" onClick={downloadCsv} disabled={accounts.length === 0}>Exportar CSV</button>
          <button type="button" className="obtn" onClick={() => window.print()}>Imprimir</button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="otable">
          <div className="empty" style={{ padding: 20 }}>
            {accounts.length === 0 ? "Todavía no hay pedidos del evento." : "No hay cuentas en este filtro."}
          </div>
        </div>
      ) : (
        <div className="bsc-adm-accounts">
          {shown.map((a) => (
            <article className={`bsc-adm-acc${a.paid ? " paid" : ""}`} key={a.key}>
              <div className="hd">
                <div>
                  <h3>{a.name}</h3>
                  <p>
                    {a.whatsapp ? a.whatsapp : "sin teléfono"}
                    {a.table ? ` · ${a.table}` : ""}
                    {" · "}
                    {a.orders.length} {a.orders.length === 1 ? "pedido" : "pedidos"}
                  </p>
                </div>
                <div className="tot">
                  <span className={`pill ${a.paid ? "paid" : "pend"}`}>{a.paid ? "Pagada" : "Abierta"}</span>
                  <b className="tnum">{crc(a.total)}</b>
                </div>
              </div>

              <div className="orders">
                {a.orders.map((o) => {
                  const prep = prepOf(o);
                  return (
                    <div className={`ord ${prep}`} key={o.id}>
                      <div className="top">
                        <span className="id">{o.id} · {crTime(o.createdAt)}</span>
                        <span className="ctl">
                          {prep !== "recibido" && (
                            <button type="button" className="obtn" onClick={() => setPrep(o, prevPrep(prep))} disabled={busy === o.id} aria-label={`Volver ${o.id} a ${PREP_LABEL[prevPrep(prep)]}`}>↺</button>
                          )}
                          <button
                            type="button"
                            className={`prep ${prep}`}
                            onClick={() => prep !== "entregado" && setPrep(o, nextPrep(prep))}
                            disabled={busy === o.id || prep === "entregado"}
                            aria-label={`${o.id}: ${PREP_LABEL[prep]}${prep !== "entregado" ? `. Pasar a ${PREP_LABEL[nextPrep(prep)]}` : ""}`}
                          >
                            {PREP_LABEL[prep]}{prep !== "entregado" ? ` → ${PREP_LABEL[nextPrep(prep)]}` : " ✓"}
                          </button>
                          <button type="button" className="obtn danger" onClick={() => removeOrder(o)} disabled={busy === o.id} aria-label={`Eliminar ${o.id}`}>✕</button>
                        </span>
                      </div>
                      <ul>
                        {(o.bsc || []).map((l, i) => {
                          const free = a.promo.applied && a.promo.item?.orderId === o.id && a.promo.item.lineIndex === i;
                          return (
                            <li key={i}>
                              <span>{l.qty}× {l.name}{l.variantName ? ` · ${l.variantName}` : ""}{free ? <em> · incluido por promo</em> : null}</span>
                              <span className="tnum">{crc(l.subtotal)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <div className="ft">
                <div className="sum">
                  <span>Subtotal <b className="tnum">{crc(a.subtotal)}</b></span>
                  {a.promo.applied && <span className="promo">Promo ({a.promo.item?.name}) <b className="tnum">−{crc(a.promo.amount)}</b></span>}
                  <span>Total <b className="tnum">{crc(a.total)}</b></span>
                </div>
                <button
                  type="button"
                  className={`bsc-adm-pay${a.paid ? " undo" : ""}`}
                  onClick={() => setPaid(a, a.paid ? "pendiente" : "pagado")}
                  disabled={busy === a.key}
                >
                  {busy === a.key ? "…" : a.paid ? "Reabrir cuenta" : "Cuenta pagada"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="wa-note" style={{ textAlign: "left", marginTop: 14 }}>
        Cada persona es una cuenta: mismo <b>teléfono</b>, o mismo nombre si no dejó teléfono. Tocá el estado de un pedido para avanzarlo
        (<b>recibido → en preparación → entregado</b>); <b>Cuenta pagada</b> cierra todos sus pedidos y un pedido nuevo la vuelve a abrir.
        Los pedidos del evento no usan cupos ni aparecen en Pedidos, Resumen cocina, Etiquetas ni en las métricas del menú semanal. Se actualiza solo cada 8 s.
      </p>

      <BscEditor settings={settings} onSaved={setSettings} />
    </>
  );
}
