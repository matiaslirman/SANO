import { NextResponse } from "next/server";
import { buildPublicStatus } from "@/lib/public-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await buildPublicStatus(), { headers: { "Cache-Control": "no-store" } });
}
