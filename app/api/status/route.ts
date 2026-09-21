import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { getClientWindows } from "@/lib/windows";
import type { PublicStatus, WindowInfo } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await store.getSettings();

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

  const status: PublicStatus = {
    menu: settings.menu,
    weekLabel: settings.weekLabel,
    basePrice: settings.basePrice,
    combos: settings.combos,
    windows,
  };
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
