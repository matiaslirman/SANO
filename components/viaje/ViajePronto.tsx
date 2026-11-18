"use client";

import Link from "next/link";
import { track } from "@/lib/track";
import { viajeAlertMessage } from "@/lib/viaje";

const WA = process.env.NEXT_PUBLIC_WHATSAPP || "50683193498";

/** Lo que ve un cliente que entra al enlace de Viaje Sano antes de que abra («Próximamente»). */
export function ViajePronto({ fecha }: { fecha: string }) {
  return (
    <>
      <section className="hero vj-hero">
        <div className="wrap">
          <span className="tbadge soon">Disponible pronto</span>
          <h1 className="hero-title" style={{ marginTop: 14 }}>
            Viaje <em>Sano</em>
          </h1>
          <p className="vj-one">
            Estamos preparando bandejas de comida casera para llevar de viaje: lasañas, pechugas rellenas y arroz chaufa, listas para tu hielera. Abrimos {fecha}.
          </p>
        </div>
      </section>
      <div className="sheet">
        <div className="wrap">
          <div className="pause-card" role="status">
            <h2 className="pause-title">Dejanos tu aviso</h2>
            <p className="pause-text">Te escribimos por WhatsApp apenas abramos los pedidos.</p>
            <a
              className="wa-btn pause-wa"
              href={`https://wa.me/${WA}?text=${encodeURIComponent(viajeAlertMessage())}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("viaje_alert")}
            >
              💬 Avisame cuando abra
            </a>
          </div>
          <p className="sec-sub" style={{ marginTop: 18 }}>Mientras tanto, el menú de la semana sigue abierto.</p>
          <p style={{ textAlign: "center" }}>
            <Link className="vj-link" href="/">Ver el menú de la semana</Link>
          </p>
        </div>
      </div>
    </>
  );
}
