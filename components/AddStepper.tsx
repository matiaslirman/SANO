"use client";

/**
 * «+ Agregar» cuando la cantidad es 0 y «– n +» cuando ya hay algo. Botones de 44 px (táctil / iPhone).
 * Lo usan el menú semanal, el Sano Market y Viaje Sano.
 */
export function AddStepper({
  qty,
  label,
  onMinus,
  onPlus,
  full,
}: {
  qty: number;
  label: string;
  onMinus: () => void;
  onPlus: () => void;
  full?: boolean;
}) {
  const empty = qty <= 0;
  return (
    <div className={`addstep${empty ? " empty" : ""}${full ? " full" : ""}`}>
      {!empty && (
        <button type="button" className="minus" onClick={onMinus} aria-label={`Quitar ${label}`}>
          –
        </button>
      )}
      {!empty && (
        <span className="q tnum" aria-live="polite">
          {qty}
        </span>
      )}
      <button type="button" className="plus" onClick={onPlus} aria-label={`${empty ? "Agregar" : "Sumar"} ${label}`}>
        {empty ? "+ Agregar" : "+"}
      </button>
    </div>
  );
}
