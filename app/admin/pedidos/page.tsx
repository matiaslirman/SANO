import { AdminShell } from "@/components/admin/AdminShell";
import { OrdersView } from "@/components/admin/OrdersView";
import { store, isPersistent } from "@/lib/store";
import { getNextWindow, getOfferedWindows } from "@/lib/windows";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const orders = await store.listOrders();
  const cupos = await store.computeCupos();
  const win = getNextWindow();
  const deliveryWindows = getOfferedWindows().map((w) => ({ id: w.id, label: w.shortLabel }));

  return (
    <AdminShell active="pedidos" title="Pedidos">
      {!isPersistent() && (
        <div className="warn-banner">
          ⚠️ <b>Base de datos no configurada.</b> Los pedidos no se están guardando de forma permanente. Conectá
          un store KV (Upstash) en Vercel y agregá las variables de entorno para activar el guardado.
        </div>
      )}
      <OrdersView
        initial={{ orders, cupos, window: { id: win.id, label: win.shortLabel }, deliveryWindows }}
      />
    </AdminShell>
  );
}
