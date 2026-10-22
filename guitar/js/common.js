/* ==========================================================================
   GuitarBook 공통 스크립트 — 전역 객체 MB (MusicBook 엔진 기반, 기타 전용 도구는 js/guitar.js의 GT)
   - 레이아웃(상단바, 목차, 이전/다음, 테마, 소리 켜기/끄기) 자동 생성
   - 시뮬레이터 헬퍼: canvas, chart, range, seg, check, 포맷/난수
   - 오디오 엔진: AudioContext, 악기(MB.play), 드럼 합성(MB.drum), 정확한 박자 스케줄러(MB.Clock)
   - 음악 이론: 음 이름·주파수, 음정, 음계, 화음, 다이아토닉 화음, 조율 체계
   - DSP: FFT, 창 함수, 바이쿼드 필터 응답
   - 위젯: 피아노 건반(MB.keyboard), 오선보(MB.staff), 파형·스펙트럼 그리기
   이 파일은 <head>에서 defer 없이 로드된다. 페이지 스크립트는 </body> 직전에 둔다.
   ========================================================================== */
(function () {
  "use strict";

  const CHAPTERS = [
    { slug: "instrument",  num: "01", title: "기타라는 악기",            desc: "구조와 각 부분의 역할, 현의 물리(메르센 법칙), 스케일 길이와 장력, 어쿠스틱·클래식·일렉의 차이.", tags: ["물리", "sim"] },
    { slug: "tuning",      num: "02", title: "튜닝과 음높이",            desc: "표준 튜닝 EADGBE, 맥놀이로 맞추기, 5프렛·하모닉스 튜닝, 마이크 튜너, 대체 튜닝.", tags: ["기초", "sim"] },
    { slug: "fretboard",   num: "03", title: "프렛과 지판",              desc: "12√2 프렛 배치와 17.817 법칙, 음 이름 찾기, 옥타브 모양, 지판 암기 게임.", tags: ["지판", "sim"] },
    { slug: "tab",         num: "04", title: "타브 악보와 리듬 읽기",    desc: "TAB의 문법, 음표 길이와 박, 기호(h·p·/·b·~), 타브 플레이어와 편집기.", tags: ["악보", "sim"] },
    { slug: "open-chords", num: "05", title: "첫 코드: 오픈 코드",        desc: "코드 다이어그램 읽기, 8개 기본 오픈 코드, 손가락 배치와 뮤트, 코드 전환 훈련.", tags: ["코드", "sim"] },
    { slug: "strumming",   num: "06", title: "리듬과 스트로크",          desc: "진자 운동 원리, 다운·업, 8비트·16비트 패턴, 뮤트와 악센트, 스트럼 패턴 편집기.", tags: ["리듬", "sim"] },
    { slug: "progressions",num: "07", title: "코드 진행과 카포",          desc: "키와 다이아토닉 코드, 숫자 표기, 자주 쓰는 진행, 카포와 조옮김 계산기.", tags: ["화성", "sim"] },
    { slug: "barre-caged", num: "08", title: "바레 코드와 CAGED",         desc: "검지 바레의 원리, E형·A형 이동 코드, CAGED 다섯 모양으로 지판 잇기.", tags: ["코드", "sim"] },
    { slug: "voicings",    num: "09", title: "지판 위의 화음",            desc: "3화음과 7화음의 구성, 줄 묶음별 트라이어드, 드롭 2, sus·add·텐션, 코드 이름 찾기.", tags: ["화음", "sim"] },
    { slug: "scales",      num: "10", title: "스케일과 솔로",            desc: "펜타토닉 5박스, 블루스 스케일, 장음계와 선법, 3NPS, 잼 트랙 위 즉흥 연주.", tags: ["솔로", "sim"] },
    { slug: "techniques",  num: "11", title: "리드 테크닉",              desc: "해머온·풀오프·슬라이드, 벤딩의 음정과 장력, 비브라토, 자연·인공 하모닉스.", tags: ["테크닉", "sim"] },
    { slug: "fingerstyle", num: "12", title: "핑거스타일",               desc: "p·i·m·a 운지, 아르페지오 패턴, 트래비스 피킹과 교대 베이스, 선율과 반주 나누기.", tags: ["핑거", "sim"] },
    { slug: "tone",        num: "13", title: "일렉 기타와 톤",            desc: "픽업의 원리와 위치(빗살 필터), 톤 노브 RC 필터, 디스토션, 앰프와 이펙터 체인.", tags: ["톤", "sim"] },
    { slug: "jam",         num: "14", title: "연습 설계와 잼 스테이션",   desc: "의도적 연습과 템포 사다리, 코드·드럼·베이스 반주 위에서 연주하는 종합 잼 스테이션.", tags: ["종합", "sim"] },
    { slug: "glossary",    num: "15", title: "용어집 & 종합 퀴즈",        desc: "기타 용어를 검색하고, 지판·코드·청음 실력을 점검하자.", tags: ["정리"] },
  ];

  const MB = (window.MB = {});
  MB.CHAPTERS = CHAPTERS;

  /* ------------------------------------------------------------ math utils */
  MB.clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  MB.lerp = (a, b, t) => a + (b - a) * t;
  MB.map = (x, a, b, c, d) => c + ((x - a) * (d - c)) / (b - a);
  MB.smooth = (a, b, x) => { const t = MB.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  MB.randn = function () {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  MB.poisson = function (lambda) {
    if (lambda <= 0) return 0;
    if (lambda > 40) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * MB.randn()));
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  };
  /** 시드 고정 난수 (장면 텍스처가 매번 같게) */
  MB.rng = function (seed = 1) {
    let s = seed >>> 0 || 1;
    const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    r.range = (a, b) => a + (b - a) * r();
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    return r;
  };
  /** 숫자 포맷: 유효 자리 */
  MB.fmt = function (x, digits = 3) {
    if (!isFinite(x)) return "—";
    if (x === 0) return "0";
    const a = Math.abs(x);
    if (a >= 1e6 || a < 1e-3) return x.toExponential(digits - 1).replace("e+", "e");
    return Number(x.toPrecision(digits)).toLocaleString("en-US", { maximumFractionDigits: 6 });
  };
  /** 부호 포함 (±) 포맷 */
  MB.signed = (x, d = 1) => (x > 0.0001 ? "+" : x < -0.0001 ? "−" : "±") + Math.abs(x).toFixed(d);

  /* ------------------------------------------------------------ theme */
  const themeCbs = [];
  MB.onTheme = (cb) => themeCbs.push(cb);
  MB.isDark = function () {
    const t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  };
  MB.color = function (name) {
    return getComputedStyle(document.documentElement).getPropertyValue("--" + name).trim();
  };
  MB.palette = function () {
    const c = MB.color;
    return {
      bg: c("canvas-bg"), text: c("text"), dim: c("text-dim"), faint: c("text-faint"),
      grid: c("grid"), axis: c("axis"), border: c("border"), surface: c("surface"), elev: c("bg-elev"),
      accent: c("accent"), accent2: c("accent-2"), ok: c("ok"), warn: c("warn"), bad: c("bad"),
      red: c("red"), green: c("green"), blue: c("blue"),
      series: [c("accent"), c("accent-2"), c("warn"), c("ok"), c("bad"), c("text-dim")],
    };
  };
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
    themeCbs.forEach((cb) => { try { cb(); } catch (e) { console.error(e); } });
  }
  try { const saved = localStorage.getItem("music-theme"); if (saved) document.documentElement.setAttribute("data-theme", saved); } catch (e) {}
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
      if (!document.documentElement.getAttribute("data-theme")) applyTheme(null);
    });
  }

  /* ------------------------------------------------------------ canvas helper */
  /**
   * HiDPI 캔버스. 폭은 부모 폭을 따르고 높이는 aspect(높이/폭) 또는 height(px)로 결정.
   *   const cv = MB.canvas(el, (ctx,w,h)=>{...}, {aspect:0.5, maxHeight: 420});  aspect는 폭→비율 함수도 가능
   */
  MB.canvas = function (canvas, draw, opts = {}) {
    if (typeof canvas === "string") canvas = document.querySelector(canvas);
    const ctx = canvas.getContext("2d");
    const st = { ctx, w: 0, h: 0, canvas, dpr: 1 };
    function resize() {
      const parent = canvas.parentElement;
      const w = Math.max(200, Math.floor(opts.width || parent.clientWidth || 600));
      let h = opts.height || Math.round(w * (typeof opts.aspect === "function" ? opts.aspect(w) : opts.aspect || 0.5));
      if (opts.minHeight) h = Math.max(h, opts.minHeight);
      if (opts.maxHeight) h = Math.min(h, opts.maxHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      st.w = w; st.h = h; st.dpr = dpr;
      st.redraw();
    }
    st.redraw = function () {
      if (!st.w) return;
      ctx.save();
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      if (!opts.noClear) {
        ctx.clearRect(0, 0, st.w, st.h);
        ctx.fillStyle = MB.color("canvas-bg");
        ctx.fillRect(0, 0, st.w, st.h);
      }
      try { draw && draw(ctx, st.w, st.h); } finally { ctx.restore(); }
    };
    st.resize = resize;
    if (window.ResizeObserver) {
      let lastW = -1;
      new ResizeObserver(() => { const w = canvas.parentElement.clientWidth; if (w !== lastW) { lastW = w; resize(); } }).observe(canvas.parentElement);
    } else window.addEventListener("resize", resize);
    MB.onTheme(() => st.redraw());
    resize();
    return st;
  };

  /** 화면에 보일 때만 도는 애니메이션 루프. fn(dt초, t초) */
  MB.loop = function (el, fn) {
    let raf = 0, last = 0, t = 0, visible = true, running = true;
    function frame(ts) {
      raf = 0;
      if (!running || !visible) return;
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
      last = ts; t += dt;
      fn(dt, t);
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && running && visible) { last = 0; raf = requestAnimationFrame(frame); } }
    if (window.IntersectionObserver && el) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }).observe(el);
    }
    kick();
    return {
      start() { running = true; kick(); },
      stop() { running = false; },
      get running() { return running; },
      toggle() { running ? (running = false) : ((running = true), kick()); return running; },
    };
  };

  /** 다음 프레임에 한 번만 실행 (슬라이더 입력 폭주 방지) */
  MB.throttle = function (fn) {
    let pending = false;
    return function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; fn(); });
    };
  };

  /* ------------------------------------------------------------ chart helper */
  /**
   * 간단한 선 그래프. box = {x,y,w,h}(생략 시 캔버스 전체에 여백 자동)
   * opts: { x:[min,max], y:[min,max], logX, logY, xLabel, yLabel, xTicks, yTicks,
   *         xFmt, yFmt, series:[{data:[[x,y],...], color, width, dash, fill}],
   *         vlines:[{x,color,label,dash}], hlines:[{y,color,label,dash}], points:[{x,y,color,r,label}],
   *         bands:[{x0,x1,color}] }
   */
  MB.chart = function (ctx, box, opts) {
    const P = MB.palette();
    const dpr = (ctx.getTransform && ctx.getTransform().a) || 1;
    const W = ctx.canvas.width / dpr, H = ctx.canvas.height / dpr;
    if (!box) box = { x: 58, y: 16, w: W - 58 - 18, h: H - 16 - 46 };
    const [x0, x1] = opts.x, [y0, y1] = opts.y;
    const lx = (v) => (opts.logX ? Math.log10(v) : v);
    const ly = (v) => (opts.logY ? Math.log10(v) : v);
    const X = (v) => box.x + ((lx(v) - lx(x0)) / (lx(x1) - lx(x0))) * box.w;
    const Y = (v) => box.y + box.h - ((ly(v) - ly(y0)) / (ly(y1) - ly(y0))) * box.h;
    const ticks = (a, b, log, n) => {
      if (log) { const out = []; for (let e = Math.ceil(Math.log10(a) - 1e-9); e <= Math.log10(b) + 1e-9; e++) out.push(Math.pow(10, e)); return out; }
      const span = b - a, raw = span / (n || 5), mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= (n || 5) + 0.5) || raw;
      const out = []; for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
      return out;
    };
    const defFmt = (v) => (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(0).replace("e+", "e") : String(Number(v.toPrecision(4))));
    const xFmt = opts.xFmt || defFmt, yFmt = opts.yFmt || defFmt;
    ctx.save();
    ctx.font = "11px " + getComputedStyle(document.body).getPropertyValue("--mono");
    ctx.lineWidth = 1;
    (opts.bands || []).forEach((b) => { ctx.fillStyle = b.color; ctx.fillRect(X(b.x0), box.y, X(b.x1) - X(b.x0), box.h); });
    const xt = opts.xTicks || ticks(x0, x1, opts.logX, 6);
    const yt = opts.yTicks || ticks(y0, y1, opts.logY, 5);
    ctx.strokeStyle = P.grid; ctx.fillStyle = P.dim;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    xt.forEach((v) => { const px = X(v); if (px < box.x - 1 || px > box.x + box.w + 1) return; ctx.beginPath(); ctx.moveTo(px, box.y); ctx.lineTo(px, box.y + box.h); ctx.stroke(); ctx.fillText(xFmt(v), px, box.y + box.h + 6); });
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    yt.forEach((v) => { const py = Y(v); if (py < box.y - 1 || py > box.y + box.h + 1) return; ctx.beginPath(); ctx.moveTo(box.x, py); ctx.lineTo(box.x + box.w, py); ctx.stroke(); ctx.fillText(yFmt(v), box.x - 6, py); });
    ctx.strokeStyle = P.axis;
    ctx.beginPath(); ctx.moveTo(box.x, box.y); ctx.lineTo(box.x, box.y + box.h); ctx.lineTo(box.x + box.w, box.y + box.h); ctx.stroke();
    ctx.fillStyle = P.dim; ctx.font = "12px " + getComputedStyle(document.body).getPropertyValue("--font");
    if (opts.xLabel) { ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(opts.xLabel, box.x + box.w / 2, box.y + box.h + 40); }
    if (opts.yLabel) { ctx.save(); ctx.translate(14, box.y + box.h / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(opts.yLabel, 0, 0); ctx.restore(); }
    ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y - 2, box.w + 2, box.h + 4); ctx.clip();
    (opts.series || []).forEach((s, i) => {
      if (!s.data || !s.data.length) return;
      ctx.strokeStyle = s.color || P.series[i % P.series.length];
      ctx.lineWidth = s.width || 2; ctx.setLineDash(s.dash || []);
      ctx.beginPath();
      let started = false;
      s.data.forEach(([x, y]) => { if (!isFinite(y) || (opts.logY && y <= 0) || (opts.logX && x <= 0)) { started = false; return; } const px = X(x), py = Y(y); started ? ctx.lineTo(px, py) : ctx.moveTo(px, py); started = true; });
      ctx.stroke();
      if (s.fill) {
        ctx.lineTo(X(s.data[s.data.length - 1][0]), Y(opts.logY ? y0 : Math.max(y0, 0)));
        ctx.lineTo(X(s.data[0][0]), Y(opts.logY ? y0 : Math.max(y0, 0)));
        ctx.closePath(); ctx.fillStyle = s.fill; ctx.fill();
      }
      ctx.setLineDash([]);
    });
    (opts.vlines || []).forEach((l) => { ctx.strokeStyle = l.color || P.faint; ctx.setLineDash(l.dash || [4, 4]); ctx.lineWidth = l.width || 1.2; ctx.beginPath(); ctx.moveTo(X(l.x), box.y); ctx.lineTo(X(l.x), box.y + box.h); ctx.stroke(); ctx.setLineDash([]); if (l.label) { ctx.fillStyle = l.color || P.dim; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(l.label, X(l.x) + 4, box.y + 4); } });
    (opts.hlines || []).forEach((l) => { ctx.strokeStyle = l.color || P.faint; ctx.setLineDash(l.dash || [4, 4]); ctx.lineWidth = l.width || 1.2; ctx.beginPath(); ctx.moveTo(box.x, Y(l.y)); ctx.lineTo(box.x + box.w, Y(l.y)); ctx.stroke(); ctx.setLineDash([]); if (l.label) { ctx.fillStyle = l.color || P.dim; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText(l.label, box.x + box.w - 4, Y(l.y) - 3); } });
    (opts.points || []).forEach((p) => { ctx.fillStyle = p.color || P.accent; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), p.r || 4, 0, Math.PI * 2); ctx.fill(); if (p.label) { ctx.fillStyle = P.text; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(p.label, X(p.x) + 6, Y(p.y) - 4); } });
    ctx.restore();
    ctx.restore();
    return { X, Y, box };
  };

  /* ------------------------------------------------------------ controls */
  /**
   * range 입력 바인딩. output은 id+"-out" 요소.
   *   const get = MB.range('ev', v => v+' EV', v => redraw());  get() → 현재 값(Number)
   */
  MB.range = function (id, fmt, onInput) {
    const el = typeof id === "string" ? document.getElementById(id) : id;
    const out = document.getElementById(el.id + "-out") || document.querySelector(`output[for="${el.id}"]`);
    const update = (fire) => {
      const v = Number(el.value);
      const pct = ((v - Number(el.min || 0)) / (Number(el.max || 100) - Number(el.min || 0))) * 100;
      el.style.setProperty("--fill", pct + "%");
      if (out) out.textContent = fmt ? fmt(v) : String(v);
      if (fire && onInput) onInput(v);
    };
    el.addEventListener("input", () => update(true));
    update(false);
    const get = () => Number(el.value);
    get.set = (v, fire = true) => { el.value = v; update(fire); };
    get.el = el;
    return get;
  };
  /**
   * 이산 값 목록 슬라이더(조리개·셔터·ISO 눈금). HTML은 <input type="range" id="..."> 만 두면 된다.
   *   const N = MB.steps('ap', MB.APERTURES, MB.fmtN, 5.6, v => redraw());  N() → 값
   */
  MB.steps = function (id, list, fmt, initial, onInput) {
    const el = typeof id === "string" ? document.getElementById(id) : id;
    el.min = 0; el.max = list.length - 1; el.step = 1;
    el.value = initial != null ? MB.nearest(list, initial) : 0;
    const r = MB.range(el, (i) => (fmt ? fmt(list[i]) : String(list[i])), (i) => onInput && onInput(list[i]));
    const get = () => list[r()];
    get.set = (v, fire = true) => r.set(MB.nearest(list, v), fire);
    get.index = r;
    get.el = el;
    return get;
  };
  /** 세그먼트 버튼: <div class="seg" id="mode"><button data-value="a" class="on">A</button>...</div> */
  MB.seg = function (id, onChange) {
    const el = typeof id === "string" ? document.getElementById(id) : id;
    const btns = [...el.querySelectorAll("button")];
    let cur = (btns.find((b) => b.classList.contains("on")) || btns[0]).dataset.value;
    const set = (v, fire = true) => {
      cur = v;
      btns.forEach((b) => { const on = b.dataset.value === v; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
      if (fire && onChange) onChange(v);
    };
    btns.forEach((b) => b.addEventListener("click", () => set(b.dataset.value)));
    set(cur, false);
    const get = () => cur;
    get.set = set;
    return get;
  };
  /** 체크박스 바인딩 */
  MB.check = function (id, onChange) {
    const el = document.getElementById(id);
    el.addEventListener("change", () => onChange && onChange(el.checked));
    const get = () => el.checked;
    get.set = (v) => { el.checked = v; onChange && onChange(v); };
    return get;
  };
  MB.stat = function (id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  MB.nearest = function (list, v, log = false) {
    let bi = 0, bd = Infinity;
    list.forEach((x, i) => { const d = log ? Math.abs(Math.log(x) - Math.log(v)) : Math.abs(x - v); if (d < bd) { bd = d; bi = i; } });
    return bi;
  };
  MB.mod = (n, m) => ((n % m) + m) % m;

  /* ==================================================================== music theory */
  MB.A4 = 440;
  /** MIDI 번호 → 주파수(12평균율, A4=69) */
  MB.mtof = (m, a4 = MB.A4) => a4 * Math.pow(2, (m - 69) / 12);
  /** 주파수 → (실수) MIDI 번호 */
  MB.ftom = (f, a4 = MB.A4) => 69 + 12 * Math.log2(f / a4);
  /** 주파수비 → 센트 */
  MB.cents = (ratio) => 1200 * Math.log2(ratio);
  MB.fromCents = (c) => Math.pow(2, c / 1200);
  MB.SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  MB.FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
  MB.SOLFEGE = ["도", "도♯", "레", "레♯", "미", "파", "파♯", "솔", "솔♯", "라", "라♯", "시"];
  /** 피치 클래스(0–11) 이름 */
  MB.pcName = (pc, flat = false) => (flat ? MB.FLAT_NAMES : MB.SHARP_NAMES)[MB.mod(pc, 12)];
  /** MIDI 번호 → "C4", "F♯3" (C4=60) */
  MB.noteName = (m, flat = false, octave = true) => MB.pcName(Math.round(m), flat) + (octave ? Math.floor(Math.round(m) / 12) - 1 : "");
  /** "C#4", "Eb3", "F♯5", "Bb" → MIDI 번호(옥타브 생략 시 4) */
  MB.parseNote = function (s) {
    const m = /^\s*([A-Ga-g])([#♯b♭]*)(-?\d+)?\s*$/.exec(s);
    if (!m) return NaN;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
    let acc = 0;
    for (const ch of m[2]) acc += ch === "#" || ch === "♯" ? 1 : -1;
    const oct = m[3] != null ? +m[3] : 4;
    return 12 * (oct + 1) + base + acc;
  };
  /** 조표에 따라 플랫 표기를 쓸지 (F, B♭, E♭, A♭, D♭, G♭ 장조와 그 관계단조) */
  MB.prefersFlats = (keyPc, minor = false) => [5, 10, 3, 8, 1, 6].includes(MB.mod(keyPc + (minor ? 3 : 0), 12));

  /** 음정 이름(반음 수 0–24) */
  MB.INTERVALS = [
    { s: 0, short: "P1", name: "완전 1도", en: "unison", ratio: [1, 1] },
    { s: 1, short: "m2", name: "단 2도", en: "minor 2nd", ratio: [16, 15] },
    { s: 2, short: "M2", name: "장 2도", en: "major 2nd", ratio: [9, 8] },
    { s: 3, short: "m3", name: "단 3도", en: "minor 3rd", ratio: [6, 5] },
    { s: 4, short: "M3", name: "장 3도", en: "major 3rd", ratio: [5, 4] },
    { s: 5, short: "P4", name: "완전 4도", en: "perfect 4th", ratio: [4, 3] },
    { s: 6, short: "TT", name: "증 4도/감 5도", en: "tritone", ratio: [45, 32] },
    { s: 7, short: "P5", name: "완전 5도", en: "perfect 5th", ratio: [3, 2] },
    { s: 8, short: "m6", name: "단 6도", en: "minor 6th", ratio: [8, 5] },
    { s: 9, short: "M6", name: "장 6도", en: "major 6th", ratio: [5, 3] },
    { s: 10, short: "m7", name: "단 7도", en: "minor 7th", ratio: [9, 5] },
    { s: 11, short: "M7", name: "장 7도", en: "major 7th", ratio: [15, 8] },
    { s: 12, short: "P8", name: "완전 8도", en: "octave", ratio: [2, 1] },
  ];
  MB.intervalName = (semis) => { const s = MB.mod(semis, 12), o = Math.floor(Math.abs(semis) / 12); const it = MB.INTERVALS[s]; return (semis !== 0 && s === 0) ? (o > 1 ? o + "옥타브" : "완전 8도") : it.name + (o ? " + " + o + "옥타브" : ""); };

  /** 음계: 근음으로부터의 반음 */
  MB.SCALES = {
    major:      { name: "장음계(이오니안)", steps: [0, 2, 4, 5, 7, 9, 11] },
    dorian:     { name: "도리안", steps: [0, 2, 3, 5, 7, 9, 10] },
    phrygian:   { name: "프리지안", steps: [0, 1, 3, 5, 7, 8, 10] },
    lydian:     { name: "리디안", steps: [0, 2, 4, 6, 7, 9, 11] },
    mixolydian: { name: "믹솔리디안", steps: [0, 2, 4, 5, 7, 9, 10] },
    minor:      { name: "자연단음계(에올리안)", steps: [0, 2, 3, 5, 7, 8, 10] },
    locrian:    { name: "로크리안", steps: [0, 1, 3, 5, 6, 8, 10] },
    harmonicMinor: { name: "화성단음계", steps: [0, 2, 3, 5, 7, 8, 11] },
    melodicMinor:  { name: "가락단음계(재즈)", steps: [0, 2, 3, 5, 7, 9, 11] },
    majorPent:  { name: "장조 5음음계", steps: [0, 2, 4, 7, 9] },
    minorPent:  { name: "단조 5음음계", steps: [0, 3, 5, 7, 10] },
    blues:      { name: "블루스", steps: [0, 3, 5, 6, 7, 10] },
    wholeTone:  { name: "온음음계", steps: [0, 2, 4, 6, 8, 10] },
    dimHW:      { name: "디미니시(반–온)", steps: [0, 1, 3, 4, 6, 7, 9, 10] },
    chromatic:  { name: "반음계", steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  };
  /** 음계의 n번째 음(0부터, 음수·옥타브 넘김 허용) → MIDI */
  MB.scaleNote = function (rootMidi, steps, degree) {
    const n = steps.length, o = Math.floor(degree / n);
    return rootMidi + 12 * o + steps[MB.mod(degree, n)];
  };
  /** 피치 클래스 집합 ↔ 12비트 마스크 (비트 i = 피치 클래스 i) */
  MB.pcsToMask = (pcs) => pcs.reduce((m, p) => m | (1 << MB.mod(p, 12)), 0);
  MB.maskToPcs = (mask) => { const o = []; for (let i = 0; i < 12; i++) if (mask & (1 << i)) o.push(i); return o; };
  /** 음정 벡터(ic1..ic6 개수) */
  MB.intervalVector = function (pcs) {
    const v = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < pcs.length; i++) for (let j = i + 1; j < pcs.length; j++) {
      const d = MB.mod(pcs[j] - pcs[i], 12), ic = Math.min(d, 12 - d);
      if (ic) v[ic - 1]++;
    }
    return v;
  };

  /** 화음 종류: 근음으로부터의 반음, 표기 접미사 */
  MB.CHORDS = {
    maj:   { name: "장3화음", sym: "", iv: [0, 4, 7] },
    min:   { name: "단3화음", sym: "m", iv: [0, 3, 7] },
    dim:   { name: "감3화음", sym: "dim", iv: [0, 3, 6] },
    aug:   { name: "증3화음", sym: "aug", iv: [0, 4, 8] },
    sus2:  { name: "서스2", sym: "sus2", iv: [0, 2, 7] },
    sus4:  { name: "서스4", sym: "sus4", iv: [0, 5, 7] },
    maj6:  { name: "장6", sym: "6", iv: [0, 4, 7, 9] },
    min6:  { name: "단6", sym: "m6", iv: [0, 3, 7, 9] },
    dom7:  { name: "속7(도미넌트 7)", sym: "7", iv: [0, 4, 7, 10] },
    maj7:  { name: "장7", sym: "maj7", iv: [0, 4, 7, 11] },
    min7:  { name: "단7", sym: "m7", iv: [0, 3, 7, 10] },
    mMaj7: { name: "단장7", sym: "m(maj7)", iv: [0, 3, 7, 11] },
    hdim7: { name: "반감7", sym: "m7♭5", iv: [0, 3, 6, 10] },
    dim7:  { name: "감7", sym: "dim7", iv: [0, 3, 6, 9] },
    aug7:  { name: "증7", sym: "7♯5", iv: [0, 4, 8, 10] },
    sus47: { name: "7sus4", sym: "7sus4", iv: [0, 5, 7, 10] },
    add9:  { name: "add9", sym: "add9", iv: [0, 4, 7, 14] },
    dom9:  { name: "속9", sym: "9", iv: [0, 4, 7, 10, 14] },
    maj9:  { name: "장9", sym: "maj9", iv: [0, 4, 7, 11, 14] },
    min9:  { name: "단9", sym: "m9", iv: [0, 3, 7, 10, 14] },
    dom7b9:{ name: "7♭9", sym: "7♭9", iv: [0, 4, 7, 10, 13] },
    dom7s9:{ name: "7♯9", sym: "7♯9", iv: [0, 4, 7, 10, 15] },
    dom11: { name: "11", sym: "11", iv: [0, 7, 10, 14, 17] },
    min11: { name: "단11", sym: "m11", iv: [0, 3, 7, 10, 14, 17] },
    maj7s11:{ name: "maj7♯11", sym: "maj7♯11", iv: [0, 4, 7, 11, 18] },
    dom13: { name: "13", sym: "13", iv: [0, 4, 7, 10, 14, 21] },
    pow:   { name: "파워 코드", sym: "5", iv: [0, 7] },
  };
  /** 화음 → MIDI 배열. root는 MIDI 번호, inversion은 전위 수 */
  MB.chord = function (root, quality = "maj", inversion = 0) {
    const iv = (MB.CHORDS[quality] || MB.CHORDS.maj).iv.slice();
    const notes = iv.map((i) => root + i);
    for (let k = 0; k < inversion; k++) notes.push(notes.shift() + 12);
    return notes;
  };
  MB.chordSymbol = (rootPc, quality, flat = false, bassPc = null) =>
    MB.pcName(rootPc, flat) + (MB.CHORDS[quality] ? MB.CHORDS[quality].sym : quality) + (bassPc != null && MB.mod(bassPc, 12) !== MB.mod(rootPc, 12) ? "/" + MB.pcName(bassPc, flat) : "");
  /**
   * 음들(MIDI 또는 피치 클래스)의 화음 이름 추정. 모든 근음 후보 × 화음 사전으로 점수를 매긴다.
   * → [{root, quality, sym, score, missing:[], extra:[]}] 점수순
   */
  MB.detectChord = function (notes, flat = false) {
    if (!notes.length) return [];
    const pcs = [...new Set(notes.map((n) => MB.mod(n, 12)))];
    const bass = MB.mod(Math.min(...notes), 12);
    const out = [];
    for (const root of pcs) {
      for (const [q, c] of Object.entries(MB.CHORDS)) {
        const cp = new Set(c.iv.map((i) => MB.mod(root + i, 12)));
        const missing = [...cp].filter((p) => !pcs.includes(p));
        const extra = pcs.filter((p) => !cp.has(p));
        if (missing.length > 1 || extra.length) continue;
        // 5음 생략은 흔하므로 감점 적게
        const fifthMissing = missing.length === 1 && MB.mod(missing[0] - root, 12) === 7;
        let score = 10 - missing.length * (fifthMissing ? 1 : 4) - (c.iv.length - 3) * 0.6 + (root === bass ? 2 : 0) - (q === "pow" ? 1 : 0);
        if (["sus2", "sus4", "aug", "dim7", "maj6", "min6"].includes(q)) score -= 0.5;
        out.push({ root, quality: q, sym: MB.chordSymbol(root, q, flat, bass), score, missing, extra });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  };

  /** 다이아토닉 화음: key는 근음 피치 클래스, scale은 MB.SCALES 키, sevenths면 4화음 */
  MB.ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
  MB.diatonic = function (keyPc, scale = "major", sevenths = false) {
    const st = MB.SCALES[scale].steps;
    return st.map((_, d) => {
      const pick = (k) => MB.scaleNote(0, st, d + k) - st[d];
      const iv = sevenths ? [0, pick(2), pick(4), pick(6)] : [0, pick(2), pick(4)];
      const q = Object.keys(MB.CHORDS).find((k) => MB.CHORDS[k].iv.length === iv.length && MB.CHORDS[k].iv.every((x, i) => x === iv[i])) || "maj";
      let rn = MB.ROMAN[d];
      if (["min", "dim", "min7", "hdim7", "dim7", "mMaj7"].includes(q)) rn = rn.toLowerCase();
      const suffix = { dim: "°", hdim7: "ø7", dim7: "°7", aug: "+", dom7: "7", maj7: "maj7", min7: "7", mMaj7: "(maj7)", aug7: "+7" }[q] || "";
      return { degree: d, root: MB.mod(keyPc + st[d], 12), quality: q, roman: rn + suffix };
    });
  };
  /**
   * 보이스 리딩: 목표 화음의 피치 클래스를 이전 보이싱에서 가장 적게 움직이도록 배치.
   * prev: MIDI 배열(정렬), pcs: 목표 피치 클래스들. 같은 성부 수를 유지(필요하면 중복).
   */
  MB.voiceLead = function (prev, pcs, range = [48, 79]) {
    const n = prev.length;
    const cand = [];
    for (let m = range[0]; m <= range[1]; m++) if (pcs.includes(MB.mod(m, 12))) cand.push(m);
    let best = null, bestCost = Infinity;
    // 각 성부에 대해 가장 가까운 후보 몇 개만 조합(성부 수가 적어 전수 탐색 가능)
    const near = prev.map((p) => cand.slice().sort((a, b) => Math.abs(a - p) - Math.abs(b - p)).slice(0, 4));
    const rec = (i, acc, cost) => {
      if (cost >= bestCost) return;
      if (i === n) {
        const used = new Set(acc.map((m) => MB.mod(m, 12)));
        const miss = pcs.filter((p) => !used.has(p)).length;
        const c = cost + miss * 6 + (new Set(acc).size < n ? 8 : 0);
        if (c < bestCost) { bestCost = c; best = acc.slice(); }
        return;
      }
      for (const m of near[i]) { acc.push(m); rec(i + 1, acc, cost + Math.abs(m - prev[i])); acc.pop(); }
    };
    rec(0, [], 0);
    return (best || prev).slice().sort((a, b) => a - b);
  };

  /**
   * 조율 체계: 근음(key)으로부터 각 피치 클래스의 센트(평균율 대비 아닌 절대 센트, 0–1200)
   */
  const rc = (a, b) => MB.cents(a / b);
  MB.TUNINGS = {
    equal: { name: "12평균율", cents: [...Array(12)].map((_, i) => i * 100) },
    pythagorean: { name: "피타고라스", cents: [0, rc(256, 243), rc(9, 8), rc(32, 27), rc(81, 64), rc(4, 3), rc(729, 512), rc(3, 2), rc(128, 81), rc(27, 16), rc(16, 9), rc(243, 128)] },
    just: { name: "5한계 순정률", cents: [0, rc(16, 15), rc(9, 8), rc(6, 5), rc(5, 4), rc(4, 3), rc(45, 32), rc(3, 2), rc(8, 5), rc(5, 3), rc(9, 5), rc(15, 8)] },
    meantone: { name: "1/4 쉼표 중전음률", cents: (() => { const f = 696.5784; const pos = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]; const k = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5]; return [...Array(12)].map((_, pc) => MB.mod(k[pc] * f, 1200)); })() },
    werckmeister: { name: "베르크마이스터 III", cents: [0, 90.225, 192.18, 294.135, 390.225, 498.045, 588.27, 696.09, 792.18, 888.27, 996.09, 1092.18] },
  };
  /** 조율 체계에서 MIDI 음의 주파수. keyPc를 기준(순정)으로 잡는다. keyPc 음은 평균율과 같은 높이 */
  MB.tunedFreq = function (m, tuning = "equal", keyPc = 0, a4 = MB.A4) {
    const t = MB.TUNINGS[tuning] || MB.TUNINGS.equal;
    const rel = MB.mod(Math.round(m) - keyPc, 12);
    const base = Math.round(m) - rel; // 같은 옥타브 안의 근음
    return MB.mtof(base, a4) * MB.fromCents(t.cents[rel]);
  };

  /* ==================================================================== DSP */
  /** 제자리 radix-2 FFT. re, im 길이는 2의 거듭제곱 */
  MB.fft = function (re, im, inverse = false) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = ((inverse ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  };
  MB.WINDOWS = {
    rect: () => 1,
    hann: (i, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)),
    hamming: (i, n) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1)),
    blackman: (i, n) => 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (n - 1)),
  };
  /**
   * 크기 스펙트럼(dBFS 근사). 사인파 진폭 A → 약 20log10(A) dB가 되도록 창 이득 보정.
   * → Float32Array(n/2) dB
   */
  MB.spectrum = function (x, win = "hann", n) {
    n = n || 1 << Math.ceil(Math.log2(x.length));
    const re = new Float64Array(n), im = new Float64Array(n), w = MB.WINDOWS[win] || MB.WINDOWS.hann;
    let wsum = 0;
    for (let i = 0; i < Math.min(n, x.length); i++) { const wi = w(i, Math.min(n, x.length)); re[i] = x[i] * wi; wsum += wi; }
    MB.fft(re, im);
    const out = new Float32Array(n / 2);
    for (let k = 0; k < n / 2; k++) out[k] = 20 * Math.log10((2 * Math.hypot(re[k], im[k])) / wsum + 1e-12);
    return out;
  };
  MB.db = (g) => 20 * Math.log10(Math.max(1e-12, g));
  MB.undb = (d) => Math.pow(10, d / 20);
  /** RBJ 쿡북 바이쿼드 계수. type: lowpass highpass bandpass notch peaking lowshelf highshelf allpass */
  MB.biquad = function (type, f0, Q = 0.7071, gainDb = 0, fs = 48000) {
    const A = Math.pow(10, gainDb / 40), w = (2 * Math.PI * f0) / fs, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * Q);
    let b0, b1, b2, a0, a1, a2;
    switch (type) {
      case "lowpass": b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
      case "highpass": b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
      case "bandpass": b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
      case "notch": b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
      case "allpass": b0 = 1 - al; b1 = -2 * cw; b2 = 1 + al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
      case "peaking": b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; break;
      case "lowshelf": { const s = 2 * Math.sqrt(A) * al; b0 = A * (A + 1 - (A - 1) * cw + s); b1 = 2 * A * (A - 1 - (A + 1) * cw); b2 = A * (A + 1 - (A - 1) * cw - s); a0 = A + 1 + (A - 1) * cw + s; a1 = -2 * (A - 1 + (A + 1) * cw); a2 = A + 1 + (A - 1) * cw - s; break; }
      case "highshelf": { const s = 2 * Math.sqrt(A) * al; b0 = A * (A + 1 + (A - 1) * cw + s); b1 = -2 * A * (A - 1 + (A + 1) * cw); b2 = A * (A + 1 + (A - 1) * cw - s); a0 = A + 1 - (A - 1) * cw + s; a1 = 2 * (A - 1 - (A + 1) * cw); a2 = A + 1 - (A - 1) * cw - s; break; }
      default: b0 = 1; b1 = b2 = a1 = a2 = 0; a0 = 1;
    }
    return { b: [b0 / a0, b1 / a0, b2 / a0], a: [1, a1 / a0, a2 / a0] };
  };
  /** 바이쿼드(또는 {b,a} 배열) 주파수 응답 |H(f)| dB */
  MB.freqResponse = function (coefs, f, fs = 48000) {
    const list = Array.isArray(coefs) ? coefs : [coefs];
    let db = 0;
    for (const { b, a } of list) {
      const w = (2 * Math.PI * f) / fs;
      const ev = (c) => { let r = 0, i = 0; c.forEach((v, k) => { r += v * Math.cos(-k * w); i += v * Math.sin(-k * w); }); return Math.hypot(r, i); };
      db += 20 * Math.log10(ev(b) / ev(a));
    }
    return db;
  };

  /* ==================================================================== audio engine */
  let actx = null, master = null, limiter = null, analyser = null, muted = false, masterVol = 0.8;
  try { muted = localStorage.getItem("mb-muted") === "1"; } catch (e) {}
  /** AudioContext(첫 호출 시 생성). 반드시 사용자 클릭·키 입력 안에서 처음 호출한다. */
  MB.ctx = function () {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC({ latencyHint: "interactive" });
      master = actx.createGain();
      master.gain.value = muted ? 0 : masterVol;
      limiter = actx.createDynamicsCompressor();
      limiter.threshold.value = -6; limiter.knee.value = 4; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.15;
      analyser = actx.createAnalyser();
      analyser.fftSize = 8192; analyser.smoothingTimeConstant = 0.6;
      master.connect(limiter); limiter.connect(analyser); analyser.connect(actx.destination);
      MB.out = master; MB.analyser = analyser;
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  };
  /** 지금 시각(오디오 시계, 초) */
  MB.now = () => (MB.ctx() ? actx.currentTime : 0);
  MB.isMuted = () => muted;
  MB.setMuted = function (m) {
    muted = m;
    try { localStorage.setItem("mb-muted", m ? "1" : "0"); } catch (e) {}
    if (master) master.gain.setTargetAtTime(m ? 0 : masterVol, actx.currentTime, 0.02);
    document.querySelectorAll(".mb-mute").forEach((b) => b.classList.toggle("muted", m));
  };
  const _activeVoices = new Set();
  /** 재생 중인 모든 음을 짧게 멈춘다(정지 버튼용) */
  MB.stopAll = function () {
    if (!actx) return;
    const t = actx.currentTime;
    _activeVoices.forEach((v) => { try { v.release(t, 0.03); } catch (e) {} });
    _activeVoices.clear();
  };

  /** 흰 잡음 버퍼(2초, 캐시) */
  const _noise = new WeakMap();
  MB.noiseBuffer = function (ctx = MB.ctx()) {
    if (_noise.has(ctx)) return _noise.get(ctx);
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    _noise.set(ctx, b);
    return b;
  };
  /** 배음 진폭(·위상) 배열 → PeriodicWave. amps[0]은 기본음(1배음). */
  MB.wave = function (amps, phases, ctx = MB.ctx()) {
    const n = amps.length + 1, real = new Float32Array(n), imag = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      const a = amps[k - 1] || 0, ph = phases ? phases[k - 1] || 0 : 0;
      // sin(ωt + φ) = sinφ·cos(ωt) + cosφ·sin(ωt)
      real[k] = a * Math.sin(ph); imag[k] = a * Math.cos(ph);
    }
    return ctx.createPeriodicWave(real, imag, { disableNormalization: true });
  };
  /** 표준 파형의 배음 진폭(n개) */
  MB.harmonicsOf = function (type, n = 32) {
    return [...Array(n)].map((_, i) => {
      const k = i + 1;
      if (type === "saw") return (2 / Math.PI) / k;
      if (type === "square") return k % 2 ? (4 / Math.PI) / k : 0;
      if (type === "triangle") return k % 2 ? ((8 / (Math.PI * Math.PI)) / (k * k)) * (((k - 1) / 2) % 2 ? -1 : 1) : 0;
      return k === 1 ? 1 : 0;
    });
  };

  /**
   * ADSR 엔벨로프를 GainParam에 건다. 해석적으로 레벨을 계산하므로 release 시점이 언제든 끊김(클릭)이 없다.
   *   const env = MB.adsr(param, t0, {a,d,s,r,peak});  env.release(t) → 끝나는 시각
   */
  MB.adsr = function (param, t0, o = {}) {
    const a = Math.max(0.002, o.a != null ? o.a : 0.01), d = Math.max(0.005, o.d != null ? o.d : 0.1), s = o.s != null ? o.s : 0.8, r = Math.max(0.005, o.r != null ? o.r : 0.2), pk = o.peak != null ? o.peak : 1;
    const tauD = d / 4;
    param.cancelScheduledValues(t0);
    param.setValueAtTime(0, t0);
    param.linearRampToValueAtTime(pk, t0 + a);
    param.setTargetAtTime(pk * s, t0 + a, tauD);
    const level = (t) => (t <= t0 ? 0 : t < t0 + a ? (pk * (t - t0)) / a : pk * s + (pk - pk * s) * Math.exp(-(t - t0 - a) / tauD));
    return {
      level,
      release(t, rr = r) {
        t = Math.max(t, t0 + 0.004);
        const L = level(t);
        param.cancelScheduledValues(t);
        param.setValueAtTime(L, t);
        param.setTargetAtTime(0, t, rr / 5);
        return t + rr;
      },
    };
  };

  /**
   * 악기 정의. 각 악기는 (ctx, freq, t0, vel, dest, o) → voice {release(t), end} 를 만든다.
   * 같은 정의를 OfflineAudioContext에서도 쓸 수 있다.
   */
  const INST = {};
  function oscVoice(ctx, freq, t0, vel, dest, o, cfg) {
    const g = ctx.createGain();
    const out = ctx.createGain(); out.gain.value = vel * (cfg.gain || 0.3);
    const nodes = [];
    (cfg.oscs || [{ type: cfg.type || "sine" }]).forEach((oc) => {
      const osc = ctx.createOscillator();
      if (oc.wave) osc.setPeriodicWave(oc.wave(ctx)); else osc.type = oc.type || "sine";
      osc.frequency.value = freq * (oc.ratio || 1);
      if (oc.detune) osc.detune.value = oc.detune;
      if (o.detune) osc.detune.value += o.detune;
      const og = ctx.createGain(); og.gain.value = oc.gain != null ? oc.gain : 1;
      osc.connect(og); og.connect(g);
      osc.start(t0);
      nodes.push(osc);
    });
    let last = g;
    if (cfg.filter) {
      const f = ctx.createBiquadFilter(); f.type = cfg.filter.type || "lowpass"; f.Q.value = cfg.filter.Q || 0.8;
      const base = typeof cfg.filter.freq === "function" ? cfg.filter.freq(freq, vel) : cfg.filter.freq;
      f.frequency.setValueAtTime(base * (cfg.filter.envAmt || 1), t0);
      if (cfg.filter.envAmt) f.frequency.setTargetAtTime(base, t0 + 0.005, cfg.filter.envTau || 0.15);
      g.connect(f); last = f;
    }
    last.connect(out); out.connect(dest);
    const env = MB.adsr(g.gain, t0, Object.assign({}, cfg.env, o.env));
    const v = {
      nodes,
      release(t, rr) { const end = env.release(t, rr); nodes.forEach((n) => { try { n.stop(end + 0.05); } catch (e) {} }); v.end = end; return end; },
    };
    if (cfg.oneShot) { const end = t0 + cfg.oneShot; nodes.forEach((n) => n.stop(end)); v.end = end; }
    return v;
  }
  const pianoAmps = [1, 0.45, 0.32, 0.18, 0.14, 0.09, 0.06, 0.05, 0.03, 0.02, 0.015, 0.01];
  const organAmps = [1, 0.75, 0.0, 0.55, 0.0, 0.35, 0.0, 0.25]; // 드로바 8' 4' 2' 1' 근사
  const _waveCache = new WeakMap();
  const cachedWave = (key, amps) => (ctx) => {
    let m = _waveCache.get(ctx); if (!m) _waveCache.set(ctx, (m = {}));
    return m[key] || (m[key] = MB.wave(amps, null, ctx));
  };
  INST.sine = (ctx, f, t0, v, d, o) => oscVoice(ctx, f, t0, v, d, o, { type: "sine", gain: 0.35, env: { a: 0.01, d: 0.1, s: 0.85, r: 0.15 } });
  INST.triangle = (ctx, f, t0, v, d, o) => oscVoice(ctx, f, t0, v, d, o, { type: "triangle", gain: 0.35, env: { a: 0.01, d: 0.1, s: 0.85, r: 0.15 } });
  INST.square = (ctx, f, t0, v, d, o) => oscVoice(ctx, f, t0, v, d, o, { type: "square", gain: 0.12, env: { a: 0.01, d: 0.1, s: 0.85, r: 0.12 } });
  INST.saw = (ctx, f, t0, v, d, o) => oscVoice(ctx, f, t0, v, d, o, { type: "sawtooth", gain: 0.14, env: { a: 0.01, d: 0.1, s: 0.85, r: 0.12 } });
  INST.organ = (ctx, f, t0, v, d, o) => oscVoice(ctx, f, t0, v, d, o, { oscs: [{ wave: cachedWave("organ", organAmps) }], gain: 0.16, env: { a: 0.012, d: 0.05, s: 1, r: 0.06 } });
  INST.piano = (ctx, f, t0, v, d, o) => oscVoice(ctx, f, t0, v, d, o, {
    oscs: [{ wave: cachedWave("piano", pianoAmps) }, { wave: cachedWave("piano", pianoAmps), detune: 3, gain: 0.5 }],
    gain: 0.2, filter: { type: "lowpass", freq: (fr, vel) => Math.min(16000, fr * (3 + 7 * vel)), envAmt: 2.2, envTau: 0.4 },
    env: { a: 0.004, d: 1.6 + 2.5 * Math.max(0, (60 - MB.ftom(f)) / 36), s: 0.0, r: 0.25 },
  });
  INST.epiano = function (ctx, f, t0, vel, dest, o) {
    // 2-오퍼레이터 FM (모듈레이터 비 1, 지수 감쇠하는 변조 지수) + 높은 '틴' 성분
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), out = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f;
    const I = 1.2 + 2.2 * vel;
    mg.gain.setValueAtTime(I * f, t0); mg.gain.setTargetAtTime(0.25 * f, t0, 0.35);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g);
    const tine = ctx.createOscillator(), tg = ctx.createGain(); tine.frequency.value = f * 14.0; tg.gain.setValueAtTime(0.08 * vel, t0); tg.gain.setTargetAtTime(0, t0, 0.03);
    tine.connect(tg); tg.connect(g);
    out.gain.value = 0.28 * vel; g.connect(out); out.connect(dest);
    const env = MB.adsr(g.gain, t0, Object.assign({ a: 0.003, d: 2.4, s: 0.0, r: 0.3 }, o.env));
    [car, mod, tine].forEach((n) => n.start(t0));
    return { release(t, rr) { const e = env.release(t, rr); [car, mod, tine].forEach((n) => n.stop(e + 0.05)); this.end = e; return e; } };
  };
  INST.bell = function (ctx, f, t0, vel, dest, o) {
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), out = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(5 * f, t0); mg.gain.setTargetAtTime(0, t0, 1.2);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g);
    out.gain.value = 0.22 * vel; g.connect(out); out.connect(dest);
    const env = MB.adsr(g.gain, t0, Object.assign({ a: 0.002, d: 4, s: 0, r: 0.6 }, o.env));
    [car, mod].forEach((n) => n.start(t0));
    return { release(t, rr) { const e = env.release(t, rr); [car, mod].forEach((n) => n.stop(e + 0.05)); this.end = e; return e; } };
  };
  INST.pad = (ctx, f, t0, v, d, o) => oscVoice(ctx, f, t0, v, d, o, {
    oscs: [{ type: "sawtooth", detune: -7 }, { type: "sawtooth", detune: 7 }, { type: "triangle", ratio: 0.5, gain: 0.6 }],
    gain: 0.07, filter: { type: "lowpass", freq: (fr) => Math.min(5000, 900 + fr * 2), Q: 0.6 }, env: { a: 0.25, d: 0.4, s: 0.8, r: 0.7 },
  });
  INST.strings = (ctx, f, t0, v, d, o) => oscVoice(ctx, f, t0, v, d, o, {
    oscs: [{ type: "sawtooth", detune: -5 }, { type: "sawtooth", detune: 6 }],
    gain: 0.08, filter: { type: "lowpass", freq: (fr) => Math.min(7000, 1500 + fr * 3), Q: 0.5 }, env: { a: 0.12, d: 0.3, s: 0.85, r: 0.4 },
  });
  INST.bass = (ctx, f, t0, v, d, o) => oscVoice(ctx, f, t0, v, d, o, {
    oscs: [{ type: "sawtooth" }, { type: "square", ratio: 0.5, gain: 0.5 }],
    gain: 0.22, filter: { type: "lowpass", freq: (fr, vel) => 200 + fr * 1.5 * vel, Q: 4, envAmt: 4, envTau: 0.08 },
    env: { a: 0.004, d: 0.35, s: 0.55, r: 0.08 },
  });
  INST.lead = (ctx, f, t0, v, d, o) => oscVoice(ctx, f, t0, v, d, o, {
    oscs: [{ type: "square" }, { type: "sawtooth", detune: 8, gain: 0.6 }],
    gain: 0.09, filter: { type: "lowpass", freq: (fr) => Math.min(9000, fr * 6), Q: 2, envAmt: 2, envTau: 0.12 }, env: { a: 0.01, d: 0.2, s: 0.7, r: 0.12 },
  });
  /** 카플러스–스트롱 뜯은 현. 버퍼를 만들어 재생(정수 지연 + 평균 필터의 반 샘플 지연을 재생 속도로 보정) */
  const _ksCache = new Map();
  MB.ksBuffer = function (ctx, f, o = {}) {
    const sr = ctx.sampleRate, dur = o.dur || 2.5, decay = o.decay != null ? o.decay : 0.996, bright = o.bright != null ? o.bright : 0.5, pos = o.pos || 0;
    const key = [sr, Math.round(f * 10), dur, decay, bright, pos, o.seed || 0].join("|");
    if (_ksCache.has(key)) return _ksCache.get(key);
    const N = Math.max(2, Math.floor(sr / f - 0.5));
    const len = Math.floor(sr * dur), b = ctx.createBuffer(1, len, sr), y = b.getChannelData(0);
    const rnd = MB.rng(o.seed || 7 + N);
    const buf = new Float32Array(N);
    for (let i = 0; i < N; i++) buf[i] = rnd() * 2 - 1;
    // 밝기: 초기 잡음을 저역 통과(1차)로 다듬는다
    for (let p = 0, k = 1 - bright; p < 2; p++) for (let i = 1; i < N; i++) buf[i] = buf[i] * (1 - k) + buf[i - 1] * k;
    // 뜯는 위치: 위치 β에서 뜯으면 빗살(comb) 필터 x[n] − x[n − βN] 효과
    if (pos > 0) { const D = Math.max(1, Math.round(pos * N)); const c = buf.slice(); for (let i = 0; i < N; i++) buf[i] = c[i] - c[MB.mod(i - D, N)]; }
    let mean = 0; for (let i = 0; i < N; i++) mean += buf[i]; mean /= N; for (let i = 0; i < N; i++) buf[i] -= mean;
    let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(buf[i])); for (let i = 0; i < N; i++) buf[i] /= peak || 1;
    let idx = 0, prev = 0;
    for (let n = 0; n < len; n++) {
      const cur = buf[idx];
      const nv = decay * 0.5 * (cur + prev);
      prev = cur; y[n] = cur; buf[idx] = nv;
      idx = (idx + 1) % N;
    }
    b._rate = f / (sr / (N + 0.5));
    _ksCache.set(key, b);
    if (_ksCache.size > 300) _ksCache.delete(_ksCache.keys().next().value);
    return b;
  };
  INST.pluck = function (ctx, f, t0, vel, dest, o) {
    const buf = MB.ksBuffer(ctx, f, Object.assign({ dur: f < 150 ? 4 : 2.5 }, o.ks));
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = buf._rate;
    const g = ctx.createGain(); g.gain.value = 0.35 * vel;
    src.connect(g); g.connect(dest); src.start(t0);
    const end0 = t0 + buf.duration / buf._rate;
    return { end: end0, release(t, rr = 0.15) { t = Math.max(t, t0 + 0.005); g.gain.setValueAtTime(0.35 * vel, t); g.gain.setTargetAtTime(0, t, rr / 5); const e = Math.min(end0, t + rr); try { src.stop(e + 0.05); } catch (er) {} this.end = e; return e; } };
  };
  /** 사용자 배음 진폭(o.amps, o.phases)으로 만든 소리. o.env로 엔벨로프 지정 */
  INST.additive = (ctx, f, t0, v, d, o) => oscVoice(ctx, f, t0, v, d, o, { oscs: [{ wave: (c) => MB.wave(o.amps, o.phases, c) }], gain: o.gain || 0.25, env: { a: 0.01, d: 0.1, s: 0.9, r: 0.12 } });
  MB.INSTRUMENTS = INST;
  MB.INSTRUMENT_NAMES = { piano: "피아노", epiano: "일렉트릭 피아노", organ: "오르간", pluck: "기타(뜯은 현)", pad: "패드", strings: "스트링", bass: "신스 베이스", lead: "리드", bell: "벨(FM)", sine: "사인파", triangle: "삼각파", square: "사각파", saw: "톱니파" };

  /**
   * 음 하나 재생.
   *   MB.play(60)                         → 피아노로 C4를 0.5초
   *   MB.play("E4", {inst:"organ", dur:1}) 또는 MB.play({freq: 441.5}, {...})
   *   opts: {inst, dur, vel(0–1), when(절대 시각, 기본 지금), dest(AudioNode), freq(주파수 직접), env:{a,d,s,r}, pan, detune, ks}
   *   dur을 null로 주면 계속 울리며, 반환된 voice.release()로 끈다.
   */
  MB.play = function (note, o = {}) {
    const ctx = o.ctx || MB.ctx(); if (!ctx) return null;
    let f = o.freq;
    if (f == null) f = typeof note === "number" ? MB.mtof(note) : typeof note === "string" ? MB.mtof(MB.parseNote(note)) : note && note.freq;
    const t0 = o.when != null ? Math.max(o.when, ctx.currentTime) : ctx.currentTime + 0.005;
    let dest = o.dest || (ctx === actx ? master : ctx.destination);
    if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; p.connect(dest); dest = p; }
    const make = o.amps ? INST.additive : INST[o.inst || "piano"] || INST.piano;
    const v = make(ctx, f, t0, o.vel != null ? o.vel : 0.8, dest, o);
    if (ctx === actx) {
      if (_activeVoices.size > 64) { const first = _activeVoices.values().next().value; try { first.release(ctx.currentTime, 0.02); } catch (e) {} _activeVoices.delete(first); }
      _activeVoices.add(v);
      const origRel = v.release.bind(v);
      v.release = (t, rr) => { const e = origRel(t != null ? t : ctx.currentTime, rr); setTimeout(() => _activeVoices.delete(v), Math.max(0, (e - ctx.currentTime) * 1000 + 200)); return e; };
    }
    const dur = o.dur === undefined ? 0.5 : o.dur;
    if (dur != null) v.release(t0 + dur);
    return v;
  };
  /** 여러 음을 동시에(strum초 간격으로 흩어서) */
  MB.playChord = (notes, o = {}) => notes.map((n, i) => MB.play(n, Object.assign({}, o, { when: (o.when != null ? o.when : MB.now() + 0.01) + i * (o.strum || 0) })));
  /**
   * 음표 목록 재생: [{m, t(박), d(박), vel}] 를 bpm으로. → {stop()}
   */
  MB.playNotes = function (notes, o = {}) {
    const ctx = MB.ctx(), bpm = o.bpm || 100, spb = 60 / bpm, t0 = ctx.currentTime + 0.05;
    const vs = notes.map((n) => MB.play(n.m != null ? n.m : n.note, Object.assign({}, o, { freq: n.freq, when: t0 + n.t * spb, dur: (n.d || 1) * spb * (o.legato || 0.95), vel: n.vel != null ? n.vel : o.vel })));
    return { t0, spb, voices: vs, stop() { vs.forEach((v) => v && v.release(ctx.currentTime, 0.03)); } };
  };

  /**
   * 합성 드럼. MB.drum("kick", when, {vel, tune(반음), decay(배수), dest, tone})
   * 종류: kick snare hat openhat clap rim tomL tomM tomH cowbell crash ride shaker
   */
  MB.DRUM_NAMES = { kick: "킥", snare: "스네어", clap: "클랩", rim: "림샷", hat: "닫힌 하이햇", openhat: "열린 하이햇", tomL: "로우 탐", tomM: "미드 탐", tomH: "하이 탐", cowbell: "카우벨", crash: "크래시", ride: "라이드", shaker: "셰이커" };
  MB.drum = function (name, when, o = {}) {
    const ctx = o.ctx || MB.ctx(); if (!ctx) return;
    const t = when != null ? Math.max(when, ctx.currentTime) : ctx.currentTime + 0.005;
    const vel = o.vel != null ? o.vel : 0.9, tune = Math.pow(2, (o.tune || 0) / 12), dk = o.decay || 1;
    const dest = o.dest || (ctx === actx ? master : ctx.destination);
    const out = ctx.createGain(); out.gain.value = vel; out.connect(dest);
    if (o.pan) { /* 간단히 무시: 드럼은 중앙 */ }
    const env = (node, peak, dec, t1 = t) => { node.gain.setValueAtTime(0.0001, t1); node.gain.linearRampToValueAtTime(peak, t1 + 0.0015); node.gain.setTargetAtTime(0, t1 + 0.0015, dec / 4); };
    const noise = (filterType, freq, Q, peak, dec, t1 = t) => {
      const s = ctx.createBufferSource(); s.buffer = MB.noiseBuffer(ctx);
      const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = Q;
      const g = ctx.createGain(); env(g, peak, dec, t1);
      s.connect(f); f.connect(g); g.connect(out); s.start(t1, Math.random() * 1.5); s.stop(t1 + dec * 1.6 + 0.05);
      return f;
    };
    const tone = (type, f0, f1, sweep, peak, dec) => {
      const osc = ctx.createOscillator(); osc.type = type;
      osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(f1, t + sweep);
      const g = ctx.createGain(); env(g, peak, dec);
      osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + dec * 1.6 + 0.05);
    };
    const metal = (dec, peak, hp = 7000) => { // 808 방식: 비조화 비율의 사각파 6개
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 10000; bp.Q.value = 0.8;
      const hpf = ctx.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = hp;
      const g = ctx.createGain(); env(g, peak, dec);
      [2, 3, 4.16, 5.43, 6.79, 8.21].forEach((r) => { const osc = ctx.createOscillator(); osc.type = "square"; osc.frequency.value = 40 * r * tune; osc.connect(bp); osc.start(t); osc.stop(t + dec * 1.6 + 0.05); });
      bp.connect(hpf); hpf.connect(g); g.connect(out);
    };
    switch (name) {
      case "kick": tone("sine", 160 * tune, 42 * tune, 0.11, 1.0, 0.45 * dk); tone("triangle", 600, 120, 0.02, 0.25, 0.02); break;
      case "snare": tone("triangle", 220 * tune, 160 * tune, 0.05, 0.55, 0.11 * dk); noise("highpass", 1400, 0.7, 0.55, 0.2 * dk); break;
      case "clap": [0, 0.011, 0.023].forEach((d) => noise("bandpass", 1200, 1.2, 0.7, 0.012, t + d)); noise("bandpass", 1150, 1.0, 0.6, 0.22 * dk, t + 0.03); break;
      case "rim": tone("triangle", 1700 * tune, 1600 * tune, 0.01, 0.6, 0.03 * dk); noise("bandpass", 3500, 2, 0.3, 0.02); break;
      case "hat": metal(0.055 * dk, 0.55); break;
      case "openhat": metal(0.38 * dk, 0.45); break;
      case "shaker": noise("highpass", 6000, 0.7, 0.35, 0.06 * dk); break;
      case "tomL": tone("sine", 140 * tune, 90 * tune, 0.18, 0.9, 0.4 * dk); break;
      case "tomM": tone("sine", 200 * tune, 130 * tune, 0.16, 0.85, 0.33 * dk); break;
      case "tomH": tone("sine", 280 * tune, 190 * tune, 0.14, 0.8, 0.28 * dk); break;
      case "cowbell": {
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2640 * tune; bp.Q.value = 1;
        const g = ctx.createGain(); env(g, 0.5, 0.35 * dk);
        [540, 800].forEach((fr) => { const osc = ctx.createOscillator(); osc.type = "square"; osc.frequency.value = fr * tune; osc.connect(bp); osc.start(t); osc.stop(t + 0.7 * dk); });
        bp.connect(g); g.connect(out); break;
      }
      case "crash": metal(1.4 * dk, 0.45, 4000); noise("highpass", 5000, 0.5, 0.35, 1.2 * dk); break;
      case "ride": metal(0.9 * dk, 0.3, 5000); tone("sine", 3200 * tune, 3100 * tune, 0.1, 0.06, 0.6 * dk); break;
      default: tone("sine", 440, 440, 0.01, 0.5, 0.1);
    }
  };

  /**
   * 박자 스케줄러("두 시계" 방식: setInterval이 앞을 내다보고 오디오 시계에 정확히 예약).
   *   const clk = MB.Clock({ bpm: () => 100, div: 4, swing: () => 0.5, length: 16,
   *     onStep(step, time, stepDur) { MB.drum("kick", time) },   // 소리 예약
   *     onUI(step) { 화면 갱신 } });                          // 소리가 실제로 날 때 호출
   *   clk.start(); clk.stop(); clk.running
   * swing: 0.5=정박, 0.667=셋잇단 느낌 (짝수 스텝 쌍에서 앞 스텝이 차지하는 비율)
   */
  MB.Clock = function (o) {
    let timer = 0, raf = 0, step = 0, next = 0, running = false;
    const queue = [];
    const bpm = () => (typeof o.bpm === "function" ? o.bpm() : o.bpm || 120);
    const div = () => (typeof o.div === "function" ? o.div() : o.div || 4);
    const swing = () => (typeof o.swing === "function" ? o.swing() : o.swing || 0.5);
    const length = () => (typeof o.length === "function" ? o.length() : o.length || 16);
    function tick() {
      const ctx = actx;
      while (next < ctx.currentTime + 0.12) {
        const base = 60 / bpm() / div();
        const sw = swing();
        const dur = step % 2 === 0 ? 2 * base * sw : 2 * base * (1 - sw);
        try { o.onStep && o.onStep(step, next, dur); } catch (e) { console.error(e); }
        queue.push({ step, time: next });
        next += dur;
        step = (step + 1) % length();
      }
    }
    function ui() {
      raf = 0;
      if (!running) return;
      const now = actx.currentTime;
      let last = null;
      while (queue.length && queue[0].time <= now) last = queue.shift();
      if (last && o.onUI) o.onUI(last.step, last.time);
      raf = requestAnimationFrame(ui);
    }
    const api = {
      start(from = 0) {
        const ctx = MB.ctx(); if (!ctx || running) return;
        running = true; step = from; next = ctx.currentTime + 0.06; queue.length = 0;
        tick(); timer = setInterval(tick, 25); raf = requestAnimationFrame(ui);
        o.onStart && o.onStart();
      },
      stop() {
        running = false; clearInterval(timer); timer = 0; if (raf) cancelAnimationFrame(raf); raf = 0; queue.length = 0;
        o.onStop && o.onStop();
      },
      toggle() { running ? api.stop() : api.start(); return running; },
      get running() { return running; },
      get step() { return step; },
    };
    return api;
  };

  /** OfflineAudioContext로 소리를 렌더링해 샘플을 얻는다(그래프 그리기용). build(ctx, dest) */
  MB.render = function (seconds, build, sr = 44100) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new OAC(1, Math.ceil(seconds * sr), sr);
    build(ctx, ctx.destination);
    return ctx.startRendering().then((buf) => buf.getChannelData(0));
  };
  /** Float32Array 샘플을 바로 재생 */
  MB.playBuffer = function (samples, sr = 44100, o = {}) {
    const ctx = MB.ctx(); if (!ctx) return null;
    const b = ctx.createBuffer(1, samples.length, sr); b.getChannelData(0).set(samples);
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = !!o.loop;
    const g = ctx.createGain(); g.gain.value = o.gain != null ? o.gain : 0.5;
    s.connect(g); g.connect(o.dest || master); s.start(o.when || ctx.currentTime + 0.01);
    const v = { src: s, gain: g, release(t = ctx.currentTime) { g.gain.setTargetAtTime(0, t, 0.01); try { s.stop(t + 0.08); } catch (e) {} } };
    _activeVoices.add(v);
    s.onended = () => _activeVoices.delete(v);
    return v;
  };

  /**
   * 계속 울리는 소리(드론): 파라미터를 실시간으로 바꿀 수 있는 발진기 묶음.
   *   const dr = MB.drone({freq:220, amps:[1,0.5,...], type, gain}); dr.set({freq, amps}); dr.stop();
   */
  MB.drone = function (o = {}) {
    const ctx = MB.ctx(); if (!ctx) return null;
    const g = ctx.createGain(); g.gain.value = 0; g.connect(o.dest || master);
    g.gain.setTargetAtTime(o.gain != null ? o.gain : 0.25, ctx.currentTime, 0.02);
    const osc = ctx.createOscillator();
    if (o.amps) osc.setPeriodicWave(MB.wave(o.amps, o.phases)); else osc.type = o.type || "sine";
    osc.frequency.value = o.freq || 220;
    osc.connect(g); osc.start();
    const v = {
      osc, gain: g,
      set(p) {
        const t = ctx.currentTime;
        if (p.freq != null) osc.frequency.setTargetAtTime(p.freq, t, p.glide || 0.01);
        if (p.amps) osc.setPeriodicWave(MB.wave(p.amps, p.phases));
        if (p.type) osc.type = p.type;
        if (p.gain != null) g.gain.setTargetAtTime(p.gain, t, 0.02);
      },
      release(t = ctx.currentTime, rr = 0.08) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, rr / 4); try { osc.stop(t + rr + 0.05); } catch (e) {} return t + rr; },
      stop() { v.release(); _activeVoices.delete(v); },
    };
    _activeVoices.add(v);
    return v;
  };

  /** 마이크 입력을 분석기에 연결(스피커로는 내보내지 않음). → Promise<{analyser, stream, stop()}> */
  MB.mic = async function () {
    const ctx = MB.ctx();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const src = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser();
    an.fftSize = 8192; an.smoothingTimeConstant = 0.5;
    src.connect(an);
    return { analyser: an, stream, stop() { stream.getTracks().forEach((t) => t.stop()); src.disconnect(); } };
  };

  /* ==================================================================== drawing */
  /** 파형 그리기: data(배열), box, {color, width, yScale, from, count} */
  MB.drawWave = function (ctx, box, data, o = {}) {
    const P = MB.palette();
    const n = o.count || data.length, s0 = o.from || 0, ys = o.yScale || 1;
    ctx.save();
    if (o.axis !== false) { ctx.strokeStyle = P.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(box.x, box.y + box.h / 2); ctx.lineTo(box.x + box.w, box.y + box.h / 2); ctx.stroke(); }
    ctx.strokeStyle = o.color || P.accent; ctx.lineWidth = o.width || 2; ctx.lineJoin = "round";
    ctx.beginPath();
    const step = Math.max(1, n / (box.w * 2));
    for (let i = 0; i < n; i += step) {
      const v = data[Math.floor(s0 + i)] || 0;
      const x = box.x + (i / (n - 1)) * box.w, y = box.y + box.h / 2 - v * ys * box.h / 2;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  };
  /** 막대 스펙트럼(배음 진폭): amps 배열, {color, labels, max} */
  MB.drawBars = function (ctx, box, amps, o = {}) {
    const P = MB.palette(), n = amps.length, max = o.max || Math.max(1e-9, ...amps.map(Math.abs));
    const bw = box.w / n;
    ctx.save();
    ctx.font = "10px " + getComputedStyle(document.body).getPropertyValue("--mono");
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    amps.forEach((a, i) => {
      const h = (Math.abs(a) / max) * (box.h - 14);
      ctx.fillStyle = o.colors ? o.colors[i] : o.color || P.accent;
      ctx.globalAlpha = o.alpha != null ? o.alpha : 0.9;
      ctx.fillRect(box.x + i * bw + bw * 0.15, box.y + box.h - 14 - h, bw * 0.7, h);
      ctx.globalAlpha = 1;
      if (o.labels !== false && (n <= 24 || i % 2 === 0)) { ctx.fillStyle = P.dim; ctx.fillText(o.labelFn ? o.labelFn(i) : String(i + 1), box.x + i * bw + bw / 2, box.y + box.h - 12); }
    });
    ctx.restore();
  };
  /**
   * 주파수 축 스펙트럼 그리기. db: Float32Array(bin), binHz: bin당 Hz.
   * opts: {fmin=20, fmax=20000, dbMin=-100, dbMax=0, color, fill, log=true, box}
   */
  MB.drawSpectrum = function (ctx, box, db, binHz, o = {}) {
    const P = MB.palette();
    const fmin = o.fmin != null ? o.fmin : 20, fmax = o.fmax || 20000, dmin = o.dbMin != null ? o.dbMin : -100, dmax = o.dbMax != null ? o.dbMax : 0, log = o.log !== false;
    const X = (f) => box.x + (log ? Math.log(f / Math.max(fmin, 1e-3)) / Math.log(fmax / Math.max(fmin, 1e-3)) : (f - fmin) / (fmax - fmin)) * box.w;
    const Y = (d) => box.y + box.h - ((MB.clamp(d, dmin, dmax) - dmin) / (dmax - dmin)) * box.h;
    ctx.save();
    if (o.grid !== false) {
      ctx.strokeStyle = P.grid; ctx.fillStyle = P.faint; ctx.lineWidth = 1;
      ctx.font = "10px " + getComputedStyle(document.body).getPropertyValue("--mono");
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      const marks = log ? [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000] : null;
      (marks || [...Array(6)].map((_, i) => fmin + (i * (fmax - fmin)) / 5)).forEach((f) => { if (f < fmin || f > fmax) return; const x = X(f); ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.fillText(f >= 1000 ? Number((f / 1000).toPrecision(3)) + "k" : String(Math.round(f)), x, box.y + box.h + 3); });
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (let d = Math.ceil(dmin / 20) * 20; d <= dmax; d += 20) { const y = Y(d); ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); ctx.fillText(d + "", box.x - 4, y); }
    }
    ctx.beginPath();
    let started = false;
    const k0 = Math.max(1, Math.floor(fmin / binHz)), k1 = Math.min(db.length - 1, Math.ceil(fmax / binHz));
    let lastX = -1, accMax = -Infinity;
    for (let k = k0; k <= k1; k++) {
      const x = X(k * binHz);
      accMax = Math.max(accMax, db[k]);
      if (x - lastX < 1 && k < k1) continue;
      const y = Y(accMax); accMax = -Infinity;
      started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true; lastX = x;
    }
    ctx.strokeStyle = o.color || P.accent; ctx.lineWidth = o.width || 1.6; ctx.stroke();
    if (o.fill) { ctx.lineTo(lastX, box.y + box.h); ctx.lineTo(X(k0 * binHz), box.y + box.h); ctx.closePath(); ctx.fillStyle = o.fill; ctx.fill(); }
    ctx.restore();
    return { X, Y };
  };
  /**
   * 마스터 출력(또는 주어진 분석기)을 실시간으로 그리는 캔버스.
   *   MB.liveView("#cv", {mode:"wave"|"spectrum"|"both", fmax, analyser, maxHeight})
   */
  MB.liveView = function (sel, o = {}) {
    let td = null, fd = null;
    const cv = MB.canvas(sel, (ctx, w, h) => {
      const an = o.analyser ? (typeof o.analyser === "function" ? o.analyser() : o.analyser) : analyser;
      const P = MB.palette();
      const mode = typeof o.mode === "function" ? o.mode() : o.mode || "both";
      if (!an) { ctx.fillStyle = P.faint; ctx.font = "13px " + getComputedStyle(document.body).getPropertyValue("--font"); ctx.textAlign = "center"; ctx.fillText(o.idleText || "소리를 내면 여기에 파형과 스펙트럼이 나타납니다", w / 2, h / 2); return; }
      if (!td || td.length !== an.fftSize) { td = new Float32Array(an.fftSize); fd = new Float32Array(an.frequencyBinCount); }
      an.getFloatTimeDomainData(td); an.getFloatFrequencyData(fd);
      const showWave = mode !== "spectrum", showSpec = mode !== "wave";
      const wb = { x: 10, y: 8, w: w - 20, h: showSpec ? h * 0.42 - 8 : h - 16 };
      if (showWave) {
        // 상승 영점 교차에서 트리거해 파형을 고정
        let s = 0; for (let i = 1; i < td.length / 2; i++) if (td[i - 1] < 0 && td[i] >= 0) { s = i; break; }
        const span = o.span ? Math.round(o.span * an.context.sampleRate) : Math.min(2048, td.length - s);
        MB.drawWave(ctx, wb, td, { from: s, count: span, yScale: o.yScale || 1.6, width: 1.6 });
      }
      if (showSpec) {
        const sb = showWave ? { x: 34, y: h * 0.42 + 8, w: w - 44, h: h * 0.58 - 26 } : { x: 34, y: 8, w: w - 44, h: h - 26 };
        MB.drawSpectrum(ctx, sb, fd, an.context.sampleRate / an.fftSize, { fmin: o.fmin || 30, fmax: o.fmax || 12000, dbMin: o.dbMin || -110, dbMax: o.dbMax || -10, fill: P.accent + "22" });
      }
    }, { aspect: o.aspect || 0.42, maxHeight: o.maxHeight || 300, minHeight: o.minHeight || 160 });
    MB.loop(cv.canvas, () => cv.redraw());
    return cv;
  };

  /**
   * 피아노 건반 위젯(DOM). 마우스·터치·컴퓨터 키보드(A W S E D F T G Y H U J K O L P ;)로 연주.
   *   const kb = MB.keyboard("#kb", {lo:48, hi:72, onDown(m), onUp(m), labels:"c"|"all"|"none", keys:true, play:true, inst});
   *   kb.mark(midis, cls="mark")  강조(클래스: mark, root, on, alt) / kb.clear(cls) / kb.press(m) / kb.release(m)
   *   play:true(기본)면 누를 때 MB.play로 소리를 낸다. onDown이 false를 돌려주면 소리를 내지 않고,
 *   voice(release()를 가진 객체)를 돌려주면 그 음을 쓰고 건반을 놓을 때 release()한다.
   */
  MB.keyboard = function (sel, o = {}) {
    const el = typeof sel === "string" ? document.querySelector(sel) : sel;
    const lo = o.lo != null ? o.lo : 48, hi = o.hi != null ? o.hi : 72;
    el.classList.add("mb-kb");
    const isBlack = (m) => [1, 3, 6, 8, 10].includes(MB.mod(m, 12));
    const whites = []; for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
    const ww = 100 / whites.length;
    const keys = {};
    let html = "";
    let wi = 0;
    for (let m = lo; m <= hi; m++) {
      const b = isBlack(m);
      const left = b ? (wi * ww - ww * 0.3) : wi * ww;
      const lab = o.labels === "none" ? "" : o.labels === "all" ? MB.noteName(m, o.flat) : !b && MB.mod(m, 12) === 0 ? "C" + (Math.floor(m / 12) - 1) : "";
      html += `<div class="key ${b ? "black" : "white"}" data-m="${m}" style="left:${left}%;width:${b ? ww * 0.6 : ww}%"><span>${lab}</span></div>`;
      if (!b) wi++;
    }
    el.innerHTML = html;
    el.querySelectorAll(".key").forEach((k) => (keys[k.dataset.m] = k));
    const voices = {};
    const down = (m, vel = 0.8) => {
      if (!keys[m] || voices[m]) return;
      keys[m].classList.add("on");
      const r = o.onDown ? o.onDown(m) : undefined;
      if (r && typeof r.release === "function") voices[m] = r; // onDown이 직접 만든 음을 돌려주면 놓을 때 끈다
      else if (o.play !== false && r !== false) voices[m] = MB.play(m, { inst: typeof o.inst === "function" ? o.inst() : o.inst || "piano", dur: null, vel, freq: o.freqFn ? o.freqFn(m) : undefined }) || true;
      else voices[m] = true;
    };
    const up = (m) => {
      if (!voices[m]) return;
      keys[m] && keys[m].classList.remove("on");
      if (voices[m] !== true) voices[m].release();
      delete voices[m];
      o.onUp && o.onUp(m);
    };
    const ptr = {};
    el.addEventListener("pointerdown", (e) => {
      const k = e.target.closest(".key"); if (!k) return;
      e.preventDefault(); try { k.releasePointerCapture(e.pointerId); } catch (er) {}
      ptr[e.pointerId] = +k.dataset.m; down(+k.dataset.m);
    });
    el.addEventListener("pointerover", (e) => {
      if (!(e.pointerId in ptr) || !e.buttons) return;
      const k = e.target.closest(".key"); if (!k || +k.dataset.m === ptr[e.pointerId]) return;
      up(ptr[e.pointerId]); ptr[e.pointerId] = +k.dataset.m; down(+k.dataset.m);
    });
    const end = (e) => { if (e.pointerId in ptr) { up(ptr[e.pointerId]); delete ptr[e.pointerId]; } };
    ["pointerup", "pointercancel"].forEach((ev) => window.addEventListener(ev, end));
    el.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") end(e); });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    // 컴퓨터 키보드: 화면에 보이는(가장 최근에 만진) 건반 하나만 반응
    let base = o.keyBase != null ? o.keyBase : (MB.mod(lo, 12) === 0 ? lo : lo + 12 - MB.mod(lo, 12));
    if (base + 17 > hi + 5 && hi - lo >= 12) base = Math.max(lo, hi - 17 - MB.mod(hi - 17, 12) + (MB.mod(hi - 17, 12) ? 12 : 0));
    const api = {
      el, lo, hi,
      press: down, release: up,
      mark(ms, cls = "mark") { (Array.isArray(ms) ? ms : [ms]).forEach((m) => keys[m] && keys[m].classList.add(cls)); },
      clear(cls = "mark") { Object.values(keys).forEach((k) => k.classList.remove(cls)); },
      set(ms, cls = "mark") { api.clear(cls); api.mark(ms, cls); },
      flash(m, ms = 180, cls = "on") { if (!keys[m]) return; keys[m].classList.add(cls); setTimeout(() => keys[m].classList.remove(cls), ms); },
      label(m, text) { if (keys[m]) keys[m].querySelector("span").textContent = text; },
      releaseAll() { Object.keys(voices).forEach((m) => up(+m)); },
      get base() { return base; }, set base(v) { base = v; },
    };
    if (o.keys !== false) {
      MB._kbList.push(api);
      el.addEventListener("pointerdown", () => (MB._kbActive = api));
    }
    return api;
  };
  MB._kbList = [];
  MB._kbActive = null;
  (function () {
    const KEYMAP = "awsedftgyhujkolp;'";
    const held = {};
    const pick = () => {
      if (MB._kbActive && document.body.contains(MB._kbActive.el)) {
        const r = MB._kbActive.el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) return MB._kbActive;
      }
      return MB._kbList.find((k) => { const r = k.el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    };
    window.addEventListener("keydown", (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) && document.activeElement.type !== "range" && document.activeElement.type !== "checkbox") return;
      const i = KEYMAP.indexOf(e.key.toLowerCase());
      if (i < 0) return;
      const kb = pick(); if (!kb) return;
      const m = kb.base + i;
      if (m < kb.lo || m > kb.hi) return;
      e.preventDefault();
      held[e.key.toLowerCase()] = { kb, m };
      kb.press(m);
    });
    window.addEventListener("keyup", (e) => {
      const h = held[e.key.toLowerCase()]; if (!h) return;
      h.kb.release(h.m); delete held[e.key.toLowerCase()];
    });
    window.addEventListener("blur", () => Object.keys(held).forEach((k) => { held[k].kb.release(held[k].m); delete held[k]; }));
  })();

  /** MIDI 음의 표기: {letter(0=C..6=B), acc(−1,0,1), oct, pos(=oct*7+letter)} */
  MB.spell = function (m, flat = false) {
    const pc = MB.mod(m, 12), oct = Math.floor(m / 12) - 1;
    const sharpL = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6], flatL = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
    const nat = [0, 2, 4, 5, 7, 9, 11];
    const letter = (flat ? flatL : sharpL)[pc];
    const acc = pc - nat[letter];
    return { letter, acc, oct, pos: oct * 7 + letter };
  };
  /**
   * 큰보표(높은음자리표+낮은음자리표) SVG. chords: [[MIDI…] | {notes:[…], label, cls}] 를 왼쪽부터 균등 배치.
   *   MB.staff("#el", chords, {flat, width, highlight: index, labels:[...]})
   */
  MB.staff = function (sel, chords, o = {}) {
    const el = typeof sel === "string" ? document.querySelector(sel) : sel;
    const sp = 9; // 줄 간격
    const W = o.width || Math.max(320, 110 + chords.length * 70);
    const trebTop = 30, bassTop = trebTop + sp * 4 + sp * 6; // 두 보표 사이 간격
    const H = bassTop + sp * 4 + 40;
    // pos(=oct*7+letter) → y. 높은음자리표 맨 윗줄 F5 (pos 5*7+3=38), 낮은음자리표 맨 윗줄 A3 (pos 26)
    const yOf = (pos, bass) => (bass ? bassTop + (26 - pos) * (sp / 2) : trebTop + (38 - pos) * (sp / 2));
    let s = `<svg viewBox="0 0 ${W} ${H}" class="mb-staff" role="img" aria-label="악보">`;
    for (let i = 0; i < 5; i++) {
      s += `<line x1="10" x2="${W - 10}" y1="${trebTop + i * sp}" y2="${trebTop + i * sp}" class="sl"/>`;
      s += `<line x1="10" x2="${W - 10}" y1="${bassTop + i * sp}" y2="${bassTop + i * sp}" class="sl"/>`;
    }
    s += `<line x1="10" x2="10" y1="${trebTop}" y2="${bassTop + sp * 4}" class="sl"/><line x1="${W - 10}" x2="${W - 10}" y1="${trebTop}" y2="${bassTop + sp * 4}" class="sl"/>`;
    s += `<text x="16" y="${trebTop + sp * 3.6}" class="clef" font-size="${sp * 5.2}">𝄞</text>`;
    s += `<text x="16" y="${bassTop + sp * 2.6}" class="clef" font-size="${sp * 3.4}">𝄢</text>`;
    const x0 = 70, dx = (W - x0 - 30) / Math.max(1, chords.length);
    chords.forEach((ch, ci) => {
      const notes = (Array.isArray(ch) ? ch : ch.notes).slice().sort((a, b) => a - b);
      const cx = x0 + dx * (ci + 0.5);
      const cls = (ch.cls || "") + (o.highlight === ci ? " hl" : "");
      s += `<g class="chord ${cls}" data-i="${ci}">`;
      if (o.highlight === ci) s += `<rect x="${cx - dx / 2 + 3}" y="${trebTop - 22}" width="${dx - 6}" height="${H - trebTop}" rx="6" class="hlbg"/>`;
      let prevPos = -99, shift = false;
      notes.forEach((m) => {
        const sp_ = MB.spell(m, ch.flat != null ? ch.flat : o.flat);
        const bass = m < 60 && !(o.trebleOnly);
        const y = yOf(sp_.pos, bass);
        shift = sp_.pos - prevPos === 1 ? !shift : false; prevPos = sp_.pos;
        const nx = cx + (shift ? sp * 1.15 : 0);
        // 덧줄
        const top = bass ? bassTop : trebTop, bot = top + sp * 4;
        for (let ly = top - sp; ly >= y - 0.1; ly -= sp) s += `<line x1="${cx - sp * 1.1}" x2="${cx + sp * 2.2}" y1="${ly}" y2="${ly}" class="sl"/>`;
        for (let ly = bot + sp; ly <= y + 0.1; ly += sp) s += `<line x1="${cx - sp * 1.1}" x2="${cx + sp * 2.2}" y1="${ly}" y2="${ly}" class="sl"/>`;
        s += `<ellipse cx="${nx}" cy="${y}" rx="${sp * 0.68}" ry="${sp * 0.48}" transform="rotate(-20 ${nx} ${y})" class="nh"/>`;
        if (sp_.acc) s += `<text x="${cx - sp * 1.9}" y="${y + sp * 0.45}" class="acc" font-size="${sp * 1.5}">${sp_.acc > 0 ? "♯" : "♭"}</text>`;
      });
      const lab = ch.label != null ? ch.label : o.labels ? o.labels[ci] : "";
      if (lab) s += `<text x="${cx}" y="${trebTop - 10}" text-anchor="middle" class="lab">${lab}</text>`;
      if (ch.sub || (o.subs && o.subs[ci])) s += `<text x="${cx}" y="${H - 12}" text-anchor="middle" class="sub">${ch.sub || o.subs[ci]}</text>`;
      s += `</g>`;
    });
    s += `</svg>`;
    el.innerHTML = s;
    return el.firstChild;
  };

  /** 원 위의 12 피치 클래스 좌표(시계 방향, 위가 0). order: "chromatic" | "fifths" */
  MB.circlePos = (pc, cx, cy, r, order = "chromatic") => {
    const idx = order === "fifths" ? MB.mod(pc * 7, 12) : MB.mod(pc, 12);
    const a = -Math.PI / 2 + (idx / 12) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  /** 재생/정지 토글 버튼 바인딩: MB.playButton("btn-id", onStart, onStop) → {set(playing)} */
  MB.playButton = function (id, onStart, onStop, labels = ["▶ 재생", "■ 정지"]) {
    const b = document.getElementById(id);
    let on = false;
    const set = (v) => { on = v; b.textContent = labels[on ? 1 : 0]; b.classList.toggle("playing", on); };
    b.addEventListener("click", () => { MB.ctx(); if (on) { set(false); onStop && onStop(); } else { set(true); onStart && onStart(); } });
    set(false);
    return { set, get on() { return on; }, el: b };
  };
  /* ------------------------------------------------------------ layout build */
  const LOGO = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="mbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2)"/></linearGradient></defs><rect x="2" y="2" width="28" height="28" rx="8" fill="url(#mbg)"/><g fill="none" stroke="#fff" stroke-linecap="round"><path d="M22.5 5.5 l4 4" stroke-width="2.6"/><path d="M23.5 8.5 L15.5 16.5" stroke-width="2"/></g><path d="M15.8 13.2c-2.1-1.6-5.1-1.2-6.4.9-1 .1-2.6.6-3.4 2.3-1.1 2.4.6 4.4 2 5.8 1.4 1.4 3.4 3.1 5.8 2 1.7-.8 2.2-2.4 2.3-3.4 2.1-1.3 2.5-4.3.9-6.4z" fill="#fff"/><circle cx="12.2" cy="19.8" r="1.7" fill="var(--accent)"/><path d="M9.3 17.6l5.1 5.1" stroke="var(--accent)" stroke-width="1.2" stroke-linecap="round"/></svg>`;
  const ICON_SOUND = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="w1" d="M16.5 8.5a5 5 0 0 1 0 7"/><path class="w2" d="M19.3 5.8a9 9 0 0 1 0 12.4"/><path class="x" d="M16 9l6 6M22 9l-6 6"/></svg>`;
  const ICON_MENU = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`;
  const ICON_MOON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
  const ICON_SUN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;

  function build() {
    const body = document.body;
    const root = body.dataset.root != null ? body.dataset.root : body.dataset.chapter ? "../" : "";
    const curSlug = body.dataset.chapter || "";
    const href = (slug) => (slug ? `${root}chapters/${slug}.html` : `${root}index.html`);
    const feedbackUrl = "https://books.euiyun.com/feedback.html?book=guitarbook&page=" + encodeURIComponent(location.href);

    const bar = document.createElement("header");
    bar.className = "sb-topbar";
    bar.innerHTML = `
      <button class="sb-btn icon" id="sb-menu" aria-label="챕터 목록">${ICON_MENU}</button>
      <a class="sb-logo" href="${href("")}">${LOGO}<span>GuitarBook <small>기타 교과서</small></span></a>
      <span class="spacer"></span>
      <a class="sb-btn series-link" href="https://books.euiyun.com/" aria-label="전체 책 보기" title="전체 책 보기"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h6v14H4zM10 5.5h6v14h-6zM17 7l3-1 2 13-3 1z"/></svg><span>전체 책</span></a>
      <button class="sb-btn icon mb-mute" id="sb-mute" aria-label="소리 켜기/끄기" title="소리 켜기/끄기">${ICON_SOUND}</button>
      <button class="sb-btn icon" id="sb-theme" aria-label="테마 전환"></button>
      <div class="sb-progress" id="sb-progress"></div>`;
    const feedbackButton = document.createElement("a");
    feedbackButton.className = bar.className.replace("-topbar", "-btn") + " icon feedback-button";
    feedbackButton.href = feedbackUrl;
    feedbackButton.target = "_blank";
    feedbackButton.rel = "noopener";
    feedbackButton.setAttribute("aria-label", "독자 의견 보내기");
    feedbackButton.title = "독자 의견 보내기";
    feedbackButton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2z"/><path d="M8 9h8M8 13h5"/></svg>';
    bar.querySelector("[id$='-theme']").before(feedbackButton);
    body.prepend(bar);

    // Search chapter metadata immediately; load section and visual titles on demand.
    const progressBar = bar.querySelector("[id$='-progress']");
    const spacer = bar.querySelector(".spacer");
    const leftNav = document.createElement("div");
    leftNav.className = "book-nav-left";
    leftNav.append(bar.querySelector("[id$='-menu']"), bar.querySelector("a[class$='-logo']"));
    const rightNav = document.createElement("div");
    rightNav.className = "book-nav-right";
    [...bar.children].filter((el) => el !== spacer && el !== progressBar).forEach((el) => rightNav.appendChild(el));
    spacer.remove();
    const search = document.createElement("div");
    search.className = "book-search";
    search.innerHTML = '<svg class="book-search-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg><input type="search" aria-label="이 책의 챕터, 섹션, 시뮬레이터, 그림 검색" placeholder="이 책 검색" autocomplete="off"><div class="book-search-results" aria-live="polite"></div>';
    bar.prepend(leftNav);
    bar.insertBefore(search, progressBar);
    bar.insertBefore(rightNav, progressBar);
    const searchInput = search.querySelector("input");
    const searchResults = search.querySelector(".book-search-results");
    const closeSearch = () => { search.classList.remove("open"); searchResults.replaceChildren(); };
    let detailEntries = [];
    let detailsLoaded = false;
    let detailPromise;
    function loadDetails() {
      if (detailPromise) return detailPromise;
      detailPromise = Promise.all(CHAPTERS.map(async (chapter) => {
        try {
          const response = await fetch(href(chapter.slug));
          if (!response.ok) return [];
          const doc = new DOMParser().parseFromString(await response.text(), "text/html");
          const main = doc.querySelector("main.chapter");
          if (!main) return [];
          // 미리 렌더링된 수식은 TeX 원문으로 되돌려 검색어와 맞춘다.
          main.querySelectorAll(".katex").forEach((k) => k.replaceWith(k.querySelector("annotation")?.textContent || k.textContent));
          const entries = [];
          [...main.querySelectorAll("section > h2")].forEach((heading, i) => {
            entries.push({ type: "섹션", title: heading.textContent.trim(), chapter, hash: heading.parentElement.id || `s${i + 1}` });
          });
          [...main.querySelectorAll(".sim")].filter((sim) => sim.querySelector(".sim-head h3")).forEach((sim, i) => {
            entries.push({ type: "시뮬레이터", title: sim.querySelector(".sim-head h3").textContent.trim(), chapter, hash: sim.id || `search-sim-${i + 1}` });
          });
          [...main.querySelectorAll("figure")].filter((figure) => figure.querySelector("figcaption")).forEach((figure, i) => {
            const caption = figure.querySelector("figcaption").textContent.replace(/\s+/g, " ").trim();
            entries.push({ type: "그림", title: caption.slice(0, 140), chapter, hash: figure.id || `search-fig-${i + 1}` });
          });
          return entries;
        } catch (error) { return []; }
      })).then((parts) => { detailEntries = parts.flat(); detailsLoaded = true; renderSearch(); });
      return detailPromise;
    }
    function renderSearch() {
      const words = searchInput.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      searchResults.replaceChildren();
      if (!words.length) { closeSearch(); return; }
      const includesWords = (value) => words.every((word) => value.toLocaleLowerCase().includes(word));
      const chapterMatches = CHAPTERS.filter((c) => includesWords([c.num, c.title, c.desc, ...(c.tags || [])].join(" ")))
        .map((c) => ({ type: "챕터", title: c.title, chapter: c, hash: "" }));
      const detailMatches = detailEntries.filter((entry) => includesWords(entry.title));
      const matches = [
        ...chapterMatches.slice(0, 4),
        ...detailMatches.filter((entry) => entry.type === "섹션").slice(0, 5),
        ...detailMatches.filter((entry) => entry.type === "시뮬레이터").slice(0, 4),
        ...detailMatches.filter((entry) => entry.type === "그림").slice(0, 4),
      ];
      matches.forEach((entry) => {
        const link = document.createElement("a");
        link.href = href(entry.chapter.slug) + (entry.hash ? `#${entry.hash}` : "");
        const title = document.createElement("strong");
        title.textContent = entry.title;
        const context = document.createElement("small");
        context.textContent = `${entry.chapter.num} · ${entry.chapter.title} · ${entry.type}`;
        link.append(title, context);
        searchResults.appendChild(link);
      });
      if (chapterMatches.length + detailMatches.length > matches.length) {
        const more = document.createElement("p");
        more.textContent = `상위 ${matches.length}개 표시 · 검색어를 더 구체적으로 입력해 보세요`;
        searchResults.appendChild(more);
      }
      if (detailPromise && !detailsLoaded) {
        const status = document.createElement("p");
        status.textContent = "섹션·시뮬레이터·그림 목록을 불러오는 중…";
        searchResults.appendChild(status);
      } else if (!matches.length) {
        const empty = document.createElement("p");
        empty.textContent = "검색 결과가 없습니다";
        searchResults.appendChild(empty);
      }
      search.classList.add("open");
    }
    searchInput.addEventListener("input", () => { if (searchInput.value.trim()) loadDetails(); renderSearch(); });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeSearch(); searchInput.blur(); }
      else if (e.key === "ArrowDown") { const first = searchResults.querySelector("a"); if (first) { e.preventDefault(); first.focus(); } }
      else if (e.key === "Enter") { const first = searchResults.querySelector("a"); if (first) { e.preventDefault(); first.click(); } }
    });
    searchResults.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeSearch(); searchInput.focus(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const links = [...searchResults.querySelectorAll("a")];
        const next = links.indexOf(document.activeElement) + (e.key === "ArrowDown" ? 1 : -1);
        e.preventDefault();
        (links[next] || searchInput).focus();
      }
    });
    document.addEventListener("pointerdown", (e) => { if (!search.contains(e.target)) closeSearch(); });


    const drawer = document.createElement("nav");
    drawer.className = "sb-drawer";
    drawer.innerHTML = `<h4>Chapters</h4><ul class="sb-chlist">
      <li><a href="${href("")}" class="${curSlug ? "" : "active"}"><span class="num">00</span><span>홈 · 로드맵</span></a></li>
      ${CHAPTERS.map((c) => `<li><a href="${href(c.slug)}" class="${c.slug === curSlug ? "active" : ""}"><span class="num">${c.num}</span><span>${c.title}</span></a></li>`).join("")}
    </ul>
    <h4 style="margin-top:22px">함께 읽기</h4><ul class="sb-chlist">
      <li><a href="${root}../fundamentals/"><span class="num">♪</span><span>MusicBook · 음악 기초</span></a></li>
      <li><a href="https://books.euiyun.com/"><span class="num">↗</span><span>전체 책 보기</span></a></li>
    </ul>`;
    const backdrop = document.createElement("div");
    backdrop.className = "sb-drawer-backdrop";
    body.append(backdrop, drawer);
    const toggleDrawer = (o) => body.classList.toggle("drawer-open", o);
    bar.querySelector("#sb-menu").addEventListener("click", () => toggleDrawer(true));
    backdrop.addEventListener("click", () => toggleDrawer(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggleDrawer(false); });

    const mbtn = bar.querySelector("#sb-mute");
    mbtn.classList.toggle("muted", MB.isMuted());
    mbtn.addEventListener("click", () => { MB.ctx(); MB.setMuted(!MB.isMuted()); });

    const tbtn = bar.querySelector("#sb-theme");
    const setIcon = () => (tbtn.innerHTML = MB.isDark() ? ICON_SUN : ICON_MOON);
    setIcon();
    tbtn.addEventListener("click", () => {
      const next = MB.isDark() ? "light" : "dark";
      try { localStorage.setItem("music-theme", next); } catch (e) {}
      applyTheme(next); setIcon();
    });

    const prog = bar.querySelector("#sb-progress");
    const onScroll = () => { const h = document.documentElement.scrollHeight - innerHeight; prog.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + "%"; };
    addEventListener("scroll", onScroll, { passive: true }); onScroll();

    const main = document.querySelector("main.chapter");
    if (main) {
      // Give search results stable anchors even when the source has no id.
      [...main.querySelectorAll(".sim")].filter((sim) => sim.querySelector(".sim-head h3")).forEach((sim, i) => { if (!sim.id) sim.id = `search-sim-${i + 1}`; });
      [...main.querySelectorAll("figure")].filter((figure) => figure.querySelector("figcaption")).forEach((figure, i) => { if (!figure.id) figure.id = `search-fig-${i + 1}`; });
      if (/^#(?:s\d+|search-(?:sim|fig)-)/.test(location.hash)) {
        requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
      }
      const layout = document.createElement("div");
      layout.className = "sb-layout";
      main.parentNode.insertBefore(layout, main);
      layout.appendChild(main);
      const toc = document.createElement("aside");
      toc.className = "sb-toc";
      const h2s = [...main.querySelectorAll("section > h2")];
      let n = 0;
      toc.innerHTML = "<h4>ON THIS PAGE</h4>" + h2s.map((h, i) => {
        const sec = h.parentElement;
        if (!sec.id) sec.id = "s" + (i + 1);
        const numbered = !sec.classList.contains("keypoints") && !sec.classList.contains("quiz-sec") && !sec.hasAttribute("data-nonum");
        if (numbered && !h.querySelector(".h-num")) { n++; h.insertAdjacentHTML("afterbegin", `<span class="h-num">${String(n).padStart(2, "0")}</span>`); }
        // 제목 텍스트를 쓰되, 빌드가 렌더링한 수식은 마크업 그대로 옮긴다.
        const label = [...h.childNodes].filter((node) => !node.classList?.contains("h-num"))
          .map((node) => (node.querySelector?.(".katex") ? node.outerHTML : node.textContent)).join("").trim();
        return `<a href="#${sec.id}">${label}</a>`;
      }).join("");
      layout.appendChild(toc);
      const links = [...toc.querySelectorAll("a")];
      if (window.IntersectionObserver && h2s.length) {
        const io = new IntersectionObserver((es) => {
          es.forEach((e) => { if (e.isIntersecting) { links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id)); } });
        }, { rootMargin: "-20% 0px -70% 0px" });
        h2s.forEach((h) => io.observe(h.parentElement));
      }

      const idx = CHAPTERS.findIndex((c) => c.slug === curSlug);
      const prev = idx > 0 ? CHAPTERS[idx - 1] : null;
      const next = idx >= 0 && idx < CHAPTERS.length - 1 ? CHAPTERS[idx + 1] : null;
      const pager = document.createElement("nav");
      pager.className = "sb-pager";
      pager.innerHTML =
        (prev ? `<a class="prev" href="${href(prev.slug)}"><small>← 이전 · ${prev.num}</small>${prev.title}</a>` : `<a class="prev" href="${href("")}"><small>← 처음으로</small>홈 · 로드맵</a>`) +
        (next ? `<a class="next" href="${href(next.slug)}"><small>다음 · ${next.num} →</small>${next.title}</a>` : "");
      layout.after(pager);
    }
    const foot = document.createElement("footer");
    foot.className = "sb-foot";
    foot.innerHTML = `GuitarBook — 듣고 튕기며 배우는 기타 교과서 · 모든 소리는 브라우저(Web Audio)에서 실시간으로 합성됩니다.
      <br>함께 읽기: <a href="${root}../fundamentals/">MusicBook · 음악 기초</a> · <a href="${root}../">음악 서가</a> · <a href="https://books.euiyun.com/">books.euiyun.com</a>
      <br>© 2026 <a href="https://github.com/geniuskey">geniuskey</a> ·
      콘텐츠 <a href="https://creativecommons.org/licenses/by/4.0/deed.ko" rel="license">CC BY 4.0</a> ·
      코드 <a href="https://github.com/geniuskey/music-books/blob/main/LICENSE-MIT">MIT</a> ·
      <a href="https://github.com/geniuskey/music-books/blob/main/guitar/LICENSE.md">라이선스 안내</a>`;
    const feedbackLink = document.createElement("a");
    feedbackLink.href = feedbackUrl;
    feedbackLink.target = "_blank";
    feedbackLink.rel = "noopener";
    feedbackLink.textContent = "독자 의견";
    foot.append(" · ", feedbackLink);
    body.appendChild(foot);

    document.querySelectorAll(".quiz-q").forEach((q) => {
      const opts = [...q.querySelectorAll("button.opt")];
      opts.forEach((b) => b.addEventListener("click", () => {
        opts.forEach((o) => { o.disabled = true; if (o.hasAttribute("data-correct")) o.classList.add("right"); });
        if (!b.hasAttribute("data-correct")) b.classList.add("wrong");
        q.classList.add("done");
        q.dispatchEvent(new CustomEvent("answered", { bubbles: true, detail: { correct: b.hasAttribute("data-correct") } }));
      }));
    });

    // KaTeX: 배포물의 수식은 빌드(tools/katex.mjs)가 미리 렌더링한다. 소스 파일을 바로 열었을 때만 CDN에서 불러와 렌더링한다.
    if (!document.querySelector(".katex") && /\\\(|\\\[|\$\$/.test(document.body.innerText)) {
      const KATEX = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/";
      const load = (tag, props) => new Promise((resolve, reject) => {
        const el = Object.assign(document.createElement(tag), props, { onload: resolve, onerror: reject });
        document.head.insertBefore(el, tag === "link" ? document.head.querySelector('link[rel="stylesheet"]') : null);
      });
      Promise.all([load("link", { rel: "stylesheet", href: KATEX + "katex.min.css" }), load("script", { src: KATEX + "katex.min.js" })])
        .then(() => load("script", { src: KATEX + "contrib/auto-render.min.js" }))
        .then(() => renderMathInElement(document.body, {
          delimiters: [{ left: "$$", right: "$$", display: true }, { left: "\\(", right: "\\)", display: false }, { left: "\\[", right: "\\]", display: true }],
          throwOnError: false,
          ignoredClasses: ["no-math"],
        }))
        .catch(() => {});
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();

// Simulator deep links: add a shareable # link to each simulator heading.
(function () {
  function addSimulatorLinks() {
    document.querySelectorAll(".sim[id] > .sim-head").forEach((head) => {
      if (head.querySelector(".sim-link")) return;
      const link = document.createElement("a");
      link.className = "sim-link";
      link.href = "#" + head.parentElement.id;
      link.textContent = "#";
      link.title = "이 시뮬레이터로 가는 링크";
      link.setAttribute("aria-label", "이 시뮬레이터로 가는 링크");
      head.appendChild(link);
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addSimulatorLinks, { once: true });
  } else {
    addSimulatorLinks();
  }
})();

// Series glossary tooltips (same runtime across independently deployed books).
(function () {
  const base = new URL(".", document.currentScript.src);
  window.BOOK_GLOSSARY_CONFIG = { dataUrl: new URL("glossary-data.js", base).href };
  const script = document.createElement("script");
  script.src = new URL("glossary-tooltips.js", base).href;
  document.head.append(script);
})();
