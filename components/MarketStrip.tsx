"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketCategory } from "@/lib/types";
import { crc } from "@/lib/format";
import { AddStepper } from "./AddStepper";

/** Clave de un producto del Market dentro del carrito del cliente. */
export const mkey = (catId: string, item: string) => `${catId}|${item}`;

/**
 * Sano Market como una tira que se desliza: categorías arriba (con un contador de lo elegido) y los productos
 * de esa categoría en tarjetas. «Sugeridos» usa la misma regla de siempre: el primer producto de cada categoría
 * sugerida y se completa hasta 4. Todo el catálogo queda a un toque, sin abrir ningún acordeón.
 */
export function MarketStrip({
  market,
  qty,
  onStep,
}: {
  market: MarketCategory[];
  qty: Record<string, number>;
  onStep: (catId: string, item: string, delta: number) => void;
}) {
  const [tab, setTab] = useState<string>("sug");
  const scroller = useRef<HTMLDivElement>(null);

  const suggested = useMemo(() => {
    const out: { cat: MarketCategory; item: string }[] = [];
    for (const c of market) if (c.suggested && c.items[0]) out.push({ cat: c, item: c.items[0] });
    for (const c of market) {
      if (out.length >= 4) break;
      if (!c.suggested && c.items[0]) out.push({ cat: c, item: c.items[0] });
    }
    return out.slice(0, 4);
  }, [market]);

  const cardsOf = (id: string) =>
    id === "sug"
      ? suggested
      : (market.find((c) => c.id === id)?.items || []).map((item) => ({ cat: market.find((c) => c.id === id) as MarketCategory, item }));

  const tabs = [{ id: "sug", name: "Sugeridos" }, ...market.map((c) => ({ id: c.id, name: c.name.replace(/\s*SANO$/i, "") }))];
  const cards = cardsOf(tab);

  useEffect(() => {
    scroller.current?.scrollTo({ left: 0 });
  }, [tab]);

  if (market.length === 0) return null;
  return (
    <section className="mkt" id="market" aria-label="Sano Market">
      <div className="mkick">Para acompañar</div>
      <h3>¿Sumás algo de Sano Market?</h3>
      <div className="mkt-tabs" role="group" aria-label="Categorías del Market">
        {tabs.map((t) => {
          const n = cardsOf(t.id).reduce((s, { cat, item }) => s + (qty[mkey(cat.id, item)] || 0), 0);
          return (
            <button key={t.id} type="button" className="mkt-chip" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
              {t.name}
              {n > 0 && <span className="cnt">{n}</span>}
            </button>
          );
        })}
      </div>
      <div className="mkt-scroll" ref={scroller}>
        {cards.map(({ cat, item }) => {
          const q = qty[mkey(cat.id, item)] || 0;
          return (
            <div className={`mkt-card${q > 0 ? " on" : ""}`} key={mkey(cat.id, item)}>
              <span className="mcat">{cat.name.replace(/\s*SANO$/i, "")}</span>
              <span className="mname">{item}</span>
              <span className="munit">{cat.unit}</span>
              <div className="mrow">
                <span className="mprice tnum">{crc(cat.price)}</span>
                <AddStepper qty={q} label={item} full onMinus={() => onStep(cat.id, item, -1)} onPlus={() => onStep(cat.id, item, 1)} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
