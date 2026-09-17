import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import { getNextWindow } from "@/lib/windows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Estado del checklist de cocina para la ventana activa (solo admin). */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const win = getNextWindow();
  const done = await store.getKitchenDone(win.id);
  return NextResponse.json(
    { window: { id: win.id, label: win.shortLabel }, done },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Marca/desmarca un ítem del resumen de cocina como completado (solo admin). */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let body: { windowId?: string; key?: string; done?: boolean };
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
  const done = await store.setKitchenItemDone(windowId, key, body.done);
  return NextResponse.json({ windowId, done });
}
