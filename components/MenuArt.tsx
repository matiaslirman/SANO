import { Seal } from "@/lib/brand";
import { FORK_MASK_URI } from "@/lib/menuArtFork";
import styles from "./MenuArt.module.css";

export type ArtFormat = "post" | "story";

/**
 * Arte del menú de la semana para Instagram. Reproduce la plantilla de marca de Sano.
 * `format` elige la medida: "post" = feed 1080×1350, "story" = 1080×1920.
 * Los platos salen del menú real; `dateA`/`dateB` son el rango de fechas (editable en el panel).
 * El título es fijo ("MENÚ DE LA CHEF · PLATOS LISTOS").
 */
export function MenuArt({
  format,
  dishes,
  dateA,
  dateB,
}: {
  format: ArtFormat;
  dishes: string[];
  dateA: string;
  dateB: string;
}) {
  return (
    <div className={`${styles.art} ${styles[format]}`}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.cream}>Menú de la chef</span> Platos listos
        </div>
        <div className={styles.date}>
          {dateA} <span className={styles.cream}>/ {dateB}</span>
        </div>
        <Seal className={styles.seal} />
      </div>

      <div className={styles.sheet}>
        <ol className={styles.dishes}>
          {dishes.map((d, i) => (
            <li key={i}>
              <span className={styles.num}>{i + 1}.</span>
              <span className={styles.name}>{d.toUpperCase()}</span>
            </li>
          ))}
        </ol>
      </div>

      <div
        className={styles.fork}
        style={{ WebkitMaskImage: `url("${FORK_MASK_URI}")`, maskImage: `url("${FORK_MASK_URI}")` }}
      />
    </div>
  );
}
