import Link from "next/link";
import { Wordmark } from "@/lib/brand";

export function SiteHeader({ variant = "public" }: { variant?: "public" | "event" }) {
  return (
    <header className="topbar">
      <div className="wrap">
        <Link className="brand" href="/" aria-label="Sano — inicio">
          <span className="brand-logo">
            <Wordmark />
          </span>
        </Link>
        <nav className="nav">
          <a href="#menu">Menú</a>
          {variant === "event" ? <a href="#checkout">Mi pedido</a> : <a href="#market">Sano Market</a>}
        </nav>
      </div>
    </header>
  );
}
