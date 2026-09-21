import { AdminShell } from "@/components/admin/AdminShell";
import { OrdersView } from "@/components/admin/OrdersView";
import { store, isPersistent } from "@/lib/store";
import { getCycleWindows, getWindowRange } from "@/lib/windows";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const orders = await store.listOrders();
  const settings = await store.getSettings();
  const event = await store.getEvent();
  const cycleWindows = getCycleWindows(settings.menuPublishedAt).map((w) => ({ id: w.id, label: w.shortLabel }));
  const deliveryWindows = getWindowRange().map((w) => ({ id: w.id, label: w.shortLabel }));

  // Pestaña del evento: se muestra si está activo o si ya entraron pedidos del evento.
  const hasEventOrders = orders.some((o) => o.eventId);
  const eventTab = event.active || hasEventOrders
    ? { label: event.title, cuposTotales: event.cuposTotales }
    : null;

  return (
    <AdminShell active="pedidos" title="Pedidos">
      {!isPersistent() && (
        <div className="warn-banner">
          ⚠️ <b>Base de datos no configurada.</b> Los pedidos no se están guardando de forma permanente. Conectá
          un store KV (Upstash) en Vercel y agregá las variables de entorno para activar el guardado.
        </div>
      )}
      <OrdersView
        initial={{ orders, cuposTotales: settings.cuposTotales, cycleWindows, deliveryWindows, event: eventTab }}
      />
    </AdminShell>
  );
}
