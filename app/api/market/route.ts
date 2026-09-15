import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import type { MarketCategory } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Catálogo de Sano Market (público). */
export async function GET() {
  const market = await store.getMarket();
  return NextResponse.json({ market }, { headers: { "Cache-Control": "no-store" } });
}

/** Editar catálogo (solo admin). */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { market?: MarketCategory[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!Array.isArray(body.market)) {
    return NextResponse.json({ error: "Falta 'market'" }, { status: 400 });
  }

  const clean: MarketCategory[] = body.market
    .filter((c) => c && typeof c.name === "string")
    .map((c, i) => ({
      id: String(c.id || `cat-${i}`),
      name: String(c.name).slice(0, 80).trim(),
      price: Math.max(0, Math.floor(Number(c.price) || 0)),
      unit: String(c.unit || "").slice(0, 40).trim(),
      suggested: Boolean(c.suggested),
      items: Array.isArray(c.items)
        ? c.items.map((it) => String(it).slice(0, 120).trim()).filter(Boolean)
        : [],
    }));

  const market = await store.saveMarket(clean);
  return NextResponse.json({ market });
}
