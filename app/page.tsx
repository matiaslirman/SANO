import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Ordering } from "@/components/Ordering";
import { store } from "@/lib/store";
import { getOfferedWindows } from "@/lib/windows";
import type { PublicStatus, WindowInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = await store.getSettings();
  const market = await store.getMarket();

  const windows: WindowInfo[] = await Promise.all(
    getOfferedWindows().map(async (w): Promise<WindowInfo> => {
      const c = await store.computeCuposFor(w.id);
      return {
        id: w.id,
        cutoffISO: w.cutoffISO,
        deliveryLabel: w.deliveryLabel,
        deliveryDateLabel: w.deliveryDateLabel,
        cuposTotales: c.totales,
        cuposDisponibles: c.disponibles,
      };
    })
  );

  const status: PublicStatus = {
    menu: settings.menu,
    weekLabel: settings.weekLabel,
    basePrice: settings.basePrice,
    combos: settings.combos,
    windows,
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
