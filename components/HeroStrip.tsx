"use client";

import { useRef } from "react";

/**
 * Vitrina del hero público: una tira a todo el ancho con la composición de platos reales
 * (táperes sobre fondo transparente, en public/platos/vitrina-sano.webp) que corre en bucle
 * continuo. La imagen se duplica y se desplaza exactamente una copia (translateX -50%), así el
 * loop es perfecto y "nunca termina". Se pausa al pasar el mouse o mantener el dedo apoyado.
 * Con "reducir movimiento" no se anima: queda una tira que se desliza a mano.
 *
 * Para cambiar la vitrina, pisá el .webp (export transparente, idealmente @2x desde Figma).
 */
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
        {[0, 1].map((copy) => (
          <img
            key={copy}
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
