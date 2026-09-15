import { chromium } from "playwright-core";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const file = "file:///tmp/claude-0/-home-user/85aad896-7b22-549c-a4cf-89e6b74c3cb9/scratchpad/sano-preview.html";

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(file, { waitUntil: "networkidle" });
await page.waitForTimeout(600);

const info = await page.evaluate(() => {
  const docW = document.documentElement.scrollWidth;
  const winW = window.innerWidth;
  const offenders = [];
  document.querySelectorAll("*").forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.right > winW + 1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || "",
        right: Math.round(r.right), width: Math.round(r.width)
      });
    }
  });
  // keep the widest few, dedupe-ish
  offenders.sort((a,b)=>b.right-a.right);
  return { docW, winW, offenders: offenders.slice(0, 14) };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
