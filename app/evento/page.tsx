import Link from "next/link";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Ordering } from "@/components/Ordering";
import { EventGate } from "@/components/EventGate";
import { store } from "@/lib/store";
import { EVENT_COOKIE, verifyEventToken } from "@/lib/event-auth";

export const dynamic = "force-dynamic";

export default async function EventoPage() {
  const event = await store.getEvent();

  // Evento apagado: no revelamos nada.
  if (!event.active) {
    return (
      <div className="gate">
        <div className="gate-card">
          <h1>Sin eventos activos</h1>
          <p>Por ahora no hay un evento privado abierto. Escribinos si creés que es un error.</p>
          <Link href="/" className="gate-btn" style={{ display: "inline-block", textDecoration: "none", marginTop: 20 }}>
            Ir al sitio
          </Link>
        </div>
      </div>
    );
  }

  const jar = await cookies();
  const authed = await verifyEventToken(jar.get(EVENT_COOKIE)?.value, event.code);
  if (!authed) {
    return <EventGate title={event.title} subtitle={event.subtitle} />;
  }

  const { status } = await store.getEventStatus();
  return (
    <>
      <SiteHeader variant="event" />
      <main>
        <Ordering
          initialStatus={status}
          initialMarket={[]}
          event={{ title: event.title, subtitle: event.subtitle, deliveryLabel: event.deliveryLabel }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
