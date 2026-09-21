import { AdminShell } from "@/components/admin/AdminShell";
import { OrdersView } from "@/components/admin/OrdersView";
import { store, isPersistent } from "@/lib/store";
import { getCycleWindows, getWindowRange } from "@/lib/windows";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const orders = await store.listOrders();
  const settings = await store.getSettings();
  const cycleWindows = getCycleWindows(settings.menuPublishedAt).map((w) => ({ id: w.id, label: w.shortLabel }));
  const deliveryWindows = getWindowRange().map((w) => ({ id: w.id, label: w.shortLabel }));

  return (
    <AdminShell active="pedidos" title="Pedidos">
      {!isPersistent() && (
        <div className="warn-banner">
          ⚠️ <b>Base de datos no configurada.</b> Los pedidos no se están guardando de forma permanente. Conectá
          un store KV (Upstash) en Vercel y agregá las variables de entorno para activar el guardado.
        </div>
      )}
      <OrdersView
        initial={{ orders, cuposTotales: settings.cuposTotales, cycleWindows, deliveryWindows }}
      />
    </AdminShell>
  );
}
