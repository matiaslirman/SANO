import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { getNextWindow } from "@/lib/windows";
import type { PublicStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await store.getSettings();
  const cupos = await store.computeCupos();
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
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
