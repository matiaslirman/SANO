import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Ordering } from "@/components/Ordering";
import { store } from "@/lib/store";
import { getNextWindow } from "@/lib/windows";
import type { PublicStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = await store.getSettings();
  const cupos = await store.computeCupos();
  const market = await store.getMarket();
  const win = getNextWindow();

  const status: PublicStatus = {
    menu: settings.menu,
    weekLabel: settings.weekLabel,
    cuposTotales: cupos.totales,
    cuposDisponibles: cupos.disponibles,
    basePrice: settings.basePrice,
    combos: settings.combos,
    window: {
      id: win.id,
      cutoffISO: win.cutoffISO,
      deliveryLabel: win.deliveryLabel,
      deliveryDateLabel: win.deliveryDateLabel,
    },
  };

  return (
    <>
      <SiteHeader />
      <main>
        <Ordering initialStatus={status} initialMarket={market} />
      </main>
      <SiteFooter />
    </>
  );
}
