"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Order, ViajeEstado, ViajePack, ViajeSettings } from "@/lib/types";
import { crc } from "@/lib/format";
import { loadContact, saveContact } from "@/lib/contact";
import { AddStepper } from "@/components/AddStepper";
import {
  MAX_QTY_PER_LINE,
  PORTIONS_PER_TRAY,
  VIAJE_CATS,
  activeItems,
  cartTotal,
  giftFor,
  indexItems,
  isPackEdited,
  longDate,
  lyc,
  neededTrays,
  nextReward,
  packAvailable,
  perPortion,
  plural,
  portions,
  recommendPack,
  swapOne,
  swapOptions,
  trays,
  traysTotal,
  viajeOrderMessage,
  type ViajeCart,
} from "@/lib/viaje";

const WA = process.env.NEXT_PUBLIC_WHATSAPP || "50683193498";

const OWNER_NOTE: Record<ViajeEstado, string> = {
  oculto: "Vista del dueño · tus clientes no ven esta página (estado: Oculto)",
  pronto: "Vista del dueño · tus clientes ven «Disponible pronto» (estado: Próximamente)",
  abierto: "",
};

/** Dibujo: una bandeja = un recuadro con 4 puntos (4 porciones, 4 personas). */
function TrayRow({ n, small, light }: { n: number; small?: boolean; light?: boolean }) {
  const max = 12;
  return (
    <div
      className={`vj-trays${small ? " sm" : ""}${light ? " light" : ""}`}
      role="img"
      aria-label={`${n} ${plural(n, "bandeja", "bandejas")} de ${PORTIONS_PER_TRAY} porciones`}
    >
      {Array.from({ length: Math.min(n, max) }, (_, i) => (
        <span className="vj-tray" key={i}>
          <i /><i /><i /><i />
        </span>
      ))}
      {n > max && <span className="vj-trays-more">+{n - max}</span>}
    </div>
  );
}

/** Desglose explícito de un pack: cuántas bandejas, cuántas porciones y para cuántas personas. */
function PackLines({ pack, settings }: { pack: ViajePack; settings: ViajeSettings }) {
  const idx = indexItems(settings.items);
  const rows = VIAJE_CATS.filter((c) => c.tray)
    .map((c) => ({ c, n: Object.entries(pack.items).reduce((s, [id, q]) => s + (idx.get(id)?.cat === c.id ? q : 0), 0) }))
    .filter((r) => r.n > 0);
  const t = trays(pack.items, settings.items);
  return (
    <ul className="vj-plines">
      {rows.map(({ c, n }) => (
        <li key={c.id}>
          <div>
            <b>{n} {plural(n, c.sing, c.plur)}</b>
            <small>
              {n} {plural(n, "bandeja", "bandejas")} × {PORTIONS_PER_TRAY} porciones<br />cada bandeja para {PORTIONS_PER_TRAY} personas
            </small>
          </div>
          <span className="tnum">{n * PORTIONS_PER_TRAY} porciones</span>
        </li>
      ))}
      <li className="vj-ptot">
        <div>
          <b>Total</b>
          <small>{lyc(t)} para {PORTIONS_PER_TRAY} personas</small>
        </div>
        <span className="tnum">{t * PORTIONS_PER_TRAY} porciones</span>
      </li>
    </ul>
  );
}

const IC = {
  person: (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
    </svg>
  ),
  sun: (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
    </svg>
  ),
  moon: (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </svg>
  ),
  snow: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 2v20M4.2 7l15.6 10M19.8 7L4.2 17M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5" />
    </svg>
  ),
  cal: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  ),
  wa: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2m0 18.15c-1.52 0-3.01-.41-4.31-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.35c0-4.54 3.7-8.24 8.24-8.24s8.24 3.7 8.24 8.24-3.7 8.24-8.24 8.24m4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12s-.64.81-.79.97c-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72s-.02-.38.11-.5c.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31s-.86.85-.86 2.07.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29" />
    </svg>
  ),
};

type Calc = { p: number; a: number; c: number };

