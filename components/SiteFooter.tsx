import Link from "next/link";
import { Wordmark } from "@/lib/brand";

const LOYALTY_URL = "https://add2wallet.com/SANO%20by%2022Bistro/wallet-pass/61/download";
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP || "50683193498";

export function SiteFooter() {
  return (
    <footer>
      <div className="wrap">
        <div>
          <div className="fbrand" style={{ color: "var(--crema)" }}>
            <span className="foot-word" aria-label="Sano">
              <Wordmark />
            </span>
          </div>
          <p>
            Comida lista y sana, producida por{" "}
            <b style={{ color: "var(--crema)" }}>22 Bistro</b>. Siempre rico y fresco.
          </p>
          <div className="loyalty">
            🎁 <b>Gana cortesías:</b> sumás sellos por compra, referido y menciones —
            canjeables por productos de Sano Market.
            <a className="loyalty-btn" href={LOYALTY_URL} target="_blank" rel="noopener noreferrer">
              📲 Descargá tu tarjeta de cliente frecuente →
            </a>
          </div>
        </div>
        <div>
          <h4>Retiro / Pick-up</h4>
          <p>
            Ciudad Colón, Costa Rica
            <br />
            50 m oeste de la Bomba Delta
          </p>
          <p style={{ marginTop: 10 }}>
            Lunes y Viernes
            <br />
            8:00 a.m. – 12:00 md
          </p>
        </div>
        <div>
          <h4>Contacto</h4>
          <a className="flink" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer">
            WhatsApp 8319-3498
          </a>
          <a className="flink" href="https://instagram.com/sanoby22bistro" target="_blank" rel="noopener noreferrer">
            @sanoby22bistro
          </a>
          <p style={{ marginTop: 10 }}>Moneda: colones (CRC)</p>
        </div>
      </div>
      <div className="foot-note">
        <div className="wrap">
          <span>© Sano · 22 Bistro — Ciudad Colón</span>
          <Link href="/admin">Panel del dueño</Link>
        </div>
      </div>
    </footer>
  );
}
