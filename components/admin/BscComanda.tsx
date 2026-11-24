"use client";

import { useMemo, useState } from "react";
import type { BscPay, BscPrep, BscSettings, Order } from "@/lib/types";
import { crc } from "@/lib/format";
import {
  BSC_CATS, PAY_LABEL, PAY_METHODS, PREP_FLOW, PREP_LABEL, accountsCsv, buildAccounts, cortesiaLabel, crTime, editionLabel, eventTotals, prepOf,
  type BscAccount,
} from "@/lib/bsc";
import { BscCaptura, type CapturaPrefill } from "./BscCaptura";

type Filter = "todas" | "pendientes" | "abiertas";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "pendientes", label: "Pendientes de preparar" },
  { id: "abiertas", label: "Cuentas abiertas" },
];
const nextPrep = (p: BscPrep): BscPrep => PREP_FLOW[Math.min(PREP_FLOW.indexOf(p) + 1, PREP_FLOW.length - 1)];
const prevPrep = (p: BscPrep): BscPrep => PREP_FLOW[Math.max(PREP_FLOW.indexOf(p) - 1, 0)];

export function BscComanda({
  orders,
  settings,
  readOnly,
  onOrders,
  onSettings,
  refetch,
}: {
  orders: Order[]; // solo los de la edición elegida
  settings: BscSettings;
  readOnly: boolean;
  onOrders: (f: (prev: Order[]) => Order[]) => void;
  onSettings: (s: BscSettings) => void;
  refetch: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<Filter>("todas");
  const [busy, setBusy] = useState("");
  const [payFor, setPayFor] = useState("");
  const [prefill, setPrefill] = useState<CapturaPrefill | null>(null);

  const accounts = useMemo(() => buildAccounts(orders), [orders]);
  const totals = useMemo(() => eventTotals(accounts), [accounts]);
  const shown = useMemo(
    () => accounts.filter((a) => (filter === "pendientes" ? a.pendingPrep > 0 : filter === "abiertas" ? !a.paid : true)),
    [accounts, filter]
  );
  const toPrepare = totals.items.filter((i) => i.pending > 0);

  const merge = (updated: Order[]) => onOrders((prev) => prev.map((o) => updated.find((u) => u.id === o.id) || o));

  async function setPrep(o: Order, prep: BscPrep) {
    setBusy(o.id);
    try {
      const r = await fetch(`/api/orders/${o.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bscPrep: prep }) });
      const d = await r.json();
      if (r.ok) merge([d.order]);
      else alert(d.error || "No se pudo cambiar el estado.");
    } finally {
      setBusy("");
    }
  }

  async function pay(a: BscAccount, method: BscPay) {
    setBusy(a.key);
    try {
      const r = await fetch("/api/bsc/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: a.orders.map((o) => o.id), status: "pagado", method }),
      });
      const d = await r.json();
      if (r.ok) {
        merge(d.orders);
        setPayFor("");
      } else alert(d.error || "No se pudo cobrar la cuenta.");
    } finally {
      setBusy("");
    }
  }

  async function reopen(a: BscAccount) {
    if (!confirm(`¿Reabrir la cuenta de ${a.name}? Se borra el método y la hora de cobro.`)) return;
    setBusy(a.key);
    try {
      const r = await fetch("/api/bsc/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: a.orders.map((o) => o.id), status: "pendiente" }),
      });
      const d = await r.json();
      if (r.ok) merge(d.orders);
      else alert(d.error || "No se pudo reabrir la cuenta.");
    } finally {
      setBusy("");
    }
  }

  async function removeOrder(o: Order) {
    if (!confirm(`¿Eliminar el pedido ${o.id} de ${o.customerName}?\nSe borra también de las ventas. Esta acción no se puede deshacer.`)) return;
    setBusy(o.id);
    try {
      const r = await fetch(`/api/orders/${o.id}`, { method: "DELETE" });
      if (r.ok) onOrders((prev) => prev.filter((x) => x.id !== o.id));
    } finally {
      setBusy("");
    }
  }

  /** Agotado / disponible con un toque: lo que se apaga desaparece al instante de la página de los clientes. */
  async function toggleItem(id: string) {
    const items = settings.items.map((i) => (i.id === id ? { ...i, active: !i.active } : i));
    onSettings({ ...settings, items }); // optimista
    try {
      const r = await fetch("/api/bsc/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
      const d = await r.json();
      if (r.ok) onSettings(d.settings);
      else throw new Error();
    } catch {
      onSettings(settings);
      alert("No se pudo cambiar la disponibilidad. Probá de nuevo.");
    }
  }

  function downloadCsv() {
    const blob = new Blob([accountsCsv(accounts)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bistro-social-club-${orders[0]?.bscEdition || settings.editionId}-comanda.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {!readOnly && (
        <>
          <div className="editcard bsc-avail">
            <h3>Disponibilidad</h3>
            <p className="sub">Tocá un ítem para marcarlo <b>agotado</b>; tocalo de nuevo para reponerlo. Los agotados no se ven en la página de los clientes.</p>
            <div className="chips">
              {settings.items.map((i) => (
                <button key={i.id} type="button" className={i.active ? "" : "off"} aria-pressed={!i.active} onClick={() => toggleItem(i.id)}>
                  {i.name}{i.active ? "" : " · AGOTADO"}
                </button>
              ))}
            </div>
          </div>
          <BscCaptura settings={settings} accounts={accounts} prefill={prefill} onCreated={refetch} />
        </>
      )}

      <div className="editcard bsc-adm-prep">
        <h3>Qué preparar ahora</h3>
        <p className="sub">Lo pedido que todavía no se entregó, para la barra y la cocina.</p>
        {toPrepare.length === 0 && totals.cortesias.pendientes === 0 ? (
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
            {totals.cortesias.pendientes > 0 && (
              <div className="cat cort">
                <div className="h">Cortesías (las da el restaurante)</div>
                <ul>
                  {Object.entries(totals.cortesias.porOpcion).filter(([, v]) => v.pendientes > 0).sort(([a], [b]) => a.localeCompare(b)).map(([id, v]) => (
                    <li key={id}><span>{cortesiaLabel(id)}</span><b>×{v.pendientes}</b></li>
                  ))}
                </ul>
              </div>
            )}
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
            {accounts.length === 0 ? `Todavía no hay pedidos en la edición del ${editionLabel(settings.editionId)}.` : "No hay cuentas en este filtro."}
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
                  <span className={`pill ${a.paid ? "paid" : "pend"}`}>{a.paid ? `Pagada${a.pay ? ` · ${PAY_LABEL[a.pay]}` : ""}` : "Abierta"}</span>
                  {a.cortesia ? (
                    <span className={`pill ${a.tragos >= settings.cortesia.tragos ? "done" : "pend"}`} title={a.tragos >= settings.cortesia.tragos ? "Cortesía entregada" : `Se dio la cortesía con menos de ${settings.cortesia.tragos} tragos`}>
                      Cortesía · {cortesiaLabel(a.cortesia.optionId)}{a.tragos >= settings.cortesia.tragos ? "" : " ⚠"}
                    </span>
                  ) : !readOnly && !a.paid && a.tragos >= settings.cortesia.tragos ? (
                    <span className="pill paid">Cortesía disponible</span>
                  ) : null}
                  <b className="tnum">{crc(a.total)}</b>
                </div>
              </div>

              <div className="orders">
                {a.orders.map((o) => {
                  const prep = prepOf(o);
                  return (
                    <div className={`ord ${prep}`} key={o.id}>
                      <div className="top">
                        <span className="id">{o.id} · {crTime(o.createdAt)}{o.bscBy === "staff" ? " · staff" : ""}</span>
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
                  {a.paid && a.paidAt && <span>Cobrada a las {crTime(a.paidAt)}</span>}
                </div>
                {a.paid ? (
                  <button type="button" className="bsc-adm-pay undo" onClick={() => reopen(a)} disabled={busy === a.key}>Reabrir cuenta</button>
                ) : payFor === a.key ? (
                  <div className="bsc-adm-paywho" role="group" aria-label={`Cobrar la cuenta de ${a.name}`}>
                    <span>Cobrar {crc(a.total)} con:</span>
                    {PAY_METHODS.map((m) => (
                      <button key={m} type="button" onClick={() => pay(a, m)} disabled={busy === a.key}>{PAY_LABEL[m]}</button>
                    ))}
                    <button type="button" className="x" onClick={() => setPayFor("")} aria-label="Cancelar">✕</button>
                  </div>
                ) : (
                  <span className="bsc-adm-btns">
                    {!readOnly && (
                      <button
                        type="button"
                        className="bsc-adm-pay undo"
                        onClick={() => setPrefill({ name: a.name, phone: a.whatsapp, table: a.table, nonce: Date.now() })}
                      >
                        + Pedido
                      </button>
                    )}
                    <button type="button" className="bsc-adm-pay" onClick={() => setPayFor(a.key)} disabled={busy === a.key}>Cobrar cuenta</button>
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="wa-note" style={{ textAlign: "left", marginTop: 14 }}>
        Cada persona es una cuenta: mismo <b>teléfono</b>, o mismo nombre si no dejó teléfono. Tocá el estado de un pedido para avanzarlo
        (<b>recibido → en preparación → entregado</b>). <b>Cobrar cuenta</b> pide el método (efectivo, SINPE o tarjeta) y cierra todos sus pedidos; un pedido nuevo la vuelve a abrir.
        La <b>cortesía</b> (Opción 1 u Opción 2, la da el restaurante) se registra en la <b>Nueva comanda</b> cuando la cuenta ya tiene {settings.cortesia.tragos} tragos; una por persona y no suma a las ventas. Los pedidos del evento no usan cupos ni aparecen en Pedidos, Resumen cocina, Etiquetas ni en las métricas del menú semanal. Se actualiza solo cada 8 s.
      </p>
    </>
  );
}
