import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import { checkViajeOrder } from "@/lib/viaje";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Crear un pedido de Viaje Sano (público). Los precios los pone el servidor: del cliente solo se leen
 * ids y cantidades. Mientras Viaje Sano no esté «abierto» solo el dueño (sesión de admin) puede probarlo.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const settings = await store.getViaje();
  if (settings.estado !== "abierto" && !(await isAdmin())) {
    return NextResponse.json({ error: "Viaje Sano todavía no está abierto.", closed: true }, { status: 409 });
  }

  const check = checkViajeOrder(body, settings);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const order = await store.createViajeOrder(check);
  return NextResponse.json({ order }, { status: 201 });
}

/** Lista los pedidos de Viaje Sano (solo admin). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const orders = await store.listViajeOrders();
  return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
}
