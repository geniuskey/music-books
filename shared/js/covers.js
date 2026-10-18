/* Copyright (c) 2026 geniuskey and euiyun books contributors.
   Reused from geniuskey/books under the MIT License (see ../../LICENSE-MIT). */
/* 책 표지 일러스트. books.json의 motif 이름 → SVG 문자열 (viewBox 0 0 200 130, 흰 선 위주).
   애니메이션은 css의 .cv-* 클래스가 담당하고, 카드에 마우스를 올렸을 때만 움직인다. */
(function () {
  "use strict";
  const W = "currentColor";
  const svg = (body) => `<svg class="cover-art" viewBox="0 0 200 130" aria-hidden="true" focusable="false">${body}</svg>`;
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  // 결정적 의사난수: 새로고침해도 같은 그림
  const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const M = {
    // 이하 guitar·piano·drums는 MusicBooks 악기 표지다. 움직임은 .gt-·.pn-·.dr- 클래스가 맡고, 멈춘 첫 프레임도 완성된 그림이다.
    // 기타: 비스듬히 놓인 어쿠스틱 기타. 프렛은 너트에서 줄 길이 × (1 − 2^(−n/12))만큼 떨어진 12평균율 자리에 놓인다.
    // 피크는 8분음표로 쉬지 않고 오르내리며 오른쪽 아래의 ↓ ↓↑ ↑↓↑ 패턴을 치고, 친 박마다 여섯 줄의 진동 폭이 부풀었다 잦아든다.
    guitar() {
      const L = 101.5, nut = 136.3, saddle = nut - L, end = 73.5, f = (v) => +v.toFixed(2);
      const fret = (n) => nut - L * (1 - 2 ** (-n / 12)), half = (x) => 4.7 - (1.1 * (x - end)) / (nut - end);
      const lo = (k) => -6.25 + 2.5 * k, hi = (k) => -3 + 1.2 * k; // 새들·너트 위 k번째 줄(0: 저음 E)
      const edge = (x) => 3.9 + (2.9 * (x - 137.7)) / 24.8; // 헤드 가장자리
      let g = `<path d="M0 0C0-19 9-31 24-31C36-31 40-21 47-21C53-21 57-26 65-26C74-26 80-18 80-9V9C80 18 74 26 65 26C57 26 53 21 47 21C40 21 36 31 24 31C9 31 0 19 0 0Z" fill="url(#gt-top)" stroke="#fff4e0" stroke-width="1.5"/>`;
      // 사운드홀과 로제트, 픽가드, 브리지와 새들
      g += `<circle cx="61" cy="0" r="8.6" fill="#2b170c"/><circle cx="61" cy="0" r="10.6" fill="none" stroke="#fff4e0" stroke-width="1.1"/><circle cx="61" cy="0" r="11.8" fill="none" stroke="#7a3d17" stroke-dasharray=".9 .9"/><circle cx="61" cy="0" r="12.8" fill="none" stroke="#fff4e0" stroke-opacity=".7" stroke-width=".5"/>`;
      g += `<path d="M71.3 8.7C72.5 16 67 23 58 23C51 23 46.5 18 47.5 12C48 9.8 48.6 8.2 49.3 6.75A13.5 13.5 0 0 0 71.3 8.7Z" fill="#4a230e" fill-opacity=".55"/>`;
      g += `<rect x="${f(saddle - 5.2)}" y="-12" width="7" height="24" rx="3" fill="#2b170c"/><path d="M${f(saddle)} -8.2V8.2" stroke="#fff8ea" stroke-width="1.1" stroke-linecap="round"/>`;
      range(6).forEach((k) => { g += `<circle cx="${f(saddle - 2.9)}" cy="${lo(k)}" r=".75" fill="#fff4e0"/>`; });
      // 지판: 반음마다 좁아지는 프렛, 3·5·7·9·12·15 프렛 자리표
      g += `<path d="M${end} ${-half(end)}L${nut} ${f(-half(nut))}V${f(half(nut))}L${end} ${half(end)}Z" fill="#2b170c" stroke="#fff4e0" stroke-width=".6"/>`;
      range(16).forEach((i) => { const x = f(fret(i + 1)), h = f(half(x)); g += `<path d="M${x} ${-h}V${h}" stroke="#e9dcc8" stroke-width=".55"/>`; });
      [3, 5, 7, 9, 12, 15].forEach((n) => {
        const x = f((fret(n - 1) + fret(n)) / 2);
        g += (n === 12 ? [-1.9, 1.9] : [0]).map((y) => `<circle cx="${x}" cy="${y}" r=".9" fill="#f6ecd9"/>`).join("");
      });
      // 너트와 헤드, 줄감개
      g += `<path d="M137.7-3.9 162.5-6.8Q165.5-7.1 165.5-4V4Q165.5 7.1 162.5 6.8L137.7 3.9Z" fill="#2b170c" stroke="#fff4e0" stroke-width=".7"/><rect x="${nut}" y="-4" width="1.5" height="8" rx=".4" fill="#fff8ea"/>`;
      [145, 152, 159].forEach((x) => [-1, 1].forEach((s) => {
        const e = edge(x);
        g += `<path d="M${x} ${f(s * e)}V${f(s * (e + 2.2))}" stroke="#e9dcc8"/><ellipse cx="${x}" cy="${f(s * (e + 3.4))}" rx="1.6" ry="1.9" fill="#f6ecd9"/><circle cx="${x}" cy="${f(s * (e - 1.7))}" r=".85" fill="#e9dcc8"/>`;
      }));
      // 여섯 줄은 새들에서 너트를 지나 줄감개로 간다. 줄마다 새들~너트 사이에 기본 진동의 폭(배 모양)을 겹쳐 둔다.
      const posts = [145, 152, 159, 159, 152, 145];
      range(6).forEach((k) => {
        const px = posts[k], py = f((k < 3 ? -1 : 1) * (edge(px) - 1.7)), m = f((saddle + nut) / 2), y = (lo(k) + hi(k)) / 2;
        g += `<path d="M${f(saddle)} ${lo(k)}L${nut} ${f(hi(k))}L${px} ${py}" fill="none" stroke="#fff6e4" stroke-width="${[1, 0.88, 0.76, 0.64, 0.54, 0.46][k]}" stroke-linejoin="round"/>`;
        g += `<path class="gt-ring" opacity="0" style="animation-delay:${(0.13 + k * 0.012).toFixed(3)}s" d="M${f(saddle)} ${lo(k)}Q${m} ${f(y - 3.2)} ${nut} ${f(hi(k))}Q${m} ${f(y + 3.2)} ${f(saddle)} ${lo(k)}Z" fill="#fff6e4" fill-opacity=".45"/>`;
      });
      g += `<g transform="translate(58 -17.5)"><path class="gt-pick" style="--dy:35px" d="M-3.9-3Q0-5.1 3.9-3 3.9.9 0 4.8-3.9.9-3.9-3Z" fill="#e8590c" stroke="#fff4e0" stroke-width=".6"/></g>`;
      let s = `<defs><radialGradient id="gt-top" cx=".5" cy=".5" r=".58"><stop offset="0" stop-color="#fff2d2"/><stop offset=".55" stop-color="#f4cd86"/><stop offset=".82" stop-color="#d0843b"/><stop offset="1" stop-color="#7a3d17"/></radialGradient></defs>`;
      s += `<g transform="translate(19.8 93.2) rotate(-24) scale(1.08)">${g}</g>`;
      // 왼쪽 위로 떠오르는 음표
      const note = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="3.9" ry="2.9" transform="rotate(-20 ${x} ${y})"/><path d="M${x + 3.5} ${y - 0.8}V${y - 15}" stroke="${W}" stroke-width="1.3"/>`;
      s += `<g class="cv-bob" fill="${W}" fill-opacity=".92">${note(24, 36)}${note(40, 31)}<path d="M27 20.4 44.1 15.2V18L27 23.2Z"/></g>`;
      s += `<g class="cv-bob" style="animation-delay:.6s" fill="${W}" fill-opacity=".92">${note(66, 22)}<path d="M69.5 7c.6 4 5.6 5 5 10.5c-.7-3.2-2.8-4.5-5-4.9z"/></g>`;
      // 오른쪽 아래 스트로크 패턴: 피크가 지나는 박마다 화살표가 빛난다
      [..."D-DU-UDU"].forEach((c, i) => {
        const x = 122 + i * 10;
        if (c === "-") { s += `<circle cx="${x}" cy="111" r="1.1" fill="${W}" fill-opacity=".45"/>`; return; }
        const [a, b] = c === "D" ? [104, 118] : [118, 104], t = c === "D" ? -4 : 4;
        s += `<path class="gt-beat" style="animation-delay:${(0.13 + i * 0.3).toFixed(2)}s" d="M${x} ${a}V${b}M${x - 3} ${b + t}L${x} ${b}L${x + 3} ${b + t}" fill="none" stroke="${W}" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
      });
      return svg(s);
    },
    // 피아노: 두 옥타브(C3–C5) 건반을 앞에서 살짝 내려다본 모습. 왼손은 C–Am–F–G 화음을 금빛으로 한 박씩 짚고,
    // 오른손 선율은 하늘빛으로 8분음표마다 옮겨 가며 위 오선에서 같은 음표가 함께 빛난다. 멈춰 있을 때는 C 화음과 첫 음 E4.
    piano() {
      const x0 = 14, x1 = 186, w = (x1 - x0) / 15, top = 64, front = 112, f = (v) => +v.toFixed(1);
      const X = (x, y) => f(100 + (x - 100) * (0.9 + (0.1 * (y - top)) / (front - top))); // 앞쪽이 넓은 원근
      const quad = (a, b, y0, y1) => `M${X(a, y0)} ${y0}L${X(b, y0)} ${y0}L${X(b, y1)} ${y1}L${X(a, y1)} ${y1}Z`;
      const wave = (x) => 3 * Math.sin(((x - 8) / 184) * Math.PI * 2);
      const gold = "#ffd27a", sky = "#8fd3ff";
      const melody = [[9, 8], [11, 6], [12, 5], [14, 3], [12, 5], [10, 7], [11, 6], [8, 9]]; // [흰 건반 번호, 오선 위치(위 줄 F5=0)]
      let s = `<defs><linearGradient id="pn-fade" gradientUnits="userSpaceOnUse" x1="8" x2="192" y1="0" y2="0"><stop offset="0" stop-color="${W}" stop-opacity="0"/><stop offset=".15" stop-color="${W}" stop-opacity=".6"/><stop offset=".85" stop-color="${W}" stop-opacity=".6"/><stop offset="1" stop-color="${W}" stop-opacity="0"/></linearGradient></defs>`;
      // 물결치는 오선과 선율
      range(5).forEach((k) => { s += `<path d="M${range(37).map((i) => { const x = 8 + (i * 184) / 36; return `${f(x)} ${f(12 + k * 4.4 + wave(x))}`; }).join("L")}" fill="none" stroke="url(#pn-fade)" stroke-width=".7"/>`; });
      const heads = melody.map(([, p], i) => { const x = 44 + i * 17.5; return [x, f(12 + p * 2.2 + wave(x))]; });
      heads.forEach(([x, y], i) => {
        const head = (fill, extra = "") => `<ellipse${extra} cx="${x}" cy="${y}" rx="2.8" ry="2" transform="rotate(-20 ${x} ${y})" fill="${fill}"/>`;
        s += head(W) + `<path d="M${f(x + 2.5)} ${f(y - 0.6)}V${f(y - 12)}" stroke="${W}"/>` + head(sky, ` class="pn-note"${i ? ' opacity="0"' : ""} style="animation-delay:${(i * 0.4).toFixed(1)}s"`);
        if (i % 2 === 0) { const [x2, y2] = heads[i + 1]; s += `<path d="M${f(x + 2)} ${f(y - 12)}L${f(x2 + 3)} ${f(y2 - 12)}V${f(y2 - 10.2)}L${f(x + 2)} ${f(y - 10.2)}Z" fill="${W}"/>`; }
      });
      // 케이스(뒤판·양옆·앞 레일), 금색 띠와 붉은 펠트
      s += `<ellipse cx="100" cy="${front + 9}" rx="94" ry="2.6" fill="#000" fill-opacity=".22"/><path d="${quad(x0 - 7, x1 + 7, 54, front + 7)}" fill="#1d1631"/>`;
      s += `<path d="M${X(x0 - 4, 57.5)} 57.5H${X(x1 + 4, 57.5)}" stroke="${gold}" stroke-opacity=".75" stroke-width=".6"/><path d="${quad(x0, x1, 62, top)}" fill="#b3214f"/>`;
      const key = (i) => [x0 + i * w + 0.35, x0 + (i + 1) * w - 0.35];
      range(15).forEach((i) => { const [a, b] = key(i); s += `<path d="${quad(a, b, top, front)}" fill="#fbf8f1"/><path d="${quad(a, b, front, front + 4.5)}" fill="#d6cce2"/>`; });
      const press = (i, color, cls, delay, on) => { const [a, b] = key(i); return `<path class="${cls}"${on ? "" : ' opacity="0"'} style="animation-delay:${delay}s" d="${quad(a + 0.4, b - 0.4, top + 0.5, front - 0.4)}" fill="${color}" fill-opacity=".9"/>`; };
      [[0, 2, 4], [0, 2, 5], [0, 3, 5], [1, 4, 6]].forEach((keys, j) => keys.forEach((i) => { s += press(i, gold, "pn-chord", (j * 0.8).toFixed(1), !j); }));
      melody.forEach(([i], k) => { s += press(i, sky, "pn-note", (k * 0.4).toFixed(1), !k); });
      // 검은 건반: 앞면이 보이도록 몸통 위에 밝은 윗면을 얹는다
      const back = top + 0.62 * (front - top);
      [0, 7].forEach((o) => [[1, -0.12], [2, 0.12], [4, -0.15], [5, 0], [6, 0.15]].forEach(([j, d]) => {
        const c = x0 + (o + j + d) * w, h = 0.29 * w;
        s += `<path d="${quad(c - h, c + h, top, back + 2.6)}" fill="#1d1631"/><path d="${quad(c - h + 0.7, c + h - 0.7, top, back - 0.4)}" fill="#3b3157"/>`;
        s += `<path d="M${X(c - h + 1.3, top)} ${top}L${X(c - h + 1.3, back - 1.4)} ${f(back - 1.4)}" stroke="${W}" stroke-opacity=".3" stroke-width=".5"/>`;
      }));
      return svg(s);
    },
    // 드럼: 객석에서 본 드럼 세트. 오른손잡이 기준이라 하이햇·스네어·크래시는 오른쪽, 플로어 탐·라이드는 왼쪽에 놓이고
    // 베이스 드럼 앞면에는 책 이름을 새겼다. 한 마디 2.4초(100 BPM)의 8비트: 하이햇은 8분음표마다, 킥은 1·3박,
    // 스네어는 2·4박, 4박 뒤 두 탐으로 필인하고 다음 1박에 크래시가 흔들린다.
    drums() {
      const f = (v) => +v.toFixed(2), metal = "#c9ced6";
      const ring = (shape, delay, dur = 2.4, stroke = 'stroke="#fff"') => `<${shape} class="dr-ring" opacity="0" style="animation-delay:${delay}s;animation-duration:${dur}s" fill="none" ${stroke} stroke-width="1.3"/>`;
      const head = (cx, y, rx, ry) => `cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}"`;
      // 원통형 북: 셸, 아래 후프, 러그 세 개, 위 헤드와 후프
      const drum = (cx, y, rx, ry, h) => `<path d="M${cx - rx} ${y}V${y + h}A${rx} ${ry} 0 0 0 ${cx + rx} ${y + h}V${y}Z" fill="url(#dr-shell)"/>`
        + `<path d="M${cx - rx} ${y + h}A${rx} ${ry} 0 0 0 ${cx + rx} ${y + h}" fill="none" stroke="${metal}" stroke-width="1.1"/>`
        + [-0.71, 0, 0.71].map((u) => `<rect x="${f(cx + u * rx - 0.8)}" y="${f(y + h * 0.3)}" width="1.6" height="${f(h * 0.42)}" rx=".8" fill="${metal}"/>`).join("")
        + `<ellipse ${head(cx, y, rx, ry)} fill="#fffaf2" stroke="${metal}" stroke-width="1.4"/><ellipse ${head(cx, y, f(rx * 0.8), f(ry * 0.8))} fill="none" stroke="#000" stroke-opacity=".07"/>`;
      const cymbal = (cx, cy, rx, ry) => `<ellipse ${head(cx, cy, rx, ry)} fill="url(#dr-brass)" stroke="#7a4c0c" stroke-opacity=".5" stroke-width=".5"/>`
        + [0.72, 0.46].map((u) => `<ellipse ${head(cx, cy, f(rx * u), f(ry * u))} fill="none" stroke="#7a4c0c" stroke-opacity=".3" stroke-width=".5"/>`).join("")
        + `<ellipse ${head(cx, f(cy - ry * 0.25), f(rx * 0.2), f(ry * 0.55))} fill="#ffe9a8"/><circle cx="${cx}" cy="${f(cy - ry * 0.45)}" r=".9" fill="#5c3a0a"/>`;
      let s = `<defs><linearGradient id="dr-shell"><stop offset="0" stop-color="#3a0a14"/><stop offset=".22" stop-color="#7d1d2e"/><stop offset=".42" stop-color="#c44a5d"/><stop offset=".6" stop-color="#8d2536"/><stop offset="1" stop-color="#2e0810"/></linearGradient>`
        + `<linearGradient id="dr-brass"><stop offset="0" stop-color="#a8741a"/><stop offset=".3" stop-color="#f2c14e"/><stop offset=".5" stop-color="#fff0b3"/><stop offset=".7" stop-color="#e6aa2e"/><stop offset="1" stop-color="#96620f"/></linearGradient></defs>`;
      s += `<ellipse cx="100" cy="123" rx="92" ry="2.5" fill="#000" fill-opacity=".18"/><path d="M8 123H192" stroke="${W}" stroke-opacity=".25"/>`;
      // 스탠드와 다리: 북보다 먼저 그려 뒤로 숨긴다
      s += `<path d="M44 34 40 123M30 123 40 111 50 123M152 26 158 123M150 123 158 111 166 123M182 48V123M174 123 182 109 190 123M150 86V123M141 123 150 108 159 123M31 80 27 123M65 80 69 123M100 60V51M100 54 89 49M100 54 111 49M77 108 67 123M123 108 133 123" fill="none" stroke="${metal}" stroke-width="1.3" stroke-linecap="round"/>`;
      // 라이드와 크래시: 기울기는 바깥 g가, 흔들림은 안쪽 g가 맡는다
      s += `<g transform="rotate(-10 44 32)">${cymbal(44, 32, 25, 5.4)}</g>`;
      s += `<g transform="rotate(14 152 24)"><g class="dr-crash" style="animation-delay:.01s">${cymbal(152, 24, 21, 4.8)}${ring(`ellipse ${head(152, 24, 21, 4.8)}`, 0.01, 2.4, 'stroke="#ffe9a8"')}</g></g>`;
      // 랙 탐 둘: 바깥으로 살짝 기울고, 마디 끝 필인에서 차례로 울린다
      [[84, -7, 2.1], [116, 7, 2.25]].forEach(([cx, a, t]) => { s += `<g transform="rotate(${a} ${cx} 52)">${drum(cx, 44, 14, 4.6, 15)}${ring(`ellipse ${head(cx, 44, 14, 4.6)}`, t)}</g>`; });
      // 베이스 드럼: 나무 후프와 크롬 인레이, 클로, 검은 앞면 헤드의 금색 고리와 책 이름, 포트 구멍
      let bd = `<circle cx="100" cy="90" r="30" fill="url(#dr-shell)"/>`;
      range(8).forEach((k) => { bd += `<rect x="98.9" y="57.5" width="2.2" height="4.5" rx=".6" fill="${metal}" transform="rotate(${22.5 + k * 45} 100 90)"/>`; });
      bd += `<circle cx="100" cy="90" r="27.6" fill="none" stroke="${metal}" stroke-width=".8"/><circle cx="100" cy="90" r="26.2" fill="#1d0b10"/>`;
      bd += `<circle cx="100" cy="90" r="20.6" fill="none" stroke="#ffd27a" stroke-width="1.2"/><circle cx="100" cy="90" r="19" fill="none" stroke="#ffd27a" stroke-opacity=".6" stroke-width=".5"/>`;
      bd += `<text x="100" y="92.4" text-anchor="middle" font-size="7" font-weight="800" font-style="italic" fill="#fffaf2">DrumBook</text><path d="M86 95.6H114" stroke="#ffd27a" stroke-width=".7"/>`;
      bd += `<circle cx="116.7" cy="106.7" r="2.2" fill="#000" fill-opacity=".5" stroke="${metal}" stroke-width=".7"/>`;
      s += `<g class="dr-kick" style="animation-delay:.01s">${bd}</g>${ring('circle cx="100" cy="90" r="13"', 0.01, 1.2, 'stroke="#ffd27a"')}`;
      // 플로어 탐(왼쪽), 스네어(오른쪽)
      s += drum(48, 72, 17, 5, 28) + drum(150, 76, 15, 4.5, 10) + ring(`ellipse ${head(150, 76, 15, 4.5)}`, 0.6, 1.2);
      // 하이햇: 아래 심벌은 고정, 위 심벌은 8분음표마다 살짝 눌렸다 올라온다
      s += cymbal(182, 61, 14, 2.4) + `<g class="dr-hat" style="animation-delay:.01s">${cymbal(182, 57.5, 14, 2.6)}</g>`;
      return svg(s);
    },
    // DRAM 셀 어레이: 워드라인·비트라인 위에서 비트가 깜박인다
    memory() {
      const r = rnd(7); let s = "";
      range(5).forEach((j) => { s += `<line x1="18" x2="196" y1="${18 + j * 22}" y2="${18 + j * 22}" stroke="${W}" stroke-opacity=".25"/>`; });
      range(9).forEach((i) => { s += `<line y1="6" y2="124" x1="${26 + i * 20}" x2="${26 + i * 20}" stroke="${W}" stroke-opacity=".18"/>`; });
      range(5).forEach((j) => range(9).forEach((i) => {
        const on = r() > 0.45, x = 26 + i * 20, y = 18 + j * 22;
        s += `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" rx="2.5" fill="${W}" fill-opacity="${on ? 0.85 : 0.12}" stroke="${W}" stroke-opacity=".5"${on && r() > 0.5 ? ` class="cv-blink" style="animation-delay:${(r() * 2).toFixed(2)}s"` : ""}/>`;
      }));
      return svg(s);
    },
    // 베이어 컬러 필터 + 마이크로렌즈, 위에서 광자가 떨어진다
    pixel() {
      const C = { R: "#ff8a8a", G: "#7deaa0", B: "#8ab4ff" }; let s = "";
      range(4).forEach((j) => range(7).forEach((i) => {
        const k = j % 2 ? (i % 2 ? "B" : "G") : (i % 2 ? "G" : "R");
        const x = 34 + i * 22, y = 40 + j * 22;
        s += `<rect x="${x}" y="${y}" width="20" height="20" rx="2" fill="${C[k]}" fill-opacity=".8"/><circle cx="${x + 10}" cy="${y + 10}" r="8.5" fill="${W}" fill-opacity=".14" stroke="${W}" stroke-opacity=".55"/>`;
      }));
      [52, 96, 140, 118, 74, 162].forEach((x, k) => {
        s += `<circle class="cv-fall" style="animation-delay:${k * 0.35}s" cx="${x}" cy="14" r="2.6" fill="${W}"/>`;
      });
      return svg(s);
    },
    // FinFET 단면: 기판·핀·게이트가 한 층씩 쌓인다
    layers() {
      let s = `<rect x="10" y="100" width="190" height="30" fill="${W}" fill-opacity=".22"/>`;
      s += `<rect x="10" y="86" width="190" height="14" fill="${W}" fill-opacity=".12"/>`;
      [44, 92, 140].forEach((x) => { s += `<rect x="${x}" y="46" width="16" height="54" rx="2" fill="${W}" fill-opacity=".7"/>`; });
      s += `<path class="cv-grow" d="M30 86 V38 Q30 30 38 30 H164 Q172 30 172 38 V86 H162 V42 H150 V86 H134 V42 H118 V86 H102 V42 H86 V86 H70 V42 H58 V86 Z" fill="${W}" fill-opacity=".32" stroke="${W}" stroke-opacity=".7"/>`;
      s += `<rect x="20" y="14" width="162" height="8" rx="2" fill="${W}" fill-opacity=".45"/>`;
      range(6).forEach((i) => { s += `<rect x="${30 + i * 26}" y="22" width="6" height="8" fill="${W}" fill-opacity=".5"/>`; });
      return svg(s);
    },
    // 이하 fab·process·etch는 SemiBooks에서 만들어 books 포털과 함께 쓰는 표지다. 움직임은 .fb-·.pr-·.et- 클래스가 맡고,
    // 애니메이션이 없을 때(동작 줄이기)도 그 자체로 완성된 그림이 되도록 기본 도형을 첫 프레임과 같게 그린다.
    // 팹 인프라 단면: FFU가 내려보낸 공기는 바닥 구멍을 지나 양쪽 샤프트를 타고 천장으로 돌아가고,
    // 천장 레일의 OHT는 FOUP을 장비 앞 로드 포트에 내려놓는다. 바닥 아래 배관은 초순수와 가스를 장비로 올려 보낸다.
    fab() {
      const flow = (d, k, o, dur) => `<path class="cv-flow" style="animation-duration:${dur}s;animation-delay:-${(k * 0.19).toFixed(2)}s" d="${d}" fill="none" stroke="${W}" stroke-opacity="${o}" stroke-width="1.2" stroke-dasharray="4 6"/>`;
      let s = `<rect x="6" y="121" width="194" height="5" rx="1" fill="${W}" fill-opacity=".3"/>`;
      s += `<rect x="22" y="12" width="168" height="109" rx="2" fill="${W}" fill-opacity=".06" stroke="${W}" stroke-opacity=".5" stroke-width="1.3"/>`;
      s += `<rect x="23" y="86" width="166" height="34.4" fill="#000" fill-opacity=".16"/>`;
      s += `<rect x="18" y="8" width="176" height="5" rx="1.5" fill="${W}" fill-opacity=".6"/>`;
      [40, 150].forEach((x) => { s += `<rect x="${x}" y="2" width="22" height="6" rx="1" fill="${W}" fill-opacity=".42"/>`; });
      // 되돌아가는 공기: 바닥 아래에서 양쪽 샤프트를 타고 천장 플레넘으로
      s += flow("M100 91 H27 V17 H98", 0, ".3", 2.4) + flow("M112 91 H185 V17 H114", 3, ".3", 2.4);
      range(6).forEach((i) => { s += `<rect x="${36 + i * 24}" y="20" width="20" height="5" rx="1" fill="${W}" fill-opacity=".62"/>`; });
      s += `<path d="M32 25 V80 M180 25 V80" stroke="${W}" stroke-opacity=".35" stroke-width="1.2"/>`;
      // 장비 세 대: 낮은 장비, 노광기처럼 높은 장비와 그 앞 로드 포트, 작은 장비
      s += `<rect x="40" y="52" width="32" height="28" rx="1.5" fill="${W}" fill-opacity=".5"/>`;
      s += `<rect x="112" y="42" width="34" height="38" rx="1.5" fill="${W}" fill-opacity=".62"/>`;
      s += `<rect x="96" y="58" width="16" height="2.5" fill="${W}" fill-opacity=".85"/><rect x="102" y="60.5" width="4" height="19.5" fill="${W}" fill-opacity=".3"/>`;
      s += `<rect x="154" y="56" width="22" height="24" rx="1.5" fill="${W}" fill-opacity=".48"/>`;
      [[44, 47, 0], [158, 51, 0.8]].forEach(([x, y, d]) => { s += `<rect class="cv-blink" style="animation-delay:-${d}s" x="${x}" y="${y}" width="4" height="4" rx="1" fill="#9be7ff"/>`; });
      // 층류: 장비 윗면이나 바닥까지 곧게 내려간다
      [[36, 79], [56, 51], [84, 79], [129, 41], [150, 79], [177, 79]].forEach(([x, y], k) => { s += flow(`M${x} 26 V${y}`, k, ".62", 1.3); });
      s += `<path d="M34 31 H178" stroke="${W}" stroke-opacity=".7" stroke-width="1.6"/>`;
      [50, 90, 130, 170].forEach((x) => { s += `<path d="M${x} 25 V31" stroke="${W}" stroke-opacity=".35"/>`; });
      // OHT: 레일을 따라 가다 로드 포트 위에서 멈추고 FOUP을 내렸다 올린다
      const oht = "animation-delay:-1.2s";
      s += `<g class="fb-oht" style="--dx:120px;${oht}"><rect x="36" y="31.5" width="16" height="6.5" rx="1.4" fill="${W}"/>`;
      s += `<path class="fb-belt" style="${oht}" d="M39.5 38h.8v2h-.8zM47.7 38h.8v2h-.8z" fill="${W}" fill-opacity=".85"/>`;
      s += `<rect class="fb-hoist" style="${oht}" x="38" y="40" width="12" height="8" rx="1.6" fill="${W}" fill-opacity=".9"/></g>`;
      // 이중 바닥과 서브팹: 초순수·가스 헤더, 장비로 올라가는 배관, 진공 펌프와 스크러버
      s += `<rect x="32" y="80" width="148" height="6" fill="${W}" fill-opacity=".38"/>`;
      range(21).forEach((i) => { s += `<rect x="${35 + i * 7}" y="81.5" width="3" height="3" fill="#000" fill-opacity=".28"/>`; });
      [["#9be7ff", 100, [58, 166]], ["#ffd27a", 106, [128]]].forEach(([c, y, risers]) => {
        [`M36 ${y} H176`, ...risers.map((x) => `M${x} ${y} V80`)].forEach((d) => {
          s += `<path d="${d}" stroke="${c}" stroke-opacity=".4" stroke-width="2" fill="none"/><path class="cv-flow" style="animation-duration:1.7s" d="${d}" stroke="${c}" stroke-width="2" stroke-dasharray="3 7" fill="none"/>`;
        });
      });
      [[44, 16], [118, 18]].forEach(([x, w]) => { s += `<rect x="${x}" y="110" width="${w}" height="10" rx="2.5" fill="${W}" fill-opacity=".5"/>`; });
      s += `<rect x="148" y="108" width="22" height="12" rx="1.5" fill="${W}" fill-opacity=".4"/>`;
      return svg(s);
    },
    // 제조 공정: 막을 쌓고(증착) 빛으로 무늬를 옮기고(노광) 깎고(식각) 이온을 심고(주입) 배선을 이으면(배선)
    // 트랜지스터 하나가 완성된다. 위의 다섯 점이 지금 단계를 따라가고, 멈춰 있을 때는 완성된 단면을 보여 준다.
    process() {
      const T = 7, at = (o) => `animation-delay:-${(T - o).toFixed(2)}s`;
      let s = `<rect x="58" y="9" width="120" height="2" rx="1" fill="${W}" fill-opacity=".28"/>`;
      s += `<rect class="pr-progress" x="58" y="9" width="120" height="2" rx="1" fill="${W}" fill-opacity=".9"/>`;
      range(5).forEach((i) => { s += `<circle cx="${58 + i * 30}" cy="10" r="3.6" fill="${W}" fill-opacity=".45"/>`; });
      s += `<circle class="pr-node" cx="178" cy="10" r="5.2" fill="${W}"/>`;
      // 기판과 소자 분리막, 소스·드레인, 마지막 단계에 덮이는 층간 절연막
      s += `<rect x="36" y="88" width="160" height="36" fill="${W}" fill-opacity=".22"/>`;
      s += `<path d="M36 88h14v16h-14zM182 88h14v16h-14z" fill="${W}" fill-opacity=".45"/>`;
      s += `<path class="pr-sd" d="M50 88 H98 V94 A5 5 0 0 1 93 99 H50 Z M182 88 H134 V94 A5 5 0 0 0 139 99 H182 Z" fill="${W}" fill-opacity=".6"/>`;
      s += `<rect class="pr-ild" x="36" y="58" width="160" height="30" fill="${W}" fill-opacity=".1"/>`;
      // 막: 양옆은 식각으로 사라지고 가운데만 게이트로 남는다
      s += `<path class="pr-film" opacity="0" d="M50 76 H100 V88 H50 Z M132 76 H182 V88 H132 Z" fill="${W}" fill-opacity=".7"/>`;
      s += `<rect class="pr-gate" x="100" y="76" width="32" height="12" fill="${W}" fill-opacity=".7"/>`;
      s += `<path class="pr-spacer" d="M100 77 Q95 80 94 88 H100 Z M132 77 Q137 80 138 88 H132 Z" fill="${W}" fill-opacity=".42"/>`;
      s += `<path class="pr-contact" d="M70 58 H76 V88 H70 Z M156 58 H162 V88 H156 Z" fill="${W}" fill-opacity=".85"/><rect class="pr-contact" x="113" y="58" width="6" height="18" fill="${W}" fill-opacity=".85"/>`;
      s += `<path class="pr-metal" d="M60 52 H86 V58 H60 Z M104 52 H128 V58 H104 Z M146 52 H172 V58 H146 Z" fill="${W}" fill-opacity=".95"/>`;
      // 감광막과 마스크, 마스크의 투명한 부분을 지나는 빛
      s += `<path class="pr-resist-s" opacity="0" d="M50 70 H100 V76 H50 Z M132 70 H182 V76 H132 Z" fill="#ffe8a3" fill-opacity=".9"/>`;
      s += `<rect class="pr-resist-c" opacity="0" x="100" y="70" width="32" height="6" fill="#ffe8a3" fill-opacity=".9"/>`;
      s += `<g class="pr-mask" opacity="0"><rect x="50" y="34" width="132" height="5" fill="${W}" fill-opacity=".16" stroke="${W}" stroke-opacity=".55" stroke-width=".8"/><rect x="100" y="34" width="32" height="5" fill="${W}"/></g>`;
      [58, 70, 82, 94, 138, 150, 162, 174].forEach((x, k) => { s += `<path class="pr-ray" opacity="0" style="animation-delay:0s,-${((k % 4) * 0.2).toFixed(1)}s" d="M${x} 16 V69" stroke="#fff3bf" stroke-width="1.6" stroke-dasharray="4 6" fill="none"/>`; });
      // 식각 이온은 열린 곳만, 주입 이온은 게이트 양옆에만 떨어진다(자기 정렬)
      [64, 80, 152, 168].forEach((x, k) => [0, 0.36].forEach((o) => { s += `<rect class="pr-etch" opacity="0" style="${at(o + k * 0.09)}" x="${x - 0.7}" y="40" width="1.4" height="7" rx=".7" fill="${W}"/>`; }));
      [60, 74, 88, 144, 158, 172].forEach((x, k) => [0, 0.4].forEach((o) => { s += `<circle class="pr-ion" opacity="0" style="${at(o + (k % 3) * 0.12 + (k > 2 ? 0.06 : 0))}" cx="${x}" cy="18" r="2" fill="${W}"/>`; }));
      return svg(s);
    },
    // 플라스마 식각: 빛나는 플라스마의 이온이 시스를 지나 수직으로 내리꽂혀 마스크 사이를 깎는다.
    // 좁은 구멍일수록 덜 깎이고(ARDE), 옆벽에는 보호막이 쌓이며, 휘발성 부산물은 위로 빠져나간다.
    etch() {
      const open = [[60, 16, 1], [98, 12, 0.82], [132, 9, 0.64], [163, 6, 0.45]]; // x, 폭, 최종 깊이 비율
      const mask = [[38, 60], [76, 98], [110, 132], [141, 163], [169, 196]];
      let s = `<rect x="38" y="3" width="158" height="5" rx="1.5" fill="${W}" fill-opacity=".55"/>`;
      s += `<g class="et-glow"><ellipse cx="117" cy="22" rx="80" ry="12" fill="${W}" fill-opacity=".1"/><ellipse cx="117" cy="22" rx="62" ry="8.5" fill="${W}" fill-opacity=".12"/><ellipse class="cv-pulse" cx="117" cy="22" rx="40" ry="5" fill="#f3d9fa" fill-opacity=".5"/></g>`;
      [[70, 20], [96, 27], [128, 17], [150, 26], [172, 21]].forEach(([x, y], k) => { s += `<circle class="et-drift" style="animation-delay:-${(k * 0.5).toFixed(1)}s" cx="${x}" cy="${y}" r="1.6" fill="${W}" fill-opacity=".85"/>`; });
      s += `<path d="M38 40 H196" stroke="${W}" stroke-opacity=".28" stroke-dasharray="2 3"/>`;
      s += `<rect x="38" y="102" width="158" height="19" fill="${W}" fill-opacity=".2"/><rect x="34" y="121" width="166" height="5" rx="1.5" fill="${W}" fill-opacity=".5"/>`;
      mask.forEach(([a, b]) => { s += `<rect x="${a}" y="62" width="${b - a}" height="40" fill="${W}" fill-opacity=".4"/><rect x="${a}" y="56" width="${b - a}" height="6" fill="${W}" fill-opacity=".9"/>`; });
      // 열린 곳의 남은 막은 위에서부터 깎이고, 깎인 만큼 옆벽 보호막이 따라 내려간다. 기본 도형은 70% 깎인 모습이고
      // 키프레임은 그 높이에 대한 배율이다: --k1은 다 깎였을 때, --kf는 새 막을 채웠을 때.
      open.forEach(([x, w, d]) => {
        const s0 = 1 - 0.7 * d, h = 40 * s0;
        s += `<rect class="et-front" style="--k1:${((1 - d) / s0).toFixed(3)};--kf:${(1 / s0).toFixed(3)}" x="${x}" y="${(102 - h).toFixed(1)}" width="${w}" height="${h.toFixed(1)}" fill="${W}" fill-opacity=".4"/>`;
        [x, x + w - 1.2].forEach((wx) => { s += `<rect class="et-wall" x="${wx}" y="62" width="1.2" height="${(28 * d).toFixed(1)}" fill="${W}" fill-opacity=".8"/>`; });
      });
      s += `<g class="et-gate">`;
      open.forEach(([x, w, d], i) => [0, 0.45].forEach((o) => {
        s += `<rect class="et-ion" style="--dy:${(62 + 40 * d * 0.85 - 35).toFixed(1)}px;animation-delay:-${(o + i * 0.21).toFixed(2)}s" x="${x + w / 2 - 0.7}" y="28" width="1.4" height="7" rx=".7" fill="${W}"/>`;
      }));
      s += `</g>`;
      open.forEach(([x, w], i) => { s += `<circle class="et-out" opacity="0" style="--ox:${i % 2 ? 6 : -6}px;animation-delay:-${(i * 0.55).toFixed(2)}s" cx="${x + w / 2}" cy="74" r="1.8" fill="#ffe8a3"/>`; });
      return svg(s);
    },
    // 인과적 어텐션 히트맵
    attention() {
      const r = rnd(11); let s = ""; const n = 7, p = 15, x0 = 74, y0 = 14;
      range(n).forEach((i) => range(n).forEach((j) => {
        const x = x0 + j * p, y = y0 + i * p;
        if (j > i) { s += `<rect x="${x}" y="${y}" width="13" height="13" rx="2" fill="none" stroke="${W}" stroke-opacity=".18"/>`; return; }
        const a = j === i ? 0.9 : 0.15 + r() * 0.6;
        s += `<rect class="cv-pulse" style="animation-delay:${((i + j) * 0.12).toFixed(2)}s" x="${x}" y="${y}" width="13" height="13" rx="2" fill="${W}" fill-opacity="${a.toFixed(2)}"/>`;
      }));
      return svg(s);
    },
    // 조리개 날개: 육각형 개구가 열리고 닫힌다
    aperture() {
      const cx = 132, cy = 65; let s = "";
      s += `<circle cx="${cx}" cy="${cy}" r="56" fill="none" stroke="${W}" stroke-opacity=".3" stroke-width="6"/>`;
      s += `<circle cx="${cx}" cy="${cy}" r="46" fill="${W}" fill-opacity=".28"/>`;
      const hex = range(6).map((k) => { const a = (Math.PI / 3) * k + 0.3; return `${(cx + 22 * Math.cos(a)).toFixed(1)},${(cy + 22 * Math.sin(a)).toFixed(1)}`; }).join(" ");
      let blades = "";
      range(6).forEach((k) => {
        const a = (Math.PI / 3) * k + 0.3, b = a + 1.25;
        blades += `<line x1="${(cx + 22 * Math.cos(a)).toFixed(1)}" y1="${(cy + 22 * Math.sin(a)).toFixed(1)}" x2="${(cx + 46 * Math.cos(b)).toFixed(1)}" y2="${(cy + 46 * Math.sin(b)).toFixed(1)}" stroke="${W}" stroke-opacity=".75" stroke-width="1.4"/>`;
      });
      s += `<g class="cv-iris" style="transform-origin:${cx}px ${cy}px"><polygon points="${hex}" fill="#000" fill-opacity=".35" stroke="${W}" stroke-width="1.4"/>${blades}</g>`;
      return svg(s);
    },
    // 논리 게이트 회로: 신호가 선을 따라 흐른다
    logic() {
      const and = (x, y) => `<path d="M${x} ${y} h14 a14 14 0 0 1 0 28 h-14 z" fill="${W}" fill-opacity=".22" stroke="${W}" stroke-width="1.5"/>`;
      const or = (x, y) => `<path d="M${x} ${y} q10 14 0 28 q24 2 34 -14 q-10 -16 -34 -14 z" fill="${W}" fill-opacity=".22" stroke="${W}" stroke-width="1.5"/>`;
      let s = and(70, 18) + and(70, 84) + or(126, 51);
      const wires = ["M20 24 H70", "M20 40 H70", "M20 90 H70", "M20 106 H70", "M98 32 H112 V58 H128", "M98 98 H112 V72 H128", "M160 65 H196"];
      wires.forEach((d) => { s += `<path d="${d}" fill="none" stroke="${W}" stroke-opacity=".35" stroke-width="1.5"/><path class="cv-flow" d="${d}" fill="none" stroke="${W}" stroke-width="2" stroke-dasharray="6 14"/>`; });
      [24, 40, 90, 106].forEach((y) => { s += `<circle cx="20" cy="${y}" r="3" fill="${W}"/>`; });
      return svg(s);
    },
    // 표준 셀 배치와 배선
    circuit() {
      const r = rnd(5); let s = "";
      range(4).forEach((j) => {
        let x = 40;
        while (x < 190) { const w = 10 + Math.round(r() * 22); if (x + w > 196) break; s += `<rect x="${x}" y="${16 + j * 28}" width="${w}" height="16" rx="1.5" fill="${W}" fill-opacity="${(0.15 + r() * 0.35).toFixed(2)}" stroke="${W}" stroke-opacity=".4"/>`; x += w + 4; }
      });
      ["M44 32 V44 H120 V60", "M88 60 V72 H170 V88", "M60 88 V100 H140 V116"].forEach((d) => { s += `<path class="cv-flow" d="${d}" fill="none" stroke="${W}" stroke-width="1.6" stroke-dasharray="5 8"/>`; });
      return svg(s);
    },
    // 2.5D 패키지: 기판·인터포저 위에 HBM이 쌓인다
    package() {
      let s = `<rect x="16" y="108" width="180" height="12" rx="2" fill="${W}" fill-opacity=".3"/><rect x="30" y="94" width="152" height="9" rx="1.5" fill="${W}" fill-opacity=".45"/>`;
      range(18).forEach((i) => { s += `<circle cx="${36 + i * 8.4}" cy="105.5" r="2" fill="${W}" fill-opacity=".7"/>`; });
      s += `<rect x="40" y="62" width="58" height="30" rx="2" fill="${W}" fill-opacity=".55"/>`;
      range(6).forEach((k) => { s += `<rect class="cv-drop" style="animation-delay:${(5 - k) * 0.12}s" x="114" y="${84 - k * 11}" width="54" height="8" rx="1.5" fill="${W}" fill-opacity="${(0.35 + k * 0.08).toFixed(2)}"/>`; });
      [126, 141, 156].forEach((x) => { s += `<line x1="${x}" x2="${x}" y1="20" y2="92" stroke="#000" stroke-opacity=".25" stroke-width="1.5"/>`; });
      return svg(s);
    },
    // 자동차와 레이더 파면
    car() {
      let s = `<path d="M20 92 h18 a10 10 0 0 1 20 0 h50 a10 10 0 0 1 20 0 h12 v-18 l-14 -6 l-18 -18 h-46 l-22 22 l-20 4 z" fill="${W}" fill-opacity=".45" stroke="${W}" stroke-width="1.5"/>`;
      s += `<circle cx="48" cy="94" r="8" fill="${W}" fill-opacity=".8"/><circle cx="118" cy="94" r="8" fill="${W}" fill-opacity=".8"/>`;
      [0, 1, 2].forEach((k) => { s += `<path class="cv-wave" style="animation-delay:${k * 0.5}s" d="M150 ${58 - k * 12} q${14 + k * 10} ${18 + k * 12} 0 ${36 + k * 24}" fill="none" stroke="${W}" stroke-width="2"/>`; });
      return svg(s);
    },
    // 웨이퍼 맵: 가장자리 고리 모양으로 불량 다이가 몰려 있다
    wafermap() {
      const cx = 130, cy = 65, r = 58, p = 11; let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${W}" fill-opacity=".14" stroke="${W}" stroke-opacity=".6"/>`;
      for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
        const x = cx + i * p, y = cy + j * p, far = Math.hypot(Math.abs(i * p) + p / 2, Math.abs(j * p) + p / 2);
        if (far > r - 2) continue;
        const ring = Math.hypot(i, j) > 3.6;
        s += `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" rx="1.5" fill="${ring ? "#ff6b6b" : W}" fill-opacity="${ring ? 0.9 : 0.55}"${ring ? ` class="cv-blink" style="animation-delay:${((i + j + 10) * 0.07).toFixed(2)}s"` : ""}/>`;
      }
      return svg(s);
    },
    // 노광: 마스크를 지난 빛이 렌즈에 모여 웨이퍼에 선을 새긴다
    litho() {
      let s = `<rect x="60" y="10" width="130" height="7" rx="1.5" fill="${W}" fill-opacity=".85"/>`;
      [72, 104, 136, 168].forEach((x) => { s += `<rect x="${x}" y="10" width="14" height="7" fill="#000" fill-opacity=".35"/>`; });
      s += `<ellipse cx="125" cy="52" rx="58" ry="9" fill="${W}" fill-opacity=".3" stroke="${W}" stroke-opacity=".7"/>`;
      [70, 98, 125, 152, 180].forEach((x, k) => {
        s += `<path class="cv-flow" style="animation-delay:${k * 0.15}s" d="M${x} 18 L${x} 46 L${100 + k * 12.5} 98" fill="none" stroke="${W}" stroke-opacity=".7" stroke-width="1.4" stroke-dasharray="5 7"/>`;
      });
      s += `<rect x="60" y="100" width="130" height="22" fill="${W}" fill-opacity=".22"/>`;
      [92, 108, 124, 140, 156].forEach((x) => { s += `<rect class="cv-grow" x="${x}" y="90" width="7" height="10" rx="1" fill="${W}" fill-opacity=".85"/>`; });
      return svg(s);
    },
    // 이온 주입: 빔이 실리콘 격자로 쏟아지고, 박힌 도펀트가 깊이 방향 종 모양 분포를 이룬다
    implant() {
      const r = rnd(11); let s = "";
      s += `<rect x="78" y="6" width="64" height="10" rx="3" fill="${W}" fill-opacity=".6"/>`;
      s += `<path d="M84 16 L66 60 H154 L136 16 Z" fill="${W}" fill-opacity=".1"/>`;
      range(5).forEach((k) => {
        const x = 90 + k * 10;
        s += `<path class="cv-flow" style="animation-delay:${k * 0.2}s" d="M${x} 18 L${x + (x - 110) * 0.8} 58" fill="none" stroke="${W}" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="4 6"/>`;
      });
      s += `<rect x="10" y="62" width="190" height="68" fill="${W}" fill-opacity=".12"/>`;
      range(5).forEach((j) => range(14).forEach((i) => {
        s += `<circle cx="${18 + i * 13.5}" cy="${70 + j * 12}" r="1.6" fill="${W}" fill-opacity=".35"/>`;
      }));
      range(26).forEach(() => {
        const g = (r() + r() + r() - 1.5) * 2;
        s += `<circle cx="${(62 + r() * 96).toFixed(1)}" cy="${(84 + g * 9).toFixed(1)}" r="2.6" fill="${W}" fill-opacity=".85"/>`;
      });
      [76, 98, 120, 142].forEach((x, k) => {
        s += `<circle class="cv-fall" style="animation-delay:${k * 0.45}s" cx="${x}" cy="30" r="2.4" fill="${W}"/>`;
      });
      return svg(s);
    },
    // 불량 분석: 배선 위를 훑는 돋보기와 빛나는 결함 한 점
    probe() {
      let s = "";
      [26, 50, 74, 98].forEach((y, k) => { s += `<rect x="${60 + (k % 2) * 14}" y="${y}" width="${118 - (k % 2) * 20}" height="7" rx="2" fill="${W}" fill-opacity=".35"/>`; });
      [84, 118, 152].forEach((x) => { s += `<rect x="${x}" y="26" width="7" height="79" fill="${W}" fill-opacity=".22"/>`; });
      s += `<circle class="cv-pulse" cx="121" cy="77" r="6" fill="#ff6b6b"/><circle cx="121" cy="77" r="13" fill="#ff6b6b" fill-opacity=".25"/>`;
      s += `<g class="cv-scan-lens"><circle cx="121" cy="77" r="24" fill="none" stroke="${W}" stroke-width="3"/><line x1="138" y1="94" x2="156" y2="112" stroke="${W}" stroke-width="5" stroke-linecap="round"/></g>`;
      return svg(s);
    },
    // SoC: 다이 평면도 위의 블록들, 블록 사이로 데이터가 오간다
    soc() {
      const blocks = [[64, 10, 40, 34, 0.75], [108, 10, 30, 34, 0.5], [142, 10, 46, 52, 0.85], [64, 48, 74, 14, 0.35], [64, 66, 50, 34, 0.6], [118, 66, 70, 16, 0.45], [118, 86, 70, 14, 0.3], [64, 104, 124, 16, 0.4]];
      let s = `<rect x="58" y="4" width="136" height="122" rx="4" fill="#000" fill-opacity=".18" stroke="${W}" stroke-opacity=".6"/>`;
      blocks.forEach(([x, y, w, h, o], k) => { s += `<rect class="cv-pulse" style="animation-delay:${(k * 0.25).toFixed(2)}s" x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${W}" fill-opacity="${o}"/>`; });
      s += `<path class="cv-flow" d="M84 44 V56 H165 V62 M89 100 V112 H150" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="2" stroke-dasharray="4 6"/>`;
      return svg(s);
    },
    // 디스플레이: RGB 서브픽셀이 켜졌다 꺼진다
    subpixel() {
      const C = ["#ff7a8a", "#7deaa0", "#8ab4ff"]; let s = "";
      range(4).forEach((j) => range(6).forEach((i) => range(3).forEach((k) => {
        const x = 62 + i * 21 + k * 6.5, y = 10 + j * 28;
        s += `<rect class="cv-pulse" style="animation-delay:${(((i + j) % 4) * 0.3 + k * 0.1).toFixed(2)}s" x="${x}" y="${y}" width="5" height="24" rx="1.5" fill="${C[k]}" fill-opacity=".85"/>`;
      })));
      return svg(s);
    },
    // 테스트: 프로브 바늘이 내려와 닿으면 셔무 플롯의 열이 하나씩 판정된다
    shmoo() {
      const x0 = 74, y0 = 16, p = 12, cols = 10, rows = 8; let s = "";
      s += `<path d="M${x0 - 5} ${y0 - 4}V${y0 + rows * p + 2}H${x0 + cols * p + 4}" fill="none" stroke="${W}" stroke-opacity=".6" stroke-width="1.2"/>`;
      s += `<text x="${x0 - 12}" y="${y0 + 4}" fill="${W}" fill-opacity=".75" font-size="8" font-family="monospace">V</text><text x="${x0 + cols * p - 10}" y="${y0 + rows * p + 11}" fill="${W}" fill-opacity=".75" font-size="8" font-family="monospace">F</text>`;
      range(cols).forEach((i) => range(rows).forEach((j) => {
        const v = 1 - j / (rows - 1), f = i / (cols - 1);
        const pass = v > 0.12 + 0.75 * f ** 1.7 && !(v > 0.9 && f > 0.75);
        s += `<rect class="cv-hit" style="animation-delay:${(0.15 + i * 0.24).toFixed(2)}s" x="${x0 + i * p}" y="${y0 + j * p}" width="10" height="10" rx="1.5" fill="${pass ? "#7deaa0" : "#ff7a8a"}" fill-opacity="${pass ? 0.85 : 0.5}"/>`;
      }));
      s += `<g class="cv-sweep" style="--dx:${cols * p}px"><rect x="${x0 - 1}" y="${y0 - 2}" width="12" height="${rows * p + 2}" rx="2" fill="${W}" fill-opacity=".16" stroke="${W}" stroke-opacity=".8"/>`;
      s += `<path d="M${x0 + 5} ${y0 - 14}V${y0 - 4}" stroke="${W}" stroke-width="1.6"/><path d="M${x0 - 1} ${y0 - 14}h12" stroke="${W}" stroke-width="2.4" stroke-linecap="round"/></g>`;
      return svg(s);
    },
    // 스마트폰: 유리·디스플레이·보드·배터리·뒷판이 비스듬히 분해되어 떠 있다
    phone() {
      let s = "";
      const layers = [[0.28, "none"], [0.5, "screen"], [0.4, "board"], [0.55, "battery"], [0.22, "back"]];
      layers.forEach(([o, kind], k) => {
        const x = 70 + k * 18, y = 6 + k * 12;
        s += `<g class="cv-drop" style="animation-delay:${(k * 0.12).toFixed(2)}s"><rect x="${x}" y="${y}" width="62" height="96" rx="9" fill="${W}" fill-opacity="${o}" stroke="${W}" stroke-opacity=".7"/>`;
        if (kind === "board") s += `<rect x="${x + 8}" y="${y + 8}" width="20" height="14" rx="2" fill="#000" fill-opacity=".3"/><rect x="${x + 34}" y="${y + 8}" width="18" height="30" rx="2" fill="#000" fill-opacity=".2"/>`;
        if (kind === "battery") s += `<rect x="${x + 10}" y="${y + 30}" width="42" height="52" rx="4" fill="#000" fill-opacity=".18"/>`;
        if (kind === "back") s += `<rect x="${x + 6}" y="${y + 6}" width="20" height="20" rx="5" fill="#000" fill-opacity=".3"/>`;
        s += `</g>`;
      });
      return svg(s);
    },
    // 소자 물리: pn 접합의 에너지 밴드가 휘고, 전자와 정공이 떠 있다
    band() {
      let s = "";
      [[30, "Ec"], [74, "Ev"]].forEach(([y, label]) => {
        s += `<path class="cv-grow" d="M64 ${y} H112 C130 ${y} 134 ${y + 26} 152 ${y + 26} H196" fill="none" stroke="${W}" stroke-width="2.5"/>`;
        s += `<text x="62" y="${y - 5}" fill="${W}" fill-opacity=".7" font-size="9" font-family="monospace">${label}</text>`;
      });
      s += `<line x1="64" y1="60" x2="196" y2="60" stroke="${W}" stroke-opacity=".6" stroke-dasharray="4 4"/>`;
      [160, 172, 184].forEach((x, k) => { s += `<circle class="cv-pulse" style="animation-delay:${k * 0.3}s" cx="${x}" cy="49" r="3.2" fill="#8ab4ff"/>`; });
      [72, 86, 100].forEach((x, k) => { s += `<circle class="cv-pulse" style="animation-delay:${k * 0.3 + 0.15}s" cx="${x}" cy="82" r="3.2" fill="none" stroke="#ff8a8a" stroke-width="1.6"/>`; });
      s += `<rect x="112" y="16" width="40" height="104" fill="${W}" fill-opacity=".1"/>`;
      return svg(s);
    },
    // TCAD: 접합 근처가 촘촘한 격자 위의 MOSFET 단면, 드레인 쪽 등전위선이 숨 쉬고 채널로 전자가 흐른다
    tcad() {
      const xs = [64, 76, 86, 94, 99, 102, 105, 110, 118, 130, 142, 150, 155, 158, 161, 166, 174, 184, 196];
      const ys = [30, 32, 35, 39, 44, 51, 60, 72, 88, 106, 124];
      let s = `<rect x="64" y="30" width="132" height="94" fill="${W}" fill-opacity=".08"/>`;
      s += `<path d="M64 30H104C104 48 97 56 82 56H64Z" fill="${W}" fill-opacity=".34"/><path d="M196 30H156C156 48 163 56 178 56H196Z" fill="${W}" fill-opacity=".34"/>`;
      xs.forEach((x) => { s += `<path d="M${x} 30V124" stroke="${W}" stroke-opacity=".2" stroke-width=".6"/>`; });
      ys.forEach((y) => { s += `<path d="M64 ${y}H196" stroke="${W}" stroke-opacity=".2" stroke-width=".6"/>`; });
      s += `<svg x="64" y="30" width="132" height="94" viewBox="64 30 132 94" overflow="hidden">`;
      [34, 46, 58].forEach((r, k) => {
        const dy = (Math.sqrt(r * r - 24 * 24) * 0.9).toFixed(1);
        s += `<path class="cv-breathe" style="animation-delay:${(k * 0.25).toFixed(2)}s" d="M${172 - r} 30A${r} ${(r * 0.9).toFixed(1)} 0 0 0 196 ${(30 + +dy).toFixed(1)}" fill="none" stroke="#ffd27a" stroke-opacity="${(0.9 - k * 0.2).toFixed(2)}" stroke-width="1.3"/>`;
      });
      s += `</svg><rect x="104" y="26" width="52" height="4" fill="${W}" fill-opacity=".5"/><rect x="108" y="12" width="44" height="14" rx="1.5" fill="${W}" fill-opacity=".9"/>`;
      s += `<rect x="70" y="21" width="24" height="9" rx="1.5" fill="${W}" fill-opacity=".7"/><rect x="166" y="21" width="24" height="9" rx="1.5" fill="${W}" fill-opacity=".7"/>`;
      range(4).forEach((k) => { s += `<circle class="cv-run" style="--dx:50px;animation-delay:-${(k * 0.4).toFixed(1)}s" cx="105" cy="33.5" r="2.2" fill="#8ab4ff"/>`; });
      return svg(s);
    },
    // 아날로그: 비반전 증폭기, 작은 입력 사인파가 큰 출력 사인파로 흘러 나간다
    analog() {
      const zig = (dx, dy, n = 4) => range(n).map((k) => `l${(dx / n / 2).toFixed(1)} ${k % 2 ? -dy : dy} l${(dx / n / 2).toFixed(1)} ${k % 2 ? dy : -dy}`).join(" ");
      let s = "";
      range(5).forEach((i) => { s += `<path d="M140 ${30 + i * 20}H196" stroke="${W}" stroke-opacity=".14"/>`; });
      s += `<path d="M92 56H80V20H100 ${zig(24, 5)} H136V70" fill="none" stroke="${W}" stroke-width="1.4"/>`;
      s += `<path d="M80 56H74 ${zig(-16, 4)} H52V64M46 64H64M49 68H61M53 72H57" fill="none" stroke="${W}" stroke-width="1.3" stroke-opacity=".85"/>`;
      s += `<path d="M44 84H92M130 70H140" stroke="${W}" stroke-width="1.4"/>`;
      s += `<path d="M92 42V98L130 70Z" fill="${W}" fill-opacity=".22" stroke="${W}" stroke-width="1.6" stroke-linejoin="round"/>`;
      s += `<path d="M96 56h6M96 84h6M99 81v6" stroke="${W}" stroke-width="1.3"/>`;
      [[80, 56], [136, 70]].forEach(([x, y]) => { s += `<circle cx="${x}" cy="${y}" r="2.4" fill="${W}"/>`; });
      const wave = (x, y, w, h, amp, per, color, sw) => {
        const cyc = Math.ceil(w / per) + 2; let d = `M${-per} ${h / 2}`;
        range(cyc * 2).forEach((k) => { d += k ? ` t${per / 2} 0` : ` q${per / 4} ${-2 * amp} ${per / 2} 0`; });
        return `<svg x="${x}" y="${y}" width="${w}" height="${h}" overflow="hidden"><path class="cv-slide" style="--dx:${per}px" d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/></svg>`;
      };
      s += wave(46, 74, 42, 20, 5, 14, "#ffd27a", 1.6);
      s += wave(140, 42, 56, 56, 22, 28, "#ffd27a", 2);
      return svg(s);
    },
    // 반도체 산업: 도는 지구 위에서 설계·장비·소재·파운드리 거점을 잇는 공급망
    globe() {
      const cx = 138, cy = 66, R = 54; let s = "";
      s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${W}" fill-opacity=".1" stroke="${W}" stroke-opacity=".6" stroke-width="1.2"/>`;
      [-36, -18, 0, 18, 36].forEach((d) => { s += `<ellipse cx="${cx}" cy="${cy + d}" rx="${Math.sqrt(R * R - d * d).toFixed(1)}" ry="${(4 - Math.abs(d) / 12).toFixed(1)}" fill="none" stroke="${W}" stroke-opacity=".22"/>`; });
      range(4).forEach((k) => { s += `<ellipse class="cv-turn" style="transform-origin:${cx}px ${cy}px;animation-delay:-${(k * 1.5).toFixed(1)}s" cx="${cx}" cy="${cy}" rx="${R}" ry="${R}" fill="none" stroke="${W}" stroke-opacity=".3"/>`; });
      const N = { us: [100, 52], nl: [128, 34], jp: [178, 50], kr: [166, 58], tw: [160, 84], cn: [140, 64] };
      [["us", "tw", -26], ["nl", "tw", -30], ["jp", "kr", -10], ["kr", "cn", -8], ["tw", "us", 30], ["cn", "nl", -14]].forEach(([a, b, bend], k) => {
        const [x1, y1] = N[a], [x2, y2] = N[b];
        const d = `M${x1} ${y1}Q${(x1 + x2) / 2} ${(y1 + y2) / 2 + bend} ${x2} ${y2}`;
        s += `<path d="${d}" fill="none" stroke="${W}" stroke-opacity=".25" stroke-width="1.2"/><path class="cv-flow" style="animation-delay:-${(k * 0.17).toFixed(2)}s" d="${d}" fill="none" stroke="#ffd27a" stroke-width="1.8" stroke-dasharray="3 9" stroke-linecap="round"/>`;
      });
      Object.values(N).forEach(([x, y], k) => {
        s += `<circle class="cv-ping" style="transform-origin:${x}px ${y}px;animation-delay:${(k * 0.3).toFixed(1)}s" cx="${x}" cy="${y}" r="7" fill="${W}" fill-opacity=".3"/><circle cx="${x}" cy="${y}" r="3" fill="${W}"/>`;
      });
      s += `<g transform="translate(160 84)"><rect x="-7" y="-7" width="14" height="14" rx="2" fill="${W}" stroke="#000" stroke-opacity=".3"/><rect x="-3.5" y="-3.5" width="7" height="7" fill="#000" fill-opacity=".3"/></g>`;
      return svg(s);
    },
    // 선박: 컨테이너선이 겹친 물결 위에서 흔들리고 굴뚝에서 연기가 오른다
    ship() {
      const sea = (y, amp, per, o, dx, dur) => {
        let d = `M${-per} ${amp * 2}`;
        range(Math.ceil(220 / per) * 2 + 4).forEach((k) => { d += k ? ` t${per / 2} 0` : ` q${per / 4} ${-2 * amp} ${per / 2} 0`; });
        return `<svg x="0" y="${y}" width="200" height="${130 - y}" overflow="hidden"><path class="cv-slide" style="--dx:${dx * per}px;animation-duration:${dur}s" d="${d}V60H${-per}Z" fill="${W}" fill-opacity="${o}"/></svg>`;
      };
      let s = sea(88, 3, 30, 0.16, 1, 3);
      s += `<g class="cv-bob" style="transform-origin:130px 96px">`;
      s += `<path d="M66 80H194L184 100H84Q72 98 66 80Z" fill="${W}" fill-opacity=".85"/><path d="M70 90H190" stroke="#ff8a8a" stroke-opacity=".8" stroke-width="3"/>`;
      s += `<rect x="74" y="50" width="20" height="30" rx="1.5" fill="${W}" fill-opacity=".75"/><rect x="72" y="46" width="24" height="5" rx="1" fill="${W}"/>`;
      range(3).forEach((k) => { s += `<rect x="${77 + k * 6}" y="54" width="4" height="3" fill="#000" fill-opacity=".35"/>`; });
      s += `<rect x="80" y="36" width="8" height="10" fill="${W}" fill-opacity=".6"/><rect x="80" y="36" width="8" height="3" fill="#ff8a8a" fill-opacity=".9"/>`;
      const C = ["#ff8a8a", "#ffd27a", "#8ab4ff", "#7deaa0", "#ffffff"]; const r = rnd(3);
      range(7).forEach((i) => range(3 - (i === 6 ? 1 : 0)).forEach((j) => {
        s += `<rect x="${100 + i * 12.5}" y="${71 - j * 9}" width="11.5" height="8" rx="1" fill="${C[Math.floor(r() * C.length)]}" fill-opacity=".85" stroke="#000" stroke-opacity=".2" stroke-width=".6"/>`;
      }));
      s += `</g>`;
      [0, 1, 2].forEach((k) => { s += `<circle class="cv-rise" style="animation-delay:${(k * 0.8).toFixed(1)}s" cx="84" cy="30" r="${3 + k}" fill="${W}" fill-opacity=".45"/>`; });
      s += sea(96, 4, 40, 0.3, -1, 2.4);
      return svg(s);
    },
    // 돈: 복리로 불어나는 동전 탑, 위로 동전이 떨어지고 지수 곡선이 그려진다
    coins() {
      const n = [1, 2, 3, 4, 6, 8, 11, 14], base = 118, step = 5; let s = "";
      s += `<path d="M66 ${base + 4}H196M66 ${base + 4}V14" stroke="${W}" stroke-opacity=".45" stroke-width="1.1"/>`;
      const tops = [];
      n.forEach((c, k) => {
        const x = 80 + k * 15;
        range(c).forEach((j) => {
          const y = base - j * step, top = j === c - 1;
          s += `<g${top ? ` class="cv-coin" style="animation-delay:${(0.15 + k * 0.22).toFixed(2)}s"` : ""}><rect x="${x - 6.5}" y="${y - 2}" width="13" height="4" fill="#ffd27a" fill-opacity=".75"/><ellipse cx="${x}" cy="${y + 2}" rx="6.5" ry="2.2" fill="#ffd27a" fill-opacity=".75"/><ellipse cx="${x}" cy="${y - 2}" rx="6.5" ry="2.2" fill="#ffe7a8" stroke="#000" stroke-opacity=".18" stroke-width=".6"/></g>`;
          if (top) tops.push([x, y - 8]);
        });
      });
      const d = "M" + tops.map(([x, y]) => `${x} ${y}`).join(" L");
      s += `<path class="cv-draw" pathLength="1" d="${d}" fill="none" stroke="${W}" stroke-width="1.8" stroke-linejoin="round" stroke-dasharray="1"/>`;
      s += `<path d="M${tops[7][0] - 4} ${tops[7][1] + 1}l4 -6 3 7" fill="none" stroke="${W}" stroke-width="1.6" stroke-linejoin="round"/>`;
      return svg(s);
    },
    // 주식: 흘러가는 캔들 차트와 오른쪽의 출렁이는 호가창
    candles() {
      const r = rnd(29), N = 16, gap = 8; let walk = [0];
      range(N).forEach(() => walk.push(walk[walk.length - 1] + (r() - 0.46) * 14));
      const drift = walk[N] / N; walk = walk.map((v, i) => v - drift * i);
      const lo = Math.min(...walk), hi = Math.max(...walk), Y = (v) => 96 - ((v - lo) / (hi - lo || 1)) * 62;
      let chart = "";
      range(2).forEach((rep) => range(N).forEach((i) => {
        const o = walk[i], c = walk[i + 1], x = (rep * N + i) * gap + 4, up = c >= o;
        const wt = Math.max(o, c) + r() * 5, wb = Math.min(o, c) - r() * 5, col = up ? "#7deaa0" : "#ff7a8a";
        chart += `<path d="M${x} ${Y(wt).toFixed(1)}V${Y(wb).toFixed(1)}" stroke="${col}" stroke-width="1"/><rect x="${x - 2.5}" y="${Y(Math.max(o, c)).toFixed(1)}" width="5" height="${Math.max(1.5, Math.abs(Y(o) - Y(c))).toFixed(1)}" rx=".8" fill="${col}" fill-opacity=".9"/>`;
      }));
      const ma = range(2 * N).map((k) => { const i = k % N, a = walk.slice(Math.max(0, i - 2), i + 2); return `${k * gap + 4} ${Y(a.reduce((p, q) => p + q, 0) / a.length).toFixed(1)}`; });
      chart += `<path d="M${ma.join(" L")}" fill="none" stroke="${W}" stroke-opacity=".6" stroke-width="1.2"/>`;
      let s = "";
      range(5).forEach((k) => { s += `<path d="M60 ${18 + k * 22}H160" stroke="${W}" stroke-opacity=".14"/>`; });
      s += `<svg x="60" y="0" width="100" height="130" overflow="hidden"><g class="cv-slide" style="--dx:-${N * gap}px;animation-duration:8s">${chart}</g></svg>`;
      s += `<path d="M164 10V120" stroke="${W}" stroke-opacity=".35"/>`;
      [26, 18, 22, 12, 8].forEach((w, k) => { s += `<rect class="cv-depth" style="animation-delay:${(k * 0.35).toFixed(2)}s" x="${194 - w}" y="${14 + k * 9}" width="${w}" height="7" rx="1" fill="#ff7a8a" fill-opacity=".7"/>`; });
      s += `<rect x="168" y="61" width="26" height="8" rx="1.5" fill="${W}" fill-opacity=".9"/>`;
      [10, 16, 24, 20, 28].forEach((w, k) => { s += `<rect class="cv-depth" style="animation-delay:${(0.2 + k * 0.35).toFixed(2)}s" x="${194 - w}" y="${72 + k * 9}" width="${w}" height="7" rx="1" fill="#7deaa0" fill-opacity=".7"/>`; });
      return svg(s);
    },
    // 심장 박동과 심전도: 심장이 뛰고 파형이 흘러간다
    heart() {
      const beat = "h14l4-6 4 10 5-40 6 52 4-16 6 0 8-6 8 6h14";
      let s = "";
      range(4).forEach((k) => { s += `<path d="M10 ${30 + k * 24}H196" stroke="${W}" stroke-opacity=".1"/>`; });
      s += `<svg x="92" y="0" width="108" height="130" overflow="hidden"><g class="cv-slide" style="--dx:-73px;animation-duration:1.6s"><path d="M0 104${(beat + " ").repeat(4)}" fill="none" stroke="#ff8a9a" stroke-width="2" stroke-linejoin="round"/></g></svg>`;
      s += `<path class="cv-hit" d="M140 64 116 40c-14-14 4-34 18-20l6 6 6-6c14-14 32 6 18 20Z" fill="${W}" fill-opacity=".75" stroke="${W}" stroke-width="1.4"/>`;
      return svg(s);
    },
    // 오선과 음표, 아래에서 스펙트럼 막대가 출렁인다
    music() {
      const r = rnd(11); let s = "";
      range(5).forEach((k) => { s += `<path d="M60 ${30 + k * 9}H196" stroke="${W}" stroke-opacity=".4"/>`; });
      [[78, 61], [100, 52.5], [122, 43.5], [144, 48], [166, 39], [186, 52.5]].forEach(([x, y], k) => {
        s += `<g class="cv-bob" style="animation-delay:${(k * 0.3).toFixed(1)}s"><ellipse cx="${x}" cy="${y}" rx="5.4" ry="4" transform="rotate(-20 ${x} ${y})" fill="${W}" fill-opacity=".9"/><path d="M${x + 5} ${y}V${y - 24}" stroke="${W}" stroke-width="1.4"/></g>`;
      });
      range(16).forEach((i) => {
        const h = 8 + r() * 30;
        s += `<rect class="cv-grow" style="animation-delay:${(r() * 2).toFixed(2)}s;animation-duration:${(0.8 + r()).toFixed(2)}s" x="${62 + i * 8.4}" y="${124 - h}" width="5.6" height="${h.toFixed(1)}" rx="1.4" fill="#7dd3fc" fill-opacity=".75"/>`;
      });
      return svg(s);
    },
    // 볼록 렌즈가 광선을 모으고 초점에서 에어리 고리가 맥동한다
    lens() {
      const fx = 176, fy = 65; let s = "";
      s += `<path d="M58 65H198" stroke="${W}" stroke-opacity=".2" stroke-dasharray="3 4"/>`;
      [-36, -22, -8, 8, 22, 36].forEach((h, k) => {
        s += `<path class="cv-flow" style="animation-delay:${(k * 0.12).toFixed(2)}s" d="M60 ${fy + h}H112L${fx} ${fy}" fill="none" stroke="#ffd38a" stroke-opacity=".85" stroke-width="1.3" stroke-dasharray="6 4"/>`;
      });
      s += `<path d="M112 20Q132 65 112 110Q92 65 112 20Z" fill="${W}" fill-opacity=".3" stroke="${W}" stroke-opacity=".8" stroke-width="1.4"/>`;
      [14, 9, 4.5].forEach((r, k) => {
        s += `<circle class="cv-pulse" style="animation-delay:${(k * 0.3).toFixed(1)}s" cx="${fx}" cy="${fy}" r="${r}" fill="${W}" fill-opacity="${(0.12 + k * 0.3).toFixed(2)}"/>`;
      });
      return svg(s);
    },
    // 네트워크: 라우터 그물망의 링크를 따라 패킷이 흐른다
    // AI 전환: 흩어진 파일·메일이 표 한 장으로 정리되고, 그 위 AI 노드로 신호가 흐른다
    transform() {
      const r = rnd(11); let s = "";
      range(7).forEach((k) => {
        const x = 10 + r() * 46, y = 14 + k * 15 + r() * 4, a = (r() - 0.5) * 30;
        s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="22" height="10" rx="2" fill="${W}" fill-opacity=".14" stroke="${W}" stroke-opacity=".55" transform="rotate(${a.toFixed(1)} ${(x + 11).toFixed(1)} ${(y + 5).toFixed(1)})"/>`;
      });
      s += `<path class="cv-flow" d="M74 70H96" stroke="${W}" stroke-width="2" stroke-dasharray="4 4" fill="none"/><path d="M94 65l6 5-6 5" fill="none" stroke="${W}" stroke-width="2"/>`;
      s += `<rect x="108" y="56" width="84" height="64" rx="4" fill="none" stroke="${W}" stroke-opacity=".5"/>`;
      range(4).forEach((j) => range(3).forEach((i) => {
        s += `<rect x="${113 + i * 26}" y="${61 + j * 14.5}" width="22" height="10" rx="2" fill="${W}" fill-opacity="${0.35 + 0.15 * ((i + j) % 3)}"${(i + j) % 4 === 0 ? ` class="cv-blink" style="animation-delay:${((i + j) * 0.3).toFixed(1)}s"` : ""}/>`;
      }));
      [124, 150, 176].forEach((x, k) => {
        s += `<path class="cv-flow" style="animation-delay:-${(k * 0.3).toFixed(1)}s" d="M150 26L${x} 56" stroke="${W}" stroke-width="1.6" stroke-dasharray="3 6" fill="none"/>`;
      });
      s += `<circle class="cv-pulse" cx="150" cy="22" r="13" fill="${W}" fill-opacity=".85"/><text x="150" y="26.5" text-anchor="middle" font-size="12" font-weight="700" fill="#000" fill-opacity=".55" font-family="sans-serif">AI</text>`;
      return svg(s);
    },
    network() {
      const N = [[28, 34], [30, 98], [74, 64], [116, 26], [118, 104], [160, 62], [186, 24], [184, 106]];
      const L = [[0, 2], [1, 2], [2, 3], [2, 4], [3, 5], [4, 5], [3, 4], [5, 6], [5, 7], [0, 3], [1, 4]];
      let s = "";
      L.forEach(([a, b], k) => {
        const d = `M${N[a][0]} ${N[a][1]}L${N[b][0]} ${N[b][1]}`;
        s += `<path d="${d}" stroke="${W}" stroke-opacity=".3" stroke-width="1.4"/>`;
        if (k % 2 === 0) s += `<path class="cv-flow" style="animation-delay:-${(k * 0.15).toFixed(2)}s" d="${d}" fill="none" stroke="${W}" stroke-width="2.2" stroke-dasharray="4 12" stroke-linecap="round"/>`;
      });
      N.forEach(([x, y], k) => {
        s += k === 2 || k === 5
          ? `<rect x="${x - 9}" y="${y - 7}" width="18" height="14" rx="3" fill="${W}" fill-opacity=".85"/><path d="M${x - 5} ${y}H${x + 5}M${x} ${y - 4}V${y + 4}" stroke="#000" stroke-opacity=".35" stroke-width="1.4"/>`
          : `<circle cx="${x}" cy="${y}" r="5.5" fill="${W}" fill-opacity=".3" stroke="${W}" stroke-width="1.4"/>`;
      });
      return svg(s);
    },
    // 행렬 = 변환: 기저 벡터 î·ĵ가 기울면 격자 전체가 따라 휜다
    matrix() {
      const cx = 128, cy = 74, u = 22; let s = "", g = "";
      range(9).forEach((k) => {
        const d = (k - 4) * u;
        s += `<path d="M${cx + d} 4V126M44 ${cy + d}H200" stroke="${W}" stroke-opacity=".1"/>`;
        g += `<path d="M${cx + d} -40V170M20 ${cy + d}H236" stroke="${W}" stroke-opacity=".38"/>`;
      });
      g += `<rect x="${cx}" y="${cy - u}" width="${u}" height="${u}" fill="${W}" fill-opacity=".25"/>`;
      g += `<path d="M${cx} ${cy}h${u - 3}" stroke="#7deaa0" stroke-width="2.4"/><path d="M${cx + u + 2} ${cy}l-6 -3.5v7Z" fill="#7deaa0"/>`;
      g += `<path d="M${cx} ${cy}v${3 - u}" stroke="#ff8a8a" stroke-width="2.4"/><path d="M${cx} ${cy - u - 2}l-3.5 6h7Z" fill="#ff8a8a"/>`;
      s += `<g class="cv-shear" style="transform-origin:${cx}px ${cy}px">${g}</g>`;
      return svg(s);
    },
    // 세금: 누진세율의 계단 위로 소득 막대가 차오르고, 옆의 원천징수 영수증에 줄이 그어진다
    brackets() {
      const steps = [[60, 6], [74, 15], [90, 24], [106, 35], [122, 38], [136, 42], [150, 45]]; let s = "";
      s += `<path d="M52 118H160M52 118V14" stroke="${W}" stroke-opacity=".45" stroke-width="1.1"/>`;
      let x0 = 52;
      steps.forEach(([x1, r], k) => {
        const h = r * 2.1;
        s += `<rect x="${x0 + 0.8}" y="${118 - h}" width="${x1 - x0 - 1.6}" height="${h}" fill="${W}" fill-opacity=".18" stroke="${W}" stroke-opacity=".55" stroke-width=".9"/>`;
        s += `<rect class="cv-blink" style="animation-delay:${(k * 0.22).toFixed(2)}s" x="${x0 + 0.8}" y="${118 - h}" width="${x1 - x0 - 1.6}" height="${h}" fill="#ffd27a" fill-opacity=".7"/>`;
        x0 = x1;
      });
      s += `<path class="cv-draw" pathLength="1" d="M54 112 C80 104 104 86 150 64" fill="none" stroke="${W}" stroke-width="1.8" stroke-dasharray="1"/>`;
      s += `<rect x="168" y="20" width="28" height="92" rx="3" fill="${W}" fill-opacity=".85"/>`;
      range(7).forEach((j) => { s += `<path d="M173 ${34 + j * 10}h${j % 3 === 2 ? 12 : 18}" stroke="#000" stroke-opacity=".28" stroke-width="1.6" stroke-linecap="round"/>`; });
      s += `<circle cx="188" cy="100" r="6" fill="none" stroke="#ff8a8a" stroke-width="1.6"/>`;
      return svg(s);
    },
    // 보험: 우산이 집들을 가리고, 우산 밖으로만 빗방울이 떨어진다
    house() {
      const r = rnd(7); let s = "";
      s += `<path d="M40 118H216" stroke="${W}" stroke-opacity=".4"/>`;
      [[52, 46], [74, 70], [168, 58], [192, 40]].forEach(([x, h]) => {
        s += `<rect x="${x}" y="${118 - h}" width="18" height="${h}" fill="${W}" fill-opacity=".22" stroke="${W}" stroke-opacity=".6" stroke-width="1.1"/>`;
        range(Math.floor(h / 12)).forEach((j) => [0, 1].forEach((i) => {
          s += `<rect x="${x + 4 + i * 6}" y="${118 - h + 5 + j * 12}" width="3.5" height="5" fill="#ffe7a8" fill-opacity="${(0.35 + r() * 0.5).toFixed(2)}"/>`;
        }));
      });
      s += `<path d="M100 118V78l28 -24 28 24V118Z" fill="${W}" fill-opacity=".85"/>`;
      s += `<path d="M94 82l34 -30 34 30" fill="none" stroke="${W}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
      s += `<path d="M121 118V96h14V118Z" fill="#000" fill-opacity=".22"/>`;
      s += `<path d="M44 22C90 26 120 40 150 62S200 96 214 100" fill="none" stroke="#ffd27a" stroke-width="2" stroke-dasharray="4 4" stroke-opacity=".8"/>`;
      return svg(s);
    },
    // 경제 뉴스: 가운데 기준금리에서 물결이 퍼지고, 점선을 따라 대출·주가·집값·환율 칸으로 신호가 번진다
    ripple() {
      const cx = 68, cy = 66; let s = "";
      [0, 0.6, 1.2].forEach((d) => { s += `<circle class="cv-ping" style="animation-delay:${d}s;transform-box:fill-box;transform-origin:center" cx="${cx}" cy="${cy}" r="14" fill="none" stroke="${W}" stroke-opacity=".7"/>`; });
      const nodes = [[150, 22, "loan"], [176, 54, "stock"], [168, 92, "house"], [132, 116, "fx"]];
      nodes.forEach(([x, y]) => { s += `<path class="cv-flow" d="M${cx + 16} ${cy}L${x - 14} ${y}" stroke="${W}" stroke-opacity=".55" stroke-width="1.3" stroke-dasharray="3 3"/>`; });
      nodes.forEach(([x, y, k]) => {
        s += `<rect x="${x - 14}" y="${y - 11}" width="28" height="22" rx="5" fill="${W}" fill-opacity=".14" stroke="${W}" stroke-opacity=".6"/>`;
        if (k === "loan") s += `<text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="12" font-weight="700" fill="#ffe7a8">%</text>`;
        if (k === "stock") s += `<path d="M${x - 9} ${y + 5}l5 -5 4 3 8 -8" fill="none" stroke="#7deaa0" stroke-width="1.8" stroke-linejoin="round"/>`;
        if (k === "house") s += `<path d="M${x - 8} ${y + 6}V${y - 1}l8 -6 8 6V${y + 6}Z" fill="${W}" fill-opacity=".85"/>`;
        if (k === "fx") s += `<text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="11" font-weight="700" fill="#ffd27a">₩$</text>`;
      });
      s += `<circle cx="${cx}" cy="${cy}" r="15" fill="${W}" fill-opacity=".9"/><text x="${cx}" y="${cy + 4.5}" text-anchor="middle" font-size="12.5" font-weight="800" fill="#000" fill-opacity=".55">%</text>`;
      s += `<path d="M14 112H44M14 112V88" stroke="${W}" stroke-opacity=".35"/><path class="cv-draw" pathLength="1" stroke-dasharray="1" d="M16 106l7 -4 6 3 7 -9 7 2" fill="none" stroke="${W}" stroke-width="1.5" stroke-linejoin="round"/>`;
      return svg(s);
    },
    umbrella() {
      const r = rnd(5), cx = 128; let s = "";
      range(14).forEach((k) => {
        const x = 52 + k * 11 + r() * 4;
        if (Math.abs(x - cx) < 54) return;
        s += `<path class="cv-fall" style="animation-delay:${(r() * 1.8).toFixed(2)}s;animation-duration:${(1.4 + r() * 0.6).toFixed(2)}s" d="M${x.toFixed(1)} ${(8 + r() * 30).toFixed(1)}v9" stroke="#8ab4ff" stroke-width="1.6" stroke-linecap="round"/>`;
      });
      s += `<path d="M${cx - 52} 54Q${cx} -4 ${cx + 52} 54Q${cx + 39} 46 ${cx + 26} 54Q${cx + 13} 46 ${cx} 54Q${cx - 13} 46 ${cx - 26} 54Q${cx - 39} 46 ${cx - 52} 54Z" fill="${W}" fill-opacity=".85"/>`;
      s += `<path d="M${cx} 54V110q0 7 -7 7" fill="none" stroke="${W}" stroke-width="2.2" stroke-linecap="round"/>`;
      [-38, -19, 19, 38].forEach((dx, k) => {
        const x = cx + dx, h = 14 + (k % 2) * 4;
        s += `<path d="M${x - 8} 118V${118 - h}l8 -7 8 7V118Z" fill="${W}" fill-opacity=".28" stroke="${W}" stroke-opacity=".7" stroke-width="1.2"/>`;
      });
      s += `<path d="M44 118H212" stroke="${W}" stroke-opacity=".35"/>`;
      return svg(s);
    },
    // 디지털: CMOS 인버터(pMOS 위·nMOS 아래)와 뒤집혀 나오는 사각파
    digital() {
      let s = `<path d="M110 14V30M110 116V100M110 58V72M84 65H96M96 46V84" stroke="${W}" stroke-opacity=".7" stroke-width="1.6"/>`;
      s += `<path d="M98 14H122M98 116H122" stroke="${W}" stroke-width="2"/>`;
      s += `<rect x="102" y="30" width="16" height="28" rx="2" fill="${W}" fill-opacity=".22" stroke="${W}" stroke-opacity=".6"/>`;
      s += `<rect x="102" y="72" width="16" height="28" rx="2" fill="${W}" fill-opacity=".55" stroke="${W}" stroke-opacity=".6"/>`;
      s += `<path d="M110 65H124" stroke="${W}" stroke-opacity=".7" stroke-width="1.6"/>`;
      s += `<path class="cv-flow" d="M44 82H54V48H64V82H74V48H84" fill="none" stroke="${W}" stroke-opacity=".8" stroke-width="1.6" stroke-dasharray="5 4"/>`;
      s += `<path class="cv-flow" style="animation-delay:.2s" d="M124 48H140V82H158V48H172V82H190" fill="none" stroke="${W}" stroke-opacity=".8" stroke-width="1.6" stroke-dasharray="5 4"/>`;
      return svg(s);
    },
    // 기본: 다이 격자
    // 팔레트: 색상환 고리 위에 손잡이가 맥동하고, 가운데 같은 회색 두 칸이 서로 다른 바탕에 놓인다(ArtBook 색채)
    palette() {
      let s = "";
      const cx = 132, cy = 65, R = 48, r = 30, n = 18;
      range(n).forEach((i) => {
        const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
        const p = (rr, a) => `${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
        s += `<path d="M${p(r, a0)}L${p(R, a0)}A${R} ${R} 0 0 1 ${p(R, a1)}L${p(r, a1)}A${r} ${r} 0 0 0 ${p(r, a0)}Z" fill="hsl(${Math.round((i / n) * 360)} 70% 62%)" fill-opacity=".9"/>`;
      });
      s += `<circle class="cv-pulse" cx="${cx + ((R + r) / 2) * Math.cos(-0.5)}" cy="${cy + ((R + r) / 2) * Math.sin(-0.5)}" r="7" fill="none" stroke="${W}" stroke-width="2.4"/>`;
      s += `<rect x="${cx - 18}" y="${cy - 10}" width="18" height="20" fill="#2a2a2a"/><rect x="${cx}" y="${cy - 10}" width="18" height="20" fill="#e6e6e6"/>`;
      s += `<rect x="${cx - 13}" y="${cy - 5}" width="8" height="10" fill="#808080"/><rect x="${cx + 5}" y="${cy - 5}" width="8" height="10" fill="#808080"/>`;
      [0.92, 0.7, 0.48, 0.26].forEach((l, k) => { s += `<rect x="36" y="${22 + k * 22}" width="18" height="18" rx="3" fill="${W}" fill-opacity="${l}"/>`; });
      return svg(s);
    },
    // 황금 직사각형을 정사각형으로 나누고 나선을 잇는다, 초점이 맥동한다(ArtBook 구도)
    spiral() {
      const phi = (1 + Math.sqrt(5)) / 2, H = 96, Wd = H * phi, x0 = (200 - Wd) / 2, y0 = 17;
      let s = `<rect x="${x0.toFixed(1)}" y="${y0}" width="${Wd.toFixed(1)}" height="${H}" fill="none" stroke="${W}" stroke-opacity=".7"/>`, d = "";
      let x = x0, y = y0, w = Wd, h = H;
      range(8).forEach((i) => {
        const k = i % 4; let q, rx, ry, ex, ey;
        if (k === 0) { q = h; rx = x; ry = y; d += (i ? "" : `M${x} ${y + q}`) + ` A${q} ${q} 0 0 1 ${x + q} ${y}`; x += q; w -= q; }
        else if (k === 1) { q = w; rx = x; ry = y; d += ` A${q} ${q} 0 0 1 ${x + q} ${y + q}`; y += q; h -= q; }
        else if (k === 2) { q = h; rx = x + w - q; ry = y; d += ` A${q} ${q} 0 0 1 ${x + w - q} ${y + q}`; w -= q; }
        else { q = w; rx = x; ry = y + h - q; d += ` A${q} ${q} 0 0 1 ${x} ${y + h - q}`; h -= q; }
        s += `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${q.toFixed(1)}" height="${q.toFixed(1)}" fill="none" stroke="${W}" stroke-opacity=".28"/>`;
      });
      s += `<path d="${d}" fill="none" stroke="#ffc46b" stroke-width="2"/>`;
      s += `<circle class="cv-pulse" cx="${(x0 + Wd * 0.618).toFixed(1)}" cy="${(y0 + H * 0.382).toFixed(1)}" r="5" fill="#ffc46b"/>`;
      return svg(s);
    },
    // 2점 투시 상자: 눈높이 위 두 소실점으로 모서리가 모인다(ArtBook 드로잉)
    vanish() {
      const hy = 52, L = [8, hy], R = [192, hy], t = [100, 22], b = [100, 112];
      const on = (p, q, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
      const lt = on(t, L, 0.42), lb = on(b, L, 0.42), rt = on(t, R, 0.38), rb = on(b, R, 0.38);
      const P = (a) => `${a[0].toFixed(1)} ${a[1].toFixed(1)}`;
      let s = `<line x1="0" x2="200" y1="${hy}" y2="${hy}" stroke="${W}" stroke-opacity=".55" stroke-dasharray="4 3"/>`;
      [t, b, lt, lb, rt, rb].forEach((p) => { const v = p[0] < 100 || p === t || p === b ? L : R; s += `<line x1="${p[0]}" y1="${p[1]}" x2="${v[0]}" y2="${v[1]}" stroke="${W}" stroke-opacity=".18"/>`; });
      [t, b].forEach((p) => { s += `<line x1="${p[0]}" y1="${p[1]}" x2="${R[0]}" y2="${R[1]}" stroke="${W}" stroke-opacity=".18"/>`; });
      s += `<path d="M${P(lt)}L${P(t)}L${P(rt)}L${P(rb)}L${P(b)}L${P(lb)}Z M${P(t)}L${P(b)}" fill="${W}" fill-opacity=".12" stroke="${W}" stroke-width="1.8" stroke-linejoin="round"/>`;
      s += `<circle class="cv-pulse" cx="${L[0]}" cy="${hy}" r="4" fill="#ffc46b"/><circle class="cv-pulse" style="animation-delay:.6s" cx="${R[0]}" cy="${hy}" r="4" fill="#ffc46b"/>`;
      return svg(s);
    },
    // 글자의 뼈대: 기준선·x높이·어센더 선 위의 큰 글자와 한글 한 자(ArtBook 타이포그래피)
    letter() {
      let s = "";
      [[30, ".35"], [52, ".55"], [96, ".8"], [112, ".35"]].forEach(([y, o]) => { s += `<line x1="10" x2="190" y1="${y}" y2="${y}" stroke="${W}" stroke-opacity="${o}" stroke-dasharray="${y === 96 ? "" : "3 3"}"/>`; });
      s += `<text x="22" y="96" font-family="Georgia, serif" font-size="86" fill="${W}" fill-opacity=".9">Ag</text>`;
      s += `<text x="122" y="96" font-family="sans-serif" font-weight="700" font-size="62" fill="#ffc46b">&#xD55C;</text>`;
      s += `<rect class="cv-pulse" x="118" y="40" width="66" height="60" fill="none" stroke="${W}" stroke-opacity=".6" stroke-dasharray="2 3"/>`;
      return svg(s);
    },
    // 연대표 위의 작품들: 시대마다 색과 크기가 다른 화면이 늘어선다(ArtBook 미술사)
    timeline() {
      let s = `<line x1="8" x2="192" y1="100" y2="100" stroke="${W}" stroke-opacity=".7"/>`;
      const F = [["#c9a227", 26, 34], ["#8a5a3c", 22, 30], ["#3f6e8c", 30, 24], ["#a8442e", 20, 28], ["#e2b04a", 28, 22], ["#4f8a62", 24, 30], ["#d06a8c", 22, 22]];
      let x = 12;
      F.forEach(([c, w, h], i) => {
        s += `<line x1="${x + w / 2}" x2="${x + w / 2}" y1="${96 - h}" y2="100" stroke="${W}" stroke-opacity=".3"/><rect x="${x}" y="${88 - h - (i % 2) * 14}" width="${w}" height="${h}" fill="${c}" fill-opacity=".85" stroke="${W}" stroke-opacity=".6"/>`;
        s += `<circle cx="${x + w / 2}" cy="100" r="2.5" fill="${W}"/>`;
        x += w + 4;
      });
      s += `<circle class="cv-pulse" cx="${12 + 26 + 4 + 22 + 4 + 15}" cy="100" r="6" fill="none" stroke="#ffc46b" stroke-width="2"/>`;
      return svg(s);
    },
    // 히스토그램과 조리개: 노출을 바꾸면 봉우리가 옮겨 간다(ArtBook 사진과 이미지)
    histogram() {
      let s = "";
      range(40).forEach((i) => {
        const u = i / 39, h = 70 * Math.exp(-((u - 0.42) ** 2) / 0.03) + 18 * Math.exp(-((u - 0.85) ** 2) / 0.004) + 4;
        s += `<rect x="${14 + i * 3.4}" y="${(108 - h).toFixed(1)}" width="2.6" height="${h.toFixed(1)}" fill="${W}" fill-opacity="${(0.35 + 0.5 * u).toFixed(2)}"/>`;
      });
      s += `<line x1="12" x2="152" y1="108" y2="108" stroke="${W}" stroke-opacity=".6"/>`;
      const cx = 172, cy = 40, R = 20; let d = "";
      range(6).forEach((k) => { const a = (k / 6) * Math.PI * 2, b = a + Math.PI / 3; d += `M${(cx + R * Math.cos(a)).toFixed(1)} ${(cy + R * Math.sin(a)).toFixed(1)}L${(cx + 9 * Math.cos(b + 0.5)).toFixed(1)} ${(cy + 9 * Math.sin(b + 0.5)).toFixed(1)}`; });
      s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${W}" stroke-width="1.6"/><path class="cv-pulse" d="${d}" stroke="#ffc46b" stroke-width="1.6" fill="none"/>`;
      return svg(s);
    },
    // 브라우저 창 안의 열 그리드와 카드, 오른쪽 가장자리 손잡이가 맥동한다(ArtBook 웹)
    browser() {
      let s = `<rect x="22" y="14" width="156" height="102" rx="7" fill="none" stroke="${W}" stroke-opacity=".8" stroke-width="1.4"/><line x1="22" x2="178" y1="28" y2="28" stroke="${W}" stroke-opacity=".5"/>`;
      [0, 1, 2].forEach((i) => { s += `<circle cx="${31 + i * 7}" cy="21" r="2.2" fill="${W}" fill-opacity=".6"/>`; });
      range(12).forEach((i) => { s += `<rect x="${32 + i * 11.7}" y="34" width="8.5" height="76" fill="${W}" fill-opacity=".08"/>`; });
      s += `<rect x="32" y="38" width="138" height="10" rx="2" fill="#ffc46b" fill-opacity=".85"/>`;
      [0, 1, 2, 3].forEach((i) => { s += `<rect x="${32 + i * 35.1}" y="54" width="32" height="48" rx="3" fill="${W}" fill-opacity="${0.18 + i * 0.12}" stroke="${W}" stroke-opacity=".5"/>`; });
      s += `<circle class="cv-pulse" cx="178" cy="65" r="5" fill="none" stroke="#ffc46b" stroke-width="2"/>`;
      return svg(s);
    },
    // 사용자 흐름도와 줄어드는 퍼널(ArtBook 제품 디자인)
    userflow() {
      let s = "";
      const N = [[30, 30], [78, 30], [126, 30], [174, 30]];
      N.forEach(([x, y], i) => { s += `<rect x="${x - 16}" y="${y - 10}" width="32" height="20" rx="${i === 3 ? 10 : 3}" fill="${W}" fill-opacity="${i === 3 ? 0.85 : 0.18}" stroke="${W}" stroke-opacity=".7"/>`; if (i < 3) s += `<path class="cv-flow" d="M${x + 17} ${y}H${x + 31}" stroke="${W}" stroke-width="1.6" stroke-dasharray="4 3" fill="none"/>`; });
      [100, 82, 61, 46].forEach((w, i) => { s += `<rect x="${100 - w * 0.8}" y="${66 + i * 13}" width="${w * 1.6}" height="9" rx="2" fill="#ffc46b" fill-opacity="${0.95 - i * 0.15}"/>`; });
      return svg(s);
    },
    // 클립형 독서등의 측면도와 무게중심(ArtBook 산업디자인)
    lamp() {
      let s = `<line x1="20" x2="180" y1="112" y2="112" stroke="${W}" stroke-opacity=".5"/>`;
      s += `<rect x="70" y="92" width="44" height="20" rx="4" fill="${W}" fill-opacity=".2" stroke="${W}" stroke-opacity=".8"/>`;
      s += `<path d="M92 92 L112 40" stroke="${W}" stroke-width="5" stroke-linecap="round"/>`;
      s += `<rect x="100" y="28" width="62" height="14" rx="5" fill="${W}" fill-opacity=".85" transform="rotate(8 112 40)"/>`;
      s += `<path d="M118 44 L104 92 M150 50 L160 98" stroke="#ffc46b" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="3 3"/>`;
      s += `<circle class="cv-pulse" cx="100" cy="84" r="4.5" fill="#ffc46b"/><line x1="100" x2="100" y1="88" y2="112" stroke="#ffc46b" stroke-dasharray="2 2"/>`;
      return svg(s);
    },
    grid() {
      let s = "";
      range(4).forEach((j) => range(8).forEach((i) => { s += `<rect x="${36 + i * 20}" y="${14 + j * 26}" width="16" height="22" rx="2" fill="${W}" fill-opacity=".2" stroke="${W}" stroke-opacity=".4"/>`; }));
      return svg(s);
    },
  };

  window.coverArt = (motif) => (M[motif] || M.grid)();
})();
