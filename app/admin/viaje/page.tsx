import { AdminShell } from "@/components/admin/AdminShell";
import { ViajeOrdersView } from "@/components/admin/ViajeOrdersView";
import { store, isPersistent } from "@/lib/store";
import { crToday } from "@/lib/viaje";

export const dynamic = "force-dynamic";

export default async function ViajePage() {
  const orders = await store.listViajeOrders();
  const viaje = await store.getViaje();
  return (
    <AdminShell active="viaje" title="Viaje Sano">
      {!isPersistent() && (
        <div className="warn-banner">
          ⚠️ <b>Base de datos no configurada.</b> Los pedidos no se están guardando de forma permanente. Conectá
          un store KV (Upstash) en Vercel y agregá las variables de entorno para activar el guardado.
        </div>
      )}
      <ViajeOrdersView initial={{ orders, today: crToday(), estado: viaje.estado }} />
    </AdminShell>
  );
}
