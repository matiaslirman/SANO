import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import { getNextWindow } from "@/lib/windows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Estado del checklist de cocina para una ventana (por defecto la activa; solo admin). */
export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const active = getNextWindow();
  const qWindow = new URL(req.url).searchParams.get("windowId");
  const windowId = (qWindow || active.id).slice(0, 40);
  const done = await store.getKitchenDone(windowId);
  return NextResponse.json(
    { windowId, window: { id: active.id, label: active.shortLabel }, done },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Marca/desmarca un ítem del resumen de cocina como completado (solo admin). */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let body: { windowId?: string; key?: string; done?: boolean; qty?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const windowId = (body.windowId || getNextWindow().id).slice(0, 40);
  const key = (body.key || "").slice(0, 200).trim();
  if (!key || typeof body.done !== "boolean") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  const qty = Number.isFinite(body.qty) ? Math.max(0, Math.floor(body.qty as number)) : 0;
  const done = await store.setKitchenItemDone(windowId, key, body.done, qty);
  return NextResponse.json({ windowId, done });
}
