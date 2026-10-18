// 스크린숏: node tools/shot.mjs <url> <out.png> [css선택자|-] [폭] [dark]
// (서버 필요: python3 -m http.server 8765)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = (() => { for (const m of ["playwright", "/opt/node-tools/node_modules/playwright"]) { try { return require(m); } catch (e) {} } })();
const [,, url, out, sel, w = "1280", dark] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: 900 }, colorScheme: dark ? "dark" : "light" });
await p.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(400);
if (sel && sel !== "-") { const e = await p.$(sel); await e.scrollIntoViewIfNeeded(); await p.waitForTimeout(200); await e.screenshot({ path: out }); }
else await p.screenshot({ path: out, fullPage: false });
await b.close();
