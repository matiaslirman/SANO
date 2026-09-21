import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import type { EventSettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Leer la config del evento (solo dueño). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const event = await store.getEvent();
  return NextResponse.json({ event }, { headers: { "Cache-Control": "no-store" } });
}

/** Editar el evento privado (solo dueño). */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: Partial<EventSettings>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const patch: Partial<EventSettings> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.title === "string") patch.title = body.title.slice(0, 80).trim();
  if (typeof body.subtitle === "string") patch.subtitle = body.subtitle.slice(0, 200).trim();
  if (typeof body.code === "string") patch.code = body.code.slice(0, 40).trim();
  if (typeof body.deliveryLabel === "string") patch.deliveryLabel = body.deliveryLabel.slice(0, 120).trim();
  if (typeof body.cuposTotales === "number" && body.cuposTotales >= 0) {
    patch.cuposTotales = Math.floor(body.cuposTotales);
  }
  if (Array.isArray(body.menu)) {
    patch.menu = body.menu.map((s) => String(s).slice(0, 120).trim()).filter(Boolean);
  }

  const event = await store.saveEvent(patch);
  return NextResponse.json({ event });
}
