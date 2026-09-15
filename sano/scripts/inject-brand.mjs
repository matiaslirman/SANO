import { readFileSync, writeFileSync } from "node:fs";

const HTML = "/tmp/claude-0/-home-user/85aad896-7b22-549c-a4cf-89e6b74c3cb9/scratchpad/sano-preview.html";
const WORD = "/home/user/sano/public/brand/logo-wordmark-cream.svg";

let word = readFileSync(WORD, "utf8");
// grab inner paths, make them currentColor so we can recolor via CSS `color`
const inner = word
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .replace(/fill="#FFF0B4"/g, 'fill="currentColor"')
  .trim();

const symbol =
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">` +
  `<symbol id="sano-word" viewBox="0 0 1440 358">${inner}</symbol>` +
  `</svg>\n`;

let html = readFileSync(HTML, "utf8");

// remove any previously injected defs, then insert fresh before the demo flag
html = html.replace(/<svg width="0" height="0"[^>]*>[\s\S]*?<\/svg>\n/, "");
const marker = '<div class="demo-flag">';
if (!html.includes(marker)) throw new Error("marker not found");
html = html.replace(marker, symbol + marker);

writeFileSync(HTML, html);
console.log("injected #sano-word symbol (" + inner.length + " chars of path data)");
