import Link from "next/link";
import { Wordmark } from "@/lib/brand";

export function SiteHeader({ variant = "public", viaje = false }: { variant?: "public" | "event" | "viaje"; viaje?: boolean }) {
  return (
    <header className="topbar">
      <div className="wrap">
        <Link className="brand" href="/" aria-label="Sano — inicio">
          <span className="brand-logo">
            <Wordmark />
          </span>
        </Link>
        <nav className="nav">
          {variant === "viaje" ? (
            <>
              <Link href="/" className="nav-hide-sm">Esta semana</Link>
              <a href="#vj-pedido" className="cta">Mi pedido</a>
            </>
          ) : (
            <>
              <a href="#menu">Menú</a>
              {variant === "event" ? <a href="#checkout">Mi pedido</a> : <a href="#market">Sano Market</a>}
              {viaje && <Link href="/viaje-sano" className="cta">Viaje Sano</Link>}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
