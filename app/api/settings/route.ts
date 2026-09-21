import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import type { Settings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const settings = await store.getSettings();
  return NextResponse.json({ settings }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: Partial<Settings>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const patch: Partial<Settings> = {};
  if (Array.isArray(body.menu)) {
    patch.menu = body.menu.map((s) => String(s).slice(0, 120).trim()).filter(Boolean);
    // Guardar el menú = abrir una nueva semana: se fija el ciclo de entregas (viernes + lunes).
    patch.menuPublishedAt = new Date().toISOString();
  }
  if (typeof body.weekLabel === "string") patch.weekLabel = body.weekLabel.slice(0, 120).trim();
  if (typeof body.cuposTotales === "number" && body.cuposTotales >= 0) {
    patch.cuposTotales = Math.floor(body.cuposTotales);
  }
  if (typeof body.basePrice === "number" && body.basePrice > 0) {
    patch.basePrice = Math.floor(body.basePrice);
  }
  if (Array.isArray(body.combos)) {
    patch.combos = body.combos
      .filter((c) => c && typeof c.min === "number" && typeof c.price === "number")
      .map((c) => ({ min: Math.floor(c.min), price: Math.floor(c.price) }))
      .sort((a, b) => a.min - b.min);
  }

  const settings = await store.saveSettings(patch);
  return NextResponse.json({ settings });
}
