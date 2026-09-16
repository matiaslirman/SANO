import { chromium } from "playwright-core";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3000";
const OUT = "/tmp/claude-0/-home-user/85aad896-7b22-549c-a4cf-89e6b74c3cb9/scratchpad/";
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

// ---- mobile checkout: no WhatsApp field + sticky becomes green WA button ----
let ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
let page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelectorAll(".dish .stepper button:last-child").forEach((b, i) => { if (i < 3) for (let k = 0; k < 4; k++) b.click(); }));
await page.waitForTimeout(200);
await page.locator("#checkout").scrollIntoViewIfNeeded();
await page.fill("#nm", "María Fernández");
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + "v2-checkout-mobile.png" });
await ctx.close();

// ---- admin: complete + delete buttons, crossed-off row ----
ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
page = await ctx.newPage();
await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
await page.fill("#pw", "sano-2bistro");
await page.click("button[type=submit]");
await page.waitForURL("**/admin/pedidos", { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + "v2-admin-pedidos.png" });
// click Completar on the first order to show strike-through
const btn = page.locator('button:has-text("Completar")').first();
if (await btn.count()) { await btn.click(); await page.waitForTimeout(900); }
await page.screenshot({ path: OUT + "v2-admin-done.png" });
await ctx.close();

await browser.close();
console.log("done");
