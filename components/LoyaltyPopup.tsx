"use client";

import { useEffect, useRef } from "react";
import { LOYALTY_URL, markLoyaltyDone } from "@/lib/loyalty";
import { track } from "@/lib/track";

/** Pop-up de la tarjeta de cliente frecuente: aparece al volver de WhatsApp tras confirmar un pedido. */
export function LoyaltyPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const primary = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (open) track("loyalty_shown");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const finish = (ev: "loyalty_download" | "loyalty_have") => {
    track(ev);
    markLoyaltyDone(); // no se vuelve a mostrar en este dispositivo
    onClose();
  };
  const later = () => {
    track("loyalty_later");
    onClose();
  };

  return (
    <div className="lp-overlay" onClick={later}>
      <div
        className="lp-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="lp-x" aria-label="Cerrar" onClick={later}>
          ×
        </button>
        <img
          className="lp-img"
          src="/brand/tarjeta-cliente.webp"
          width={2000}
          height={1786}
          alt="Tarjeta de cliente frecuente SANO: sumás sellos y recibís recordatorios y promos cada semana"
        />
        <h3 id="lp-title" className="lp-title">¡Gracias por tu pedido!</h3>
        <p className="lp-text">
          Sumá sellos por cada compra y recibí recordatorios y promos cada semana con tu tarjeta de cliente
          frecuente. Usá el mismo correo con el que pedís para que te sumemos los sellos.
        </p>
        <a
          ref={primary}
          className="lp-btn"
          href={LOYALTY_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => finish("loyalty_download")}
        >
          📲 Descargá tu tarjeta →
        </a>
        <div className="lp-row">
          <button type="button" className="lp-ghost" onClick={later}>Ahora no</button>
          <button type="button" className="lp-ghost" onClick={() => finish("loyalty_have")}>Ya la tengo</button>
        </div>
      </div>
    </div>
  );
}
