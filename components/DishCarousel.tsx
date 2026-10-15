"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Vitrina fija de platos (fotos con el nombre incluido, en public/platos). El orden es el del carrusel. */
const DISHES = [
  { slug: "vegetales-salteados", name: "Vegetales Salteados", w: 194, h: 289 },
  { slug: "pechuga-cordon-bleu", name: "Pechuga Cordon Bleu", w: 165, h: 280 },
  { slug: "costilla-22-bistro", name: "Costilla 22 Bistro", w: 167, h: 284 },
  { slug: "salmon-salsa-caribena", name: "Salmón Salsa Caribeña", w: 178, h: 293 },
  { slug: "ossobucco-de-res", name: "Ossobucco de Res", w: 221, h: 265 },
  { slug: "mongolian-de-res", name: "Mongolian de Res", w: 184, h: 293 },
];

const AUTOPLAY_MS = 4500;
const TOUCH_PAUSE_MS = 9000;

export function DishCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedUntil = useRef(0); // autoplay en pausa hasta este instante
  const hovering = useRef(false);
  const [active, setActive] = useState(0);
  const [atEnd, setAtEnd] = useState(false);

  const items = useCallback(
    () => Array.from(trackRef.current?.querySelectorAll<HTMLElement>("[data-dc]") ?? []),
    []
  );

  const goTo = useCallback(
    (i: number) => {
      const el = trackRef.current;
      const list = items();
      if (!el || !list.length) return;
      const idx = Math.max(0, Math.min(list.length - 1, i));
      const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0; // el primer plato queda con su margen
      el.scrollTo({ left: list[idx].offsetLeft - pad, behavior: "smooth" });
    },
    [items]
  );

  // Punto activo = primer plato visible (o el último si ya llegó al final).
  const onScroll = useCallback(() => {
    const el = trackRef.current;
    const list = items();
    if (!el || !list.length) return;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setAtEnd(end);
    if (end) {
      setActive(list.length - 1);
      return;
    }
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    let best = 0;
    let dist = Infinity;
    list.forEach((it, i) => {
      const d = Math.abs(it.offsetLeft - pad - el.scrollLeft);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setActive(best);
  }, [items]);

  const step = useCallback(
    (dir: 1 | -1) => {
      const el = trackRef.current;
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (dir === 1 && atEnd) goTo(0);
      else goTo(active + dir);
    },
    [active, goTo]
  );

  // Avance automático; se pausa al pasar el mouse, al tocar, con foco dentro, en otra pestaña o si se piden menos animaciones.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (document.hidden || hovering.current || Date.now() < pausedUntil.current) return;
      const el = trackRef.current;
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (atEnd) goTo(0);
      else goTo(active + 1);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [active, goTo]);

  const pauseTouch = () => {
    pausedUntil.current = Date.now() + TOUCH_PAUSE_MS;
  };

  return (
    <div
      className="dcar"
      role="region"
      aria-roledescription="carrusel"
      aria-label="Algunos de nuestros platos"
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
      onFocus={() => (hovering.current = true)}
      onBlur={() => (hovering.current = false)}
    >
      <span className="dcar-kick">Algunos de nuestros platos</span>
      <div className="dcar-stage">
        <button type="button" className="dcar-arrow prev" aria-label="Plato anterior" onClick={() => { pauseTouch(); step(-1); }} disabled={active === 0}>
          ‹
        </button>
        <div
          className="dcar-track"
          ref={trackRef}
          onScroll={onScroll}
          onTouchStart={pauseTouch}
          onPointerDown={pauseTouch}
          tabIndex={0}
        >
          {DISHES.map((d, i) => (
            <figure className="dcar-item" data-dc key={d.slug}>
              <img
                src={`/platos/${d.slug}.webp`}
                width={d.w}
                height={d.h}
                alt={d.name}
                loading="eager"
                decoding="async"
                draggable={false}
              />
            </figure>
          ))}
        </div>
        <button type="button" className="dcar-arrow next" aria-label="Plato siguiente" onClick={() => { pauseTouch(); step(1); }} disabled={atEnd}>
          ›
        </button>
      </div>
      <div className="dcar-dots" aria-hidden="true">
        {DISHES.map((d, i) => (
          <button
            type="button"
            key={d.slug}
            tabIndex={-1}
            className={i === active ? "on" : ""}
            onClick={() => { pauseTouch(); goTo(i); }}
          />
        ))}
      </div>
    </div>
  );
}