export function ViajeSano({
  settings,
  minDate,
  estado,
}: {
  settings: ViajeSettings;
  /** Primera fecha de retiro posible (YYYY-MM-DD, hora CR), calculada en el servidor. */
  minDate: string;
  /** Estado actual: si no es «abierto», quien ve esta página es el dueño (vista previa). */
  estado: ViajeEstado;
}) {
  const items = settings.items;
  const idx = useMemo(() => indexItems(items), [items]);
  const shown = useMemo(() => activeItems(items), [items]);

  const [calc, setCalc] = useState<Calc>({ p: 4, a: 2, c: 2 });
  const [cart, setCart] = useState<ViajeCart>({});
  const [packId, setPackId] = useState<string | null>(null);
  const [showPacks, setShowPacks] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Order | null>(null);
  const [toast, setToast] = useState("");
  const [swapId, setSwapId] = useState<string | null>(null);
  const swapOpener = useRef<HTMLElement | null>(null);
  const swapClose = useRef<HTMLButtonElement>(null);

  // datos recordados en este celular (los mismos del menú semanal)
  useEffect(() => {
    const c = loadContact();
    if (!c) return;
    setName((v) => v || c.name);
    setPhone((v) => v || c.phone);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  // hoja de «Cambiar»: Escape cierra, el fondo no se desplaza y el foco vuelve a quien la abrió
  const closeSwap = useCallback(() => {
    setSwapId(null);
    swapOpener.current?.focus?.();
  }, []);
  useEffect(() => {
    if (!swapId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    swapClose.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSwap();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [swapId, closeSwap]);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  // ── cuentas ──
  const needed = neededTrays(calc.p, calc.a, calc.c);
  const meals = calc.a + calc.c;
  const rec = useMemo(() => recommendPack(needed, settings.packs, items), [needed, settings.packs, items]);
  const availablePacks = useMemo(() => settings.packs.filter((p) => packAvailable(p, items)), [settings.packs, items]);

  const count = Object.values(cart).reduce((s, q) => s + q, 0);
  const t = trays(cart, items);
  const port = t * PORTIONS_PER_TRAY;
  const extras = count - t;
  const total = cartTotal(cart, items);
  const pp = perPortion(cart, items);
  const gift = giftFor(total, settings.rewards);
  const nextGift = nextReward(total, settings.rewards);
  const activePack = packId ? settings.packs.find((p) => p.id === packId) || null : null;
  const edited = activePack ? isPackEdited(cart, activePack) : false;

  const dateOk = !!date && date >= minDate;
  const dateBad = !!date && !dateOk;
  const canSubmit = count > 0 && name.trim().length > 0 && dateOk && !submitting && !created;

  const setCalcN = (k: keyof Calc, d: number) =>
    setCalc((c) => {
      const lim = k === "p" ? [1, 16] : [0, 14];
      return { ...c, [k]: Math.max(lim[0], Math.min(lim[1], c[k] + d)) };
    });

  const step = (id: string, d: number) => {
    setCreated(null);
    setCart((c) => {
      const q = Math.max(0, Math.min(MAX_QTY_PER_LINE, (c[id] || 0) + d));
      const next = { ...c };
      if (q) next[id] = q;
      else delete next[id];
      return next;
    });
  };

  const choosePack = (p: ViajePack) => {
    setCreated(null);
    setCart({ ...p.items });
    setPackId(p.id);
    setToast("Pack cargado. Revisalo y elegí el día de retiro.");
    setTimeout(() => go("vj-pedido"), 40);
  };

  const openCustom = () => {
    setShowCustom(true);
    setTimeout(() => go("vj-armar"), 40);
  };
  const openPacks = () => {
    setShowPacks(true);
    setTimeout(() => go("vj-packs"), 40);
  };
  const openExtra = (cat: string) => {
    setShowCustom(true);
    setTimeout(() => go(`vj-cat-${cat}`), 40);
  };

  const doSwap = (to: string) => {
    if (!swapId) return;
    setCart((c) => swapOne(c, swapId, to));
    setToast(`Cambiaste a ${idx.get(to)?.name || "otra opción"}.`);
    closeSwap();
  };

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const win = window.open("", "_blank");
    try {
      const r = await fetch("/api/viaje/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim(),
          whatsapp: phone.trim(),
          notes: notes.trim(),
          pickupDate: date,
          packId: packId && !edited ? packId : undefined,
          lines: Object.entries(cart).map(([id, qty]) => ({ id, qty })),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "No se pudo enviar el pedido.");
      const order: Order = data.order;
      const link = `https://wa.me/${WA}?text=${encodeURIComponent(viajeOrderMessage(order))}`;
      if (win) win.location.href = link;
      else window.location.href = link;
      const prev = loadContact();
      saveContact({ name, phone, email: prev?.email || "" });
      setCreated(order);
      setCart({});
      setPackId(null);
    } catch (e) {
      if (win) win.close();
      setToast((e as Error).message || "No se pudo enviar el pedido.");
    } finally {
      setSubmitting(false);
    }
  }

  const newOrder = () => {
    setCreated(null);
    setNotes("");
    setNoteOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── textos del resultado de la calculadora ──
  let fit = "";
  let fitWarn = false;
  if (rec) {
    const b = trays(rec.pack.items, items);
    if (rec.base) {
      fit = `Empezá con este pack y sumá ${needed - b} ${plural(needed - b, "bandeja más", "bandejas más")}.`;
      fitWarn = true;
    } else if (rec.diff === 0) fit = "Te alcanza justo.";
    else if (rec.diff > 0) fit = `Te alcanza y te ${plural(rec.diff, "sobra", "sobran")} ${rec.diff} ${plural(rec.diff, "bandeja", "bandejas")}.`;
    else {
      fit = `Te ${plural(-rec.diff, "falta", "faltan")} ${-rec.diff} ${plural(-rec.diff, "bandeja", "bandejas")}: la sumás en tu pedido.`;
      fitWarn = true;
    }
  }

  const goalMsg =
    meals === 0
      ? ""
      : t === 0
      ? `Tu meta: ${needed} ${plural(needed, "bandeja", "bandejas")} de ${PORTIONS_PER_TRAY} porciones. Todavía no elegiste ninguna.`
      : t < needed
      ? `Llevás ${t} de ${needed} bandejas · faltan ${needed - t}`
      : t === needed
      ? `✓ Llevás las ${needed} ${plural(needed, "bandeja", "bandejas")} que necesitás`
      : `Llevás ${t} bandejas y necesitabas ${needed} · te ${plural(t - needed, "sobra", "sobran")} ${t - needed}`;
  const goalMet = t > 0 && t >= needed && meals > 0;
  const goalPct = needed ? Math.min(100, Math.round((t / needed) * 100)) : 0;

  const GoalStrip = ({ where }: { where: "armar" | "pedido" }) =>
    meals === 0 ? null : (
      <div className={`vj-goal${goalMet ? " met" : ""}`} aria-live="polite">
        <span className="gt">{goalMsg}</span>
        {where === "pedido" ? (
          t < needed && (
            <button type="button" className="gx" onClick={openCustom}>
              Agregar bandejas
            </button>
          )
        ) : (
          <button type="button" className="gx" onClick={() => go("vj-calc")}>
            Cambiar cálculo
          </button>
        )}
        <div className="bar"><i style={{ width: `${goalPct}%` }} /></div>
      </div>
    );

  const swapItem = swapId ? idx.get(swapId) : null;
  const swapOpts = swapId ? swapOptions(swapId, items) : [];
  const stickyOn = count > 0 && !created;

  const comandaLines = VIAJE_CATS.map((c) => {
    const rows = shown.filter((i) => i.cat === c.id && (cart[i.id] || 0) > 0);
    if (!rows.length) return null;
    return (
      <div key={c.id}>
        <div className="csub">{c.name}</div>
        {rows.map((i) => {
          const q = cart[i.id];
          const canSwap = shown.filter((x) => x.cat === i.cat).length > 1;
          return (
            <div className="vj-cline" key={i.id}>
              <span className="nm">
                {i.name}
                <small>
                  {c.unit}
                  {c.perPortion ? ` · ${crc(i.price / PORTIONS_PER_TRAY)} por porción` : ""}
                  {q > 1 && c.short === "4 porciones" ? ` · ${q * PORTIONS_PER_TRAY} porciones en total` : ""}
                </small>
                {canSwap && (
                  <button
                    type="button"
                    className="vj-swaplink"
                    onClick={(e) => {
                      swapOpener.current = e.currentTarget;
                      setSwapId(i.id);
                    }}
                  >
                    Cambiar
                  </button>
                )}
              </span>
              <span className="rt">
                <span className="amt tnum">{crc(i.price * q)}</span>
                <AddStepper qty={q} label={i.name} onMinus={() => step(i.id, -1)} onPlus={() => step(i.id, 1)} />
              </span>
            </div>
          );
        })}
      </div>
    );
  });

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="hero vj-hero">
        <div className="wrap">
          {estado !== "abierto" && <div className="vj-owner">{OWNER_NOTE[estado]}</div>}
          <h1 className="hero-title">
            Llevá Sano <em>a donde vayas.</em>
          </h1>
          <p className="vj-one">Contanos cuántos son y te recomendamos qué llevar. Vos elegís el día de retiro.</p>
        </div>
      </section>

      <div className="sheet">
        <div className="wrap">
          {/* ============ CALCULADORA ============ */}
          <section className="vj-sec" id="vj-calc">
            <h2 className="sec-title">Calculá tu pedido</h2>
            <div className="vj-calc">
              <div className="vj-ctl">
                {(
                  [
                    ["p", "Personas", IC.person],
                    ["a", "Almuerzos", IC.sun],
                    ["c", "Cenas", IC.moon],
                  ] as const
                ).map(([k, label, icon]) => (
                  <div className="vj-ctile" key={k}>
                    <span className="ic">{icon}</span>
                    <span className="lab">{label}</span>
                    <span className="num tnum" aria-live="polite">{calc[k]}</span>
                    <div className="btns">
                      <button type="button" className="cbtn minus" aria-label={`Menos ${label.toLowerCase()}`} disabled={calc[k] <= (k === "p" ? 1 : 0)} onClick={() => setCalcN(k, -1)}>–</button>
                      <button type="button" className="cbtn plus" aria-label={`Más ${label.toLowerCase()}`} disabled={calc[k] >= (k === "p" ? 16 : 14)} onClick={() => setCalcN(k, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="vj-out" aria-live="polite">
                {meals === 0 ? (
                  <div className="eq">Sumá al menos un almuerzo o una cena.</div>
                ) : (
                  <>
                    <div className="eq">
                      {calc.p} {plural(calc.p, "persona", "personas")} × {meals} {plural(meals, "comida", "comidas")} ({calc.a} {plural(calc.a, "almuerzo", "almuerzos")} y {calc.c} {plural(calc.c, "cena", "cenas")})
                    </div>
                    <div className="big">
                      <b className="tnum">{calc.p * meals}</b> porciones = <b className="tnum">{needed}</b> {plural(needed, "bandeja", "bandejas")}
                    </div>
                  </>
                )}
              </div>
              {needed > 0 && <TrayRow n={needed} />}
              <p className="vj-porcion">
                <b>1 porción</b> = lo que come 1 persona en un almuerzo o cena. <b>1 bandeja</b> = {PORTIONS_PER_TRAY} porciones.
              </p>
            </div>

            {meals > 0 && rec && (
              <div className="vj-rec">
                <div className="vj-rec-top">
                  <span className="tag">Te recomendamos</span>
                  <span className={`fit${fitWarn ? " warn" : ""}`}>{fit}</span>
                </div>
                <h3>Pack {rec.pack.name}</h3>
                <TrayRow n={trays(rec.pack.items, items)} small light />
                <PackLines pack={rec.pack} settings={settings} />
                <div className="vj-rec-price">
                  <b className="tnum">{crc(cartTotal(rec.pack.items, items))}</b>
                  <span className="tnum">≈ {crc(perPortion(rec.pack.items, items))} por porción</span>
                </div>
                <div className="vj-rec-actions">
                  <button type="button" className="vj-btn" onClick={() => choosePack(rec.pack)}>Elegir Pack {rec.pack.name}</button>
                  <button type="button" className="vj-btn-line" onClick={openCustom}>Armar el mío</button>
                </div>
                {availablePacks.length > 1 && (
                  <button type="button" className="vj-link" onClick={openPacks}>Ver los {availablePacks.length} packs</button>
                )}
              </div>
            )}
            {meals > 0 && !rec && (
              <div className="vj-rec">
                <h3>Armá el tuyo</h3>
                <p className="vj-sub">Elegí las bandejas que quieras; te vamos contando cuántas llevás.</p>
                <div className="vj-rec-actions"><button type="button" className="vj-btn" onClick={openCustom}>Armar mi pedido</button></div>
              </div>
            )}
          </section>

          {/* ============ LOS PACKS ============ */}
          {showPacks && (
            <section className="vj-sec" id="vj-packs">
              <h2 className="sec-title">Los {availablePacks.length} packs</h2>
              <div className="vj-packs">
                {availablePacks.map((p) => {
                  const on = packId === p.id && !edited;
                  const suggested = rec?.pack.id === p.id && meals > 0;
                  return (
                    <article
                      key={p.id}
                      className={`vj-pack${on ? " on" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-pressed={on}
                      onClick={() => choosePack(p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          choosePack(p);
                        }
                      }}
                    >
                      {suggested && <span className="tag">Sugerido para vos</span>}
                      <h3>{p.name}</h3>
                      <TrayRow n={trays(p.items, items)} small light />
                      <PackLines pack={p} settings={settings} />
                      <div className="price tnum">{crc(cartTotal(p.items, items))}</div>
                      <div className="pp tnum">≈ {crc(perPortion(p.items, items))} por porción</div>
                      <span className="cta">{on ? "✓ Elegido" : "Elegir"}</span>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* ============ ARMÁ EL TUYO ============ */}
          {showCustom && (
            <section className="vj-sec" id="vj-armar">
              <h2 className="sec-title">Armá el tuyo</h2>
              <GoalStrip where="armar" />
              <nav className="vj-catsnav" aria-label="Categorías">
                {VIAJE_CATS.map((c) => (
                  <button type="button" key={c.id} className="vj-chip" onClick={() => go(`vj-cat-${c.id}`)}>
                    {c.chip || c.name}
                  </button>
                ))}
              </nav>
              {[
                { title: "Platos fuertes", sub: "Cada bandeja es 1 almuerzo o cena para 4 personas. Cuentan para tu meta.", cats: VIAJE_CATS.filter((c) => c.tray) },
                { title: "Extras", sub: "Para sumar a tus platos. No cuentan para tu meta.", cats: VIAJE_CATS.filter((c) => !c.tray) },
              ].map((g) => (
                <div className="vj-grp" key={g.title}>
                  <h3 className="vj-grp-t">{g.title}</h3>
                  <p className="vj-grp-s">{g.sub}</p>
                  {g.cats.map((c) => {
                    const rows = shown.filter((i) => i.cat === c.id);
                    if (!rows.length) return null;
                    return (
                      <div className="vj-cblock" id={`vj-cat-${c.id}`} key={c.id}>
                        <div className="vj-cblock-h">
                          <h3>{c.name}</h3>
                          <span className="rule">{c.rule}</span>
                        </div>
                        <div className="vj-rows">
                          {rows.map((i) => {
                            const q = cart[i.id] || 0;
                            return (
                              <div className={`vj-row${q > 0 ? " on" : ""}`} key={i.id}>
                                <div>
                                  <div className="vname">{i.name}</div>
                                  <div className="vmeta">
                                    {i.desc ? `${i.desc} · ` : ""}
                                    <b className="tnum">{crc(i.price)}</b> · {c.unit}
                                  </div>
                                  {c.perPortion && <div className="vpp tnum">{crc(i.price / PORTIONS_PER_TRAY)} por porción</div>}
                                </div>
                                <AddStepper qty={q} label={i.name} onMinus={() => step(i.id, -1)} onPlus={() => step(i.id, 1)} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </section>
          )}

          {/* ============ TU RETIRO + TU PEDIDO ============ */}
          <section className="vj-sec checkout" id="vj-pedido">
            <div className="panel">
              <h3>Tu retiro</h3>
              <div className="field vj-date">
                <label htmlFor="vj-date">¿Qué día pasás a retirar?</label>
                <input id="vj-date" type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={dateBad || undefined} />
                {dateBad ? (
                  <div className="hint err">
                    Pedí con {settings.leadDays} {plural(settings.leadDays, "día", "días")} de anticipación: elegí desde el {longDate(minDate)}.
                  </div>
                ) : (
                  <div className="hint">
                    Con {settings.leadDays} {plural(settings.leadDays, "día", "días")} de anticipación. Primer día disponible: {longDate(minDate)}. Te confirmamos fecha y hora por WhatsApp.
                  </div>
                )}
              </div>
              <div className="vj-chain">{IC.snow}<span>{settings.chainText}</span></div>
              <div className="field">
                <label htmlFor="vj-name">Nombre y apellido</label>
                <input id="vj-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: María Fernández" />
              </div>
              <div className="field">
                <label htmlFor="vj-phone">
                  WhatsApp <span style={{ textTransform: "none", letterSpacing: 0 }}>(opcional)</span>
                </label>
                <input id="vj-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: 8319 3498" />
              </div>
              <button type="button" className="vj-link left" onClick={() => setNoteOpen((v) => !v)} aria-expanded={noteOpen}>
                {noteOpen ? "− Quitar la nota" : "+ Agregar una nota"}
              </button>
              {noteOpen && (
                <div className="field">
                  <label htmlFor="vj-notes">Nota</label>
                  <textarea id="vj-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: qué salsa de regalo preferís, alergias…" />
                </div>
              )}
            </div>

            <div>
              {created ? (
                <div className="vj-done" role="status">
                  <b>¡Pedido registrado!</b>
                  <div className="id">{created.id}</div>
                  <p>
                    Retiro pedido: <strong>{created.pickupDate ? longDate(created.pickupDate) : ""}</strong> · Total <strong>{crc(created.total)}</strong>
                  </p>
                  <a
                    className="wa-btn"
                    href={`https://wa.me/${WA}?text=${encodeURIComponent(viajeOrderMessage(created))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ maxWidth: 420, margin: "16px auto 0" }}
                  >
                    Abrir WhatsApp para confirmar
                  </a>
                  <p className="wa-note">Si WhatsApp no se abrió solo, tocá el botón. La fecha y la hora se confirman en la conversación.</p>
                  <button type="button" className="vj-link" onClick={newOrder}>Hacer otro pedido</button>
                </div>
              ) : (
                <>
                  <div className="comanda">
                    <div className="ctop">
                      <span className="t">Tu pedido</span>
                      <span className="stamp">{activePack ? `Pack ${activePack.name}${edited ? " · editado" : ""}` : "Viaje Sano"}</span>
                    </div>
                    <div className="cbody">
                      <GoalStrip where="pedido" />
                      <div className="cdeliv">
                        {IC.cal}
                        <span>{dateOk ? <>Retiro pedido: <b>{longDate(date)}</b></> : "Elegí el día de retiro"}</span>
                      </div>
                      {count === 0 ? (
                        <div className="empty">Todavía no elegiste nada. Elegí el pack recomendado o armá el tuyo.</div>
                      ) : (
                        comandaLines
                      )}
                      <div className="vj-extras">
                        <p>¿Sumás algo más?</p>
                        <div className="chips">
                          {VIAJE_CATS.filter((c) => !c.tray && shown.some((i) => i.cat === c.id)).map((c) => (
                            <button type="button" className="vj-chip" key={c.id} onClick={() => openExtra(c.id)}>
                              {c.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="ctotals">
                      <div className="trow"><span>Platos fuertes</span><b className="tnum">{port} porciones</b></div>
                      {port > 0 && <div className="trow"><span>Precio por porción de plato fuerte</span><b className="tnum">≈ {crc(pp)}</b></div>}
                      <div className="trow"><span>Extras</span><b className="tnum">{extras > 0 ? `${extras} · ${crc(total - traysTotal(cart, items))}` : "0"}</b></div>
                      {nextGift || gift ? (
                        <div className={`vj-reward${gift && !nextGift ? " got" : ""}`}>
                          {gift ? `🎁 Ganaste ${gift.text}. ` : ""}
                          {nextGift ? `Sumá ${crc(nextGift.at - total)} y te regalamos ${nextGift.text.replace(/ de regalo$/, "")}.` : "Llegaste al máximo beneficio."}
                          <div className="bar"><i style={{ width: `${nextGift ? Math.max(4, Math.round(((total - (gift?.at || 0)) / (nextGift.at - (gift?.at || 0))) * 100)) : 100}%` }} /></div>
                        </div>
                      ) : null}
                      <div className="grand"><span className="l">Total</span><span className="v tnum">{crc(total)}</span></div>
                    </div>
                  </div>
                  <button className="wa-btn" onClick={submit} disabled={!canSubmit}>
                    {IC.wa}
                    {submitting ? "Enviando…" : "Pedir por WhatsApp"}
                  </button>
                  <p className="wa-note">
                    {canSubmit
                      ? "Se abre WhatsApp con tu pedido listo. Te confirmamos la fecha por ahí."
                      : `Falta ${[count === 0 && "elegir tu pedido", !dateOk && "el día de retiro", !name.trim() && "tu nombre"].filter(Boolean).join(", ").replace(/, ([^,]*)$/, " y $1")}.`}
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* barra fija: avance de la meta y total */}
      <div className={`sticky${stickyOn ? " show" : ""}`} aria-live="polite">
        <div className="wrap">
          <div className="sinfo">
            <span className="scount">
              {t > 0 && meals > 0
                ? `${t} de ${needed} ${plural(needed, "bandeja", "bandejas")}${extras ? ` + ${extras} ${plural(extras, "extra", "extras")}` : ""}`
                : `${count} ${plural(count, "producto", "productos")}`}
            </span>
            <span className="stotal tnum">{crc(total)}</span>
          </div>
          <button className="go" type="button" onClick={() => go("vj-pedido")}>
            Ver mi pedido →
          </button>
        </div>
      </div>
      <div style={{ height: stickyOn ? 84 : 0 }} />

      {/* hoja de «Cambiar sabor» */}
      {swapItem && (
        <div className="vj-swapov" onClick={closeSwap}>
          <div className="vj-swapsheet" role="dialog" aria-modal="true" aria-labelledby="vj-swap-t" onClick={(e) => e.stopPropagation()}>
            <div className="head">
              <h3 id="vj-swap-t">Cambiar {swapItem.name}</h3>
              <button ref={swapClose} type="button" className="x" aria-label="Cerrar" onClick={closeSwap}>×</button>
            </div>
            <p className="sub">{(cart[swapItem.id] || 0) > 1 ? `Cambiás 1 de tus ${cart[swapItem.id]}. Elegí por cuál.` : "Elegí por cuál lo cambiás."}</p>
            <div className="list">
              {swapOpts.map(({ item, diff }) => (
                <button type="button" className="opt" key={item.id} onClick={() => doSwap(item.id)}>
                  <span>
                    {item.name}
                    {item.desc && <small>{item.desc}</small>}
                  </span>
                  <b className={diff > 0 ? "up" : diff < 0 ? "dn" : ""}>{diff === 0 ? "Mismo precio" : `${diff > 0 ? "+" : "−"}${crc(diff)}`}</b>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}

