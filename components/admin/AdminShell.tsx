import Link from "next/link";
import { Wordmark } from "@/lib/brand";
import { LogoutButton } from "./LogoutButton";

type Tab = "pedidos" | "cocina" | "contenido";

export function AdminShell({
  active,
  title,
  children,
}: {
  active: Tab;
  title: string;
  children: React.ReactNode;
}) {
  const tabs: { id: Tab; label: string; href: string }[] = [
    { id: "pedidos", label: "Pedidos", href: "/admin/pedidos" },
    { id: "cocina", label: "Resumen cocina", href: "/admin/cocina" },
    { id: "contenido", label: "Contenido", href: "/admin/contenido" },
  ];
  return (
    <div className="admin">
      <div className="admin-top">
        <div className="wrap">
          <span className="brand-logo">
            <Wordmark />
          </span>
          <div className="sp">
            <Link className="who" href="/" target="_blank">
              Ver sitio ↗
            </Link>
            <LogoutButton />
          </div>
        </div>
      </div>
      <div className="wrap">
        <div className="admin-head">
          <div className="sk">Panel del dueño · 22 Bistro</div>
          <h1>{title}</h1>
        </div>
        <nav className="tabs">
          {tabs.map((t) => (
            <Link key={t.id} href={t.href} className={t.id === active ? "on" : ""}>
              {t.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
