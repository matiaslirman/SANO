import { readFileSync, writeFileSync } from "node:fs";

const word = readFileSync("public/brand/logo-wordmark-cream.svg", "utf8");
const inner = word
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .replace(/fill="#FFF0B4"/g, 'fill="currentColor"')
  .replace(/\s+/g, " ")
  .trim();

const STAR =
  "120.0,4.0 144.3,29.2 178.0,19.5 186.5,53.5 220.5,62.0 210.8,95.7 236.0,120.0 210.8,144.3 220.5,178.0 186.5,186.5 178.0,220.5 144.3,210.8 120.0,236.0 95.7,210.8 62.0,220.5 53.5,186.5 19.5,178.0 29.2,144.3 4.0,120.0 29.2,95.7 19.5,62.0 53.5,53.5 62.0,19.5 95.7,29.2";

const out = `// AUTO-GENERADO desde public/brand/logo-wordmark-cream.svg (no editar a mano).
// Regenerar con: node scripts/gen-brand-component.mjs
import React from "react";

const WORD_INNER = ${JSON.stringify(inner)};
const STAR_PTS = ${JSON.stringify(STAR)};

/** Wordmark horizontal "SANO". Toma el color de \`currentColor\` (usá CSS \`color\`). */
export function Wordmark({ className, title = "Sano" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 1440 358"
      role="img"
      aria-label={title}
      className={className}
      dangerouslySetInnerHTML={{ __html: WORD_INNER }}
    />
  );
}

/** Sello circular: sunburst crema + círculo bordó + wordmark crema. */
export function Seal({ className, title = "Sano" }: { className?: string; title?: string }) {
  const inner =
    '<polygon points="' + STAR_PTS + '" fill="#FFF1B4"/>' +
    '<circle cx="120" cy="120" r="93" fill="#921A1B"/>' +
    '<g transform="translate(40 100) scale(0.1111)" style="color:#FFF1B4">' + WORD_INNER + '</g>';
  return (
    <svg
      viewBox="0 0 240 240"
      role="img"
      aria-label={title}
      className={className}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
`;

writeFileSync("lib/brand.tsx", out);
console.log("wrote lib/brand.tsx (" + inner.length + " chars of path data)");
