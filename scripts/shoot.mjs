import { chromium } from "playwright-core";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const file = "file:///tmp/claude-0/-home-user/85aad896-7b22-549c-a4cf-89e6b74c3cb9/scratchpad/sano-preview.html";
const OUT = "/tmp/claude-0/-home-user/85aad896-7b22-549c-a4cf-89e6b74c3cb9/scratchpad/";

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

// mobile hero
let ctx = await browser.newContext({ viewport: { width: 390, height: 940 }, deviceScaleFactor: 2 });
let page = await ctx.newPage();
await page.goto(file, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + "v-mobile.png" });
await ctx.close();

// desktop hero
ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
page = await ctx.newPage();
await page.goto(file, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + "v-desktop.png" });
// footer (loyalty button)
await page.locator("footer").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.locator("footer").screenshot({ path: OUT + "v-footer.png" });
await ctx.close();

await browser.close();
console.log("shot v-mobile / v-desktop / v-footer");
