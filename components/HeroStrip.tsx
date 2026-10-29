"use client";

import { useRef } from "react";

/**
 * Vitrina del hero público: una tira a todo el ancho con la composición de platos reales
 * (táperes sobre fondo transparente, en public/platos/vitrina-sano.webp) que corre en bucle
 * continuo. Para que el loop sea perfecto y SIN HUECOS en pantallas anchas, la tira se arma en
 * dos mitades idénticas y se desplaza exactamente una mitad (translateX -50%): al terminar, la
 * segunda mitad queda donde estaba la primera, así que no hay salto. Cada mitad tiene varias
 * copias de la composición para que siempre sea más ancha que la pantalla (si no, en desktop
 * ancho quedaría bordó vacío a la derecha). Se pausa al pasar el mouse o mantener el dedo.
 * Con "reducir movimiento" no se anima: queda la tira estática llenando el ancho.
 *
 * Para cambiar la vitrina, pisá el .webp (export transparente, idealmente @2x desde Figma).
 */
// Copias por mitad. La composición mide ~690px de ancho a la altura del hero; 5 copias = ~3450px,
// más ancho que cualquier monitor usual (incluye ultrawide). La misma imagen se descarga una sola vez.
const PER_HALF = 5;
export function HeroStrip() {
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
    <div
      className="hstrip"
      role="img"
      aria-label="Platos de Sano listos para retirar"
      // Mouse real: pausa mientras está encima. Dedo: pausa mientras está apoyado. Los eventos de mouse
      // que el navegador táctil simula tras un toque se ignoran (si no, "mouse encima" quedaba pegado).
      onPointerEnter={(e) => e.pointerType === "mouse" && hold()}
      onPointerLeave={(e) => e.pointerType === "mouse" && release()}
      onPointerDown={(e) => e.pointerType !== "mouse" && hold()}
      onPointerUp={(e) => e.pointerType !== "mouse" && release()}
      onPointerCancel={(e) => e.pointerType !== "mouse" && release()}
    >
      <div className="hstrip-rail" ref={railRef} aria-hidden="true">
        {/* Dos mitades idénticas (PER_HALF copias cada una) → translateX -50% hace el loop sin salto */}
        {Array.from({ length: PER_HALF * 2 }).map((_, i) => (
          <img
            key={i}
            src="/platos/vitrina-sano.webp"
            width={2000}
            height={870}
            alt=""
            loading="eager"
            decoding="async"
            draggable={false}
          />
        ))}
      </div>
    </div>
  );
}
