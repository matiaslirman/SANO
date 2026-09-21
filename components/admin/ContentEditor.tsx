"use client";

import { useState } from "react";
import type { Settings, MarketCategory, ComboTier, EventSettings } from "@/lib/types";

function Saved({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="saved-msg">✓ Guardado</span>;
}

export function ContentEditor({
  initialSettings,
  initialMarket,
  initialEvent,
}: {
  initialSettings: Settings;
  initialMarket: MarketCategory[];
  initialEvent: EventSettings;
}) {
  // ── Menú ──
  const [menu, setMenu] = useState<string[]>(initialSettings.menu);
  const [weekLabel, setWeekLabel] = useState(initialSettings.weekLabel);
  const [savedMenu, setSavedMenu] = useState(false);
  const [busyMenu, setBusyMenu] = useState(false);

  // ── Cupos ──
  const [cupos, setCupos] = useState(initialSettings.cuposTotales);
  const [savedCupos, setSavedCupos] = useState(false);
  const [busyCupos, setBusyCupos] = useState(false);

  // ── Precios ──
  const [basePrice, setBasePrice] = useState(initialSettings.basePrice);
  const [combos, setCombos] = useState<ComboTier[]>(initialSettings.combos);
  const [savedPrice, setSavedPrice] = useState(false);
  const [busyPrice, setBusyPrice] = useState(false);

  // ── Market ──
  const [market, setMarket] = useState<MarketCategory[]>(initialMarket);
  const [savedMarket, setSavedMarket] = useState(false);
  const [busyMarket, setBusyMarket] = useState(false);

  // ── Evento privado ──
  const [ev, setEv] = useState<EventSettings>(initialEvent);
  const [savedEvent, setSavedEvent] = useState(false);
  const [busyEvent, setBusyEvent] = useState(false);
  const setEvField = <K extends keyof EventSettings>(k: K, v: EventSettings[K]) =>
    setEv((e) => ({ ...e, [k]: v }));

  async function patchSettings(body: Partial<Settings>) {
    const r = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("No se pudo guardar");
    return (await r.json()).settings as Settings;
  }
  const flash = (set: (b: boolean) => void) => {
    set(true);
    setTimeout(() => set(false), 1800);
  };

  async function saveMenu() {
    setBusyMenu(true);
    try {
      await patchSettings({ menu: menu.map((m) => m.trim()).filter(Boolean), weekLabel });
      flash(setSavedMenu);
    } finally {
      setBusyMenu(false);
    }
  }
  async function saveCupos() {
    setBusyCupos(true);
    try {
      await patchSettings({ cuposTotales: cupos });
      flash(setSavedCupos);
    } finally {
      setBusyCupos(false);
    }
  }
  async function savePrice() {
    setBusyPrice(true);
    try {
      await patchSettings({ basePrice, combos: [...combos].sort((a, b) => a.min - b.min) });
      flash(setSavedPrice);
    } finally {
      setBusyPrice(false);
    }
  }
  async function saveMarket() {
    setBusyMarket(true);
    try {
      const r = await fetch("/api/market", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market }),
      });
      if (!r.ok) throw new Error("No se pudo guardar");
      flash(setSavedMarket);
    } finally {
      setBusyMarket(false);
    }
  }
  async function saveEvent() {
    setBusyEvent(true);
    try {
      const r = await fetch("/api/evento", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: ev.active,
          title: ev.title.trim(),
          subtitle: ev.subtitle.trim(),
          code: ev.code.trim(),
          deliveryLabel: ev.deliveryLabel.trim(),
          cuposTotales: ev.cuposTotales,
          menu: ev.menu.map((m) => m.trim()).filter(Boolean),
        }),
      });
      if (!r.ok) throw new Error("No se pudo guardar");
      const saved = (await r.json()).event as EventSettings;
      setEv(saved);
      flash(setSavedEvent);
    } finally {
      setBusyEvent(false);
    }
  }

  return (
    <>
      {/* MENÚ */}
      <div className="editcard">
        <h3>Menú de la semana</h3>
        <div className="sub">
          Editá los platos de la semana. <b>Al guardar se abre una nueva semana de entregas</b> (viernes + lunes):
          los pedidos nuevos entran a ese ciclo y las entregas anteriores pasan al Histórico de Pedidos.
        </div>
        <div className="field" style={{ marginTop: 0, marginBottom: 14 }}>
          <label>Etiqueta de la semana</label>
          <input value={weekLabel} onChange={(e) => setWeekLabel(e.target.value)} placeholder="Ej: Semana del 15 al 21 sep" />
        </div>
        <div className="edit-list">
          {menu.map((dish, i) => (
            <div className="er" key={i}>
              <span className="n">{i + 1}</span>
              <input
                value={dish}
                onChange={(e) => setMenu((m) => m.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <button className="obtn" onClick={() => setMenu((m) => m.filter((_, j) => j !== i))}>
                Quitar
              </button>
            </div>
          ))}
        </div>
        <button className="obtn" style={{ marginTop: 12 }} onClick={() => setMenu((m) => [...m, ""])}>
          + Agregar plato
        </button>
        <div>
          <button className="save-btn" onClick={saveMenu} disabled={busyMenu}>
            {busyMenu ? "Guardando…" : "Guardar menú y abrir la semana"}
          </button>
          <Saved show={savedMenu} />
        </div>
      </div>

      {/* EVENTO PRIVADO */}
      <div className="editcard">
        <h3>Evento privado</h3>
        <div className="sub">
          Una ventana aparte del sitio para un grupo (ej. un viaje): mismo flujo y precios, con su propia
          lista de platos y una fecha fija. Se entra con un <b>código</b> desde el enlace{" "}
          <b>“Evento privado”</b> al pie de la página. Reusá esta ficha para futuros eventos.
        </div>

        <label className="ev-toggle">
          <input
            type="checkbox"
            checked={ev.active}
            onChange={(e) => setEvField("active", e.target.checked)}
          />
          <span>
            <b>Evento activo</b> — {ev.active ? "el grupo puede entrar con el código." : "apagado: nadie puede entrar."}
          </span>
        </label>

        <div className="ev-grid">
          <div className="field">
            <label>Título del evento</label>
            <input value={ev.title} onChange={(e) => setEvField("title", e.target.value)} placeholder="Ej: Paquetes Viaje a la Playa" />
          </div>
          <div className="field">
            <label>Código de acceso</label>
            <input value={ev.code} onChange={(e) => setEvField("code", e.target.value)} placeholder="Ej: PLAYA2026" />
          </div>
          <div className="field">
            <label>Cupos totales</label>
            <input type="number" min={0} value={ev.cuposTotales} onChange={(e) => setEvField("cuposTotales", parseInt(e.target.value) || 0)} />
          </div>
          <div className="field">
            <label>Fecha / etiqueta de retiro</label>
            <input value={ev.deliveryLabel} onChange={(e) => setEvField("deliveryLabel", e.target.value)} placeholder="Ej: Retiro jueves 2 oct · 8 a.m.–12 md" />
          </div>
        </div>
        <div className="field" style={{ marginTop: 0, marginBottom: 14 }}>
          <label>Bajada (texto corto del encabezado)</label>
          <input value={ev.subtitle} onChange={(e) => setEvField("subtitle", e.target.value)} placeholder="Ej: Menú especial del grupo del viaje." />
        </div>

        <label style={{ fontSize: 12.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>
          Platos del evento
        </label>
        <div className="edit-list" style={{ marginTop: 8 }}>
          {ev.menu.map((dish, i) => (
            <div className="er" key={i}>
              <span className="n">{i + 1}</span>
              <input
                value={dish}
                onChange={(e) => setEv((s) => ({ ...s, menu: s.menu.map((x, j) => (j === i ? e.target.value : x)) }))}
              />
              <button className="obtn" onClick={() => setEv((s) => ({ ...s, menu: s.menu.filter((_, j) => j !== i) }))}>
                Quitar
              </button>
            </div>
          ))}
        </div>
        <button className="obtn" style={{ marginTop: 12 }} onClick={() => setEv((s) => ({ ...s, menu: [...s.menu, ""] }))}>
          + Agregar plato
        </button>

        <div className="ev-hint">
          Enlace para compartir: <b>tu-sitio.com/evento</b> · Código actual: <b>{ev.code || "—"}</b> ·{" "}
          {ev.active ? "activo ✓" : "apagado"}
        </div>

        <div>
          <button className="save-btn" onClick={saveEvent} disabled={busyEvent}>
            {busyEvent ? "Guardando…" : "Guardar evento"}
          </button>
          <Saved show={savedEvent} />
        </div>
      </div>

      {/* CUPOS */}
      <div className="editcard">
        <h3>Cupos de la ventana</h3>
        <div className="sub">Cantidad total de cupos por entrega. Los confirmados (pagados) se descuentan solos.</div>
        <div className="cupos-edit">
          <div className="field">
            <label>Cupos totales</label>
            <input type="number" min={0} value={cupos} onChange={(e) => setCupos(parseInt(e.target.value) || 0)} />
          </div>
          <button className="save-btn" style={{ marginTop: 0 }} onClick={saveCupos} disabled={busyCupos}>
            {busyCupos ? "Guardando…" : "Actualizar cupos"}
          </button>
          <Saved show={savedCupos} />
        </div>
      </div>

      {/* PRECIOS */}
      <div className="editcard">
        <h3>Precios y combos</h3>
        <div className="sub">Precio base por plato y combos por volumen (aplican sobre el total de platos).</div>
        <div className="field" style={{ marginTop: 0, marginBottom: 14 }}>
          <label>Precio base por plato (₡)</label>
          <input type="number" min={0} value={basePrice} onChange={(e) => setBasePrice(parseInt(e.target.value) || 0)} style={{ maxWidth: 160 }} />
        </div>
        <div className="edit-list">
          {combos.map((c, i) => (
            <div className="er" key={i}>
              <input
                type="number"
                min={1}
                value={c.min}
                onChange={(e) => setCombos((cs) => cs.map((x, j) => (j === i ? { ...x, min: parseInt(e.target.value) || 0 } : x)))}
                style={{ maxWidth: 90 }}
                aria-label="platos"
              />
              <span style={{ color: "var(--muted)", fontSize: 13 }}>platos →</span>
              <input
                type="number"
                min={0}
                value={c.price}
                onChange={(e) => setCombos((cs) => cs.map((x, j) => (j === i ? { ...x, price: parseInt(e.target.value) || 0 } : x)))}
                aria-label="precio"
              />
              <button className="obtn" onClick={() => setCombos((cs) => cs.filter((_, j) => j !== i))}>Quitar</button>
            </div>
          ))}
        </div>
        <button className="obtn" style={{ marginTop: 12 }} onClick={() => setCombos((cs) => [...cs, { min: 0, price: 0 }])}>
          + Agregar combo
        </button>
        <div>
          <button className="save-btn" onClick={savePrice} disabled={busyPrice}>
            {busyPrice ? "Guardando…" : "Guardar precios"}
          </button>
          <Saved show={savedPrice} />
        </div>
      </div>

      {/* MARKET */}
      <div className="editcard">
        <h3>Sano Market</h3>
        <div className="sub">
          Categorías con precio fijo. Los productos van uno por línea. Marcá “destacado” para que aparezca en el
          upsell del checkout.
        </div>
        {market.map((cat, ci) => (
          <div key={cat.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="field" style={{ marginTop: 0, flex: 1, minWidth: 180 }}>
                <label>Categoría</label>
                <input value={cat.name} onChange={(e) => setMarket((m) => m.map((c, j) => (j === ci ? { ...c, name: e.target.value } : c)))} />
              </div>
              <div className="field" style={{ marginTop: 0 }}>
                <label>Precio (₡)</label>
                <input type="number" min={0} value={cat.price} onChange={(e) => setMarket((m) => m.map((c, j) => (j === ci ? { ...c, price: parseInt(e.target.value) || 0 } : c)))} style={{ width: 110 }} />
              </div>
              <div className="field" style={{ marginTop: 0 }}>
                <label>Presentación</label>
                <input value={cat.unit} onChange={(e) => setMarket((m) => m.map((c, j) => (j === ci ? { ...c, unit: e.target.value } : c)))} style={{ width: 110 }} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0", fontSize: 13, color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={!!cat.suggested}
                onChange={(e) => setMarket((m) => m.map((c, j) => (j === ci ? { ...c, suggested: e.target.checked } : c)))}
              />
              Destacado en el upsell
            </label>
            <div className="field" style={{ marginTop: 0 }}>
              <label>Productos (uno por línea)</label>
              <textarea
                value={cat.items.join("\n")}
                onChange={(e) => setMarket((m) => m.map((c, j) => (j === ci ? { ...c, items: e.target.value.split("\n") } : c)))}
                style={{ minHeight: 90 }}
              />
            </div>
            <button className="obtn" onClick={() => setMarket((m) => m.filter((_, j) => j !== ci))}>
              Quitar categoría
            </button>
          </div>
        ))}
        <button
          className="obtn"
          style={{ marginTop: 14 }}
          onClick={() =>
            setMarket((m) => [...m, { id: `cat-${Date.now()}`, name: "Nueva categoría", price: 0, unit: "unidad", suggested: false, items: [] }])
          }
        >
          + Agregar categoría
        </button>
        <div>
          <button className="save-btn" onClick={saveMarket} disabled={busyMarket}>
            {busyMarket ? "Guardando…" : "Guardar Sano Market"}
          </button>
          <Saved show={savedMarket} />
        </div>
      </div>
    </>
  );
}
