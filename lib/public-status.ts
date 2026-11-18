import "server-only";
import { store } from "./store";
import { getClientWindows } from "./windows";
import { resolveExtraPrices } from "./pricing";
import { resolveHeroPill } from "./hero";
import { popularInMenu } from "./favorites";
import type { PublicStatus, WindowInfo } from "./types";

/** Estado público del menú semanal: lo comparten la landing (`/`) y `GET /api/status`. */
export async function buildPublicStatus(): Promise<PublicStatus> {
  const settings = await store.getSettings();
  const viaje = await store.getViaje();

  const windows: WindowInfo[] = await Promise.all(
    getClientWindows(settings.menuPublishedAt).map(async (w): Promise<WindowInfo> => {
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

  // «Más pedido»: solo con datos reales y suficientes (ver `popularInMenu`).
  const popular = popularInMenu(await store.listOrders(), settings.menu);

  return {
    menu: settings.menu,
    weekLabel: settings.weekLabel,
    basePrice: settings.basePrice,
    combos: settings.combos,
    windows,
    extraPrices: resolveExtraPrices(settings),
    heroPill: resolveHeroPill(settings),
    viaje: { estado: viaje.estado, fecha: viaje.fecha, destacar: viaje.destacar },
    ...(popular.length ? { popular } : {}),
    ...(windows.length === 0 ? { closed: await store.getClosedShowcase(settings.menu) } : {}),
  };
}
