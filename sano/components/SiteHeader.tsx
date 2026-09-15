import Link from "next/link";
import { Wordmark } from "@/lib/brand";

export function SiteHeader() {
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
          <a href="#market">Sano Market</a>
        </nav>
      </div>
    </header>
  );
}
