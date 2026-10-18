// 모든 페이지를 헤드리스 Chromium으로 열어 점검한다.
//   - 콘솔 오류·페이지 예외(외부 리소스 로딩 실패는 제외)
//   - 폭 360px에서 가로 스크롤
//   - 시뮬레이터 수, 시뮬레이터 id 중복
//   - 시뮬레이터 안의 버튼·세그먼트·패드·스텝·건반을 눌러 보고 슬라이더를 흔들어 핸들러 오류를 잡는다
// 사용: node tools/check.mjs [slug ...]
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
let chromium;
for (const p of ["playwright", "/opt/node-tools/node_modules/playwright", "@playwright/test"]) {
  try { ({ chromium } = require(p)); break; } catch (e) {}
}
if (!chromium) { console.error("playwright를 찾을 수 없습니다 (npm i -D playwright)"); process.exit(2); }

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const js = fs.readFileSync(path.join(root, "js/common.js"), "utf8");
const slugs = [...js.matchAll(/\{ slug: "(\w+)",\s*num: "(\d+)"/g)].map((m) => m[1]);
const only = process.argv.slice(2);
const pages = [""].concat(slugs.map((s) => `chapters/${s}.html`)).filter((p) => !only.length || only.some((o) => (p || "index.html").includes(o)));

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let failed = 0, totalSims = 0;
const seenIds = new Map();
for (const p of pages) {
  if (p && !fs.existsSync(path.join(root, p))) { console.log(`✗ ${p}: 파일 없음`); failed++; continue; }
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  // 외부 CDN·분석 스크립트는 막는다(오프라인에서도 같은 결과)
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(`http://127.0.0.1:${port}/${p}`, { waitUntil: "load" });
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const wide = over > 1 ? [...document.querySelectorAll("main *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest(".steps-grid, .table-wrap, .chain, .sim-view, .katex-display")).slice(0, 4).map((e) => e.tagName + (e.id ? "#" + e.id : "") + "." + [...e.classList].join(".")) : [];
    return { over, wide, sims: [...document.querySelectorAll(".sim")].map((s) => s.id), quiz: document.querySelectorAll(".quiz-q").length, h2: document.querySelectorAll("main section > h2").length };
  });
  // 상호작용 퍼징
  await page.setViewportSize({ width: 1280, height: 900 });
  const n = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let count = 0;
    const sims = [...document.querySelectorAll(".sim")];
    for (const sim of sims) {
      sim.scrollIntoView();
      const ranges = [...sim.querySelectorAll('input[type="range"]')];
      for (const r of ranges) { for (const f of [0, 1, 0.5]) { const min = +r.min || 0, max = +(r.max || 100); r.value = min + (max - min) * f; r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true })); count++; } }
      for (const s of sim.querySelectorAll("select")) { for (const o of [...s.options]) { s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); s.dispatchEvent(new Event("input", { bubbles: true })); count++; } }
      for (const c of sim.querySelectorAll('input[type="checkbox"]')) { c.click(); c.click(); count++; }
      const clickables = [...sim.querySelectorAll("button, .key, .slot, .cell, [data-click]")].slice(0, 80);
      for (const b of clickables) {
        if (b.disabled) continue;
        const r = b.getBoundingClientRect();
        const opts = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, buttons: 1 };
        b.dispatchEvent(new PointerEvent("pointerdown", opts));
        b.dispatchEvent(new MouseEvent("mousedown", opts));
        await sleep(5);
        b.dispatchEvent(new PointerEvent("pointerup", opts));
        b.dispatchEvent(new MouseEvent("mouseup", opts));
        b.click();
        count++;
      }
      await sleep(250);
      // 다시 눌러서 토글형 재생 버튼을 끈다
      for (const b of sim.querySelectorAll("button.playing")) b.click();
      if (window.MB && MB.stopAll) MB.stopAll();
    }
    return count;
  });
  await page.waitForTimeout(400);
  for (const id of info.sims) { if (!id) continue; if (seenIds.has(id)) errors.push(`시뮬레이터 id 중복: ${id} (${seenIds.get(id)})`); seenIds.set(id, p); }
  const noId = info.sims.filter((x) => !x).length;
  if (noId) errors.push(`id 없는 .sim ${noId}개`);
  if (info.over > 1) errors.push(`360px에서 가로 스크롤 ${info.over}px ${info.wide.join(", ")}`);
  totalSims += info.sims.length;
  const ok = !errors.length;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${p || "index.html"}  sims=${info.sims.length} quiz=${info.quiz} h2=${info.h2} actions=${n}`);
  [...new Set(errors)].slice(0, 12).forEach((e) => console.log("    " + e));
  await ctx.close();
}
await browser.close();
server.close();
console.log(`\n${pages.length}개 페이지, 시뮬레이터 ${totalSims}개, 실패 ${failed}`);
process.exit(failed ? 1 : 0);
