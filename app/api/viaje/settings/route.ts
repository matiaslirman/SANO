import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import type { ViajeSettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ viaje: await store.getViaje() }, { headers: { "Cache-Control": "no-store" } });
}

/** Guarda lo que mande el panel. `normalizeViaje` (en el store) sanea y descarta lo inválido. */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  let body: Partial<ViajeSettings>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const patch: Partial<ViajeSettings> = {};
  if (body.estado === "oculto" || body.estado === "pronto" || body.estado === "abierto") patch.estado = body.estado;
  if (typeof body.fecha === "string") patch.fecha = body.fecha;
  if (body.destacar === "semana" || body.destacar === "viaje") patch.destacar = body.destacar;
  if (typeof body.leadDays === "number") patch.leadDays = body.leadDays;
  if (typeof body.chainText === "string") patch.chainText = body.chainText;
  if (Array.isArray(body.rewards)) patch.rewards = body.rewards;
  if (Array.isArray(body.items)) patch.items = body.items;
  if (Array.isArray(body.packs)) patch.packs = body.packs;
  const viaje = await store.saveViaje(patch);
  return NextResponse.json({ viaje });
}
