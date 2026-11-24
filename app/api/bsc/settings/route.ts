import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/auth-server";
import type { BscSettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ settings: await store.getBsc() }, { headers: { "Cache-Control": "no-store" } });
}

/** Guarda lo que mande el panel. `normalizeBsc` (en el store) sanea y descarta lo inválido. */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  let body: Partial<BscSettings>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const patch: Partial<BscSettings> = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.venue === "string") patch.venue = body.venue;
  if (typeof body.editionId === "string") patch.editionId = body.editionId;
  if (typeof body.startsAt === "string") patch.startsAt = body.startsAt;
  if (typeof body.availableFrom === "string") patch.availableFrom = body.availableFrom;
  if (typeof body.availableUntil === "string") patch.availableUntil = body.availableUntil;
  if (Array.isArray(body.items)) patch.items = body.items;
  if (body.cortesia && typeof body.cortesia === "object") patch.cortesia = body.cortesia;
  const settings = await store.saveBsc(patch);
  return NextResponse.json({ settings });
}
