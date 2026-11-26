"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BscSettings, Order } from "@/lib/types";
import { bscState, crDateTimeLabel, editionLabel, editionsSummary, orderEdition } from "@/lib/bsc";
import { DaySelect, type DayOpt } from "./DaySelect";
import { BscComanda } from "./BscComanda";
import { BscVentas } from "./BscVentas";
import { BscEditor } from "./BscEditor";

type Vista = "comanda" | "ventas" | "carta";
const VISTAS: { id: Vista; label: string }[] = [
  { id: "comanda", label: "Comanda" },
  { id: "ventas", label: "Ventas" },
  { id: "carta", label: "Carta y edición" },
];
const STATE_TXT = { before: "Todavía no abre", open: "Recibiendo pedidos", ended: "Ventana cerrada" } as const;

/** Plataforma del evento para el equipo: cargar comandas, cobrar, ver lo vendido y mantener la carta. */
export function BscView({ initial }: { initial: { orders: Order[]; settings: BscSettings } }) {
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const [settings, setSettings] = useState<BscSettings>(initial.settings);
  const [vista, setVista] = useState<Vista>("comanda");
  const [edition, setEdition] = useState<string>(initial.settings.editionId);
  const [now, setNow] = useState(() => new Date());

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/bsc/orders", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d.orders)) setOrders(d.orders);
      if (d.settings) setSettings(d.settings);
      setNow(new Date());
    } catch {
      /* silencioso */
    }
  }, []);
  useEffect(() => {
    const id = setInterval(refetch, 8000); // durante el servicio: se actualiza solo
    return () => clearInterval(id);
  }, [refetch]);

  const summary = useMemo(() => editionsSummary(orders), [orders]);
  const options = useMemo<DayOpt[]>(() => {
    const ids = new Set(summary.map((e) => e.id));
    ids.add(settings.editionId);
    return [...ids].sort((a, b) => b.localeCompare(a)).map((id) => ({
      id,
      label: `${editionLabel(id)}${id === settings.editionId ? " (en curso)" : ""}`,
    }));
  }, [summary, settings.editionId]);
  const selected = options.some((o) => o.id === edition) ? edition : settings.editionId;
  const inCurso = selected === settings.editionId;
  const ordersEd = useMemo(() => orders.filter((o) => orderEdition(o) === selected), [orders, selected]);
  const state = bscState(now, settings);

  return (
    <>
      <div className={`bsc-adm-state ${state}`}>
        <span className="dot" aria-hidden="true" />
        <span className="txt">
          <b>{settings.name} · {editionLabel(settings.editionId)}:</b> {STATE_TXT[state]}
          {!settings.enabled && " · interruptor APAGADO (sin pestaña ni pedidos de clientes)"}
          <span className="win">
            {" · "}
            {crDateTimeLabel(settings.availableFrom)} → {crDateTimeLabel(settings.availableUntil)} (hora de Costa Rica)
          </span>
        </span>
        <a className="obtn" href="/bistro-social-club" target="_blank" rel="noopener noreferrer">Ver la página ↗</a>
      </div>

      <div className="bsc-adm-top">
        <div className="bsc-adm-tabs" role="tablist" aria-label="Vistas del evento">
          {VISTAS.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={vista === v.id} className={vista === v.id ? "on" : ""} onClick={() => setVista(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        {vista !== "carta" && options.length > 1 && (
          <div className="wtabs" style={{ margin: 0 }}>
            <DaySelect options={options} value={selected} onChange={setEdition} label="Edición" />
          </div>
        )}
      </div>

      {!inCurso && vista !== "carta" && (
        <div className="bsc-adm-past" role="status">
          Estás viendo la edición del <b>{editionLabel(selected)}</b>, que ya no es la edición en curso. <button type="button" className="obtn" onClick={() => setEdition(settings.editionId)}>Volver a la edición en curso</button>
        </div>
      )}

      {vista === "comanda" && <BscComanda orders={ordersEd} settings={settings} readOnly={!inCurso} onOrders={setOrders} onSettings={setSettings} refetch={refetch} />}
      {vista === "ventas" && <BscVentas orders={ordersEd} allOrders={orders} edition={selected} onPick={setEdition} />}
      {vista === "carta" && (
        <BscEditor
          settings={settings}
          onSaved={(s) => {
            setSettings(s);
            setEdition(s.editionId);
          }}
        />
      )}
    </>
  );
}
