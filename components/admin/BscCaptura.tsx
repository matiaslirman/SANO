"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BscSettings, OrderBscLine } from "@/lib/types";
import { BSC_CATS, CORTESIA_ID, MAX_QTY_PER_LINE, accountKey, cortesiaLabel, courtesyOf, unitPrice, type BscAccount } from "@/lib/bsc";
import { crc } from "@/lib/format";

const cartKey = (id: string, variantId?: string) => `${id}:${variantId || ""}`;

export interface CapturaPrefill {
  name: string;
  phone: string;
  table: string;
  nonce: number;
}

/**
 * «Nueva comanda»: el equipo carga lo que pide cada persona desde el panel (celular o tablet). Usa la misma validación
 * y los mismos precios que el pedido del cliente; la promo se calcula sobre la cuenta completa de esa persona.
 */
export function BscCaptura({
  settings,
  accounts,
  prefill,
  onCreated,
}: {
  settings: BscSettings;
  accounts: BscAccount[];
  prefill: CapturaPrefill | null;
  onCreated: () => Promise<void> | void;
}) {
  const items = useMemo(() => settings.items.filter((i) => i.active), [settings.items]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [table, setTable] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [cort, setCort] = useState<string>(""); // cortesía elegida: "1" | "2" | ""
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!prefill) return;
    setName(prefill.name);
    setPhone(prefill.phone);
    setTable(prefill.table);
    setOk("");
    setErr("");
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [prefill]);

  const lines: OrderBscLine[] = useMemo(() => {
    const out: OrderBscLine[] = [];
    for (const item of items) {
      for (const v of item.variants?.length ? item.variants : [undefined]) {
        const q = qty[cartKey(item.id, v?.id)] || 0;
        if (q <= 0) continue;
        const up = unitPrice(item, v);
        out.push({
          id: item.id, cat: item.cat, name: item.name,
          ...(v ? { variantId: v.id, variantName: v.name } : {}),
          qty: q, unitPrice: up, subtotal: up * q,
          ...(item.promoTrigger ? { promoTrigger: true } : {}),
          ...(item.promoEligible ? { promoEligible: true } : {}),
        });
      }
    }
    return out;
  }, [items, qty]);

  const subtotal = lines.reduce((t, l) => t + l.subtotal, 0);
  const count = lines.reduce((t, l) => t + l.qty, 0);
  const key = name.trim() || phone.trim() ? accountKey({ customerName: name, whatsapp: phone }) : "";
  const match = key ? accounts.find((a) => a.key === key) : undefined;
  // Cortesía (la da el restaurante): se mira sobre toda la cuenta de esa persona, con lo que ya pidió y lo que lleva en este pedido.
  const need = settings.cortesia.tragos;
  const cs = useMemo(() => courtesyOf([...(match?.orders || []), { id: "nuevo", bsc: lines }], need), [match, lines, need]);
  const given = cs.given && cs.given.orderId !== "nuevo" ? cs.given : undefined;
  const canGive = cs.qualifies && !given;
  useEffect(() => {
    if (!canGive) setCort("");
  }, [canGive]);

  const bump = (k: string, d: number) =>
    setQty((q) => {
      const n = Math.max(0, Math.min(MAX_QTY_PER_LINE, (q[k] || 0) + d));
      const next = { ...q };
      if (n === 0) delete next[k];
      else next[k] = n;
      return next;
    });

  async function submit() {
    if (busy) return;
    setErr("");
    setOk("");
    if (!name.trim()) return setErr("Escribí el nombre (o «Mesa 4») para saber de quién es la cuenta.");
    if (lines.length === 0 && !cort) return setErr("Agregá al menos un ítem.");
    setBusy(true);
    try {
      const r = await fetch("/api/bsc/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim(),
          whatsapp: phone.trim(),
          table: table.trim(),
          staff: true,
          lines: [...lines.map((l) => ({ id: l.id, variantId: l.variantId, qty: l.qty })), ...(cort && canGive ? [{ id: CORTESIA_ID, optionId: cort }] : [])],
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error || "No se pudo registrar el pedido.");
        return;
      }
      setOk(`✓ ${d.order.id} registrado para ${d.order.customerName}${d.account ? ` · su cuenta va en ${crc(d.account.total)}` : ""}`);
      setQty({});
      setCort("");
      setName("");
      setPhone("");
      setTable("");
      await onCreated();
    } catch {
      setErr("No hay conexión. Revisá el internet y probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="editcard bsc-cap" ref={ref}>
      <h3>Nueva comanda</h3>
      <p className="sub">Cargá lo que pide cada persona. Si ya tiene cuenta abierta, escribí su nombre o teléfono y el pedido se suma a la misma cuenta.</p>

      <div className="bsc-cap-who">
        <label>
          <span>Nombre o mesa</span>
          <input value={name} onChange={(e) => setName(e.target.value)} list="bsc-cuentas" placeholder="Ej: María, Mesa 4" autoComplete="off" maxLength={80} />
        </label>
        <label>
          <span>Teléfono (opcional)</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Ej: 8319 3498" maxLength={30} />
        </label>
        <label>
          <span>Mesa o referencia</span>
          <input value={table} onChange={(e) => setTable(e.target.value)} placeholder="Ej: barra, patio" maxLength={40} />
        </label>
        <datalist id="bsc-cuentas">
          {accounts.filter((a) => !a.paid).map((a) => (
            <option key={a.key} value={a.name}>{a.whatsapp}</option>
          ))}
        </datalist>
      </div>
      {match && (
        <div className="bsc-cap-match">
          Cuenta {match.paid ? "pagada (este pedido la reabre)" : "abierta"} de <b>{match.name}</b>: {match.orders.length} {match.orders.length === 1 ? "pedido" : "pedidos"}, {crc(match.total)}.
        </div>
      )}
      {!match && key.startsWith("n:") && accounts.some((a) => a.whatsapp && a.name.trim().toLowerCase() === name.trim().toLowerCase()) && (
        <div className="bsc-cap-match warn">Ya hay una cuenta con ese nombre que tiene teléfono: elegila de la lista para que se sume a la misma.</div>
      )}

      {BSC_CATS.map((cat) => {
        const list = items.filter((i) => i.cat === cat.id);
        if (!list.length) return null;
        return (
          <div key={cat.id} className="bsc-cap-cat">
            <div className="h">{cat.name}</div>
            <div className="ctiles">
              {list.map((item) => (
                <div key={item.id} className="ctile">
                  <div className="nm">{item.name}</div>
                  {item.variants?.length ? (
                    <div className="vars">
                      {item.variants.map((v) => {
                        const q = qty[cartKey(item.id, v.id)] || 0;
                        return (
                          <button key={v.id} type="button" className={q ? "on" : ""} onClick={() => bump(cartKey(item.id, v.id), 1)} aria-label={`Agregar ${item.name} ${v.name}`}>
                            {v.name}
                            <small>{crc(unitPrice(item, v))}</small>
                            {q > 0 && <i>{q}</i>}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <button type="button" className={`one${qty[cartKey(item.id)] ? " on" : ""}`} onClick={() => bump(cartKey(item.id), 1)} aria-label={`Agregar ${item.name}`}>
                      {crc(item.price)}
                      <span>+ Agregar</span>
                      {(qty[cartKey(item.id)] || 0) > 0 && <i>{qty[cartKey(item.id)]}</i>}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {(lines.length > 0 || cs.tragos > 0) && (
        <div className="bsc-cap-cort">
          <div className="h">Cortesía <small>(la da el restaurante)</small></div>
          {given ? (
            <p>Esta cuenta ya recibió la <b>{cortesiaLabel(given.optionId)}</b>. Es una por persona.</p>
          ) : canGive ? (
            <>
              <p>Ya calificó ({cs.tragos} tragos). Elegí cuál se entrega:</p>
              <div className="opts" role="radiogroup" aria-label="Cortesía">
                {settings.cortesia.options.map((o) => (
                  <button key={o.id} type="button" role="radio" aria-checked={cort === o.id} className={cort === o.id ? "on" : ""} onClick={() => setCort(cort === o.id ? "" : o.id)}>
                    {cortesiaLabel(o.id)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>Faltan {need - cs.tragos} {need - cs.tragos === 1 ? "trago" : "tragos"} para la cortesía (lleva {cs.tragos}).</p>
          )}
        </div>
      )}

      {(lines.length > 0 || cort) && (
        <div className="bsc-cap-cart">
          <div className="h">Pedido a registrar</div>
          {lines.map((l) => {
            const k = cartKey(l.id, l.variantId);
            return (
              <div key={k} className="ln">
                <span className="t">{l.name}{l.variantName ? ` · ${l.variantName}` : ""}</span>
                <span className="st">
                  <button type="button" onClick={() => bump(k, -1)} aria-label={`Quitar uno de ${l.name}`}>–</button>
                  <b>{l.qty}</b>
                  <button type="button" onClick={() => bump(k, 1)} disabled={l.qty >= MAX_QTY_PER_LINE} aria-label={`Sumar uno de ${l.name}`}>+</button>
                </span>
                <span className="p">{crc(l.subtotal)}</span>
              </div>
            );
          })}
          {cort && canGive && (
            <div className="ln promo"><span className="t">Cortesía · {cortesiaLabel(cort)}</span><span className="p">₡0</span></div>
          )}
          <div className="tot"><span>{count} {count === 1 ? "ítem" : "ítems"}</span><b>{crc(subtotal)}</b></div>
        </div>
      )}

      {err && <p className="bsc-cap-msg err" role="alert">{err}</p>}
      {ok && <p className="bsc-cap-msg ok" role="status">{ok}</p>}
      <button type="button" className="save-btn bsc-cap-go" onClick={submit} disabled={busy || (lines.length === 0 && !cort)}>
        {busy ? "Registrando…" : "Registrar pedido"}
      </button>
    </div>
  );
}
