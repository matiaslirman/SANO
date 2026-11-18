import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Ordering } from "@/components/Ordering";
import { store } from "@/lib/store";
import { buildPublicStatus } from "@/lib/public-status";

export const dynamic = "force-dynamic";

export default async function Home() {
  const status = await buildPublicStatus();
  const market = await store.getMarket();

  return (
    <>
      <SiteHeader viaje={status.viaje?.estado === "abierto"} />
      <main>
        <Ordering initialStatus={status} initialMarket={market} />
      </main>
      <SiteFooter />
    </>
  );
}
