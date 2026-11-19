"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { BscItem, BscSettings, OrderBscLine } from "@/lib/types";
import { BSC_CATS, MAX_QTY_PER_LINE, applyPromo, crDateTimeLabel, priceLabel, unitPrice } from "@/lib/bsc";
import { crc } from "@/lib/format";

const CONTACT_KEY = "sano:bsc:contact";

interface Receipt {
  id: string;
  lines: OrderBscLine[];
  total: number;
  name: string;
  table?: string;
  account?: { orders: number; subtotal: number; promo: { applied: boolean; amount: number; item: string }; total: number };
}

const cartKey = (id: string, variantId?: string) => (variantId ? `${id}:${variantId}` : id);

/** Stepper cuadrado de 44 px: «+ AGREGAR» cuando está en 0, «– n +» cuando ya hay. */
function Stepper({ qty, label, onMinus, onPlus }: { qty: number; label: string; onMinus: () => void; onPlus: () => void }) {
  if (qty <= 0) {
    return (
      <button type="button" className="bsc-add" onClick={onPlus} aria-label={`Agregar ${label}`}>
        + Agregar
      </button>
    );
  }
  return (
    <div className="bsc-step">
      <button type="button" onClick={onMinus} aria-label={`Quitar ${label}`}>–</button>
      <span className="q" aria-live="polite">{qty}</span>
      <button type="button" onClick={onPlus} disabled={qty >= MAX_QTY_PER_LINE} aria-label={`Sumar ${label}`}>+</button>
    </div>
  );
}

/** Encabezado de sección entre corchetes, con el precio entre paréntesis a la derecha si es el mismo para todos. */
function sectionPrice(items: BscItem[]): string {
  const labels = [...new Set(items.map((i) => priceLabel(i)))];
  return labels.length === 1 ? labels[0] : "";
}

