import { AdminShell } from "@/components/admin/AdminShell";
import { ContentEditor } from "@/components/admin/ContentEditor";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ContenidoPage() {
  const settings = await store.getSettings();
  const market = await store.getMarket();
  return (
    <AdminShell active="contenido" title="Contenido">
      <ContentEditor initialSettings={settings} initialMarket={market} />
    </AdminShell>
  );
}
