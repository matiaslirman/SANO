import { AdminShell } from "@/components/admin/AdminShell";
import { KitchenView } from "@/components/admin/KitchenView";
import { store } from "@/lib/store";
import { getNextWindow } from "@/lib/windows";

export const dynamic = "force-dynamic";

export default async function CocinaPage() {
  const orders = await store.listOrders();
  const win = getNextWindow();
  const done = await store.getKitchenDone(win.id);
  return (
    <AdminShell active="cocina" title="Resumen de cocina">
      <KitchenView initial={{ orders, window: { id: win.id, label: win.shortLabel }, done }} />
    </AdminShell>
  );
}
