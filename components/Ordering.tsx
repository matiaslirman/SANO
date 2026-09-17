"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { PublicStatus, MarketCategory, Order } from "@/lib/types";
import { priceForDishes, comboLabel, nextCombo, savingsVsBase } from "@/lib/pricing";
import { crc } from "@/lib/format";
import { Seal } from "@/lib/brand";

const WA = process.env.NEXT_PUBLIC_WHATSAPP || "50683193498";

const mkey = (catId: string, item: string) => `${catId}|${item}`;

export function Ordering({
  initialStatus,
  initialMarket,
}: {
  initialStatus: PublicStatus;
  initialMarket: MarketCategory[];
}) {
  const [status, setStatus] = useState<PublicStatus>(initialStatus);
  const market = initialMarket;

  const [dishQty, setDishQty] = useState<Record<string, number>>({});
  const [marketQty, setMarketQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Order | null>(null);
  const [toast, setToast] = useState("");

  // ── countdown (solo tras montar, para evitar mismatch de hidratación) ──
  const [cd, setCd] = useState({
    d: 0, h: 0, m: 0, s: 0,
    dd: "—", hh: "--", mm: "--", ss: "--",
    totalMin: Number.POSITIVE_INFINITY, closed: false,
  });
  useEffect(() => {
    const target = new Date(status.window.cutoffISO).getTime();
    const p = (n: number) => String(n).padStart(2, "0");
    const tick = () => {
      const raw = target - Date.now();
      const ms = Math.max(0, raw);
      const t = Math.floor(ms / 1000);
      const d = Math.floor(t / 86400);
      const h = Math.floor((t % 86400) / 3600);
      const m = Math.floor((t % 3600) / 60);
      const s = t % 60;
      setCd({
        d, h, m, s,
        dd: String(d), hh: p(h), mm: p(m), ss: p(s),
        totalMin: Math.floor(ms / 60000),
        closed: raw <= 0,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status.window.cutoffISO]);

  // ── el pill de urgencia se despega y sigue al usuario al scrollear ──
  const heroPillRef = useRef<HTMLDivElement>(null);
  const [pillShow, setPillShow] = useState(false);
  useEffect(() => {
    const el = heroPillRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setPillShow(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-76px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ── refrescar estado (cupos/ventana) periódicamente ──
  const refetchStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      if (r.ok) setStatus(await r.json());
    } catch {
      /* silencioso */
    }
  }, []);
  useEffect(() => {
    const id = setInterval(refetchStatus, 45000);
    return () => clearInterval(id);
  }, [refetchStatus]);

  // ── toast auto-hide ──
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  // ── totales ──
  const totals = useMemo(() => {
    const dishesQty = Object.values(dishQty).reduce((a, b) => a + b, 0);
    const dishesTotal = priceForDishes(dishesQty, status.basePrice, status.combos);
    let marketTotal = 0;
    let marketCount = 0;
    for (const cat of market) {
      for (const item of cat.items) {
        const q = marketQty[mkey(cat.id, item)] || 0;
        if (q > 0) {
          marketTotal += q * cat.price;
          marketCount += q;
        }
      }
    }
    return {
      dishesQty,
      dishesTotal,
      marketTotal,
      marketCount,
      grand: dishesTotal + marketTotal,
    };
  }, [dishQty, marketQty, market, status.basePrice, status.combos]);

  const savings = savingsVsBase(totals.dishesQty, status.basePrice, status.combos);
  const combo = comboLabel(totals.dishesQty, status.combos);
  const next = nextCombo(totals.dishesQty, status.combos);
  const soldOut = status.cuposDisponibles <= 0;
  const canSubmit = totals.grand > 0 && name.trim().length > 0 && !soldOut && !submitting;

  // ── suggested para el upsell (4 destacados) ──
  const suggested = useMemo(() => {
    const out: { cat: MarketCategory; item: string }[] = [];
    for (const c of market) if (c.suggested && c.items[0]) out.push({ cat: c, item: c.items[0] });
    for (const c of market) {
      if (out.length >= 4) break;
      if (!c.suggested && c.items[0]) out.push({ cat: c, item: c.items[0] });
    }
    return out.slice(0, 4);
  }, [market]);

  // ── acciones ──
  const stepDish = (dish: string, delta: number) =>
    setDishQty((q) => ({ ...q, [dish]: Math.max(0, (q[dish] || 0) + delta) }));
  const stepMarket = (catId: string, item: string, delta: number) =>
    setMarketQty((q) => {
      const k = mkey(catId, item);
      return { ...q, [k]: Math.max(0, Math.min(20, (q[k] || 0) + delta)) };
    });

  const cuposPct = status.cuposTotales
    ? Math.round((status.cuposDisponibles / status.cuposTotales) * 100)
    : 0;

  // ── fase de urgencia del countdown ──
  const closed = cd.closed;
  const critical = !closed && cd.totalMin <= 20;
  const urgent = !closed && !critical && cd.totalMin <= 120;
  const phaseClass = closed ? "is-closed" : critical ? "is-critical" : urgent ? "is-urgent" : "is-live";
  const phaseLabel = closed ? "Pedidos" : critical ? "Cerrando ya" : urgent ? "Cierra pronto" : "Cierra en";
  const cdTime = closed ? "Cerrado" : `${cd.d > 0 ? cd.dd + "d " : ""}${cd.hh}:${cd.mm}:${cd.ss}`;
  const cuposText = soldOut
    ? "Sin cupos"
    : `${status.cuposDisponibles} ${status.cuposDisponibles === 1 ? "cupo" : "cupos"}`;
  const cdA11y = closed
    ? "El cierre de pedidos de esta ventana ya pasó."
    : `Los pedidos cierran en ${cd.d > 0 ? `${cd.d} días, ` : ""}${cd.h} horas y ${cd.m} minutos. Quedan ${cuposText}.`;

  // Pill de urgencia reutilizable (anclado en el hero + flotante al scrollear).
  // Función que devuelve JSX (no un componente) para no remontar y reiniciar el pulso en cada tick.
  const renderPill = (withDate: boolean) => (
    <span className="pill">
      <span className="pulse" aria-hidden="true" />
      <span className="pill-blk">
        <span className="pill-lab">{phaseLabel}</span>
        <span className="pill-val tnum">{cdTime}</span>
      </span>
      <span className="pill-sep" />
      <span className="pill-cupos">
        {soldOut ? "Sin cupos" : <><b>{status.cuposDisponibles}</b> {status.cuposDisponibles === 1 ? "cupo" : "cupos"}</>}
      </span>
      {withDate && (
        <>
          <span className="pill-sep pill-date-sep" />
          <span className="pill-date">
            {IconCal}
            <span>{status.window.deliveryDateLabel} · 8 a.m.–12 md</span>
          </span>
        </>
      )}
    </span>
  );

  const scrollToMenu = () => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
  const scrollToCheckout = () =>
    document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "start" });

  function buildWaMessage(order: Order): string {
    const L: string[] = [];
    L.push("¡Hola Sano! 👋 Quiero confirmar mi pedido:");
    L.push("");
    L.push(`*Orden ${order.id}* · ${order.customerName}`);
    L.push(order.windowLabel); // ej. "Entrega Viernes 18 sep"

    if (order.dishes.length) {
      L.push("");
      L.push("*PLATOS LISTOS SANO*");
      order.dishes.forEach((d) => L.push(`x${d.qty}  ${d.name}`));
    }
    if (order.market.length) {
      L.push("");
      L.push("*SANO MARKET*");
      order.market.forEach((m) => L.push(`x${m.qty}  ${m.name} — ${crc(m.subtotal)}`));
    }

    L.push("");
    const combo = comboLabel(order.dishesQty, status.combos);
    const parts: string[] = [];
    if (order.dishesQty > 0) {
      parts.push(
        combo
          ? `${combo} platos ${crc(order.dishesTotal)}`
          : `${order.dishesQty} platos ${crc(order.dishesTotal)}`
      );
    }
    if (order.marketTotal > 0) parts.push(`Market ${crc(order.marketTotal)}`);
    L.push(`*TOTAL: ${crc(order.total)}*`);
    if (parts.length > 1) L.push(`(${parts.join(" + ")})`);
    else if (combo) L.push(`(${combo})`);

    if (order.notes) {
      L.push("");
      L.push(`📝 ${order.notes}`);
    }
    return L.join("\n");
  }

  function buildWaLink(order: Order) {
    return `https://wa.me/${WA}?text=${encodeURIComponent(buildWaMessage(order))}`;
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const win = window.open("", "_blank");
    try {
      const payload = {
        customerName: name.trim(),
        notes: notes.trim(),
        dishes: Object.entries(dishQty)
          .filter(([, q]) => q > 0)
          .map(([n, q]) => ({ name: n, qty: q })),
        market: market.flatMap((cat) =>
          cat.items
            .map((item) => ({ category: cat.name, name: item, qty: marketQty[mkey(cat.id, item)] || 0 }))
            .filter((m) => m.qty > 0)
        ),
      };
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "No se pudo crear el pedido");
      const order: Order = data.order;
      const link = buildWaLink(order);
      if (win) win.location.href = link;
      else window.location.href = link;
      setCreated(order);
      setDishQty({});
      setMarketQty({});
      refetchStatus();
    } catch (e) {
      if (win) win.close();
      setToast((e as Error).message || "Error al enviar el pedido");
    } finally {
      setSubmitting(false);
    }
  }

  function newOrder() {
    setCreated(null);
    setName("");
    setNotes("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const IconCal = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  );

  return (
    <>
      {/* ============ HERO ============ */}
      <section className={`hero ${phaseClass}`}>
        <div className="wrap">
          <div className="hero-copy">
            <h1>
              Resolvé almuerzos <em>y cenas.</em>
            </h1>
            <p className="lead">
              Platos de chef, listos para retirar. Elegí los tuyos y coordinás todo por WhatsApp en un
              minuto.
            </p>
            <div className="hero-cta">
              <button className="btn-primary" onClick={scrollToMenu}>
                Pedir ahora →
              </button>
            </div>
            <div className="trust">
              <span className="ig">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
                  <circle cx="12" cy="12" r="4.2" />
                  <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
                </svg>
                @sanoby22bistro
              </span>
              <span className="sep" />
              <span>+2.000 platos vendidos</span>
              <span className="sep trust-extra" />
              <span className="trust-extra">Atención personalizada 1 a 1</span>
            </div>

            {/* PILL de urgencia — anclado en el hero; se despega y sigue al scrollear */}
            <div className="hero-urgency" ref={heroPillRef}>
              {renderPill(true)}
              <span className="sr-only" role="timer">{cdA11y}</span>
            </div>
          </div>

          {/* SELLO — recurso de marca oficial (lib/brand · Seal) */}
          <div className="hero-visual" aria-hidden="true">
            <Seal className="hero-seal" />
          </div>
        </div>
      </section>

      {/* ============ SHEET ============ */}
      <div className="sheet">
        <div className="wrap">
          {/* MENU */}
          <div className="sec-head" id="menu">
            <div>
              <div className="sec-kick">Platos listos · Sano Premium</div>
              <h2 className="sec-title">Menú de la semana</h2>
            </div>
            <span className="week-pill">{status.weekLabel}</span>
          </div>

          <div className="combos">
            <span className="combos-lead">
              Elegí libre · <b>a más platos, mejor precio</b>
            </span>
            <div className="combos-cells">
              {status.combos.map((c, i) => (
                <div key={c.min} className={`combo-cell${i === status.combos.length - 1 ? " featured" : ""}`}>
                  {i === status.combos.length - 1 && <span className="cc-tag">Mejor precio</span>}
                  <span className="cc-q">{c.min}</span>
                  <span className="cc-l">platos</span>
                  <span className="cc-p tnum">{crc(c.price)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="menu-grid">
            {status.menu.map((dish, i) => {
              const q = dishQty[dish] || 0;
              return (
                <div key={dish} className={`dish${q > 0 ? " active" : ""}`}>
                  <div className="top">
                    <span className="idx">{i + 1}</span>
                    <h3>{dish}</h3>
                  </div>
                  <div className="row2">
                    <span className="price-each">
                      Desde <b>{crc(status.basePrice)}</b> c/u
                    </span>
                    <div className="stepper">
                      <button onClick={() => stepDish(dish, -1)} disabled={q <= 0} aria-label="Quitar">
                        –
                      </button>
                      {q > 0 ? <span className="q tnum">{q}</span> : <span className="add">Agregar</span>}
                      <button onClick={() => stepDish(dish, 1)} aria-label="Sumar">
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* MARKET */}
          <div className="market" id="market">
            <div className="mhead">
              <div>
                <div className="mkick">Para acompañar</div>
                <h3>¿Sumás algo de Sano Market?</h3>
              </div>
            </div>
            <div className="mgrid">
              {suggested.map(({ cat, item }) => {
                const q = marketQty[mkey(cat.id, item)] || 0;
                return (
                  <div key={mkey(cat.id, item)} className="mcard">
                    <span className="cat">{cat.name.replace(" SANO", "")}</span>
                    <span className="nm">{item}</span>
                    <div className="prow">
                      <span className="pr tnum">{crc(cat.price)}</span>
                      <div className="mini">
                        <button onClick={() => stepMarket(cat.id, item, -1)} disabled={q <= 0}>
                          –
                        </button>
                        <span className="q tnum">{q}</span>
                        <button onClick={() => stepMarket(cat.id, item, 1)}>+</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="seemore" onClick={() => setCatalogOpen((v) => !v)}>
              {catalogOpen ? "Ocultar catálogo" : "Ver todo el catálogo de Sano Market"}
            </button>

            {catalogOpen && (
              <div className="catalog">
                {market.map((cat) => (
                  <div key={cat.id} className="catblock">
                    <h4>
                      {cat.name} <span>{crc(cat.price)} · {cat.unit}</span>
                    </h4>
                    {cat.items.map((item) => {
                      const q = marketQty[mkey(cat.id, item)] || 0;
                      return (
                        <div key={item} className="catrow">
                          <span className="cn">{item}</span>
                          <div className="mini">
                            <button onClick={() => stepMarket(cat.id, item, -1)} disabled={q <= 0}>
                              –
                            </button>
                            <span className="q tnum">{q}</span>
                            <button onClick={() => stepMarket(cat.id, item, 1)}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CHECKOUT */}
          <div className="checkout" id="checkout">
            {created ? (
              <SuccessPanel order={created} waLink={buildWaLink(created)} onNew={newOrder} />
            ) : (
              <>
                <div className="panel">
                  <h3>Tus datos</h3>
                  <div className="field">
                    <label htmlFor="nm">Nombre y apellido</label>
                    <input id="nm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: María Fernández" />
                  </div>
                  <div className="field">
                    <label htmlFor="nt">Restricciones o ajustes menores</label>
                    <textarea id="nt" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: sin cebolla, alérgico a maní…" />
                    <div className="hint">
                      Solo modificaciones menores dentro de las opciones ofrecidas — no personalización
                      completa de platos.
                    </div>
                  </div>
                </div>

                <div>
                  <div className="comanda">
                    <div className="ctop">
                      <span className="t">Comanda</span>
                      <span className="stamp">Tu pedido</span>
                    </div>
                    <div className="cbody">
                      {name.trim() && (
                        <div style={{ fontFamily: "var(--disp)", fontSize: "1.05rem", color: "var(--bordo-ink)", marginBottom: 8 }}>
                          {name.trim()}
                        </div>
                      )}
                      {totals.dishesQty > 0 && <div className="csub">Platos listos</div>}
                      {status.menu.map((dish) => {
                        const q = dishQty[dish] || 0;
                        if (!q) return null;
                        return (
                          <div key={dish} className="cline">
                            <span className="qy">{q}×</span>
                            <span className="nm">{dish}</span>
                          </div>
                        );
                      })}
                      {totals.marketCount > 0 && <div className="csub">Sano Market</div>}
                      {market.map((cat) =>
                        cat.items.map((item) => {
                          const q = marketQty[mkey(cat.id, item)] || 0;
                          if (!q) return null;
                          return (
                            <div key={mkey(cat.id, item)} className="cline">
                              <span className="qy">{q}×</span>
                              <span className="nm">{item}</span>
                              <span className="amt">{crc(q * cat.price)}</span>
                            </div>
                          );
                        })
                      )}
                      {totals.grand === 0 && (
                        <div className="empty">Todavía no elegiste nada. Sumá desde el menú de arriba ↑</div>
                      )}
                      {notes.trim() && (
                        <>
                          <div className="csub">Nota</div>
                          <div style={{ fontSize: 13.5, color: "var(--muted)" }}>“{notes.trim()}”</div>
                        </>
                      )}
                    </div>
                    <div className="ctotals">
                      <div className="trow">
                        <span>Platos listos ({totals.dishesQty})</span>
                        <span className="tnum">{crc(totals.dishesTotal)}</span>
                      </div>
                      {totals.marketTotal > 0 && (
                        <div className="trow">
                          <span>Sano Market</span>
                          <span className="tnum">{crc(totals.marketTotal)}</span>
                        </div>
                      )}
                      {savings > 0 && (
                        <div className="savings">
                          ✨ <b>{combo} aplicado</b> — estás ahorrando {crc(savings)} en tus platos.
                        </div>
                      )}
                      {totals.dishesQty > 0 && next && (
                        <div className="combohint">
                          ➕ Sumá <b>{next.min - totals.dishesQty} plato{next.min - totals.dishesQty > 1 ? "s" : ""}</b> más y activás el <b>Combo {next.min}</b> ({crc(next.price)}).
                        </div>
                      )}
                      <div className="grand">
                        <span className="l">Total</span>
                        <span className="v tnum">{crc(totals.grand)}</span>
                      </div>
                    </div>
                  </div>

                  {soldOut ? (
                    <a className="wa-btn" href={`https://wa.me/${WA}?text=${encodeURIComponent("Hola Sano 👋 Me gustaría entrar en lista de espera para la próxima ventana.")}`} target="_blank" rel="noopener noreferrer" style={{ background: "var(--bordo)" }}>
                      Sin cupos — escribinos para lista de espera
                    </a>
                  ) : (
                    <button className="wa-btn" onClick={submit} disabled={!canSubmit}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2m0 18.15c-1.52 0-3.01-.41-4.31-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.35c0-4.54 3.7-8.24 8.24-8.24s8.24 3.7 8.24 8.24-3.7 8.24-8.24 8.24m4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12s-.64.81-.79.97c-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72s-.02-.38.11-.5c.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31s-.86.85-.86 2.07.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29" />
                      </svg>
                      {submitting ? "Enviando…" : "Enviar pedido por WhatsApp"}
                    </button>
                  )}
                  <p className="wa-note">
                    Se abre WhatsApp con tu pedido pre-escrito. Los datos de pago se coordinan ahí mismo con
                    Sano.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* PILL de urgencia flotante — aparece cuando el pill del hero sale de vista */}
      <button
        type="button"
        className={`u-pill ${phaseClass}${pillShow && !created ? " show" : ""}`}
        onClick={scrollToMenu}
        aria-hidden={pillShow && !created ? undefined : true}
        tabIndex={pillShow && !created ? 0 : -1}
        aria-label={`${cdA11y} Tocá para ir al menú.`}
      >
        {renderPill(false)}
      </button>

      {/* sticky total */}
      <div className={`sticky${totals.grand > 0 && !created ? " show" : ""}`}>
        <div className="wrap">
          <div className="sinfo">
            <span className="scount">
              {totals.dishesQty} platos · {soldOut ? "sin cupos" : canSubmit ? "listo para enviar" : "toca continuar"}
            </span>
            <span className="stotal tnum">
              {crc(totals.grand)}
              {combo && <span className="stag">{combo}</span>}
            </span>
          </div>
          {soldOut ? (
            <button className="go" disabled style={{ opacity: 0.65 }}>
              Sin cupos
            </button>
          ) : canSubmit ? (
            <button className="go wa" onClick={submit} disabled={submitting}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2m0 18.15c-1.52 0-3.01-.41-4.31-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.35c0-4.54 3.7-8.24 8.24-8.24s8.24 3.7 8.24 8.24-3.7 8.24-8.24 8.24m4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12s-.64.81-.79.97c-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72s-.02-.38.11-.5c.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31s-.86.85-.86 2.07.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29" />
              </svg>
              {submitting ? "Enviando…" : "Confirmar por WhatsApp"}
            </button>
          ) : (
            <button className="go" onClick={scrollToCheckout}>
              Continuar →
            </button>
          )}
        </div>
      </div>
      <div style={{ height: totals.grand > 0 && !created ? 84 : 0 }} />

      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}

function SuccessPanel({ order, waLink, onNew }: { order: Order; waLink: string; onNew: () => void }) {
  return (
    <div className="panel" style={{ gridColumn: "1 / -1", textAlign: "center" }}>
      <div style={{ fontSize: 40, lineHeight: 1 }}>🎉</div>
      <h3 style={{ marginTop: 10 }}>¡Pedido registrado!</h3>
      <p style={{ color: "var(--muted)", marginTop: 8 }}>
        Tu número de orden es
      </p>
      <div style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: "2rem", color: "var(--bordo)", margin: "6px 0 4px" }}>
        {order.id}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        {order.dishesQty > 0 && `${order.dishesQty} platos`}
        {order.market.length > 0 && ` · ${order.market.reduce((s, m) => s + m.qty, 0)} de Market`} · Total{" "}
        <b style={{ color: "var(--ink)" }}>{crc(order.total)}</b>
      </p>
      <a className="wa-btn" href={waLink} target="_blank" rel="noopener noreferrer" style={{ maxWidth: 420, margin: "18px auto 0" }}>
        Abrir WhatsApp para confirmar
      </a>
      <p className="wa-note">Si WhatsApp no se abrió solo, tocá el botón. El pago se coordina en la conversación.</p>
      <button
        onClick={onNew}
        style={{ marginTop: 14, background: "transparent", border: "1px solid var(--line-strong)", color: "var(--bordo)", borderRadius: 11, padding: "12px 18px", fontWeight: 600, fontFamily: "var(--body)" }}
      >
        Hacer otro pedido
      </button>
    </div>
  );
}
