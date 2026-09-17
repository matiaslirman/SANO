import { NextResponse } from "next/server";
import { store, type NewOrderInput } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import { getNextWindow } from "@/lib/windows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Crear un pedido (cliente). */
export async function POST(req: Request) {
  let body: NewOrderInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const hasDishes = Array.isArray(body.dishes) && body.dishes.some((d) => d && d.qty > 0);
  const hasMarket = Array.isArray(body.market) && body.market.some((m) => m && m.qty > 0);
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
  const win = getNextWindow();
  const kitchenDone = await store.getKitchenDone(win.id);
  return NextResponse.json(
    { orders, cupos, window: { id: win.id, label: win.shortLabel }, kitchenDone },
    { headers: { "Cache-Control": "no-store" } }
  );
}
