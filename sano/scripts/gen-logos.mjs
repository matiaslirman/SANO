import { writeFileSync, mkdirSync } from "node:fs";

mkdirSync("public/brand", { recursive: true });

const BORDO = "#921A1B";
const CREMA = "#FFF1B4";

// 12-point sunburst star (cx120,cy120,R116,r94)
const STAR =
  "120.0,4.0 144.3,29.2 178.0,19.5 186.5,53.5 220.5,62.0 210.8,95.7 236.0,120.0 210.8,144.3 220.5,178.0 186.5,186.5 178.0,220.5 144.3,210.8 120.0,236.0 95.7,210.8 62.0,220.5 53.5,186.5 19.5,178.0 29.2,144.3 4.0,120.0 29.2,95.7 19.5,62.0 53.5,53.5 62.0,19.5 95.7,29.2";

// Place-setting icon (fork + plate + knife), drawn in a ~192x206 box.
// `c` = fill/stroke color. Strokes used for the plate so it reads on any ground.
function iconSetting(c) {
  return `
    <g fill="${c}" stroke="${c}">
      <!-- fork -->
      <g stroke="none">
        <rect x="4"  y="4" width="9" height="62" rx="4.5"/>
        <rect x="20" y="4" width="9" height="62" rx="4.5"/>
        <rect x="36" y="4" width="9" height="62" rx="4.5"/>
        <path d="M4 60 H45 L34 92 H15 Z"/>
        <rect x="16" y="86" width="17" height="118" rx="8"/>
      </g>
      <!-- plate -->
      <g fill="none" stroke-width="9"><circle cx="100" cy="104" r="46"/></g>
      <g fill="none" stroke-width="5"><circle cx="100" cy="104" r="30"/></g>
      <!-- knife -->
      <g stroke="none">
        <path d="M170 100 C160 100 156 78 158 44 C159 20 168 6 176 6 C184 30 184 74 180 100 Z"/>
        <rect x="163" y="96" width="15" height="108" rx="7.5"/>
      </g>
    </g>`;
}

/* ---------- WORDMARK (horizontal) ---------- */
function wordmark(letters, icon) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 250" role="img" aria-label="Sano">
  <style>text{font-family:'Anton','Oswald Bold',Impact,sans-serif}</style>
  <text x="4" y="200" font-size="214" letter-spacing="-4" fill="${letters}">SAN</text>
  <g transform="translate(392,28) scale(1.02)">${iconSetting(icon)}</g>
</svg>`;
}

/* ---------- SEAL (circular badge) ---------- */
function seal() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Sano">
  <defs>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.28"/>
    </filter>
  </defs>
  <g filter="url(#sh)">
    <polygon points="${STAR}" fill="${CREMA}"/>
    <circle cx="120" cy="120" r="93" fill="${BORDO}"/>
  </g>
  <g transform="rotate(-6 120 120)">
    <style>text{font-family:'Anton','Oswald Bold',Impact,sans-serif}</style>
    <text x="40" y="150" font-size="82" letter-spacing="-2" fill="${CREMA}">SAN</text>
    <g transform="translate(150,78) scale(0.44)">${iconSetting(CREMA)}</g>
  </g>
</svg>`;
}

writeFileSync("public/brand/logo-seal.svg", seal());
writeFileSync("public/brand/logo-wordmark-cream.svg", wordmark(CREMA, CREMA));
writeFileSync("public/brand/logo-wordmark-bordo.svg", wordmark(BORDO, BORDO));
console.log("wrote public/brand/{logo-seal,logo-wordmark-cream,logo-wordmark-bordo}.svg");
