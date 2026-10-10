"use client";

import type { Order } from "@/lib/types";
import { PROTEIN_EXTRA_LABEL } from "@/lib/pricing";
import { Wordmark } from "@/lib/brand";

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
  /**
   * `full` entra todo. `compact` saca el día de entrega: en una tanda es el
   * mismo en las 120 etiquetas, así que es lo primero que sobra cuando el
   * espacio aprieta.
   */
  density: "full" | "compact";
  /** Tipografía en pt. Debajo de 6 pt la térmica de 203 dpi empieza a fundir trazos. */
  name: number;
  body: number;
  small: number;
  /** Ancho del wordmark en mm. Menos de 9 mm y deja de leerse "SANO". */
  mark: number;
}

/**
 * Ningún formato pasa de 50 mm en su lado largo, y ninguno baja de 25 mm de alto:
 * a 21 mm, un plato que cae en dos líneas más el extra más la restricción ya no
 * entran, y lo que se pierde es justamente la alergia.
 *
 * Las de hoja son para probar en papel sin comprar nada; las de rollo, para una
 * térmica. Las medidas de hoja son una grilla propia: si se compran pliegos
 * pre-troquelados de una marca, hay que calzar la geometría exacta de ese
 * producto.
 */
export const LABEL_FORMATS: LabelFormat[] = [
  {
    id: "carta-40",
    label: "Hoja Carta · 40 etiquetas",
    hint: "48 × 25 mm · 4 × 10",
    kind: "sheet",
    w: 48, h: 25, cols: 4,
    page: "letter", margin: "14.7mm 11.95mm",
    density: "compact",
    name: 9.5, body: 7, small: 5.5, mark: 11,
  },
  {
    id: "carta-50",
    label: "Hoja Carta · 50 etiquetas",
    hint: "38 × 25 mm · 5 × 10",
    kind: "sheet",
    w: 38, h: 25, cols: 5,
    page: "letter", margin: "14.7mm 12.95mm",
    density: "compact",
    name: 8.5, body: 6.5, small: 5, mark: 9,
  },
  {
    id: "a4-55",
    label: "Hoja A4 · 55 etiquetas",
    hint: "38 × 25 mm · 5 × 11",
    kind: "sheet",
    w: 38, h: 25, cols: 5,
    page: "A4", margin: "11mm 10mm",
    density: "compact",
    name: 8.5, body: 6.5, small: 5, mark: 9,
  },
  {
    id: "rollo-50x30",
    label: "Rollo 50 × 30 mm",
    hint: "térmica · el más holgado",
    kind: "roll",
    w: 50, h: 30, cols: 4,
    page: "50mm 30mm", margin: "0",
    density: "full",
    name: 10, body: 7.5, small: 6, mark: 12,
  },
  {
    id: "rollo-50x25",
    label: "Rollo 50 × 25 mm",
    hint: "térmica · medida corriente",
    kind: "roll",
    w: 50, h: 25, cols: 4,
    page: "50mm 25mm", margin: "0",
    density: "compact",
    name: 9.5, body: 7, small: 5.5, mark: 11,
  },
  {
    id: "rollo-40x25",
    label: "Rollo 40 × 25 mm",
    hint: "térmica · el más chico legible",
    kind: "roll",
    w: 40, h: 25, cols: 5,
    page: "40mm 25mm", margin: "0",
    density: "compact",
    name: 8.5, body: 6.5, small: 5, mark: 9,
  },
];

/**
 * El pliego de etiquetas. En pantalla se ve al tamaño real (todo en mm) para
 * poder juzgar si entra el nombre del plato antes de gastar un rollo.
 */
export function LabelPrint({ units, format }: { units: LabelUnit[]; format: LabelFormat }) {
  const isRoll = format.kind === "roll";
  const full = format.density === "full";
  return (
    <>
      {/* `@page` no acepta variables CSS, así que la regla se arma por formato. */}
      <style>{`@page{size:${format.page};margin:${format.margin}}`}</style>
      <div
        className={`lbl-sheet${isRoll ? " is-roll" : ""}${full ? "" : " is-compact"}`}
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
              {/* Recurso oficial de marca (lib/brand · Wordmark), en negro: la térmica
                  imprime un solo color y el bordó saldría tramado. El ancho va en
                  el contenedor porque `brand.tsx` es auto-generado y no se toca. */}
              <span className="lbl-mark" style={{ width: `${format.mark}mm` }} aria-hidden="true">
                <Wordmark />
              </span>
              {full && <span className="lbl-day">{u.delivery}</span>}
              {u.of > 1 && (
                <span className="tnum lbl-n">
                  {u.idx}/{u.of}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
