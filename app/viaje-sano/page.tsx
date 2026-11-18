import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ViajeSano } from "@/components/viaje/ViajeSano";
import { ViajePronto } from "@/components/viaje/ViajePronto";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import { minPickupDate } from "@/lib/viaje";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Viaje Sano — Bandejas para llevar | Sano by 22 Bistro",
  description: "Lasañas, pechugas rellenas y arroz chaufa en bandejas de 4 porciones, listas para tu viaje. Vos elegís el día de retiro.",
};

/**
 * Viaje Sano, según el estado que fija el dueño en Contenido:
 *  - abierto: la página completa;
 *  - pronto: aviso «Disponible pronto» con botón de WhatsApp (el dueño igual ve la página completa, para probarla);
 *  - oculto: no existe (404), salvo para el dueño.
 */
export default async function ViajeSanoPage() {
  const settings = await store.getViaje();
  const admin = await isAdmin();

  if (settings.estado === "abierto" || admin) {
    return (
      <>
        <SiteHeader variant="viaje" />
        <main>
          <ViajeSano settings={settings} estado={settings.estado} minDate={minPickupDate(new Date(), settings.leadDays)} />
        </main>
        <SiteFooter />
      </>
    );
  }
  if (settings.estado === "pronto") {
    return (
      <>
        <SiteHeader variant="viaje" />
        <main>
          <ViajePronto fecha={settings.fecha} />
        </main>
        <SiteFooter />
      </>
    );
  }
  notFound();
}
