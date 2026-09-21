import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { store, type NewOrderInput } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import { EVENT_COOKIE, verifyEventToken } from "@/lib/event-auth";
import { getCycleWindows, getNextWindow } from "@/lib/windows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Crear un pedido (cliente). `event: true` lo enruta al evento privado. */
export async function POST(req: Request) {
  let body: NewOrderInput & { event?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const hasDishes = Array.isArray(body.dishes) && body.dishes.some((d) => d && d.qty > 0);
  const hasMarket = Array.isArray(body.market) && body.market.some((m) => m && m.qty > 0);

  // ── Pedido de evento privado ──
  if (body.event) {
    const event = await store.getEvent();
    if (!event.active) {
      return NextResponse.json({ error: "No hay un evento activo." }, { status: 403 });
    }
    const jar = await cookies();
    const ok = await verifyEventToken(jar.get(EVENT_COOKIE)?.value, event.code);
    if (!ok) {
      return NextResponse.json({ error: "Acceso al evento no válido." }, { status: 401 });
    }
    if (!hasDishes) {
      return NextResponse.json({ error: "El pedido está vacío" }, { status: 400 });
    }
    if (!body.customerName || !body.customerName.trim()) {
      return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
    }
    const order = await store.createEventOrder(body);
    return NextResponse.json({ order }, { status: 201 });
  }

  if (!hasDishes && !hasMarket) {
    return NextResponse.json({ error: "El pedido está vacío" }, { status: 400 });
  }
  if (!body.customerName || !body.customerName.trim()) {
    return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
  }

  const order = await store.createOrder(body);
  return NextResponse.json({ order }, { status: 201 });
}

/** Listar pedidos (solo admin). */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const orders = await store.listOrders();
  const cupos = await store.computeCupos();
  const settings = await store.getSettings();
  // Ventana "activa" = la más cercana del ciclo actual (atado al menú).
  const cycle = getCycleWindows(settings.menuPublishedAt);
  const win = cycle[0] || getNextWindow();
  const kitchenDone = await store.getKitchenDone(win.id);
  return NextResponse.json(
    { orders, cupos, window: { id: win.id, label: win.shortLabel }, kitchenDone },
    { headers: { "Cache-Control": "no-store" } }
  );
}
