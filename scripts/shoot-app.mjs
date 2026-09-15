import { chromium } from "playwright-core";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3000";
const OUT = "/tmp/claude-0/-home-user/85aad896-7b22-549c-a4cf-89e6b74c3cb9/scratchpad/";

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

// ---- client: desktop + mobile ----
let ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
let page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + "app-home-desktop.png" });
await ctx.close();

ctx = await browser.newContext({ viewport: { width: 390, height: 940 }, deviceScaleFactor: 2 });
page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + "app-home-mobile.png" });
// interact: add dishes then screenshot checkout
await page.evaluate(() => document.querySelectorAll(".dish .stepper button:last-child").forEach((b, i) => { if (i < 3) for (let k = 0; k < 4; k++) b.click(); }));
await page.waitForTimeout(300);
await page.locator("#checkout").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + "app-checkout-mobile.png" });
await ctx.close();

// ---- admin: login then pages ----
ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
page = await ctx.newPage();
await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
await page.screenshot({ path: OUT + "app-login.png" });
await page.fill("#pw", "sano-2bistro");
await page.click("button[type=submit]");
await page.waitForURL("**/admin/pedidos", { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + "app-admin-pedidos.png" });

await page.goto(BASE + "/admin/cocina", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + "app-admin-cocina.png" });

await page.goto(BASE + "/admin/contenido", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + "app-admin-contenido.png", fullPage: false });
await ctx.close();

await browser.close();
console.log("done");
