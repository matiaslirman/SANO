import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "./bsc.css";
import { BscOrder } from "@/components/bsc/BscOrder";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import { bscState } from "@/lib/bsc";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bistro Social Club · 22Bistro",
  description: "Noche fuera de horario en 22Bistro, Ciudad Colón. Pedí tus tragos y platos para picar desde el celular.",
  robots: { index: false },
};

/**
 * Pestaña temporal del evento. Dentro de la ventana: carta y pedidos. Antes de abrir (o con el interruptor
 * apagado): 404 para el público. Después de cerrar: «ya terminó». El dueño con sesión la ve siempre (vista previa).
 */
export default async function BistroSocialClub() {
  const settings = await store.getBsc();
  const admin = await isAdmin();
  const state = bscState(new Date(), settings);
  const open = settings.enabled && state === "open";

  if (!admin && (!settings.enabled || state === "before")) notFound();

  if (!open && !admin) {
    return (
      <div className="bsc" data-theme="bsc">
        <Cross />
        <div className="bsc-ended">
          <img src="/bsc/logos/avatar-azul.png" alt="Bistro Social Club" width={120} height={120} />
          <p className="bsc-big">Bistro Social Club ya terminó. ¡Gracias por venir!</p>
          <Link className="bsc-btn line" href="/">Volver a Sano</Link>
        </div>
      </div>
    );
  }

  const visible = { ...settings, items: settings.items.filter((i) => i.active) };
  return (
    <div className="bsc" data-theme="bsc">
      <Cross />
      <BscOrder settings={visible} preview={!open} />
    </div>
  );
}

/** Marcas de corte (cruces finas) en las esquinas de la pantalla. */
function Cross() {
  return (
    <div aria-hidden="true">
      <i className="bsc-x tl" /><i className="bsc-x tr" /><i className="bsc-x bl" /><i className="bsc-x br" />
    </div>
  );
}
