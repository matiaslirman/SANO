"use client";

import { useMemo } from "react";
import type { Order } from "@/lib/types";
import { crc } from "@/lib/format";
import { BSC_CATS, PAY_LABEL, buildAccounts, cortesiaLabel, crTime, editionLabel, editionsSummary, eventTotals, salesByHour } from "@/lib/bsc";

const cell = (v: string | number) => (/[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** Tracking de la edición: lo facturado, lo cobrado (por método), lo que se vendió y salió, y cómo se movió la noche. */
export function BscVentas({ orders, allOrders, edition, onPick }: { orders: Order[]; allOrders: Order[]; edition: string; onPick: (id: string) => void }) {
  const accounts = useMemo(() => buildAccounts(orders), [orders]);
  const t = useMemo(() => eventTotals(accounts), [accounts]);
  const hours = useMemo(() => salesByHour(orders), [orders]);
  const editions = useMemo(() => editionsSummary(allOrders), [allOrders]);
  const maxHour = Math.max(1, ...hours.map((h) => h.bruto));
  const ticket = t.cuentas ? Math.round(t.ventas / t.cuentas) : 0;
  const entregados = t.items.reduce((s, i) => s + i.delivered, 0);
  const pedidos = t.items.reduce((s, i) => s + i.qty, 0);
  const pend = pedidos - entregados;
  const first = orders.length ? [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0].createdAt : "";
  const last = orders.length ? [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt : "";

  function downloadCsv() {
    const rows: (string | number)[][] = [["Categoría", "Ítem", "Variante", "Pedidos", "Salió", "Falta", "Ingreso bruto"]];
    for (const cat of BSC_CATS) {
      for (const i of t.items.filter((x) => x.cat === cat.id)) rows.push([cat.name, i.name, i.variantName || "", i.qty, i.delivered, i.pending, i.revenue]);
    }
    rows.push([], ["", "Bruto", "", "", "", "", t.bruto], ["", "Promos", "", "", "", "", -t.promoMonto], ["", "Facturado", "", "", "", "", t.ventas]);
    for (const [id, v] of Object.entries(t.cortesias.porOpcion).sort(([a], [b]) => a.localeCompare(b))) rows.push(["", `Cortesías · ${cortesiaLabel(id)}`, "", v.total, "", v.pendientes, 0]);
    rows.push(["", "Cobrado", "", "", "", "", t.cobrado], ["", "Por cobrar", "", "", "", "", t.porCobrar]);
    for (const k of ["efectivo", "sinpe", "tarjeta", "sin"] as const) rows.push(["", `Cobrado · ${PAY_LABEL[k]}`, "", "", "", "", t.porMetodo[k]]);
    const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bistro-social-club-${edition}-ventas.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (orders.length === 0) {
    return (
      <>
        <div className="otable"><div className="empty" style={{ padding: 20 }}>Todavía no hay pedidos en la edición del {editionLabel(edition)}.</div></div>
        <Ediciones editions={editions} current={edition} onPick={onPick} />
      </>
    );
  }

  return (
    <>
      <div className="astat bsc-adm-stats">
        <div className="box accent">
          <div className="k">Facturado</div>
          <div className="v tnum">{crc(t.ventas)}</div>
        </div>
        <div className="box">
          <div className="k">Cobrado</div>
          <div className="v tnum">{crc(t.cobrado)}</div>
        </div>
        <div className="box">
          <div className="k">Por cobrar</div>
          <div className="v tnum">{crc(t.porCobrar)}</div>
        </div>
        <div className="box">
          <div className="k">Cuentas</div>
          <div className="v">{t.cuentas}<span className="of"> · {t.abiertas} abiertas</span></div>
        </div>
        <div className="box">
          <div className="k">Ticket promedio</div>
          <div className="v tnum">{crc(ticket)}</div>
        </div>
      </div>

      <div className="editcard">
        <h3>Cobrado por método</h3>
        <p className="sub">Para cuadrar la caja al cierre: lo que debería haber en efectivo, en SINPE y en el datáfono.</p>
        <div className="bsc-adm-methods">
          {(["efectivo", "sinpe", "tarjeta"] as const).map((k) => (
            <div key={k} className="m"><span>{PAY_LABEL[k]}</span><b className="tnum">{crc(t.porMetodo[k])}</b></div>
          ))}
          {t.porMetodo.sin > 0 && <div className="m warn"><span>{PAY_LABEL.sin}</span><b className="tnum">{crc(t.porMetodo.sin)}</b></div>}
          <div className="m sum"><span>Total cobrado</span><b className="tnum">{crc(t.cobrado)}</b></div>
        </div>
        {t.porCobrar > 0 && <p className="sub" style={{ marginTop: 10, marginBottom: 0 }}>Faltan por cobrar <b>{crc(t.porCobrar)}</b> en {t.abiertas} {t.abiertas === 1 ? "cuenta abierta" : "cuentas abiertas"}.</p>}
      </div>

      <div className="editcard">
        <h3>Lo vendido y lo que salió</h3>
        <p className="sub">
          {pedidos} {pedidos === 1 ? "unidad pedida" : "unidades pedidas"}: <b>{entregados}</b> ya salieron y <b>{pend}</b> faltan por entregar.
          {first && <> Primer pedido a las {crTime(first)}; el último, a las {crTime(last)}</>}
        </p>
        <div className="bsc-adm-tblwrap">
          <table className="bsc-adm-tbl">
            <thead>
              <tr><th>Ítem</th><th className="n">Pedidos</th><th className="n">Salió</th><th className="n">Falta</th><th className="n">Ingreso</th></tr>
            </thead>
            <tbody>
              {BSC_CATS.map((cat) => {
                const rows = t.items.filter((i) => i.cat === cat.id);
                if (!rows.length) return null;
                const sub = rows.reduce((s, i) => s + i.revenue, 0);
                return [
                  <tr className="cat" key={`c-${cat.id}`}><td colSpan={4}>{cat.name}</td><td className="n tnum">{crc(sub)}</td></tr>,
                  ...rows.map((i) => (
                    <tr key={i.key}>
                      <td>{i.name}{i.variantName ? ` · ${i.variantName}` : ""}</td>
                      <td className="n">{i.qty}</td>
                      <td className="n">{i.delivered}</td>
                      <td className={`n${i.pending ? " pend" : ""}`}>{i.pending}</td>
                      <td className="n tnum">{crc(i.revenue)}</td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
            <tfoot>
              <tr><td colSpan={4}>Bruto (todo lo pedido)</td><td className="n tnum">{crc(t.bruto)}</td></tr>
              {t.promoMonto > 0 && <tr><td colSpan={4}>Promos de la primera edición ({t.promos} {t.promos === 1 ? "cuenta" : "cuentas"})</td><td className="n tnum">−{crc(t.promoMonto)}</td></tr>}
              <tr className="fin"><td colSpan={4}>Facturado</td><td className="n tnum">{crc(t.ventas)}</td></tr>
            </tfoot>
          </table>
        </div>
        {t.cortesias.total > 0 && (
          <p className="sub" style={{ marginTop: 12, marginBottom: 0 }}>
            <b>Cortesías: {t.cortesias.total}</b> (las da el restaurante, no suman a las ventas):{" "}
            {Object.entries(t.cortesias.porOpcion).sort(([a], [b]) => a.localeCompare(b)).map(([id, v]) => `${cortesiaLabel(id)} ×${v.total}`).join(" · ")}.{" "}
            {t.cortesias.total - t.cortesias.pendientes} ya entregadas y {t.cortesias.pendientes} por entregar.
          </p>
        )}
        <div className="bsc-adm-actions" style={{ marginTop: 12 }}>
          <button type="button" className="obtn" onClick={downloadCsv}>Exportar resumen (CSV)</button>
          <button type="button" className="obtn" onClick={() => window.print()}>Imprimir</button>
        </div>
      </div>

      {hours.length > 0 && (
        <div className="editcard">
          <h3>Cómo se movió la noche</h3>
          <p className="sub">Lo pedido por hora (hora de Costa Rica), antes de promos.</p>
          <div className="bsc-adm-hours">
            {hours.map((h) => (
              <div className="row" key={h.hour}>
                <span className="l">{h.label}</span>
                <span className="bar"><i style={{ width: `${Math.round((h.bruto / maxHour) * 100)}%` }} /></span>
                <span className="v tnum">{h.orders ? `${crc(h.bruto)} · ${h.orders} ${h.orders === 1 ? "pedido" : "pedidos"}` : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Ediciones editions={editions} current={edition} onPick={onPick} />
    </>
  );
}

function Ediciones({ editions, current, onPick }: { editions: ReturnType<typeof editionsSummary>; current: string; onPick: (id: string) => void }) {
  if (editions.length < 2) return null;
  return (
    <div className="editcard">
      <h3>Ediciones</h3>
      <p className="sub">Cada jueves tiene su propia comanda y sus propios totales. Tocá una para verla.</p>
      <div className="bsc-adm-tblwrap">
        <table className="bsc-adm-tbl">
          <thead><tr><th>Edición</th><th className="n">Pedidos</th><th className="n">Cuentas</th><th className="n">Facturado</th><th className="n">Cobrado</th></tr></thead>
          <tbody>
            {editions.map((e) => (
              <tr key={e.id} className={e.id === current ? "cur" : ""}>
                <td><button type="button" className="lnk" onClick={() => onPick(e.id)}>{e.label}</button></td>
                <td className="n">{e.pedidos}</td>
                <td className="n">{e.cuentas}</td>
                <td className="n tnum">{crc(e.ventas)}</td>
                <td className="n tnum">{crc(e.cobrado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
