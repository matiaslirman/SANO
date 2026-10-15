"use client";

import { useRef } from "react";

/** Vitrina fija de platos (fotos con el nombre incluido, en public/platos). El orden es el del carrusel. */
const DISHES = [
  { slug: "vegetales-salteados", name: "Vegetales Salteados", w: 194, h: 289 },
  { slug: "pechuga-cordon-bleu", name: "Pechuga Cordon Bleu", w: 165, h: 280 },
  { slug: "costilla-22-bistro", name: "Costilla 22 Bistro", w: 167, h: 284 },
  { slug: "salmon-salsa-caribena", name: "Salmón Salsa Caribeña", w: 178, h: 293 },
  { slug: "ossobucco-de-res", name: "Ossobucco de Res", w: 221, h: 265 },
  { slug: "mongolian-de-res", name: "Mongolian de Res", w: 184, h: 293 },
];

/**
 * Carrusel que rota solo y de forma continua (sin tocarlo). La tira se duplica para que el
 * bucle sea perfecto; la animación es CSS (suave y liviana). Se pausa al pasar el mouse o
 * mantener el dedo apretado. Con "reducir movimiento" no se anima: queda una tira que se desliza a mano.
 */
export function DishCarousel() {
  const railRef = useRef<HTMLDivElement>(null);
  const resume = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hold = () => {
    clearTimeout(resume.current);
    railRef.current?.classList.add("hold");
  };
  const release = () => {
    clearTimeout(resume.current);
    resume.current = setTimeout(() => railRef.current?.classList.remove("hold"), 1200);
  };

  return (
    <div className="dcar" role="region" aria-roledescription="carrusel" aria-label="Algunos de nuestros platos">
      <div
        className="dcar-marquee"
        // Mouse real: pausa mientras está encima. Dedo: pausa mientras está apoyado. Los eventos de mouse que el
        // navegador táctil simula tras un toque se ignoran (si no, "mouse encima" quedaba pegado y la tira no volvía a moverse).
        onPointerEnter={(e) => e.pointerType === "mouse" && hold()}
        onPointerLeave={(e) => e.pointerType === "mouse" && release()}
        onPointerDown={(e) => e.pointerType !== "mouse" && hold()}
        onPointerUp={(e) => e.pointerType !== "mouse" && release()}
        onPointerCancel={(e) => e.pointerType !== "mouse" && release()}
      >
        <div className="dcar-rail" ref={railRef}>
          {[0, 1].map((copy) =>
            DISHES.map((d) => (
              <figure className="dcar-item" key={`${copy}-${d.slug}`} aria-hidden={copy === 1 ? true : undefined}>
                <img
                  src={`/platos/${d.slug}.webp`}
                  width={d.w}
                  height={d.h}
                  alt={copy === 0 ? d.name : ""}
                  loading="eager"
                  decoding="async"
                  draggable={false}
                />
              </figure>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
