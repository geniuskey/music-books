/* ==========================================================================
   GuitarBook 기타 전용 스크립트 — 전역 객체 GT (common.js의 MB 위에서 동작)
   - 기타 음원: 카플러스–스트롱 현 + 몸통 공진 필터, 줄마다 한 음(새 음이 앞 음을 멈춘다), 벤딩·슬라이드
   - GT.guitar(): 줄·프렛 단위로 뜯고(pluck) 긁는(strum) 가상 기타, 소리 나는 순간의 콜백(on)
   - 위젯: 가로 지판(GT.fretboard), 코드 다이어그램(GT.chordDiagram), TAB 악보(GT.tab)
   - 이론: 튜닝, 줄·프렛 ↔ MIDI, 코드 모양 사전, 이동 코드·CAGED, n-음-한-줄 스케일 모양
   - 도구: 박 단위 이벤트 스케줄러(GT.scheduler), 스트럼 패턴, 피치 검출(GT.detectPitch)
   줄 번호 규칙: 배열 인덱스 s=0이 6번 줄(굵은 저음 E), s=5가 1번 줄(가는 고음 E). 기타 관습의 줄 번호 = 6 − s.
   이 파일은 common.js 다음에 defer 없이 로드한다.
   ========================================================================== */
(function () {
  "use strict";
  const GT = (window.GT = {});
  const SVGNS = "http://www.w3.org/2000/svg";
  const $ = (sel) => (typeof sel === "string" ? document.querySelector(sel) : sel);

  /* ------------------------------------------------------------ tunings & geometry */
  GT.TUNINGS = {
    standard: { name: "표준 (E A D G B E)", notes: [40, 45, 50, 55, 59, 64] },
    halfDown: { name: "반음 내림 (E♭ 튜닝)", notes: [39, 44, 49, 54, 58, 63] },
    dropD:    { name: "드롭 D (D A D G B E)", notes: [38, 45, 50, 55, 59, 64] },
    dadgad:   { name: "DADGAD", notes: [38, 45, 50, 55, 57, 62] },
    openG:    { name: "오픈 G (D G D G B D)", notes: [38, 43, 50, 55, 59, 62] },
    openD:    { name: "오픈 D (D A D F♯ A D)", notes: [38, 45, 50, 54, 57, 62] },
    openE:    { name: "오픈 E (E B E G♯ B E)", notes: [40, 47, 52, 56, 59, 64] },
  };
  GT.STANDARD = GT.TUNINGS.standard.notes;
  const tun = (t) => (Array.isArray(t) ? t : t && GT.TUNINGS[t] ? GT.TUNINGS[t].notes : GT.STANDARD);
  GT.tuningNotes = tun;
  /** 줄 번호 표기(1–6번 줄) */
  GT.stringNumber = (s) => 6 - s;
  GT.STRING_LABELS = ["6번 줄(E)", "5번 줄(A)", "4번 줄(D)", "3번 줄(G)", "2번 줄(B)", "1번 줄(E)"];
  /** 스케일 길이(mm): 펜더 25.5″ = 648, 깁슨 24.75″ = 628, 클래식 650 */
  GT.SCALE_MM = 648;
  /** 너트에서 n번 프렛까지 거리 d_n = L(1 − 2^(−n/12)) */
  GT.fretPos = (n, L = GT.SCALE_MM) => L * (1 - Math.pow(2, -n / 12));
  /** 줄 s, 프렛 f의 MIDI 번호. f는 카포 기준(카포 = 새 너트) */
  GT.midiAt = (s, f, tuning, capo = 0) => tun(tuning)[s] + capo + f;
  /** MIDI 번호를 낼 수 있는 모든 자리 [{s,f}] (0..maxFret) */
  GT.positionsOf = (midi, { tuning, capo = 0, maxFret = 15 } = {}) => {
    const t = tun(tuning), out = [];
    for (let s = 0; s < 6; s++) { const f = midi - t[s] - capo; if (f >= 0 && f <= maxFret) out.push({ s, f }); }
    return out;
  };
  const IV_LABELS = ["R", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];
  /** 근음에서의 반음 수 → 도수 표기 R, ♭3, 5 … */
  GT.intervalLabel = (semis) => IV_LABELS[MB.mod(semis, 12)];
  GT.IV_LABELS = IV_LABELS;

  /* ------------------------------------------------------------ chord shapes */
  /** "x32010" · "x,10,12,12,12,10" · [-1,3,2,0,1,0] → 6개 배열(−1 = 뮤트), 저음 줄부터 */
  GT.parseShape = function (sh) {
    if (Array.isArray(sh)) return sh.map((v) => (v == null || v === "x" || v < 0 ? -1 : +v));
    const parts = sh.includes(",") || sh.includes(" ") ? sh.trim().split(/[\s,]+/) : sh.split("");
    return parts.map((c) => (c === "x" || c === "X" || c === "-" ? -1 : parseInt(c, 10)));
  };
  GT.shapeString = (shape) => {
    const s = GT.parseShape(shape);
    const sep = s.some((v) => v > 9) ? "," : "";
    return s.map((v) => (v < 0 ? "x" : String(v))).join(sep);
  };
  /** 울리는 줄의 MIDI 번호 목록(저음→고음) */
  GT.shapeNotes = (shape, { tuning, capo = 0 } = {}) => {
    const t = tun(tuning);
    return GT.parseShape(shape).map((f, s) => (f < 0 ? null : t[s] + capo + f)).filter((m) => m != null);
  };
  /** 모양의 코드 이름 추정(MB.detectChord, 가장 낮은 음을 베이스로) */
  GT.identify = (shape, o = {}) => {
    const ns = GT.shapeNotes(shape, o);
    if (ns.length < 2) return [];
    return MB.detectChord(ns, o.flat);
  };
  /** 코드 모양 사전: 이름 → {shape, fingers, barre?} (fingers의 0 = 개방/누르지 않음) */
  GT.CHORDS = {
    C: { shape: "x32010", fingers: "x32010" },
    A: { shape: "x02220", fingers: "x01230" },
    G: { shape: "320003", fingers: "210003" },
    E: { shape: "022100", fingers: "023100" },
    D: { shape: "xx0232", fingers: "xx0132" },
    Am: { shape: "x02210", fingers: "x02310" },
    Em: { shape: "022000", fingers: "023000" },
    Dm: { shape: "xx0231", fingers: "xx0231" },
    F: { shape: "133211", fingers: "134211", barre: 1 },
    Fs: { shape: "xx3211", fingers: "xx3211", name: "F", note: "작은 F" },
    Bm: { shape: "x24432", fingers: "x13421", barre: 2 },
    Bb: { shape: "x13331", fingers: "x12341", barre: 1, name: "B♭" },
    B: { shape: "x24442", fingers: "x12341", barre: 2 },
    "F#m": { shape: "244222", fingers: "134111", barre: 2, name: "F♯m" },
    Cm: { shape: "x35543", fingers: "x13421", barre: 3 },
    Gm: { shape: "355333", fingers: "134111", barre: 3 },
    G4: { shape: "320033", fingers: "210034", name: "G", note: "4손가락 G" },
    A7: { shape: "x02020", fingers: "x02030" },
    B7: { shape: "x21202", fingers: "x21304" },
    C7: { shape: "x32310", fingers: "x32410" },
    D7: { shape: "xx0212", fingers: "xx0213" },
    E7: { shape: "020100", fingers: "020100" },
    G7: { shape: "320001", fingers: "320001" },
    Am7: { shape: "x02010", fingers: "x02010" },
    Em7: { shape: "020000", fingers: "020000" },
    Dm7: { shape: "xx0211", fingers: "xx0211" },
    Cmaj7: { shape: "x32000", fingers: "x32000" },
    Fmaj7: { shape: "xx3210", fingers: "xx3210" },
    Amaj7: { shape: "x02120", fingers: "x02130" },
    Dmaj7: { shape: "xx0222", fingers: "xx0111" },
    Gmaj7: { shape: "320002", fingers: "320001" },
    Asus2: { shape: "x02200", fingers: "x01200" },
    Asus4: { shape: "x02230", fingers: "x01230" },
    Dsus2: { shape: "xx0230", fingers: "xx0130" },
    Dsus4: { shape: "xx0233", fingers: "xx0134" },
    Esus4: { shape: "022200", fingers: "023400" },
    Cadd9: { shape: "x32030", fingers: "x21030" },
    E5: { shape: "022xxx", fingers: "011xxx" },
    A5: { shape: "x022xx", fingers: "x011xx" },
    G5: { shape: "355xxx", fingers: "134xxx" },
  };
  /** 사전에서 코드 찾기: GT.chord("Am") → {name, shape:[...], fingers:[...], barre} */
  GT.chord = function (name) {
    const c = GT.CHORDS[name];
    if (!c) return null;
    return { name: c.name || name.replace("#", "♯").replace(/^([A-G])b/, "$1♭"), shape: GT.parseShape(c.shape), fingers: c.fingers ? GT.parseShape(c.fingers) : null, barre: c.barre || 0, note: c.note || "" };
  };

  /** 이동 코드 형태(근음 줄 기준, 근음 프렛 0 기준 상대 프렛) */
  const MOVABLE = {
    E: { rootString: 0, maj: [0, 2, 2, 1, 0, 0], min: [0, 2, 2, 0, 0, 0], dom7: [0, 2, 0, 1, 0, 0], min7: [0, 2, 0, 0, 0, 0], maj7: [0, -1, 1, 1, 0, -1], sus4: [0, 2, 2, 2, 0, 0], pow: [0, 2, 2, -1, -1, -1],
      fingers: { maj: [1, 3, 4, 2, 1, 1], min: [1, 3, 4, 1, 1, 1], dom7: [1, 3, 1, 2, 1, 1], min7: [1, 3, 1, 1, 1, 1], maj7: [1, 0, 3, 4, 2, 0], sus4: [1, 2, 3, 4, 1, 1], pow: [1, 3, 4, 0, 0, 0] } },
    A: { rootString: 1, maj: [-1, 0, 2, 2, 2, 0], min: [-1, 0, 2, 2, 1, 0], dom7: [-1, 0, 2, 0, 2, 0], min7: [-1, 0, 2, 0, 1, 0], maj7: [-1, 0, 2, 1, 2, 0], sus4: [-1, 0, 2, 2, 3, 0], sus2: [-1, 0, 2, 2, 0, 0], pow: [-1, 0, 2, 2, -1, -1],
      fingers: { maj: [0, 1, 3, 3, 3, 1], min: [0, 1, 3, 4, 2, 1], dom7: [0, 1, 3, 1, 4, 1], min7: [0, 1, 3, 1, 2, 1], maj7: [0, 1, 3, 2, 4, 1], sus4: [0, 1, 2, 3, 4, 1], sus2: [0, 1, 3, 4, 1, 1], pow: [0, 1, 3, 4, 0, 0] } },
  };
  /** 근음 pc와 품질로 E형/A형 바레 코드 → {name, shape, fingers, barre, base} */
  GT.movable = function (rootPc, quality = "maj", form = "E", { tuning, minFret = 1 } = {}) {
    const M = MOVABLE[form]; const tpl = M[quality]; if (!tpl) return null;
    const t = tun(tuning);
    let r = MB.mod(rootPc - t[M.rootString], 12);
    if (r < minFret) r += 12;
    const shape = tpl.map((v) => (v < 0 ? -1 : v + r));
    const fingers = M.fingers[quality].map((v, i) => (tpl[i] < 0 ? -1 : v));
    return { name: MB.chordSymbol(rootPc, quality), shape, fingers, barre: r, base: r, form };
  };
  /** CAGED: 장3화음 하나를 다섯 모양으로 → [{form, shape, base}] (지판 낮은 쪽부터) */
  const CAGED = {
    C: { ref: 1, rootFret: 3, shape: [-1, 3, 2, 0, 1, 0] },
    A: { ref: 1, rootFret: 0, shape: [-1, 0, 2, 2, 2, 0] },
    G: { ref: 0, rootFret: 3, shape: [3, 2, 0, 0, 0, 3] },
    E: { ref: 0, rootFret: 0, shape: [0, 2, 2, 1, 0, 0] },
    D: { ref: 2, rootFret: 0, shape: [-1, -1, 0, 2, 3, 2] },
  };
  GT.CAGED_ORDER = ["C", "A", "G", "E", "D"];
  GT.caged = function (rootPc, { tuning } = {}) {
    const t = tun(tuning);
    return GT.CAGED_ORDER.map((form) => {
      const c = CAGED[form];
      const shift = MB.mod(rootPc - (t[c.ref] + c.rootFret), 12);
      const shape = c.shape.map((v) => (v < 0 ? -1 : v + shift));
      const fs = shape.filter((v) => v >= 0);
      return { form, shape, base: Math.min(...fs), top: Math.max(...fs), shift };
    }).sort((a, b) => a.base - b.base);
  };

  /* ------------------------------------------------------------ scales on the neck */
  /** 프렛 구간 [from,to]에서 음계 음의 자리 → [{s,f,midi,pc,deg,iv,label}] */
  GT.scalePositions = function (rootPc, steps, { tuning, capo = 0, from = 0, to = 15 } = {}) {
    const t = tun(tuning), set = new Map(steps.map((x, i) => [MB.mod(x, 12), i])), out = [];
    for (let s = 0; s < 6; s++) for (let f = from; f <= to; f++) {
      const midi = t[s] + capo + f, iv = MB.mod(midi - rootPc, 12);
      if (set.has(iv)) out.push({ s, f, midi, pc: MB.mod(midi, 12), deg: set.get(iv), iv, label: IV_LABELS[iv] });
    }
    return out;
  };
  /**
   * 한 줄에 nps개씩 음계 음을 차례로 놓는 모양(펜타토닉 박스 = nps 2, 3NPS 장음계 = nps 3).
   * start: 6번 줄 첫 음의 음계 도수 인덱스, minFret: 첫 음 프렛의 최솟값.
   */
  GT.npsShape = function (rootPc, steps, { nps = 2, start = 0, tuning, minFret = 0 } = {}) {
    const t = tun(tuning), n = steps.length;
    let f0 = MB.mod(rootPc + steps[MB.mod(start, n)] - t[0], 12);
    while (f0 < minFret) f0 += 12;
    let midi = t[0] + f0, deg = MB.mod(start, n);
    const out = [];
    for (let s = 0; s < 6; s++) {
      for (let k = 0; k < nps; k++) {
        if (!(s === 0 && k === 0)) {
          const nd = deg + 1;
          midi += MB.mod(steps[nd % n] - steps[deg % n], 12) || 12;
          deg = nd;
        }
        const f = midi - t[s];
        out.push({ s, f, midi, deg: deg % n, iv: MB.mod(midi - rootPc, 12), label: IV_LABELS[MB.mod(midi - rootPc, 12)] });
      }
    }
    // 위쪽 줄 음이 개방현보다 낮아지면(음수 프렛) 한 옥타브 위 같은 모양을 쓴다
    if (out.some((p) => p.f < 0)) return GT.npsShape(rootPc, steps, { nps, start, tuning, minFret: f0 + 1 });
    return out;
  };
  /** 마이너 펜타토닉 박스 1–5 (박스 1 = 6번 줄 근음에서 시작) */
  GT.pentaBox = (rootPc, box = 1, o = {}) => GT.npsShape(rootPc, MB.SCALES.minorPent.steps, Object.assign({ nps: 2, start: box - 1 }, o));

  /* ------------------------------------------------------------ guitar voice (instrument) */
  GT.TONES = {
    steel:    { name: "통기타(스틸)", bright: 0.78, decay: 0.9975, pos: 0.12, dur: [4.5, 2.8], gain: 1.0 },
    nylon:    { name: "클래식(나일론)", bright: 0.32, decay: 0.996, pos: 0.18, dur: [4, 2.5], gain: 1.15 },
    electric: { name: "일렉(클린)", bright: 0.62, decay: 0.9985, pos: 0.09, dur: [5, 3.5], gain: 0.95 },
    muted:    { name: "팜 뮤트", bright: 0.35, decay: 0.95, pos: 0.12, dur: [0.45, 0.35], gain: 1.1 },
    raw:      { name: "순수 KS(필터 없음)", bright: 0.6, decay: 0.997, pos: 0, dur: [4, 2.5], gain: 1.0 },
  };
  GT.TONE_NAMES = Object.fromEntries(Object.entries(GT.TONES).map(([k, v]) => [k, v.name]));
  // 몸통·픽업 필터 버스: 출력 노드(dest)마다, 음색마다 하나
  const _buses = new WeakMap();
  function bus(ctx, dest, tone) {
    let m = _buses.get(dest); if (!m) _buses.set(dest, (m = {}));
    if (m[tone]) return m[tone];
    const chain = [];
    const peq = (f, g, q) => { const b = ctx.createBiquadFilter(); b.type = "peaking"; b.frequency.value = f; b.gain.value = g; b.Q.value = q; chain.push(b); };
    const lp = (f) => { const b = ctx.createBiquadFilter(); b.type = "lowpass"; b.frequency.value = f; b.Q.value = 0.7; chain.push(b); };
    const hs = (f, g) => { const b = ctx.createBiquadFilter(); b.type = "highshelf"; b.frequency.value = f; b.gain.value = g; chain.push(b); };
    if (tone === "steel") { peq(105, 5, 1.6); peq(220, 3, 1.4); peq(2800, 2, 1); hs(7000, -4); }
    else if (tone === "nylon") { peq(110, 4, 1.4); peq(200, 3, 1.3); lp(3600); }
    else if (tone === "electric") { peq(160, -2, 0.8); peq(2600, 3, 1.2); lp(6500); }
    else if (tone === "muted") { peq(140, 4, 1.2); lp(2200); }
    const input = ctx.createGain(); input.gain.value = 1;
    let last = input; chain.forEach((n) => { last.connect(n); last = n; }); last.connect(dest);
    return (m[tone] = input);
  }
  /**
   * MB.play(midi, {inst:"guitar", dur:null, gt:{tone, bright, decay, pos, seed}}) 로 부르는 악기.
   * voice에 src(BufferSource)와 bend(cents, t, glide)를 더한다.
   */
  MB.INSTRUMENTS.guitar = function (ctx, f, t0, vel, dest, o) {
    const g0 = o.gt || {}, T = GT.TONES[g0.tone || "steel"] || GT.TONES.steel;
    const low = f < 160;
    const buf = MB.ksBuffer(ctx, f, {
      dur: g0.dur || (low ? T.dur[0] : T.dur[1]),
      decay: g0.decay != null ? g0.decay : T.decay,
      bright: MB.clamp((g0.bright != null ? g0.bright : T.bright) * (0.75 + 0.35 * vel), 0.05, 0.98),
      pos: g0.pos != null ? g0.pos : T.pos,
      seed: g0.seed != null ? g0.seed : 1 + Math.floor(Math.random() * 4),
    });
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.setValueAtTime(buf._rate, t0);
    const g = ctx.createGain(), level = 0.42 * vel * T.gain;
    g.gain.setValueAtTime(level, t0);
    src.connect(g); g.connect(g0.raw || g0.tone === "raw" ? dest : bus(ctx, dest, g0.tone || "steel"));
    src.start(t0);
    const end0 = t0 + buf.duration / buf._rate;
    return {
      src, gain: g, t0, rate: buf._rate, end: end0,
      /** 피치를 cents만큼(기준 음 대비) glide초 동안 옮긴다 */
      bend(cents, t = ctx.currentTime, glide = 0.08) {
        const p = src.playbackRate; t = Math.max(t, ctx.currentTime);
        if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); }
        p.linearRampToValueAtTime(buf._rate * Math.pow(2, cents / 1200), t + Math.max(0.005, glide));
      },
      release(t, rr = 0.06) {
        t = Math.max(t, t0 + 0.004);
        g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(level, t); g.gain.setTargetAtTime(0, t, rr / 5);
        const e = Math.min(end0, t + rr); try { src.stop(e + 0.05); } catch (er) {}
        this.end = e; return e;
      },
    };
  };
  MB.INSTRUMENT_NAMES.guitar = "기타(KS 현 모델)";

  /** 뮤트 줄을 긁는 '칙' 소리(바디 노이즈 + 짧은 저음) */
  GT.chuck = function (when, { vel = 0.8, dest } = {}) {
    const ctx = MB.ctx(); if (!ctx) return;
    const t = when != null ? Math.max(when, ctx.currentTime) : ctx.currentTime + 0.005;
    const out = dest || MB.out;
    const s = ctx.createBufferSource(); s.buffer = MB.noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.9;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * vel, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, 0.012);
    s.connect(bp); bp.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + 0.12);
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.05);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.35 * vel, t + 0.003); og.gain.setTargetAtTime(0, t + 0.003, 0.015);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.12);
  };

  /**
   * 가상 기타. 줄마다 한 음만 울린다(같은 줄의 새 음이 앞 음을 멈춘다).
   *   const g = GT.guitar({tone:"steel", tuning:"standard", capo:0});
   *   g.pluck(s, f, {when, vel, bend, tone, ring(버퍼 길이 초)}) → voice    g.strum("x32010", {dir:"D", when})
   *   g.damp(when, strings?)   g.stop()   g.on(({s,f,midi,type})=>{...})  // 소리 나는 순간 호출
   */
  GT.guitar = function (o = {}) {
    const st = { tone: o.tone || "steel", tuning: tun(o.tuning), capo: o.capo || 0, dest: o.dest || null };
    const ring = [null, null, null, null, null, null];
    const listeners = [];
    const fire = (ev, when) => {
      if (!listeners.length) return;
      const delay = Math.max(0, (when - MB.now()) * 1000);
      setTimeout(() => listeners.forEach((cb) => { try { cb(ev); } catch (e) { console.error(e); } }), delay);
    };
    const api = {
      get tone() { return st.tone; }, set tone(v) { st.tone = v; },
      get tuning() { return st.tuning; }, set tuning(v) { st.tuning = tun(v); },
      get capo() { return st.capo; }, set capo(v) { st.capo = v | 0; },
      get dest() { return st.dest; }, set dest(v) { st.dest = v; },
      ringing: ring,
      midi: (s, f) => st.tuning[s] + st.capo + f,
      on(cb) { listeners.push(cb); return api; },
      /** 줄 s의 프렛 f(카포 기준)를 뜯는다 */
      pluck(s, f, p = {}) {
        const ctx = MB.ctx(); if (!ctx || f == null || f < 0) return null;
        const when = p.when != null ? Math.max(p.when, ctx.currentTime) : ctx.currentTime + 0.005;
        const midi = st.tuning[s] + st.capo + f;
        if (ring[s]) { try { ring[s].release(when, 0.03); } catch (e) {} }
        const tone = p.tone || st.tone;
        const v = MB.play(midi, { inst: "guitar", dur: null, when, vel: p.vel != null ? p.vel : 0.8, dest: p.dest || st.dest || undefined,
          gt: { tone, bright: p.bright, decay: p.decay, pos: p.pos, raw: p.raw, dur: p.ring } });
        if (!v) return null;
        ring[s] = v;
        if (p.bend) v.bend(p.bend, when + (p.bendAt || 0.06), p.bendTime || 0.12);
        if (p.dur != null) v.release(when + p.dur, 0.05);
        fire({ s, f, midi, type: p.type || "pluck", when }, when);
        return v;
      },
      /** 코드 모양을 긁는다. dir:"D"(저음→고음) | "U"(고음→저음), spread: 줄 사이 시간(초) */
      strum(shape, p = {}) {
        const ctx = MB.ctx(); if (!ctx) return [];
        const when = p.when != null ? Math.max(p.when, ctx.currentTime) : ctx.currentTime + 0.01;
        const sh = GT.parseShape(shape);
        const dir = p.dir || "D";
        let order = [0, 1, 2, 3, 4, 5];
        if (dir === "U") order = order.reverse();
        if (p.strings) order = order.filter((s) => p.strings.includes(s));
        const spread = p.spread != null ? p.spread : dir === "U" ? 0.009 : 0.012;
        const vel = p.vel != null ? p.vel : 0.75;
        const tone = p.mute ? "muted" : p.tone;
        const vs = []; let k = 0;
        // 모양이 바뀌면서 뮤트(x)가 된 줄은 멈춘다
        sh.forEach((fr, s) => { if (fr < 0 && ring[s]) { ring[s].release(when, 0.04); ring[s] = null; } });
        order.forEach((s) => {
          const fr = sh[s]; if (fr < 0) return;
          const tilt = dir === "U" ? 1 - 0.07 * (5 - s) : 1 - 0.04 * s; // 업은 고음 줄이 세게, 다운은 저음 줄이 세게
          vs.push(api.pluck(s, fr, { when: when + k * spread * (0.85 + 0.3 * Math.random()), vel: vel * tilt * (0.9 + 0.2 * Math.random()), tone, dur: p.dur, ring: p.ring, bright: p.bright, pos: p.pos, decay: p.decay, type: "strum" }));
          k++;
        });
        fire({ type: "strum", dir, shape: sh, when }, when);
        return vs;
      },
      /** 뮤트 스트로크(칙): 울리던 줄을 멈추고 타격 잡음 */
      chuck(p = {}) {
        const when = p.when != null ? p.when : MB.now() + 0.01;
        api.damp(when);
        GT.chuck(when, { vel: p.vel != null ? p.vel : 0.8, dest: st.dest || undefined });
        fire({ type: "chuck", when }, when);
      },
      /** 울리는 줄 멈추기(손바닥·왼손 힘 빼기) */
      damp(when, strings) {
        const t = when != null ? when : MB.now();
        (strings || [0, 1, 2, 3, 4, 5]).forEach((s) => { if (ring[s]) { try { ring[s].release(t, 0.05); } catch (e) {} ring[s] = null; } });
      },
      stop() { api.damp(MB.now()); },
    };
    return api;
  };
  let _default = null;
  /** 책 전체에서 함께 쓰는 기본 기타 */
  GT.default = () => _default || (_default = GT.guitar());

  /* ------------------------------------------------------------ scheduler & strumming */
  /**
   * 박 단위 이벤트 스케줄러(룩어헤드). events: [{t(박), ...}] (t 오름차순이 아니어도 됨)
   *   GT.scheduler(events, {bpm:()=>90, length:8(박, 반복 길이), loop:true,
   *     onEvent(ev, when, spb), onUI(ev), onEnd()}) → {start(), stop(), running, setEvents(list)}
   */
  GT.scheduler = function (events, o = {}) {
    let list = events.slice().sort((a, b) => a.t - b.t);
    let timer = 0, raf = 0, running = false, idx = 0, barStart = 0, beatPos = 0, lastTime = 0;
    const queue = [];
    const bpm = () => (typeof o.bpm === "function" ? o.bpm() : o.bpm || 90);
    const length = () => (typeof o.length === "function" ? o.length() : o.length) || (list.length ? Math.ceil(list[list.length - 1].t + (list[list.length - 1].d || 1)) : 4);
    function tick() {
      const ctx = MB.ctx(), horizon = ctx.currentTime + 0.15;
      // beatPos(박)와 lastTime(초)을 함께 전진시켜 템포가 바뀌어도 이어진다
      for (let guard = 0; guard < 256; guard++) {
        const spb = 60 / bpm();
        const ev = list[idx];
        const L = length();
        const nextT = ev ? ev.t : L;
        const when = lastTime + (nextT - beatPos) * spb;
        if (when > horizon) break;
        if (!ev || ev.t >= L) {
          if (!o.loop) { const endAt = lastTime + (L - beatPos) * spb; queue.push({ end: true, time: endAt }); stopTimers(); return; }
          lastTime = lastTime + (L - beatPos) * spb; beatPos = 0; idx = 0; barStart++;
          if (!list.length) break;
          continue;
        }
        lastTime = when; beatPos = ev.t;
        try { o.onEvent && o.onEvent(ev, when, spb, barStart); } catch (e) { console.error(e); }
        queue.push({ ev, time: when });
        idx++;
      }
    }
    function stopTimers() { clearInterval(timer); timer = 0; }
    function ui() {
      raf = 0; if (!running) return;
      const now = MB.now();
      while (queue.length && queue[0].time <= now) {
        const q = queue.shift();
        if (q.end) { api.stop(); o.onEnd && o.onEnd(); return; }
        o.onUI && o.onUI(q.ev);
      }
      raf = requestAnimationFrame(ui);
    }
    const api = {
      start() {
        const ctx = MB.ctx(); if (!ctx || running) return;
        running = true; idx = 0; beatPos = 0; barStart = 0; lastTime = ctx.currentTime + 0.08; queue.length = 0;
        tick(); if (running) timer = setInterval(tick, 25); raf = requestAnimationFrame(ui);
        o.onStart && o.onStart();
      },
      stop() { if (!running) return; running = false; stopTimers(); if (raf) cancelAnimationFrame(raf); raf = 0; queue.length = 0; o.onStop && o.onStop(); },
      toggle() { running ? api.stop() : api.start(); return running; },
      setEvents(ev) { list = ev.slice().sort((a, b) => a.t - b.t); if (running) { idx = list.findIndex((e) => e.t >= beatPos + 1e-6); if (idx < 0) idx = list.length; } },
      get running() { return running; },
    };
    return api;
  };

  /** 스트럼 패턴: 슬롯 문자 D(다운) U(업) X(뮤트 칙) -(헛스윙). 8슬롯 = 8분음표, 16슬롯 = 16분음표 */
  GT.STRUM_PATTERNS = {
    quarter:  { name: "4분 다운", slots: "D-D-D-D-" },
    eighth:   { name: "8비트 다운업", slots: "DUDUDUDU" },
    folk:     { name: "포크(D DU UDU)", slots: "D-DU-UDU" },
    pop:      { name: "팝(D D DUDU)", slots: "D-D-DUDU" },
    reggae:   { name: "오프비트(업만)", slots: "-U-U-U-U" },
    chuck:    { name: "칙 스트로크", slots: "D-X-D-X-" },
    funk16:   { name: "16비트 펑크", slots: "D-XUD-XU-UXUD-XU" },
    ballad16: { name: "16비트 발라드", slots: "D--UD-UDU-UDD-UD" },
  };
  /** 스트럼 슬롯 문자열 → 스케줄러 이벤트 [{t, dir, accent}] (beats 길이에 균등 배분) */
  GT.strumEvents = function (slots, beats = 4) {
    const n = slots.length, step = beats / n, out = [];
    slots.split("").forEach((c, i) => {
      if (c === "-" || c === " ") return;
      const onBeat = Math.abs((i * step) % 1) < 1e-6;
      out.push({ t: i * step, slot: i, dir: c.toUpperCase() === "U" ? "U" : "D", chuck: c.toUpperCase() === "X", accent: onBeat && Math.abs((i * step) % 2) < 1e-6 });
    });
    return out;
  };

  /* ------------------------------------------------------------ pitch detection */
  /**
   * 자기상관(정규화 차이 함수, YIN 방식) 피치 검출. → {freq, clarity, rms} 또는 null
   * buf: Float32Array 시간 영역 샘플, sr: 샘플레이트, [fmin,fmax] 탐색 범위
   */
  GT.detectPitch = function (buf, sr, { fmin = 60, fmax = 1100, threshold = 0.15 } = {}) {
    const n = buf.length;
    let rms = 0; for (let i = 0; i < n; i++) rms += buf[i] * buf[i]; rms = Math.sqrt(rms / n);
    if (rms < 0.005) return null;
    const tauMin = Math.max(2, Math.floor(sr / fmax)), tauMax = Math.min(Math.floor(n / 2), Math.ceil(sr / fmin));
    const W = n - tauMax;
    const d = new Float32Array(tauMax + 1);
    for (let tau = 1; tau <= tauMax; tau++) { let s = 0; for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + tau]; s += x * x; } d[tau] = s; }
    const c = new Float32Array(tauMax + 1); c[0] = 1; let run = 0;
    for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; c[tau] = run > 0 ? (d[tau] * tau) / run : 1; }
    let tau = -1;
    for (let t = tauMin; t <= tauMax; t++) { if (c[t] < threshold) { while (t + 1 <= tauMax && c[t + 1] < c[t]) t++; tau = t; break; } }
    if (tau < 0) { let best = tauMin; for (let t = tauMin; t <= tauMax; t++) if (c[t] < c[best]) best = t; if (c[best] > 0.35) return null; tau = best; }
    const a = c[tau - 1] != null ? c[tau - 1] : c[tau], b = c[tau], cc = c[tau + 1] != null ? c[tau + 1] : c[tau];
    const den = a - 2 * b + cc, shift = den ? (0.5 * (a - cc)) / den : 0;
    return { freq: sr / (tau + MB.clamp(shift, -1, 1)), clarity: 1 - b, rms };
  };

  /* ------------------------------------------------------------ fretboard widget */
  const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
  /**
   * 가로 지판 SVG. 1번 줄(고음 E)이 위, 너트가 왼쪽(TAB과 같은 방향).
   *   const fb = GT.fretboard("#fb", {frets:12, from:0, labels:"none"|"notes"|"intervals"|"frets", root:pc,
   *                tuning, capo, flat, play:true, tone, even:false, onClick(s,f,midi)});
   *   fb.mark([{s,f,label,cls}], cls)  fb.clear(cls)  fb.set(list, cls)  fb.flash(s,f,ms)
   *   fb.showShape(shape, {cls, fingers})  fb.showScale(rootPc, steps, {from,to})  fb.setLabels(mode, root)
   *   cls: mark(주색) alt(보조색) root(근음) ghost(테두리) ok bad dim
   */
  GT.fretboard = function (sel, o = {}) {
    const host = $(sel);
    host.classList.add("gt-fb");
    const st = {
      from: o.from || 0, frets: o.frets != null ? o.frets : 12, tuning: tun(o.tuning), capo: o.capo || 0,
      labels: o.labels || "none", root: o.root != null ? o.root : 0, flat: !!o.flat, even: !!o.even,
    };
    const guitar = o.guitar || GT.guitar({ tone: o.tone || "steel", tuning: st.tuning });
    const marks = new Map(); // key "s,f" → {cls, label}
    let svg, geo;
    const key = (s, f) => s + "," + f;
    function geometry() {
      const lo = st.from, hi = st.from + st.frets;
      const left = 34, openW = lo === 0 ? 30 : 10, gap = 24, top = 16, H = top * 2 + gap * 5 + 18;
      const unit = 62; // 첫 프렛 폭(px, viewBox 단위)
      const xs = [left + openW];
      for (let f = lo + 1; f <= hi; f++) {
        const w = st.even ? unit * 0.8 : unit * Math.pow(2, -(f - 1) / 12) * 1.25;
        xs.push(xs[xs.length - 1] + Math.max(w, 34));
      }
      const W = xs[xs.length - 1] + 12;
      return { lo, hi, left, openW, gap, top, H, W, xs,
        y: (s) => top + gap * (5 - s),
        cx: (f) => (f === 0 && lo === 0 ? left + openW / 2 - 2 : f <= lo ? xs[0] - 6 : (xs[f - lo - 1] + xs[f - lo]) / 2) };
    }
    function labelFor(s, f) {
      const midi = st.tuning[s] + st.capo + f;
      if (st.labels === "notes") return MB.pcName(midi, st.flat);
      if (st.labels === "intervals") return IV_LABELS[MB.mod(midi - st.root, 12)];
      if (st.labels === "frets") return String(f);
      if (st.labels === "octave") return MB.noteName(midi, st.flat);
      return "";
    }
    function render() {
      geo = geometry();
      const g = geo, P = [];
      P.push(`<svg viewBox="0 0 ${g.W} ${g.H}" style="min-width:${Math.round(g.W * 0.62)}px" role="img" aria-label="기타 지판">`);
      const x0 = g.xs[0], x1 = g.xs[g.xs.length - 1];
      P.push(`<rect class="wood" x="${x0}" y="${g.top - 9}" width="${x1 - x0}" height="${g.gap * 5 + 18}" rx="2"/>`);
      // 인레이
      for (let f = g.lo + 1; f <= g.hi; f++) {
        const cx = g.cx(f), cy = g.top + g.gap * 2.5;
        if (f % 12 === 0) P.push(`<circle class="inlay" cx="${cx}" cy="${g.top + g.gap * 1.5}" r="4.5"/><circle class="inlay" cx="${cx}" cy="${g.top + g.gap * 3.5}" r="4.5"/>`);
        else if (INLAYS.includes(f % 24)) P.push(`<circle class="inlay" cx="${cx}" cy="${cy}" r="4.5"/>`);
      }
      // 프렛 선과 너트
      g.xs.forEach((x, i) => {
        const f = g.lo + i;
        const nut = f === 0;
        P.push(`<line class="${nut ? "nut" : "fret"}" x1="${x}" y1="${g.top - 9}" x2="${x}" y2="${g.top + g.gap * 5 + 9}"/>`);
      });
      if (st.capo > 0 && g.lo === 0) P.push(`<rect class="capo" x="${g.xs[0] - 7}" y="${g.top - 12}" width="9" height="${g.gap * 5 + 24}" rx="3"/>`);
      // 줄
      for (let s = 0; s < 6; s++) {
        const y = g.y(s), wdt = 0.8 + (5 - s) * 0.32;
        P.push(`<line class="str" x1="${g.lo === 0 ? g.left + 4 : x0}" y1="${y}" x2="${x1}" y2="${y}" stroke-width="${wdt.toFixed(2)}"/>`);
        P.push(`<text class="sname" x="${g.left - 22}" y="${y + 4}">${MB.pcName(st.tuning[s] + st.capo, st.flat)}</text>`);
      }
      // 프렛 번호
      for (let f = Math.max(1, g.lo); f <= g.hi; f++) {
        if (f <= g.lo) continue;
        const show = f % 12 === 0 || INLAYS.includes(f % 24) || f === 1 || st.frets <= 5;
        if (show) P.push(`<text class="fnum" x="${g.cx(f)}" y="${g.H - 3}">${f}</text>`);
      }
      // 클릭 영역 + 점 레이어
      P.push(`<g class="hits">`);
      for (let s = 0; s < 6; s++) {
        for (let f = g.lo === 0 ? 0 : g.lo + 1; f <= g.hi; f++) {
          let xa, xb;
          if (f === 0) { xa = g.left - 4; xb = g.xs[0]; } else { xa = g.xs[f - g.lo - 1]; xb = g.xs[f - g.lo]; }
          P.push(`<rect data-s="${s}" data-f="${f}" x="${xa}" y="${g.y(s) - g.gap / 2}" width="${xb - xa}" height="${g.gap}"/>`);
        }
      }
      P.push(`</g><g class="dots"></g></svg>`);
      host.innerHTML = P.join("");
      svg = host.querySelector("svg");
      drawDots();
    }
    function drawDots() {
      const layer = svg.querySelector(".dots");
      const P = [];
      const all = new Map(marks);
      if (st.labels !== "none" && o.labelAll) {
        for (let s = 0; s < 6; s++) for (let f = geo.lo === 0 ? 0 : geo.lo + 1; f <= geo.hi; f++) if (!all.has(key(s, f))) all.set(key(s, f), { cls: "faint", label: null });
      }
      all.forEach((m, k) => {
        const [s, f] = k.split(",").map(Number);
        if (f < (geo.lo === 0 ? 0 : geo.lo + 1) || f > geo.hi) return;
        const cx = geo.cx(f), cy = geo.y(s);
        const label = m.label != null ? m.label : labelFor(s, f);
        P.push(`<g class="dot ${m.cls || "mark"}" data-k="${k}"><circle cx="${cx}" cy="${cy}" r="9.5"/>${label ? `<text x="${cx}" y="${cy + 3.6}">${label}</text>` : ""}</g>`);
      });
      layer.innerHTML = P.join("");
    }
    host.addEventListener("click", (e) => {
      const r = e.target.closest("rect[data-s]"); if (!r) return;
      const s = +r.dataset.s, f = +r.dataset.f, midi = st.tuning[s] + st.capo + f;
      MB.ctx();
      let res;
      if (o.onClick) res = o.onClick(s, f, midi);
      if (res !== false && o.play !== false) { guitar.pluck(s, f); api.flash(s, f); }
    });
    const api = {
      el: host, guitar,
      get svg() { return svg; },
      get state() { return st; },
      /** 점 찍기: list=[{s,f,label,cls}] */
      mark(list, cls = "mark") { (Array.isArray(list) ? list : [list]).forEach((m) => marks.set(key(m.s, m.f), { cls: m.cls || cls, label: m.label })); drawDots(); return api; },
      /** cls를 주면 그 종류만, 없으면 모두 지운다 */
      clear(cls) { if (!cls) marks.clear(); else [...marks].forEach(([k, m]) => { if (m.cls === cls) marks.delete(k); }); drawDots(); return api; },
      set(list, cls = "mark") { marks.clear(); return api.mark(list, cls); },
      unmark(s, f) { marks.delete(key(s, f)); drawDots(); return api; },
      has: (s, f) => marks.has(key(s, f)),
      /** 잠깐 반짝이기(소리와 함께) */
      flash(s, f, ms = 380) {
        if (!svg) return;
        const layer = svg.querySelector(".dots");
        const g = document.createElementNS(SVGNS, "g");
        g.setAttribute("class", "dot on");
        const c = document.createElementNS(SVGNS, "circle");
        c.setAttribute("cx", geo.cx(f)); c.setAttribute("cy", geo.y(s)); c.setAttribute("r", 9.5);
        g.appendChild(c);
        const lab = labelFor(s, f) || MB.pcName(st.tuning[s] + st.capo + f, st.flat);
        const t = document.createElementNS(SVGNS, "text"); t.setAttribute("x", geo.cx(f)); t.setAttribute("y", geo.y(s) + 3.6); t.textContent = lab; g.appendChild(t);
        layer.appendChild(g);
        setTimeout(() => g.remove(), ms);
        // 줄 진동 표시
        const str = svg.querySelectorAll(".str")[s];
        if (str) { str.classList.remove("vib"); void str.getBBox(); str.classList.add("vib"); setTimeout(() => str.classList.remove("vib"), 600); }
      },
      /** 코드 모양 표시(뮤트 줄은 ×) */
      showShape(shape, p = {}) {
        const sh = GT.parseShape(shape), fingers = p.fingers ? GT.parseShape(p.fingers) : null;
        if (!p.keep) marks.clear();
        sh.forEach((f, s) => {
          if (f < 0) { if (geo.lo === 0) marks.set(key(s, 0), { cls: "x", label: "×" }); return; }
          const midi = st.tuning[s] + st.capo + f;
          const isRoot = p.root != null && MB.mod(midi - p.root, 12) === 0;
          const label = p.label === "fingers" && fingers ? (fingers[s] > 0 ? String(fingers[s]) : "○") : p.label === "intervals" && p.root != null ? IV_LABELS[MB.mod(midi - p.root, 12)] : p.label === "notes" ? MB.pcName(midi, st.flat) : undefined;
          marks.set(key(s, f), { cls: p.cls || (isRoot ? "root" : f === 0 ? "open" : "mark"), label });
        });
        drawDots(); return api;
      },
      /** 음계 음 전부 표시(근음 강조) */
      showScale(rootPc, steps, p = {}) {
        if (!p.keep) marks.clear();
        const from = p.from != null ? p.from : geo.lo, to = p.to != null ? p.to : geo.hi;
        GT.scalePositions(rootPc, steps, { tuning: st.tuning, capo: st.capo, from, to }).forEach((n) => {
          const label = p.label === "notes" ? MB.pcName(n.midi, st.flat) : p.label === "none" ? "" : n.label;
          marks.set(key(n.s, n.f), { cls: n.iv === 0 ? "root" : p.cls || "mark", label });
        });
        drawDots(); return api;
      },
      setLabels(mode, root) { st.labels = mode; if (root != null) st.root = root; drawDots(); return api; },
      setTuning(t) { st.tuning = tun(t); guitar.tuning = st.tuning; render(); return api; },
      setCapo(c) { st.capo = c | 0; guitar.capo = st.capo; render(); return api; },
      setRange(from, frets) { st.from = from; if (frets != null) st.frets = frets; render(); return api; },
      setFlat(f) { st.flat = !!f; render(); return api; },
      pos: (s, f) => [geo.cx(f), geo.y(s)],
      redraw: render,
      midi: (s, f) => st.tuning[s] + st.capo + f,
    };
    guitar.capo = st.capo;
    render();
    MB.onTheme(() => drawDots());
    return api;
  };

  /* ------------------------------------------------------------ chord diagram */
  /**
   * 세로 코드 다이어그램 SVG(6번 줄이 왼쪽, 너트가 위).
   *   GT.chordDiagram(el|null, shape, {name, fingers, barre, base, labels:"fingers"|"notes"|"intervals"|"none",
   *                   root, tuning, capo, size, interactive, onPick(s,f), highlight:[s...]}) → SVG 문자열(el이 없으면) 또는 el
   */
  GT.chordDiagram = function (el, shape, o = {}) {
    const sh = GT.parseShape(shape);
    const fingers = o.fingers ? GT.parseShape(o.fingers) : null;
    const fr = sh.filter((v) => v > 0);
    const rows = o.rows || 5;
    let base = o.base != null ? o.base : 1;
    if (o.base == null && fr.length && Math.max(...fr) > rows) base = Math.min(...fr);
    const t = tun(o.tuning), capo = o.capo || 0;
    const sx = 18, sy = 22, L = 32, T = o.name ? 38 : 22, W = L + sx * 5 + 22, H = T + sy * rows + (o.labels && o.labels !== "fingers" && o.labels !== "none" ? 30 : 12);
    const X = (s) => L + sx * s, Y = (r) => T + sy * r;
    const P = [`<svg class="gt-chord-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.name ? o.name + " " : ""}코드 다이어그램 ${GT.shapeString(sh)}">`];
    if (o.name) P.push(`<text class="cname" x="${L + sx * 2.5}" y="18">${o.name}</text>`);
    // 프렛 격자
    for (let r = 0; r <= rows; r++) P.push(`<line class="${r === 0 && base === 1 ? "nut" : "fret"}" x1="${X(0)}" y1="${Y(r)}" x2="${X(5)}" y2="${Y(r)}"/>`);
    for (let s = 0; s < 6; s++) P.push(`<line class="str${o.highlight && o.highlight.includes(s) ? " hl" : ""}" x1="${X(s)}" y1="${Y(0)}" x2="${X(s)}" y2="${Y(rows)}"/>`);
    if (base > 1) P.push(`<text class="base" x="${L - 8}" y="${Y(0) + sy * 0.5 + 4}">${base}fr</text>`);
    // 바레
    let barre = o.barre != null ? o.barre : 0;
    if (o.barre == null && fingers) {
      // 같은 프렛에 손가락 1이 두 줄 이상 → 바레
      const ones = sh.map((f, s) => (fingers[s] === 1 && f > 0 ? s : -1)).filter((s) => s >= 0);
      if (ones.length >= 2 && ones.every((s) => sh[s] === sh[ones[0]])) barre = sh[ones[0]];
    }
    if (barre > 0) {
      const ss = sh.map((f, s) => (f >= barre ? s : -1)).filter((s) => s >= 0);
      const s0 = sh.findIndex((f, s) => f === barre && (!fingers || fingers[s] === 1));
      const s1 = ss[ss.length - 1];
      if (s0 >= 0 && s1 > s0) { const r = barre - base + 0.5; P.push(`<rect class="barre" x="${X(s0) - 7}" y="${Y(r) - 7}" width="${X(s1) - X(s0) + 14}" height="14" rx="7"/>`); }
    }
    sh.forEach((f, s) => {
      const midi = f >= 0 ? t[s] + capo + f : null;
      if (f < 0) P.push(`<text class="mx" x="${X(s)}" y="${T - 6}">×</text>`);
      else if (f === 0) P.push(`<circle class="open${o.root != null && MB.mod(midi - o.root, 12) === 0 ? " root" : ""}" cx="${X(s)}" cy="${T - 10}" r="4.6"/>`);
      else {
        const r = f - base + 0.5;
        if (r > 0 && r < rows + 0.5) {
          const isRoot = o.root != null && MB.mod(midi - o.root, 12) === 0;
          const inBarre = barre > 0 && f === barre && fingers && fingers[s] === 1;
          if (!inBarre || s === sh.findIndex((v, k) => v === barre && fingers[k] === 1)) {
            P.push(`<circle class="dot${isRoot ? " root" : ""}${inBarre ? " inbarre" : ""}" cx="${X(s)}" cy="${Y(r)}" r="7.2"/>`);
            const lab = (o.labels || "fingers") === "fingers" && fingers && fingers[s] > 0 ? fingers[s] : "";
            if (lab) P.push(`<text class="fing" x="${X(s)}" y="${Y(r) + 3.6}">${lab}</text>`);
          }
        }
      }
      if (o.labels === "notes" || o.labels === "intervals") {
        const txt = midi == null ? "" : o.labels === "notes" ? MB.pcName(midi, o.flat) : o.root != null ? IV_LABELS[MB.mod(midi - o.root, 12)] : "";
        P.push(`<text class="nl" x="${X(s)}" y="${Y(rows) + 18}">${txt}</text>`);
      }
    });
    if (o.interactive) {
      for (let s = 0; s < 6; s++) {
        P.push(`<rect class="hit" data-s="${s}" data-f="0" x="${X(s) - sx / 2}" y="0" width="${sx}" height="${T}"/>`);
        for (let r = 0; r < rows; r++) P.push(`<rect class="hit" data-s="${s}" data-f="${base + r}" x="${X(s) - sx / 2}" y="${Y(r)}" width="${sx}" height="${sy}"/>`);
      }
    }
    P.push(`</svg>`);
    const html = P.join("");
    if (!el) return html;
    el = $(el);
    el.classList.add("gt-chord");
    el.innerHTML = html;
    if (o.interactive && o.onPick && !el._gtPick) {
      el._gtPick = true;
      el.addEventListener("click", (e) => { const r = e.target.closest("rect.hit"); if (r) el._onPick(+r.dataset.s, +r.dataset.f); });
    }
    if (o.onPick) el._onPick = o.onPick;
    return el;
  };

  /* ------------------------------------------------------------ tab notation */
  /**
   * TAB 악보 SVG. 반응형(컨테이너 폭에 맞춰 줄바꿈).
   *   notes: [{t(박), d(박), s(줄 인덱스 0=6번 줄), f(프렛), tech:"h"|"p"|"/"|"\\"|"b"|"r"|"~"|"x"|"harm"|"pm", bend:2(반음)}]
   *   GT.tab(el, notes, {beatsPerBar:4, chords:[{t,name}], rhythm:true, title}) → {highlight(i), at(beat), clear(), notes, render()}
   */
  GT.tab = function (sel, notes, o = {}) {
    const host = $(sel);
    host.classList.add("gt-tab");
    let list = notes.slice().sort((a, b) => a.t - b.t || a.s - b.s);
    const bpb = o.beatsPerBar || 4;
    let cur = -1, curBeat = -1, layout = null;
    function totalBeats() { const last = list.reduce((m, n) => Math.max(m, n.t + (n.d || 1)), 0); return Math.max(bpb, Math.ceil(last / bpb - 1e-6) * bpb); }
    function render() {
      const width = Math.max(300, host.clientWidth || 640);
      const bars = Math.round(totalBeats() / bpb);
      const minBarW = o.barWidth || (bpb * (o.beatWidth || 52));
      const perLine = o.barsPerLine || Math.max(1, Math.min(bars, Math.floor((width - 40) / minBarW)));
      const lines = Math.ceil(bars / perLine);
      const gap = 13, left = 34, lineH = gap * 5 + (o.rhythm !== false ? 64 : 34) + (o.chords ? 18 : 0);
      const barW = (width - left - 8) / perLine;
      const topPad = o.chords ? 22 : 18;
      const H = lines * lineH + 4;
      const P = [`<svg viewBox="0 0 ${width} ${H}" role="img" aria-label="TAB 악보">`];
      layout = { width, perLine, barW, left, lineH, gap, topPad };
      const xOf = (t) => { const bar = Math.floor(t / bpb + 1e-9), line = Math.floor(bar / perLine), inBar = t - bar * bpb; return { x: left + (bar % perLine) * barW + 12 + (inBar / bpb) * (barW - 18), line }; };
      layout.xOf = xOf;
      for (let L = 0; L < lines; L++) {
        const y0 = L * lineH + topPad;
        const nb = Math.min(perLine, bars - L * perLine);
        const xEnd = left + nb * barW;
        for (let k = 0; k < 6; k++) P.push(`<line class="tl" x1="${left - 26}" y1="${y0 + k * gap}" x2="${xEnd}" y2="${y0 + k * gap}"/>`);
        P.push(`<text class="clef" x="${left - 22}" y="${y0 + gap * 1.2}">T</text><text class="clef" x="${left - 22}" y="${y0 + gap * 2.7}">A</text><text class="clef" x="${left - 22}" y="${y0 + gap * 4.2}">B</text>`);
        for (let b = 0; b <= nb; b++) { const x = left + b * barW; P.push(`<line class="bar" x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + gap * 5}"/>`); }
        if (L === lines - 1) { P.push(`<line class="bar end" x1="${xEnd - 3}" y1="${y0}" x2="${xEnd - 3}" y2="${y0 + gap * 5}"/>`); }
        P.push(`<rect class="playhead" data-line="${L}" x="-10" y="${y0 - 6}" width="3" height="${gap * 5 + 12}" rx="1.5"/>`);
      }
      // 코드 이름
      (o.chords || []).forEach((c) => { const { x, line } = xOf(c.t); P.push(`<text class="chname" x="${x - 4}" y="${line * lineH + topPad - 10}">${c.name}</text>`); });
      // 음표
      const yOf = (s, line) => line * lineH + topPad + (5 - s) * gap;
      list.forEach((n, i) => {
        const { x, line } = xOf(n.t);
        const y = yOf(n.s, line);
        const txt = n.f == null || n.tech === "x" ? "×" : n.tech === "harm" ? `&lt;${n.f}&gt;` : String(n.f);
        const w = 6 + 6.2 * String(txt).replace(/&[lg]t;/g, "<").length;
        P.push(`<g class="tn" data-i="${i}"><rect x="${x - w / 2}" y="${y - 6.5}" width="${w}" height="13" rx="3"/><text x="${x}" y="${y + 4}">${txt}</text></g>`);
        if (n.tech === "b" || n.bend) {
          const amt = n.bend || 2; const lab = amt === 2 ? "full" : amt === 1 ? "½" : amt + "/2";
          P.push(`<path class="tech" d="M${x + w / 2} ${y} q10 0 12 -14" /><text class="techl" x="${x + w / 2 + 14}" y="${y - 16}">${lab}</text>`);
        }
        if (n.tech === "~") P.push(`<text class="techl" x="${x + w / 2 + 2}" y="${y - 6}">~~</text>`);
        if (n.tech === "pm") P.push(`<text class="techl" x="${x - 6}" y="${line * lineH + topPad - 3}">P.M.</text>`);
      });
      // 레가토·슬라이드(다음 음과 연결)
      list.forEach((n, i) => {
        if (!n.tech || !["h", "p", "/", "\\"].includes(n.tech)) return;
        const prev = list.slice(0, i).reverse().find((m) => m.s === n.s); if (!prev) return;
        const a = xOf(prev.t), b = xOf(n.t); if (a.line !== b.line) return;
        const y = yOf(n.s, b.line);
        if (n.tech === "h" || n.tech === "p") {
          P.push(`<path class="tech" d="M${a.x + 4} ${y - 8} Q${(a.x + b.x) / 2} ${y - 19} ${b.x - 4} ${y - 8}"/><text class="techl" x="${(a.x + b.x) / 2}" y="${y - 17}" text-anchor="middle">${n.tech.toUpperCase()}</text>`);
        } else {
          const up = n.tech === "/";
          P.push(`<line class="tech" x1="${a.x + 8}" y1="${y + (up ? 4 : -4)}" x2="${b.x - 8}" y2="${y + (up ? -4 : 4)}"/>`);
        }
      });
      // 리듬(기둥·꼬리)
      if (o.rhythm !== false) {
        const groups = new Map();
        list.forEach((n) => { const k = Math.round(n.t * 1000); if (!groups.has(k)) groups.set(k, { t: n.t, d: n.d || 1 }); else groups.get(k).d = Math.min(groups.get(k).d, n.d || 1); });
        const gs = [...groups.values()].sort((a, b) => a.t - b.t);
        const beams = new Map();
        gs.forEach((g) => {
          const { x, line } = xOf(g.t); const yb = line * lineH + topPad + gap * 5 + 8, ye = yb + 22;
          g.x = x; g.line = line; g.ye = ye;
          const hollow = g.d >= 2;
          if (g.d < 4) P.push(`<line class="stem" x1="${x}" y1="${yb}" x2="${x}" y2="${hollow ? ye - 4 : ye}"/>`);
          if (hollow) P.push(`<ellipse class="head" cx="${g.d >= 4 ? x : x - 3.6}" cy="${ye}" rx="4.4" ry="3.2" transform="rotate(-20 ${g.d >= 4 ? x : x - 3.6} ${ye})"/>`);
          if (g.d < 1 - 1e-6) { const k = g.line + ":" + Math.floor(g.t + 1e-6); if (!beams.has(k)) beams.set(k, []); beams.get(k).push(g); }
          if ([3, 1.5, 0.75].some((v) => Math.abs(g.d - v) < 1e-6)) P.push(`<circle class="dotted" cx="${x + 5}" cy="${ye - 3}" r="1.6"/>`);
        });
        beams.forEach((grp) => {
          if (grp.length === 1) { // 꼬리
            const g = grp[0]; const n = g.d <= 0.25 + 1e-6 ? 2 : 1;
            for (let k = 0; k < n; k++) P.push(`<path class="flag" d="M${g.x} ${g.ye - k * 5} q6 -2 8 -9"/>`);
            return;
          }
          const a = grp[0], b = grp[grp.length - 1];
          P.push(`<line class="beam" x1="${a.x}" y1="${a.ye}" x2="${b.x}" y2="${b.ye}"/>`);
          for (let k = 0; k < grp.length; k++) {
            const g = grp[k];
            if (g.d <= 0.25 + 1e-6) {
              const nb = grp[k + 1] && grp[k + 1].d <= 0.25 + 1e-6 ? grp[k + 1] : null;
              if (nb) P.push(`<line class="beam" x1="${g.x}" y1="${g.ye - 5}" x2="${nb.x}" y2="${nb.ye - 5}"/>`);
              else if (!(grp[k - 1] && grp[k - 1].d <= 0.25 + 1e-6)) { const dir = k === grp.length - 1 ? -7 : 7; P.push(`<line class="beam" x1="${g.x}" y1="${g.ye - 5}" x2="${g.x + dir}" y2="${g.ye - 5}"/>`); }
            }
          }
        });
      }
      P.push(`</svg>`);
      host.innerHTML = P.join("");
      if (cur >= 0) api.highlight(cur);
      if (curBeat >= 0) api.at(curBeat);
    }
    const api = {
      el: host,
      get notes() { return list; },
      setNotes(n, chords) { list = n.slice().sort((a, b) => a.t - b.t || a.s - b.s); if (chords) o.chords = chords; render(); },
      /** i번째 음(정렬된 목록 기준)과 같은 박의 음들을 강조 */
      highlight(i) {
        cur = i; host.querySelectorAll(".tn.now").forEach((g) => g.classList.remove("now"));
        if (i < 0 || !list[i]) return;
        const t = list[i].t;
        list.forEach((n, k) => { if (Math.abs(n.t - t) < 1e-6) { const g = host.querySelector(`.tn[data-i="${k}"]`); if (g) g.classList.add("now"); } });
      },
      /** 박 위치에 재생 막대 */
      at(beat) {
        curBeat = beat; if (!layout) return;
        host.querySelectorAll(".playhead").forEach((r) => r.setAttribute("x", -10));
        if (beat < 0) return;
        const { x, line } = layout.xOf(beat);
        const r = host.querySelector(`.playhead[data-line="${line}"]`); if (r) r.setAttribute("x", x - 1.5);
      },
      clear() { cur = -1; curBeat = -1; host.querySelectorAll(".tn.now").forEach((g) => g.classList.remove("now")); api.at(-1); },
      render,
    };
    render();
    if (window.ResizeObserver) { let lastW = host.clientWidth; new ResizeObserver(() => { if (Math.abs(host.clientWidth - lastW) > 8) { lastW = host.clientWidth; render(); } }).observe(host); }
    return api;
  };
  /**
   * TAB 음표 재생(기술 기호 반영). → GT.scheduler 객체
   *   GT.playTab(notes, {bpm, guitar, loop, onNote(i, n), onEnd, tab(GT.tab 객체: 자동 강조)})
   */
  GT.playTab = function (notes, o = {}) {
    const g = o.guitar || GT.default();
    const sorted = notes.slice().sort((a, b) => a.t - b.t || a.s - b.s);
    const evs = sorted.map((n, i) => Object.assign({}, n, { i }));
    const total = o.length || Math.max(4, Math.ceil(sorted.reduce((m, n) => Math.max(m, n.t + (n.d || 1)), 0) / 4 - 1e-6) * 4);
    const voices = {};
    const sch = GT.scheduler(evs, {
      bpm: o.bpm || 90, loop: !!o.loop, length: total,
      onEvent(n, when, spb) {
        const legato = n.tech === "h" || n.tech === "p" || n.tech === "/" || n.tech === "\\";
        if (n.tech === "x" || n.f == null) { g.damp(when, [n.s]); GT.chuck(when, { vel: 0.4 }); return; }
        if ((n.tech === "/" || n.tech === "\\") && voices[n.s]) {
          // 슬라이드: 앞 음의 피치를 미끄러뜨린 뒤 새 음으로 이어 받는다
          // bend()는 처음 뜯은 프렛(pv._f) 기준 절대 센트라 연속 슬라이드도 누적되지 않는다
          const pv = voices[n.s];
          pv.bend((n.f - pv._f) * 100, when, Math.min(0.12, spb * 0.4));
          if (n.d) pv.release(when + n.d * spb * 0.98, 0.06);
          return;
        }
        const v = g.pluck(n.s, n.f, { when, vel: (legato ? 0.5 : n.vel || 0.8), tone: n.tech === "pm" ? "muted" : undefined, pos: n.tech === "harm" ? 0.5 : undefined,
          bright: n.tech === "harm" ? 0.95 : undefined });
        if (!v) return;
        v._f = n.f;
        if (n.tech === "harm") { /* 자연 하모닉스는 프렛 위치의 배음: 12프렛=×2, 7=×3, 5=×4 */ const mult = { 12: 2, 7: 3, 19: 3, 5: 4, 24: 4, 4: 5, 9: 5 }[n.f] || 2; v.bend(1200 * Math.log2(mult) - n.f * 100, when, 0.002); }
        if (n.tech === "b" || n.bend) { const amt = (n.bend || 2) * 100; v.bend(amt, when + spb * 0.15, spb * 0.25); }
        if (n.tech === "r") { v.bend((n.bend || 2) * 100, when, 0.003); v.bend(0, when + spb * 0.2, spb * 0.3); }
        if (n.tech === "~") { for (let k = 0; k < 10; k++) v.bend(k % 2 ? 0 : 35, when + 0.12 + k * 0.09, 0.09); }
        voices[n.s] = v;
      },
      onUI(n) { if (o.tab) { o.tab.highlight(n.i); o.tab.at(n.t); } o.onNote && o.onNote(n.i, n); },
      onEnd() { if (o.tab) o.tab.clear(); o.onEnd && o.onEnd(); },
      onStop() { if (o.tab) o.tab.clear(); o.onStop && o.onStop(); },
    });
    return sch;
  };
  /**
   * 간단한 TAB 텍스트 → 음표. 한 줄에 하나씩, 1번 줄부터(e|B|G|D|A|E) 6줄, 칸 하나 = step박.
   *   "e|-----0---|\nB|---1---1-|..." 숫자 두 자리(10–24)도 인식. 기술 문자 h p / \ b ~ x 도 인식.
   */
  GT.parseAsciiTab = function (text, { step = 0.5 } = {}) {
    const rows = text.trim().split(/\n/).map((r) => r.replace(/^[^|]*\|/, "").replace(/\|\s*$/, ""));
    if (rows.length < 6) return [];
    const out = [];
    rows.slice(0, 6).forEach((row, r) => {
      const s = 5 - r; let col = 0; let lastTech = null;
      for (let i = 0; i < row.length; i++) {
        const c = row[i];
        if (c === "|") continue;
        if (/\d/.test(c)) {
          const t0 = col * step; // 음의 시각 = 숫자가 시작하는 칸
          let num = c; if (/\d/.test(row[i + 1] || "")) { num += row[i + 1]; i++; col++; }
          const note = { t: t0, d: step, s, f: +num };
          if (lastTech) { note.tech = lastTech; lastTech = null; }
          if (row[i + 1] === "b") { note.tech = "b"; }
          if (row[i + 1] === "~") { note.tech = "~"; }
          out.push(note);
        } else if ("hp/\\".includes(c)) lastTech = c;
        else if (c === "x") out.push({ t: col * step, d: step, s, f: null, tech: "x" });
        col++;
      }
    });
    out.sort((a, b) => a.t - b.t);
    return out;
  };
})();
