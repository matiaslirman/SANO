import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cerrar o reabrir una cuenta (solo staff): marca todos sus pedidos como pagados (o pendientes). Solo toca pedidos
 * del evento; cualquier otro id se ignora.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  let body: { ids?: unknown; status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const status = body.status === "pagado" || body.status === "pendiente" ? body.status : null;
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 200) : [];
  if (!status || ids.length === 0) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  const mine = new Set((await store.listBscOrders()).map((o) => o.id));
  const updated = [];
  for (const id of ids) {
    if (!mine.has(id)) continue;
    const o = await store.updateOrder(id, { status });
    if (o) updated.push(o);
  }
  return NextResponse.json({ orders: updated });
}