export function BscOrder({ settings, preview }: { settings: BscSettings; preview: boolean }) {
  const items = useMemo(() => settings.items.filter((i) => i.active), [settings.items]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [table, setTable] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const checkoutRef = useRef<HTMLElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  // Lo que la persona escribió la última vez queda en su celular: así sus pedidos de la noche caen en la misma cuenta.
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem(CONTACT_KEY) || "null");
      if (c && typeof c === "object") {
        if (typeof c.name === "string") setName(c.name);
        if (typeof c.phone === "string") setPhone(c.phone);
        if (typeof c.table === "string") setTable(c.table);
      }
    } catch {
      /* sin localStorage: no pasa nada */
    }
  }, []);

  const lines: OrderBscLine[] = useMemo(() => {
    const out: OrderBscLine[] = [];
    for (const item of items) {
      const vs = item.variants?.length ? item.variants : [undefined];
      for (const v of vs) {
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
  const promo = useMemo(() => applyPromo([{ id: "cart", seq: 0, createdAt: "", bsc: lines }]), [lines]);
  const hasPlato = lines.some((l) => l.promoEligible);
  const hasTrago = lines.some((l) => l.promoTrigger);
  const total = subtotal - promo.amount;

  const bump = (key: string, d: number) =>
    setQty((q) => {
      const n = Math.max(0, Math.min(MAX_QTY_PER_LINE, (q[key] || 0) + d));
      const next = { ...q };
      if (n === 0) delete next[key];
      else next[key] = n;
      return next;
    });

  async function submit() {
    if (submitting) return;
    setError("");
    if (!name.trim()) {
      setError("Escribí tu nombre para que la barra sepa a quién llevárselo.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/bsc/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim(),
          whatsapp: phone.trim(),
          table: table.trim(),
          lines: lines.map((l) => ({ id: l.id, variantId: l.variantId, qty: l.qty })),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409 && d.closed) {
        setClosed(true);
        return;
      }
      if (!r.ok) {
        setError(d.error || "No pudimos enviar tu pedido. Probá de nuevo.");
        return;
      }
      try {
        localStorage.setItem(CONTACT_KEY, JSON.stringify({ name: name.trim(), phone: phone.trim(), table: table.trim() }));
      } catch {
        /* ignorar */
      }
      setReceipt({ id: d.order.id, lines: d.order.bsc, total: d.order.total, name: d.order.customerName, table: d.order.bscTable, account: d.account });
      setQty({});
      setTimeout(() => ticketRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch {
      setError("No hay conexión. Revisá tu internet y probá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  const datos = `${crDateTimeLabel(settings.startsAt, true)} · ${settings.venue.toUpperCase()} · FUERA DE HORARIO`;

  if (closed) {
    return (
      <div className="bsc-ended">
        <img src="/bsc/logos/avatar-azul.png" alt="Bistro Social Club" width={120} height={120} />
        <p className="bsc-big">Bistro Social Club ya terminó. ¡Gracias por venir!</p>
        <Link className="bsc-btn line" href="/">Volver a Sano</Link>
      </div>
    );
  }

  return (
    <>
      {preview && (
        <div className="bsc-preview" role="status">
          Vista previa del dueño: la ventana de pedidos está cerrada. Los pedidos de prueba se guardan igual: borralos desde la comanda.
        </div>
      )}

      <header className="bsc-top">
        <img className="bsc-logo" src="/bsc/logos/avatar-azul.png" alt="Bistro Social Club" width={72} height={72} />
        <Link className="bsc-back" href="/">← Sano</Link>
      </header>

      <section className="bsc-hero">
        <h1>¿Sin planes este jueves?</h1>
        <p className="bsc-data">{datos}</p>
      </section>

      <div className="bsc-promo" role="note">Primer plato para picar incluido con tu primer trago</div>

      <main className="bsc-main">
        {BSC_CATS.map((cat) => {
          const list = items.filter((i) => i.cat === cat.id);
          if (list.length === 0) return null;
          const price = sectionPrice(list);
          return (
            <section key={cat.id} className="bsc-sec" aria-labelledby={`bsc-h-${cat.id}`}>
              <h2 className="bsc-h" id={`bsc-h-${cat.id}`}>
                <span>[{cat.name}]</span>
                {price && <span>({price})</span>}
              </h2>
              {cat.sub && <p className="bsc-sub">{cat.sub}</p>}
              <div className="bsc-grid">
                {list.map((item) => {
                  const on = (item.variants?.length ? item.variants : [undefined]).some((v) => (qty[cartKey(item.id, v?.id)] || 0) > 0);
                  return (
                    <article key={item.id} className={`bsc-card${on ? " on" : ""}`}>
                      {item.image ? (
                        <div className="bsc-photo">
                          <img src={`/bsc/fotos/${item.image}`} alt="" width={480} height={480} loading="lazy" decoding="async" />
                          <div className="bsc-label">
                            <b>{item.name}</b>
                            {item.desc && <span>{item.desc}</span>}
                          </div>
                        </div>
                      ) : (
                        <div className="bsc-label flat">
                          <b>{item.name}</b>
                          {item.desc && <span>{item.desc}</span>}
                        </div>
                      )}
                      <div className="bsc-opts">
                        {item.variants?.length ? (
                          item.variants.map((v) => (
                            <div className="bsc-opt" key={v.id}>
                              <span className="n">
                                {v.name}
                                {v.price !== undefined && !v.name.includes(crc(v.price)) && <i> ({crc(v.price)})</i>}
                              </span>
                              <Stepper
                                qty={qty[cartKey(item.id, v.id)] || 0}
                                label={`${item.name} ${v.name}`}
                                onMinus={() => bump(cartKey(item.id, v.id), -1)}
                                onPlus={() => bump(cartKey(item.id, v.id), 1)}
                              />
                            </div>
                          ))
                        ) : (
                          <div className="bsc-opt">
                            <span className="n">{crc(item.price)}</span>
                            <Stepper qty={qty[item.id] || 0} label={item.name} onMinus={() => bump(item.id, -1)} onPlus={() => bump(item.id, 1)} />
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        {receipt && (
          <div className="bsc-ticket-wrap" ref={ticketRef}>
            <div className="bsc-ticket" role="status">
              <div className="bsc-ticket-main">
                <p className="bsc-big">¡Listo! Tu pedido está en camino a la barra</p>
                <p className="bsc-who">{receipt.name}{receipt.table ? ` · ${receipt.table}` : ""}</p>
                <ul>
                  {receipt.lines.map((l, i) => (
                    <li key={i}>
                      <span>{l.qty}× {l.name}{l.variantName ? ` · ${l.variantName}` : ""}</span>
                      <span>{crc(l.subtotal)}</span>
                    </li>
                  ))}
                </ul>
                <div className="bsc-ticket-tot"><span>Este pedido</span><b>{crc(receipt.total)}</b></div>
                {receipt.account && (
                  <>
                    {receipt.account.promo.applied && (
                      <div className="bsc-ticket-tot promo">
                        <span>Incluido por promo: {receipt.account.promo.item}</span>
                        <b>−{crc(receipt.account.promo.amount)}</b>
                      </div>
                    )}
                    <div className="bsc-ticket-tot"><span>Tu cuenta hasta ahora ({receipt.account.orders} {receipt.account.orders === 1 ? "pedido" : "pedidos"})</span><b>{crc(receipt.account.total)}</b></div>
                  </>
                )}
              </div>
              <div className="bsc-ticket-stub">
                <span>Admite 1</span>
                <b>{receipt.id}</b>
              </div>
            </div>
            <button type="button" className="bsc-btn line" onClick={() => { setReceipt(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              Pedir algo más
            </button>
          </div>
        )}

        {count > 0 && (
          <section className="bsc-sec bsc-checkout" id="bsc-pedido" ref={checkoutRef} aria-labelledby="bsc-h-pedido">
            <h2 className="bsc-h" id="bsc-h-pedido"><span>[Tu pedido]</span><span>({count})</span></h2>
            <ul className="bsc-lines">
              {lines.map((l) => (
                <li key={cartKey(l.id, l.variantId)}>
                  <span className="t">{l.name}{l.variantName ? ` · ${l.variantName}` : ""}</span>
                  <Stepper
                    qty={l.qty}
                    label={`${l.name}${l.variantName ? ` ${l.variantName}` : ""}`}
                    onMinus={() => bump(cartKey(l.id, l.variantId), -1)}
                    onPlus={() => bump(cartKey(l.id, l.variantId), 1)}
                  />
                  <span className="p">{crc(l.subtotal)}</span>
                </li>
              ))}
              {promo.applied && (
                <li className="promo">
                  <span className="t">Incluido por promo: {promo.item?.name}</span>
                  <span className="p">−{crc(promo.amount)}</span>
                </li>
              )}
            </ul>
            {hasPlato && !hasTrago && (
              <p className="bsc-hint">Sumá un trago de la casa y tu primer plato para picar va incluido.</p>
            )}
            <p className="bsc-hint">Si ya pediste antes esta noche, la promo se calcula sobre toda tu cuenta.</p>
            <div className="bsc-total"><span>Total de este pedido</span><b>{crc(total)}</b></div>

            <div className="bsc-form">
              <label>
                <span>Nombre y apellido</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Ej: María Fernández" maxLength={80} />
              </label>
              <label>
                <span>Teléfono (opcional)</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="Ej: 8319 3498" maxLength={30} />
                <small>Con tu teléfono juntamos todos tus pedidos de la noche en una sola cuenta.</small>
              </label>
              <label>
                <span>Mesa o referencia (opcional)</span>
                <input value={table} onChange={(e) => setTable(e.target.value)} placeholder="Ej: Mesa 4, la barra, el patio" maxLength={40} />
              </label>
            </div>
            {error && <p className="bsc-error" role="alert">{error}</p>}
            <button type="button" className="bsc-btn" onClick={submit} disabled={submitting || lines.length === 0}>
              {submitting ? "Enviando…" : "Enviar pedido a la barra"}
            </button>
          </section>
        )}
      </main>

      <div className="bsc-foot">
        <span>22Bistro · Ciudad Colón</span>
        <Link href="/">Sano</Link>
      </div>

      {count > 0 && (
        <div className="bsc-bar">
          <div>
            <b>{crc(total)}</b>
            <span>{count} {count === 1 ? "ítem" : "ítems"}{promo.applied ? " · promo aplicada" : ""}</span>
          </div>
          <button type="button" onClick={() => checkoutRef.current?.scrollIntoView({ behavior: "smooth" })}>Revisar pedido</button>
        </div>
      )}
      {count > 0 && <div style={{ height: 84 }} aria-hidden="true" />}
    </>
  );
}
