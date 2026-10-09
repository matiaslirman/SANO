"use client";

import type { Order } from "@/lib/types";
import { PROTEIN_EXTRA_LABEL } from "@/lib/pricing";

/**
 * Etiquetas imprimibles: **una etiqueta por envase**.
 *
 * Un pedido de 3× Costilla son 3 etiquetas, no una línea con "3×". Si de esas 3
 * hay 1 con Proteína Extra, solo esa etiqueta lo dice: lo que va pegado en el
 * envase tiene que describir ese envase y nada más.
 */
export interface LabelUnit {
  key: string;
  customer: string;
  orderId: string;
  dish: string;
  extra: boolean;
  idx: number; // 2 de 3
  of: number;
  note: string;
  delivery: string;
}

const shortWinLabel = (label: string) => label.replace(/^Entrega\s+/i, "");

/** Expande cada línea de plato en una etiqueta por unidad. Las primeras llevan el extra. */
export function buildLabels(orders: Order[]): LabelUnit[] {
  const out: LabelUnit[] = [];
  for (const o of orders) {
    for (const d of o.dishes) {
      if (d.qty <= 0) continue;
      const extras = Math.min(d.extraQty || 0, d.qty);
      for (let i = 0; i < d.qty; i++) {
        out.push({
          key: `${o.id}|${d.name}|${i}`,
          customer: o.customerName,
          orderId: o.id,
          dish: d.name,
          extra: i < extras,
          idx: i + 1,
          of: d.qty,
          note: o.notes.trim(),
          delivery: shortWinLabel(o.windowLabel),
        });
      }
    }
  }
  return out;
}

export interface LabelFormat {
  id: string;
  label: string;
  hint: string;
  kind: "sheet" | "roll";
  w: number; // mm
  h: number; // mm
  cols: number;
  /** Tamaño y márgenes de página, tal cual van en la regla `@page`. */
  page: string;
  margin: string;
  /** Tipografía en pt: el nombre manda, el resto acompaña. */
  name: number;
  body: number;
  small: number;
}

/**
 * Dos familias. Las de hoja sirven para probar en cualquier impresora común con
 * pliegos de stickers, sin comprar nada. Las de rollo son para una térmica.
 */
export const LABEL_FORMATS: LabelFormat[] = [
  {
    id: "a4-24",
    label: "Hoja A4 · 24 etiquetas",
    hint: "70 × 35 mm · pliego de stickers 3 × 8",
    kind: "sheet",
    w: 70, h: 35, cols: 3,
    page: "A4", margin: "8.5mm 0",
    name: 11, body: 8, small: 6,
  },
  {
    id: "carta-10",
    label: "Hoja Carta · 10 etiquetas",
    hint: "101,6 × 50,8 mm · pliego tipo Avery 5163",
    kind: "sheet",
    w: 101.6, h: 50.8, cols: 2,
    page: "letter", margin: "12.7mm 6.35mm",
    name: 16, body: 11, small: 8,
  },
  {
    id: "rollo-62x50",
    label: "Rollo 62 × 50 mm",
    hint: "térmica de etiquetas, rollo ancho",
    kind: "roll",
    w: 62, h: 50, cols: 3,
    page: "62mm 50mm", margin: "0",
    name: 13, body: 10, small: 7,
  },
  {
    id: "rollo-50x30",
    label: "Rollo 50 × 30 mm",
    hint: "térmica de etiquetas, rollo angosto",
    kind: "roll",
    w: 50, h: 30, cols: 4,
    page: "50mm 30mm", margin: "0",
    name: 10, body: 7.5, small: 6,
  },
];

/**
 * El pliego de etiquetas. En pantalla se ve al tamaño real (todo en mm) para
 * poder juzgar si entra el nombre del plato antes de gastar un rollo.
 */
export function LabelPrint({ units, format }: { units: LabelUnit[]; format: LabelFormat }) {
  const isRoll = format.kind === "roll";
  return (
    <>
      {/* `@page` no acepta variables CSS, así que la regla se arma por formato. */}
      <style>{`@page{size:${format.page};margin:${format.margin}}`}</style>
      <div
        className={`lbl-sheet${isRoll ? " is-roll" : ""}`}
        style={{ gridTemplateColumns: `repeat(${format.cols}, ${format.w}mm)` }}
      >
        {units.map((u) => (
          <div
            key={u.key}
            className="lbl"
            style={{
              width: `${format.w}mm`,
              height: `${format.h}mm`,
              fontSize: `${format.body}pt`,
            }}
          >
            <div className="lbl-top">
              <span className="lbl-who" style={{ fontSize: `${format.name}pt` }}>
                {u.customer}
              </span>
              <span className="lbl-ono" style={{ fontSize: `${format.small}pt` }}>
                {u.orderId}
              </span>
            </div>

            <div className="lbl-dish">{u.dish}</div>
            {u.extra && <div className="lbl-extra">+ {PROTEIN_EXTRA_LABEL}</div>}

            {/* La restricción del cliente vive hoy solo en Pedidos; en el envase es lo que más importa. */}
            {u.note && (
              <div className="lbl-note" style={{ fontSize: `${format.small}pt` }}>
                {u.note}
              </div>
            )}

            <div className="lbl-foot" style={{ fontSize: `${format.small}pt` }}>
              <span>{u.delivery}</span>
              {u.of > 1 && (
                <span className="tnum">
                  {u.idx} de {u.of}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
