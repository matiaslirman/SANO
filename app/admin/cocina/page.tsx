import { AdminShell } from "@/components/admin/AdminShell";
import { KitchenView } from "@/components/admin/KitchenView";
import { store } from "@/lib/store";
import { getCycleWindows, getNextWindow } from "@/lib/windows";

export const dynamic = "force-dynamic";

export default async function CocinaPage() {
  const orders = await store.listOrders();
  const settings = await store.getSettings();
  // Ventana por defecto = la más cercana del ciclo actual (atado al menú).
  const win = getCycleWindows(settings.menuPublishedAt)[0] || getNextWindow();
  const done = await store.getKitchenDone(win.id);
  return (
    <AdminShell active="cocina" title="Resumen de cocina">
      <KitchenView initial={{ orders, window: { id: win.id, label: win.shortLabel }, done }} />
    </AdminShell>
  );
}
