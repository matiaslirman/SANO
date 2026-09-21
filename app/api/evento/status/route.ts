import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { store } from "@/lib/store";
import { EVENT_COOKIE, verifyEventToken } from "@/lib/event-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Estado del evento (cupos/menú) para refrescar el flujo. Requiere acceso válido. */
export async function GET() {
  const event = await store.getEvent();
  if (!event.active) {
    return NextResponse.json({ error: "Evento no disponible" }, { status: 403 });
  }
  const jar = await cookies();
  const ok = await verifyEventToken(jar.get(EVENT_COOKIE)?.value, event.code);
  if (!ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { status } = await store.getEventStatus();
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
