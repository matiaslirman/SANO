import { AdminShell } from "@/components/admin/AdminShell";
import { EtiquetasView } from "@/components/admin/EtiquetasView";
import { store, isPersistent } from "@/lib/store";
import { getCycleWindows } from "@/lib/windows";

export const dynamic = "force-dynamic";

export default async function EtiquetasPage() {
  const orders = await store.listOrders();
  const settings = await store.getSettings();
  const event = await store.getEvent();
  const cycleWindows = getCycleWindows(settings.menuPublishedAt).map((w) => ({ id: w.id, label: w.shortLabel }));
  const hasEventOrders = orders.some((o) => o.eventId);
  const eventTab = event.active || hasEventOrders ? { label: event.title } : null;

  return (
    <AdminShell active="etiquetas" title="Etiquetas">
      {!isPersistent() && (
        <div className="warn-banner">
          ⚠️ <b>Base de datos no configurada.</b> Los pedidos no se están guardando de forma permanente.
        </div>
      )}
      <EtiquetasView initial={{ orders, cycleWindows, event: eventTab }} />
    </AdminShell>
  );
}
