/* ==========================================================================
   BassBook 베이스 전용 스크립트 — 전역 객체 BS (common.js의 MB 위에서 동작)
   - 베이스 음원: 카플러스–스트롱 현 + 주법별 픽업·앰프 필터(핑거·피크·슬랩·팝·뮤트·플랫·업라이트), 데드 노트
   - BS.bass(): 줄·프렛 단위로 뜯는 가상 베이스, 소리 나는 순간의 콜백(on)
   - 위젯: 가로 지판(BS.fretboard), TAB(BS.tab), 낮은음자리표 보표(BS.staff), 스텝 격자(.bs-steps)
   - 이론: 튜닝(4·5·6현), 줄·프렛 ↔ MIDI, 손 위치에 가까운 자리 찾기, 코드 기호 해석, 베이스라인 생성기
   - 반주: 드럼 그루브 사전(BS.GROOVES), 드럼·베이스·건반을 함께 돌리는 밴드(BS.band), 박 스케줄러
   줄 번호 규칙: 배열 인덱스 s=0이 가장 낮은 줄(4현이면 4번 줄 E). 관습의 줄 번호 = 줄 수 − s.
   이 파일은 common.js 다음에 defer 없이 로드한다.
   ========================================================================== */
(function () {
  "use strict";
  const BS = (window.BS = {});
  const SVGNS = "http://www.w3.org/2000/svg";
  const $ = (sel) => (typeof sel === "string" ? document.querySelector(sel) : sel);

  /* ------------------------------------------------------------ tunings & geometry */
  BS.TUNINGS = {
    standard: { name: "4현 표준 (E A D G)", notes: [28, 33, 38, 43] },
    dropD:    { name: "드롭 D (D A D G)", notes: [26, 33, 38, 43] },
    halfDown: { name: "반음 내림 (E♭ A♭ D♭ G♭)", notes: [27, 32, 37, 42] },
    five:     { name: "5현 (B E A D G)", notes: [23, 28, 33, 38, 43] },
    fiveHigh: { name: "5현 하이 C (E A D G C)", notes: [28, 33, 38, 43, 48] },
    six:      { name: "6현 (B E A D G C)", notes: [23, 28, 33, 38, 43, 48] },
    piccolo:  { name: "피콜로 (한 옥타브 위 E A D G)", notes: [40, 45, 50, 55] },
  };
  BS.STANDARD = BS.TUNINGS.standard.notes;
  const tun = (t) => (Array.isArray(t) ? t : t && BS.TUNINGS[t] ? BS.TUNINGS[t].notes : BS.STANDARD);
  BS.tuningNotes = tun;
  /** 관습의 줄 번호(가장 가는 줄 = 1번) */
  BS.stringNumber = (s, tuning) => tun(tuning).length - s;
  BS.stringLabel = (s, tuning) => `${BS.stringNumber(s, tuning)}번 줄(${MB.pcName(tun(tuning)[s])})`;
  /** 스케일 길이(mm): 롱 스케일 34″ = 864, 미디엄 32″ = 813, 숏 30″ = 762, 5현 35″ = 889 */
  BS.SCALE_MM = 864;
  BS.fretPos = (n, L = BS.SCALE_MM) => L * (1 - Math.pow(2, -n / 12));
  BS.midiAt = (s, f, tuning) => tun(tuning)[s] + f;
  /** MIDI 번호를 낼 수 있는 모든 자리 [{s,f}] (0..maxFret) */
  BS.positionsOf = (midi, { tuning, maxFret = 20 } = {}) => {
    const t = tun(tuning), out = [];
    for (let s = 0; s < t.length; s++) { const f = midi - t[s]; if (f >= 0 && f <= maxFret) out.push({ s, f }); }
    return out;
  };
  /**
   * 손 위치(hand = 검지가 놓인 프렛)에서 가장 짚기 쉬운 자리. 한 손가락 한 프렛 범위 [hand−1, hand+4]를 우선,
   * 그다음 손 이동이 적은 자리. 개방현은 open:true일 때만 선호.
   */
  BS.bestPosition = (midi, { tuning, hand = 1, open = true, maxFret = 20, prefer } = {}) => {
    const ps = BS.positionsOf(midi, { tuning, maxFret });
    if (!ps.length) return null;
    const cost = (p) => {
      if (p.f === 0) return open ? 0.5 : 3 + hand * 0.2;
      const inBox = p.f >= hand - 1 && p.f <= hand + 3;
      return (inBox ? 0 : 2 + Math.min(Math.abs(p.f - hand), Math.abs(p.f - hand - 3))) + (prefer != null ? Math.abs(p.s - prefer) * 0.3 : 0);
    };
    return ps.sort((a, b) => cost(a) - cost(b))[0];
  };
  /** MIDI 음 목록 → 손 이동이 적은 TAB 자리 목록(순서대로) */
  BS.fingerLine = (midis, { tuning, hand, open = true } = {}) => {
    let h = hand != null ? hand : null;
    return midis.map((m) => {
      if (m == null) return null;
      if (h == null) { const p0 = BS.bestPosition(m, { tuning, hand: 1, open }); h = p0 && p0.f > 4 ? p0.f - 1 : 1; }
      const p = BS.bestPosition(m, { tuning, hand: h, open });
      if (p && p.f > 0 && (p.f < h - 1 || p.f > h + 3)) h = Math.max(1, p.f - 1);
      return p;
    });
  };
  const IV_LABELS = ["R", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];
  BS.IV_LABELS = IV_LABELS;
  BS.intervalLabel = (semis) => IV_LABELS[MB.mod(semis, 12)];

  /* ------------------------------------------------------------ chord symbols */
  const Q_ALIAS = [
    ["maj7", "maj7"], ["M7", "maj7"], ["Δ7", "maj7"], ["m7b5", "hdim7"], ["m7♭5", "hdim7"], ["ø", "hdim7"], ["dim7", "dim7"], ["°7", "dim7"],
    ["m(maj7)", "mMaj7"], ["mMaj7", "mMaj7"], ["m7", "min7"], ["m6", "min6"], ["m9", "min9"], ["m11", "min11"], ["7sus4", "sus47"], ["7#9", "dom7s9"], ["7♯9", "dom7s9"], ["7b9", "dom7b9"], ["7♭9", "dom7b9"],
    ["13", "dom13"], ["9", "dom9"], ["7", "dom7"], ["6", "maj6"], ["sus2", "sus2"], ["sus4", "sus4"], ["sus", "sus4"], ["dim", "dim"], ["°", "dim"], ["aug", "aug"], ["+", "aug"], ["add9", "add9"], ["5", "pow"], ["m", "min"], ["", "maj"],
  ];
  /** "Am7" "F#m7b5" "B♭maj7" "C/E" → {root, q, bass, name} (root·bass는 피치 클래스) */
  BS.parseChord = function (sym) {
    const m = String(sym).trim().match(/^([A-G])([#♯b♭]?)(.*?)(?:\/([A-G][#♯b♭]?))?$/);
    if (!m) return null;
    const pc = (L, a) => MB.mod({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[L] + (a === "#" || a === "♯" ? 1 : a === "b" || a === "♭" ? -1 : 0), 12);
    const root = pc(m[1], m[2]);
    const rest = m[3];
    const hit = Q_ALIAS.find(([k]) => rest === k) || Q_ALIAS.find(([k]) => k && rest.startsWith(k)) || ["", "maj"];
    const bass = m[4] ? pc(m[4][0], m[4].slice(1)) : root;
    const flat = m[2] === "b" || m[2] === "♭" || MB.prefersFlats(root);
    return { root, q: hit[1], bass, name: String(sym).replace("#", "♯").replace(/^([A-G])b/, "$1♭"), flat };
  };
  /** "C Am F G" 또는 "| C | Am | F G |" → [{root,q,bass,name,beats}] (마디 안에 여러 개면 나눠 가짐) */
  BS.parseProgression = function (text, beatsPerBar = 4) {
    const bars = String(text).includes("|") ? text.split("|").map((b) => b.trim()).filter(Boolean) : text.trim().split(/\s+/).map((x) => x);
    const out = [];
    bars.forEach((bar) => {
      const cs = bar.split(/\s+/).filter(Boolean);
      cs.forEach((c) => { const p = c === "%" && out.length ? Object.assign({}, out[out.length - 1]) : BS.parseChord(c); if (p) { p.beats = beatsPerBar / cs.length; out.push(p); } });
    });
    return out;
  };
  /** 피치 클래스를 베이스 음역(lo..lo+11)의 MIDI로. near를 주면 그 음에 가장 가까운 옥타브 */
  BS.bassNote = (pc, { lo = 28, near } = {}) => {
    if (near != null) { let m = near + MB.mod(pc - near, 12); if (m - near > 6) m -= 12; while (m < lo) m += 12; return m; }
    return lo + MB.mod(pc - lo, 12);
  };

  /* ------------------------------------------------------------ bass lines */
  BS.LINE_STYLES = {
    root1:    "온음표 근음",
    root4:    "4분음 근음",
    root8:    "8분음 근음",
    rootFifth:"근음–5도 (투비트)",
    country:  "근음–5도 4분음",
    octave:   "옥타브 (디스코)",
    arp:      "아르페지오 1–3–5–8",
    arp7:     "7화음 아르페지오",
    approach: "근음 + 반음 어프로치",
    walk:     "워킹 베이스",
    motown:   "모타운 (점8분 + 16분)",
    rock:     "록 8분음 (근음·5도·옥타브)",
  };
  const ivOf = (q) => (MB.CHORDS[q] || MB.CHORDS.maj).iv;
  const third = (q) => (ivOf(q).includes(3) && !ivOf(q).includes(4) ? 3 : ivOf(q).includes(4) ? 4 : ivOf(q).includes(5) ? 5 : 4);
  const fifth = (q) => (ivOf(q).includes(6) && !ivOf(q).includes(7) ? 6 : ivOf(q).includes(8) ? 8 : 7);
  const seventh = (q) => (ivOf(q).find((x) => x >= 9 && x <= 11) != null ? ivOf(q).find((x) => x >= 9 && x <= 11) : 12);
  /**
   * 코드 진행 → 베이스 음표 [{t, d, m, vel, chord(인덱스), role:"R"|"3"|"5"|"8"|"7"|"A"(어프로치)|"P"(경과음), tech}]
   *   chords: BS.parseProgression 결과. style: BS.LINE_STYLES 키. o: {lo(최저 MIDI, 28), seed}
   */
  BS.line = function (chords, style = "root8", o = {}) {
    const lo = o.lo != null ? o.lo : 28, out = [], rnd = MB.rng(o.seed || 3);
    let t = 0, prev = null;
    chords.forEach((c, ci) => {
      const next = chords[(ci + 1) % chords.length];
      const B = c.beats || 4;
      let r = BS.bassNote(c.bass != null ? c.bass : c.root, { lo, near: prev != null ? prev : lo + 5 });
      if (r > lo + 14) r -= 12;
      const nr = BS.bassNote(next.bass != null ? next.bass : next.root, { lo, near: r });
      const n = (dt, d, m, role, extra) => out.push(Object.assign({ t: t + dt, d, m, vel: dt % 1 === 0 ? 0.85 : 0.72, chord: ci, role }, extra || {}));
      const third_ = r + third(c.q), fifth_ = r + fifth(c.q), oct = r + 12;
      const fifthDown = fifth_ - 12 >= lo ? fifth_ - 12 : fifth_;
      switch (style) {
        case "root1": n(0, B, r, "R"); break;
        case "root4": for (let k = 0; k < B; k++) n(k, 1, r, "R"); break;
        case "root8": for (let k = 0; k < B * 2; k++) n(k / 2, 0.5, r, "R"); break;
        case "rootFifth": for (let k = 0; k < B; k += 2) { n(k, 2, k % 4 === 0 ? r : fifthDown, k % 4 === 0 ? "R" : "5"); } break;
        case "country": for (let k = 0; k < B; k++) n(k, 1, k % 2 === 0 ? r : fifthDown, k % 2 === 0 ? "R" : "5"); break;
        case "octave": for (let k = 0; k < B * 2; k++) n(k / 2, 0.5, k % 2 ? oct : r, k % 2 ? "8" : "R"); break;
        case "arp": { const seq = [[r, "R"], [third_, "3"], [fifth_, "5"], [oct, "8"]]; for (let k = 0; k < B; k++) { const [m, ro] = seq[k % 4]; n(k, 1, m, ro); } break; }
        case "arp7": { const seq = [[r, "R"], [third_, "3"], [fifth_, "5"], [r + seventh(c.q), "7"]]; for (let k = 0; k < B; k++) { const [m, ro] = seq[k % 4]; n(k, 1, m, ro); } break; }
        case "approach": {
          for (let k = 0; k < B - 1; k++) n(k, 1, r, "R");
          const a = nr === r ? fifthDown : nr + (rnd() < 0.5 ? -1 : 1);
          n(B - 1, 1, a, nr === r ? "5" : "A"); break;
        }
        case "walk": {
          // 1박: 근음, 2·3박: 코드톤/음계음으로 다음 근음 쪽으로, 4박: 다음 근음의 반음 위·아래(또는 5도 위)
          if (B < 2) { n(0, B, r, "R"); break; }
          const up = nr >= r;
          const tones = [r, third_, fifth_, r + seventh(c.q), oct].filter((m) => m <= lo + 19);
          const target = nr + (rnd() < 0.6 ? (up ? -1 : 1) : (rnd() < 0.5 ? 7 - 12 : -1));
          n(0, 1, r, "R");
          const mids = B - 2;
          let cur = r;
          for (let k = 1; k <= mids; k++) {
            const goal = cur + ((target - cur) * 1) / (mids - k + 2);
            const pick = tones.slice().sort((a, b) => Math.abs(a - goal) - Math.abs(b - goal)).find((m) => m !== cur) || fifth_;
            cur = pick; n(k, 1, cur, pick === third_ ? "3" : pick === fifth_ ? "5" : pick === oct ? "8" : pick === r ? "R" : "7");
          }
          n(B - 1, 1, MB.clamp(target, lo, lo + 22), "A");
          break;
        }
        case "motown": {
          for (let k = 0; k < B; k += 2) {
            n(k, 0.75, r, "R"); n(k + 0.75, 0.25, r, "R", { vel: 0.6 });
            n(k + 1, 0.5, k % 4 === 0 ? fifth_ : oct, k % 4 === 0 ? "5" : "8");
            n(k + 1.5, 0.5, k + 2 >= B ? (nr === r ? third_ : nr - 1) : third_, k + 2 >= B && nr !== r ? "A" : "3");
          }
          break;
        }
        case "rock": {
          const pat = [r, r, r, r, r, r, fifth_, oct];
          for (let k = 0; k < B * 2; k++) n(k / 2, 0.5, pat[k % 8], pat[k % 8] === r ? "R" : pat[k % 8] === oct ? "8" : "5");
          break;
        }
        default: for (let k = 0; k < B * 2; k++) n(k / 2, 0.5, r, "R");
      }
      prev = r; t += B;
    });
    return out;
  };
  /** 음표에 TAB 자리(s,f)를 붙인다(손 이동 최소) */
  BS.withTab = (notes, o = {}) => {
    const ps = BS.fingerLine(notes.map((n) => n.m), o);
    return notes.map((n, i) => Object.assign({}, n, ps[i] ? { s: ps[i].s, f: ps[i].f } : {}));
  };

  /* ------------------------------------------------------------ bass voice (instrument) */
  BS.TONES = {
    finger:  { name: "핑거(라운드 와운드)", bright: 0.42, decay: 0.9985, pos: 0.16, dur: [4.2, 3], gain: 1.0 },
    pick:    { name: "피크", bright: 0.78, decay: 0.998, pos: 0.07, dur: [3.8, 2.6], gain: 0.9 },
    slap:    { name: "슬랩(엄지)", bright: 0.9, decay: 0.997, pos: 0.32, dur: [2.6, 2], gain: 1.0 },
    pop:     { name: "팝(검지로 당기기)", bright: 0.96, decay: 0.9965, pos: 0.05, dur: [1.8, 1.4], gain: 0.85 },
    muted:   { name: "팜 뮤트", bright: 0.3, decay: 0.95, pos: 0.12, dur: [0.5, 0.4], gain: 1.2 },
    flat:    { name: "플랫 와운드(빈티지)", bright: 0.22, decay: 0.997, pos: 0.2, dur: [2.4, 1.8], gain: 1.15 },
    upright: { name: "업라이트(콘트라베이스)", bright: 0.3, decay: 0.993, pos: 0.22, dur: [1.6, 1.2], gain: 1.25 },
    raw:     { name: "순수 KS(필터 없음)", bright: 0.5, decay: 0.998, pos: 0, dur: [4, 3], gain: 0.9 },
  };
  BS.TONE_NAMES = Object.fromEntries(Object.entries(BS.TONES).map(([k, v]) => [k, v.name]));
  const _buses = new WeakMap();
  function bus(ctx, dest, tone) {
    let m = _buses.get(dest); if (!m) _buses.set(dest, (m = {}));
    if (m[tone]) return m[tone];
    const chain = [];
    const peq = (f, g, q) => { const b = ctx.createBiquadFilter(); b.type = "peaking"; b.frequency.value = f; b.gain.value = g; b.Q.value = q; chain.push(b); };
    const lp = (f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = "lowpass"; b.frequency.value = f; b.Q.value = q; chain.push(b); };
    const hp = (f) => { const b = ctx.createBiquadFilter(); b.type = "highpass"; b.frequency.value = f; b.Q.value = 0.7; chain.push(b); };
    hp(30);
    if (tone === "finger") { peq(90, 3, 1.1); peq(700, -2, 1); lp(3200); }
    else if (tone === "pick") { peq(90, 2, 1.1); peq(2400, 4, 1.1); lp(6500); }
    else if (tone === "slap" || tone === "pop") { peq(80, 5, 1); peq(450, -7, 0.8); peq(2800, 6, 0.9); lp(10000); }
    else if (tone === "muted") { peq(110, 4, 1.2); lp(900); }
    else if (tone === "flat") { peq(100, 4, 1.2); lp(1500, 0.9); }
    else if (tone === "upright") { peq(120, 5, 1.3); peq(320, 2, 1.4); lp(1800); }
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.15; chain.push(comp);
    const input = ctx.createGain(); input.gain.value = 1;
    let last = input; chain.forEach((n) => { last.connect(n); last = n; }); last.connect(dest);
    return (m[tone] = input);
  }
  /** 손가락·엄지가 줄을 때리는 순간의 짧은 잡음(주법마다 다름) */
  function transient(ctx, t, tone, vel, dest, f) {
    const spec = { slap: [2600, 0.9, 0.5, 0.012], pop: [4200, 1.2, 0.45, 0.008], pick: [3200, 1, 0.18, 0.006], upright: [600, 0.8, 0.35, 0.02], finger: [1200, 0.8, 0.06, 0.008] }[tone];
    if (!spec) return;
    const s = ctx.createBufferSource(); s.buffer = MB.noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = spec[0]; bp.Q.value = spec[1];
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(spec[2] * vel, t + 0.001); g.gain.setTargetAtTime(0, t + 0.001, spec[3]);
    s.connect(bp); bp.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + 0.15);
    if (tone === "slap") { // 줄이 마지막 프렛에 부딪히는 금속성 울림
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(f * 2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
      const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.25 * vel, t + 0.002); og.gain.setTargetAtTime(0, t + 0.002, 0.03);
      o.connect(og); og.connect(dest); o.start(t); o.stop(t + 0.2);
    }
  }
  /**
   * MB.play(midi, {inst:"ebass", dur:null, bs:{tone, bright, decay, pos, ring}}) 로 부르는 악기.
   * voice에 bend(cents, t, glide)·release(t)가 있다.
   */
  MB.INSTRUMENTS.ebass = function (ctx, f, t0, vel, dest, o) {
    const b0 = o.bs || {}, T = BS.TONES[b0.tone || "finger"] || BS.TONES.finger;
    const low = f < 70;
    const buf = MB.ksBuffer(ctx, f, {
      dur: b0.ring || (low ? T.dur[0] : T.dur[1]),
      decay: b0.decay != null ? b0.decay : T.decay,
      bright: MB.clamp((b0.bright != null ? b0.bright : T.bright) * (0.7 + 0.4 * vel), 0.05, 0.98),
      pos: b0.pos != null ? b0.pos : T.pos,
      seed: b0.seed != null ? b0.seed : 1 + Math.floor(Math.random() * 4),
    });
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.setValueAtTime(buf._rate, t0);
    const g = ctx.createGain(), level = 0.55 * vel * T.gain;
    const atk = (b0.tone === "upright" ? 0.012 : 0.003);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(level, t0 + atk);
    const out = b0.raw || b0.tone === "raw" ? dest : bus(ctx, dest, b0.tone || "finger");
    src.connect(g); g.connect(out);
    transient(ctx, t0, b0.tone || "finger", vel, out, f);
    src.start(t0);
    const end0 = t0 + buf.duration / buf._rate;
    return {
      src, gain: g, t0, rate: buf._rate, end: end0,
      bend(cents, t = ctx.currentTime, glide = 0.08) {
        const p = src.playbackRate; t = Math.max(t, ctx.currentTime);
        if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t);
        p.linearRampToValueAtTime(buf._rate * Math.pow(2, cents / 1200), t + Math.max(0.005, glide));
      },
      release(t, rr = 0.07) {
        t = Math.max(t, t0 + 0.004);
        g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(level, t); g.gain.setTargetAtTime(0, t, rr / 5);
        const e = Math.min(end0, t + rr); try { src.stop(e + 0.05); } catch (er) {}
        this.end = e; return e;
      },
    };
  };
  MB.INSTRUMENT_NAMES.ebass = "베이스(KS 현 모델)";

  /** 데드 노트(고스트): 왼손으로 줄을 살짝 덮고 뜯는 음정 없는 '툭' */
  BS.dead = function (when, { f = 70, vel = 0.7, dest } = {}) {
    const ctx = MB.ctx(); if (!ctx) return;
    const t = when != null ? Math.max(when, ctx.currentTime) : ctx.currentTime + 0.005;
    const out = dest || MB.out;
    const s = ctx.createBufferSource(); s.buffer = MB.noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = Math.max(160, f * 3); bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * vel, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, 0.018);
    s.connect(bp); bp.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + 0.15);
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f * 1.2, t); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.05);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.45 * vel, t + 0.003); og.gain.setTargetAtTime(0, t + 0.003, 0.02);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.15);
  };

  /**
   * 가상 베이스. 줄마다 한 음만 울린다(같은 줄의 새 음이 앞 음을 멈춘다).
   *   const b = BS.bass({tone:"finger", tuning:"standard"});
   *   b.pluck(s, f, {when, vel, tone, dur, bend, ring}) → voice    b.note(midi, {hand, ...})  b.dead(s, {when})
   *   b.damp(when, strings?)   b.stop()   b.on(({s,f,midi,type,when})=>{...})
   */
  BS.bass = function (o = {}) {
    const st = { tone: o.tone || "finger", tuning: tun(o.tuning), dest: o.dest || null };
    let ring = st.tuning.map(() => null);
    const listeners = [];
    const fire = (ev, when) => {
      if (!listeners.length) return;
      const delay = Math.max(0, (when - MB.now()) * 1000);
      setTimeout(() => listeners.forEach((cb) => { try { cb(ev); } catch (e) { console.error(e); } }), delay);
    };
    const api = {
      get tone() { return st.tone; }, set tone(v) { st.tone = v; },
      get tuning() { return st.tuning; }, set tuning(v) { api.stop(); st.tuning = tun(v); ring = st.tuning.map(() => null); },
      get dest() { return st.dest; }, set dest(v) { st.dest = v; },
      get strings() { return st.tuning.length; },
      ringing: () => ring,
      midi: (s, f) => st.tuning[s] + f,
      on(cb) { listeners.push(cb); return api; },
      pluck(s, f, p = {}) {
        const ctx = MB.ctx(); if (!ctx || f == null || f < 0 || s == null || s >= st.tuning.length) return null;
        const when = p.when != null ? Math.max(p.when, ctx.currentTime) : ctx.currentTime + 0.005;
        const midi = st.tuning[s] + f;
        if (ring[s]) { try { ring[s].release(when, 0.025); } catch (e) {} }
        const v = MB.play(midi, { inst: "ebass", dur: null, when, vel: p.vel != null ? p.vel : 0.8, dest: p.dest || st.dest || undefined,
          bs: { tone: p.tone || st.tone, bright: p.bright, decay: p.decay, pos: p.pos, raw: p.raw, ring: p.ring } });
        if (!v) return null;
        ring[s] = v; v._f = f;
        if (p.bend) v.bend(p.bend, when + (p.bendAt || 0.06), p.bendTime || 0.12);
        if (p.dur != null) v.release(when + p.dur, 0.05);
        fire({ s, f, midi, type: p.type || "pluck", tone: p.tone || st.tone, when }, when);
        return v;
      },
      /** MIDI 음을 손 위치(hand)에서 가장 가까운 자리로 */
      note(midi, p = {}) {
        const pos = BS.bestPosition(midi, { tuning: st.tuning, hand: p.hand || 1, open: p.open !== false });
        if (!pos) return null;
        return api.pluck(pos.s, pos.f, p);
      },
      /** 데드 노트: 그 줄의 울림을 멈추고 음정 없는 타격 */
      dead(s, p = {}) {
        const when = p.when != null ? p.when : MB.now() + 0.005;
        api.damp(when, [s]);
        BS.dead(when, { f: MB.mtof(st.tuning[s] + 5), vel: p.vel != null ? p.vel : 0.7, dest: st.dest || undefined });
        fire({ s, f: null, midi: null, type: "dead", when }, when);
      },
      damp(when, strings) {
        const t = when != null ? when : MB.now();
        (strings || st.tuning.map((_, i) => i)).forEach((s) => { if (ring[s]) { try { ring[s].release(t, 0.06); } catch (e) {} ring[s] = null; } });
      },
      stop() { api.damp(MB.now()); },
    };
    return api;
  };
  let _default = null;
  BS.default = () => _default || (_default = BS.bass());

  /* ------------------------------------------------------------ scheduler */
  /**
   * 박 단위 이벤트 스케줄러(룩어헤드). events: [{t(박), ...}]
   *   BS.scheduler(events, {bpm:()=>90, length:8(박), loop:true, swing:()=>0..0.33,
   *     onEvent(ev, when, spb, loopNo), onUI(ev), onEnd(), onStart(), onStop()}) → {start, stop, toggle, running, setEvents}
   *   swing: 8분 뒷박(t의 소수부 0.5)을 swing×박만큼 늦춘다(0.167 ≈ 셋잇단 스윙).
   */
  BS.scheduler = function (events, o = {}) {
    let list = events.slice().sort((a, b) => a.t - b.t);
    let timer = 0, raf = 0, running = false, idx = 0, loopNo = 0, beatPos = 0, lastTime = 0;
    const queue = [];
    const bpm = () => (typeof o.bpm === "function" ? o.bpm() : o.bpm || 90);
    const swing = () => (typeof o.swing === "function" ? o.swing() : o.swing || 0);
    const length = () => (typeof o.length === "function" ? o.length() : o.length) || (list.length ? Math.ceil(list[list.length - 1].t + (list[list.length - 1].d || 1)) : 4);
    function tick() {
      const ctx = MB.ctx(), horizon = ctx.currentTime + 0.15;
      for (let guard = 0; guard < 512; guard++) {
        const spb = 60 / bpm();
        const ev = list[idx];
        const L = length();
        const nextT = ev ? ev.t : L;
        const when = lastTime + (nextT - beatPos) * spb;
        if (when > horizon) break;
        if (!ev || ev.t >= L) {
          if (!o.loop) { const endAt = lastTime + (L - beatPos) * spb; queue.push({ end: true, time: endAt }); stopTimers(); return; }
          lastTime = lastTime + (L - beatPos) * spb; beatPos = 0; idx = 0; loopNo++;
          if (!list.length) break;
          continue;
        }
        lastTime = when; beatPos = ev.t;
        const frac = MB.mod(ev.t, 1), sw = swing();
        const shift = sw && Math.abs(frac - 0.5) < 1e-6 ? sw * spb : sw && Math.abs(frac - 0.75) < 1e-6 ? sw * spb * 0.5 : 0;
        try { o.onEvent && o.onEvent(ev, when + shift, spb, loopNo); } catch (e) { console.error(e); }
        queue.push({ ev, time: when + shift });
        idx++;
      }
    }
    function stopTimers() { clearInterval(timer); timer = 0; }
    function ui() {
      raf = 0; if (!running) return;
      const now = MB.now();
      queue.sort((a, b) => a.time - b.time);
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
        running = true; idx = 0; beatPos = 0; loopNo = 0; lastTime = ctx.currentTime + 0.08; queue.length = 0;
        tick(); if (running) timer = setInterval(tick, 25); raf = requestAnimationFrame(ui);
        o.onStart && o.onStart();
      },
      stop() { if (!running) return; running = false; stopTimers(); if (raf) cancelAnimationFrame(raf); raf = 0; queue.length = 0; o.onStop && o.onStop(); },
      toggle() { running ? api.stop() : api.start(); return running; },
      setEvents(ev) { list = ev.slice().sort((a, b) => a.t - b.t); if (running) { idx = list.findIndex((e) => e.t >= beatPos + 1e-6); if (idx < 0) idx = list.length; } },
      get running() { return running; },
      /** 시작 시각 기준 지금 몇 박째인지(UI용 근사) */
      get beat() { if (!running) return -1; const spb = 60 / bpm(); return beatPos + (MB.now() - lastTime) / spb; },
    };
    return api;
  };

  /* ------------------------------------------------------------ drum grooves */
  /**
   * 드럼 그루브 사전. steps: 한 마디 칸 수(16 = 16분음, 12 = 8분 셋잇단).
   * 각 파트 문자열: x 보통, X 강세, g 고스트, . 쉼. 파트 이름은 MB.drum 이름(kick snare hat openhat ride rim clap cowbell shaker tomL tomM tomH crash).
   */
  BS.GROOVES = {
    none:     { name: "드럼 없음", steps: 16, parts: {} },
    click:    { name: "메트로놈", steps: 4, parts: { rim: "Xxxx" } },
    rock8:    { name: "록 8비트", steps: 16, parts: { kick: "x.......x.x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x." } },
    pop:      { name: "팝 (4온더플로어 아님)", steps: 16, parts: { kick: "x.....x...x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x." } },
    four:     { name: "포 온 더 플로어", steps: 16, parts: { kick: "x...x...x...x...", snare: "....x.......x...", hat: "..x...x...x...x.", } },
    disco:    { name: "디스코", steps: 16, parts: { kick: "x...x...x...x...", snare: "....x.......x...", hat: "x...x...x...x...", openhat: "..x...x...x...x." } },
    funk16:   { name: "펑크 16비트", steps: 16, parts: { kick: "x.x.......x..x..", snare: "....x..g.g..x..g", hat: "xxxxxxxxxxxxxxxx" } },
    halftime: { name: "하프타임", steps: 16, parts: { kick: "x.....x.........", snare: "........x.......", hat: "x.x.x.x.x.x.x.x." } },
    motown:   { name: "모타운 (스네어 4분)", steps: 16, parts: { kick: "x.....x.x.....x.", snare: "x...x...x...x...", hat: "x.x.x.x.x.x.x.x." } },
    reggae:   { name: "레게 원 드롭", steps: 16, parts: { kick: "........x.......", rim: "........x.......", hat: "..x...x...x...x." } },
    shuffle:  { name: "셔플 (12/8)", steps: 12, parts: { kick: "x.....x.....", snare: "...x.....x..", hat: "x.xx.xx.xx.x" } },
    swing:    { name: "재즈 스윙 (라이드)", steps: 12, parts: { kick: "g..g..g..g..", ride: "x..x.xx..x.x", hat: "...x.....x.." } },
    bossa:    { name: "보사노바", steps: 16, parts: { kick: "x..xx..xx..xx..x", rim: "x..x..x...x..x..", hat: "x.x.x.x.x.x.x.x." } },
    tumbao:   { name: "살사 (클라베 2-3)", steps: 16, parts: { cowbell: "x...x...x...x...", rim: "..x.x...x..x..x.", kick: "......x.......x." } },
    hiphop:   { name: "힙합 (붐뱁)", steps: 16, parts: { kick: "x.......xx....x.", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x." } },
  };
  BS.GROOVE_NAMES = Object.fromEntries(Object.entries(BS.GROOVES).map(([k, v]) => [k, v.name]));
  /** 그루브 → 이벤트 [{t(박), drum, vel}] (bars 마디, beatsPerBar 박) */
  BS.drumEvents = function (groove, bars = 1, beatsPerBar = 4) {
    const G = typeof groove === "string" ? BS.GROOVES[groove] : groove;
    if (!G) return [];
    const out = [], step = beatsPerBar / G.steps;
    for (let b = 0; b < bars; b++) {
      Object.entries(G.parts).forEach(([drum, pat]) => {
        pat.split("").forEach((c, i) => {
          if (c === "." || c === " ") return;
          out.push({ t: b * beatsPerBar + i * step, drum, vel: c === "X" ? 1 : c === "g" ? 0.3 : drum === "hat" || drum === "ride" ? 0.55 : 0.85, kind: "drum" });
        });
      });
    }
    return out;
  };
  /** 한 마디 안의 킥 위치(박) */
  BS.kickBeats = (groove, beatsPerBar = 4) => BS.drumEvents(groove, 1, beatsPerBar).filter((e) => e.drum === "kick" && e.vel > 0.4).map((e) => e.t);
  /** 그루브의 셋잇단 여부: 12칸 그루브의 칸은 1/3박이므로 베이스 음표 t도 1/3 격자로 */
  BS.isTriplet = (groove) => (typeof groove === "string" ? BS.GROOVES[groove] : groove).steps % 3 === 0;

  /**
   * 밴드: 드럼 그루브 + 베이스라인 + (선택) 건반 코드를 한 스케줄러로 반복 재생.
   *   const band = BS.band({bpm:()=>96, progression:()=>"C Am F G", style:()=>"root8", groove:()=>"rock8",
   *                         keys:()=>true, bass:()=>true, swing:()=>0, notes:()=>[...](직접 만든 베이스 음표; 있으면 style 무시),
   *                         bassInst: BS.bass 객체, onNote(n), onBeat(beat, bar), onChord(i)});
   *   band.start() band.stop() band.toggle() band.refresh()(설정이 바뀌면) band.notes(현재 베이스 음표) band.chords
   * 베이스 음표의 tech: "dead" 데드 노트, "slap" "pop" 주법, "h" "/" 레가토·슬라이드(앞 음에서 이어짐).
   */
  BS.band = function (o = {}) {
    const val = (k, d) => (typeof o[k] === "function" ? o[k]() : o[k] != null ? o[k] : d);
    const bass = o.bassInst || BS.default();
    let chords = [], notes = [], total = 4;
    const voices = {};
    function build() {
      const prog = val("progression", "C");
      chords = Array.isArray(prog) ? prog : BS.parseProgression(prog);
      total = Math.max(4, Math.ceil(chords.reduce((a, c) => a + (c.beats || 4), 0) / 4 - 1e-6) * 4);
      const custom = val("notes", null);
      notes = custom ? custom.slice() : BS.line(chords, val("style", "root8"), { lo: val("lo", 28), seed: val("seed", 3) });
      notes = BS.withTab(notes, { tuning: bass.tuning });
      const ev = [];
      if (val("bass", true)) notes.forEach((n, i) => ev.push(Object.assign({ kind: "bass", i }, n)));
      const gname = val("groove", "rock8");
      BS.drumEvents(gname, total / 4).forEach((e) => ev.push(e));
      if (val("keys", false)) { let t = 0; chords.forEach((c, ci) => { ev.push({ t, kind: "keys", chord: ci, d: c.beats || 4 }); t += c.beats || 4; }); }
      let t = 0; chords.forEach((c, ci) => { ev.push({ t, kind: "chord", chord: ci }); t += c.beats || 4; });
      for (let b = 0; b < total; b++) ev.push({ t: b, kind: "beat", beat: b });
      return ev;
    }
    let keyVoices = [];
    const sch = BS.scheduler(build(), {
      bpm: () => val("bpm", 96), loop: o.loop !== false, length: () => total, swing: () => val("swing", 0),
      onEvent(ev, when, spb) {
        if (ev.kind === "drum") MB.drum(ev.drum, when, { vel: ev.vel * val("drumLevel", 0.8) });
        else if (ev.kind === "bass") {
          const d = (ev.d || 0.5) * spb * (ev.legato || val("legato", 0.92));
          if (ev.tech === "dead") { bass.dead(ev.s != null ? ev.s : 0, { when, vel: ev.vel * 0.9 }); return; }
          if (ev.tech === "/" && voices[ev.s]) { const pv = voices[ev.s]; pv.bend((ev.f - pv._f) * 100, when, Math.min(0.1, spb * 0.4)); pv.release(when + d, 0.06); return; }
          const v = bass.pluck(ev.s, ev.f, { when, vel: (ev.tech === "h" || ev.tech === "p" ? 0.55 : 1) * (ev.vel || 0.8), dur: d, tone: ev.tech === "slap" ? "slap" : ev.tech === "pop" ? "pop" : ev.tone });
          if (v) voices[ev.s] = v;
        } else if (ev.kind === "keys") {
          const c = chords[ev.chord]; const iv = ivOf(c.q).filter((x) => x < 12);
          const ms = MB.voiceLead(keyVoices.length ? keyVoices : [55, 60, 64], iv.map((x) => c.root + x), [52, 74]);
          keyVoices = ms;
          ms.forEach((m) => MB.play(m, { inst: "epiano", when, dur: ev.d * spb * 0.9, vel: 0.28 * val("keysLevel", 1) }));
        }
      },
      onUI(ev) {
        if (ev.kind === "bass") o.onNote && o.onNote(ev);
        else if (ev.kind === "beat") o.onBeat && o.onBeat(ev.beat, Math.floor(ev.beat / 4));
        else if (ev.kind === "chord") o.onChord && o.onChord(ev.chord, chords[ev.chord]);
      },
      onStart: o.onStart, onStop: () => { bass.stop(); o.onStop && o.onStop(); }, onEnd: o.onEnd,
    });
    return {
      start: () => sch.start(), stop: () => sch.stop(), toggle: () => sch.toggle(),
      get running() { return sch.running; },
      refresh() { sch.setEvents(build()); return this; },
      get notes() { return notes; }, get chords() { return chords; }, get length() { return total; },
      bass,
    };
  };

  /* ------------------------------------------------------------ pitch detection */
  /**
   * YIN 피치 검출 → {freq, clarity, rms} | null. 베이스 저음(41 Hz)을 잡으려면 버퍼가 2·sr/fmin 샘플 이상이어야 한다
   * (48 kHz에서 fmin 35 Hz → 2743샘플 이상, analyser.fftSize = 4096 이상 권장).
   */
  BS.detectPitch = function (buf, sr, { fmin = 35, fmax = 500, threshold = 0.15 } = {}) {
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
   * 가로 지판 SVG. 가장 가는 줄이 위, 너트가 왼쪽(TAB과 같은 방향). 줄 수는 튜닝 길이(4·5·6).
   *   const fb = BS.fretboard("#fb", {frets:12, from:0, labels:"none"|"notes"|"intervals"|"frets"|"octave", root:pc,
   *                tuning, flat, play:true, tone, even:false, onClick(s,f,midi), labelAll, bass});
   *   fb.mark([{s,f,label,cls}], cls)  fb.clear(cls)  fb.set(list, cls)  fb.flash(s,f,ms)  fb.showScale(rootPc, steps, {from,to})
   *   cls: mark(주색) alt(보조색) root(근음) open ghost dim ok bad x
   */
  BS.fretboard = function (sel, o = {}) {
    const host = $(sel);
    host.classList.add("bs-fb");
    const st = {
      from: o.from || 0, frets: o.frets != null ? o.frets : 12, tuning: tun(o.tuning),
      labels: o.labels || "none", root: o.root != null ? o.root : 0, flat: !!o.flat, even: !!o.even,
    };
    const bass = o.bass || BS.bass({ tone: o.tone || "finger", tuning: st.tuning });
    const marks = new Map();
    let svg, geo;
    const key = (s, f) => s + "," + f;
    const N = () => st.tuning.length;
    function geometry() {
      const lo = st.from, hi = st.from + st.frets, n = N();
      const left = 34, openW = lo === 0 ? 30 : 10, gap = 26, top = 16, H = top * 2 + gap * (n - 1) + 18;
      const unit = 70;
      const xs = [left + openW];
      for (let f = lo + 1; f <= hi; f++) {
        const w = st.even ? unit * 0.75 : unit * Math.pow(2, -(f - 1) / 12) * 1.2;
        xs.push(xs[xs.length - 1] + Math.max(w, 34));
      }
      const W = xs[xs.length - 1] + 12;
      return { lo, hi, left, openW, gap, top, H, W, xs, n,
        y: (s) => top + gap * (n - 1 - s),
        cx: (f) => (f === 0 && lo === 0 ? left + openW / 2 - 2 : f <= lo ? xs[0] - 6 : (xs[f - lo - 1] + xs[f - lo]) / 2) };
    }
    function labelFor(s, f) {
      const midi = st.tuning[s] + f;
      if (st.labels === "notes") return MB.pcName(midi, st.flat);
      if (st.labels === "intervals") return IV_LABELS[MB.mod(midi - st.root, 12)];
      if (st.labels === "frets") return String(f);
      if (st.labels === "octave") return MB.noteName(midi, st.flat);
      return "";
    }
    function render() {
      geo = geometry();
      const g = geo, P = [], span = g.gap * (g.n - 1);
      P.push(`<svg viewBox="0 0 ${g.W} ${g.H}" style="min-width:${Math.round(g.W * 0.6)}px" role="img" aria-label="베이스 지판">`);
      const x0 = g.xs[0], x1 = g.xs[g.xs.length - 1];
      P.push(`<rect class="wood" x="${x0}" y="${g.top - 10}" width="${x1 - x0}" height="${span + 20}" rx="2"/>`);
      for (let f = g.lo + 1; f <= g.hi; f++) {
        const cx = g.cx(f);
        if (f % 12 === 0) P.push(`<circle class="inlay" cx="${cx}" cy="${g.top + span * 0.25}" r="4.5"/><circle class="inlay" cx="${cx}" cy="${g.top + span * 0.75}" r="4.5"/>`);
        else if (INLAYS.includes(f % 24)) P.push(`<circle class="inlay" cx="${cx}" cy="${g.top + span / 2}" r="4.5"/>`);
      }
      g.xs.forEach((x, i) => { const f = g.lo + i; P.push(`<line class="${f === 0 ? "nut" : "fret"}" x1="${x}" y1="${g.top - 10}" x2="${x}" y2="${g.top + span + 10}"/>`); });
      for (let s = 0; s < g.n; s++) {
        const y = g.y(s), wdt = 1.3 + (g.n - 1 - s) * 0.55;
        P.push(`<line class="str" x1="${g.lo === 0 ? g.left + 4 : x0}" y1="${y}" x2="${x1}" y2="${y}" stroke-width="${wdt.toFixed(2)}"/>`);
        P.push(`<text class="sname" x="${g.left - 22}" y="${y + 4}">${MB.pcName(st.tuning[s], st.flat)}</text>`);
      }
      for (let f = Math.max(1, g.lo + 1); f <= g.hi; f++) {
        const show = f % 12 === 0 || INLAYS.includes(f % 24) || f === 1 || st.frets <= 5;
        if (show) P.push(`<text class="fnum" x="${g.cx(f)}" y="${g.H - 3}">${f}</text>`);
      }
      P.push(`<g class="hits">`);
      for (let s = 0; s < g.n; s++) {
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
      const P = [], all = new Map(marks);
      if (st.labels !== "none" && o.labelAll) {
        for (let s = 0; s < geo.n; s++) for (let f = geo.lo === 0 ? 0 : geo.lo + 1; f <= geo.hi; f++) if (!all.has(key(s, f))) all.set(key(s, f), { cls: "faint", label: null });
      }
      all.forEach((m, k) => {
        const [s, f] = k.split(",").map(Number);
        if (s >= geo.n || f < (geo.lo === 0 ? 0 : geo.lo + 1) || f > geo.hi) return;
        const cx = geo.cx(f), cy = geo.y(s);
        const label = m.label != null ? m.label : labelFor(s, f);
        P.push(`<g class="dot ${m.cls || "mark"}" data-k="${k}"><circle cx="${cx}" cy="${cy}" r="10"/>${label ? `<text x="${cx}" y="${cy + 3.6}">${label}</text>` : ""}</g>`);
      });
      layer.innerHTML = P.join("");
    }
    host.addEventListener("click", (e) => {
      const r = e.target.closest("rect[data-s]"); if (!r) return;
      const s = +r.dataset.s, f = +r.dataset.f, midi = st.tuning[s] + f;
      MB.ctx();
      let res;
      if (o.onClick) res = o.onClick(s, f, midi);
      if (res !== false && o.play !== false) { bass.pluck(s, f); api.flash(s, f); }
    });
    const api = {
      el: host, bass,
      get svg() { return svg; },
      get state() { return st; },
      mark(list, cls = "mark") { (Array.isArray(list) ? list : [list]).forEach((m) => marks.set(key(m.s, m.f), { cls: m.cls || cls, label: m.label })); drawDots(); return api; },
      clear(cls) { if (!cls) marks.clear(); else [...marks].forEach(([k, m]) => { if (m.cls === cls) marks.delete(k); }); drawDots(); return api; },
      set(list, cls = "mark") { marks.clear(); return api.mark(list, cls); },
      unmark(s, f) { marks.delete(key(s, f)); drawDots(); return api; },
      has: (s, f) => marks.has(key(s, f)),
      flash(s, f, ms = 380) {
        if (!svg || s == null || f == null || s >= geo.n) return;
        if (f > geo.hi || f < (geo.lo === 0 ? 0 : geo.lo + 1)) return;
        const layer = svg.querySelector(".dots");
        const g = document.createElementNS(SVGNS, "g"); g.setAttribute("class", "dot on");
        const c = document.createElementNS(SVGNS, "circle"); c.setAttribute("cx", geo.cx(f)); c.setAttribute("cy", geo.y(s)); c.setAttribute("r", 10); g.appendChild(c);
        const t = document.createElementNS(SVGNS, "text"); t.setAttribute("x", geo.cx(f)); t.setAttribute("y", geo.y(s) + 3.6); t.textContent = labelFor(s, f) || MB.pcName(st.tuning[s] + f, st.flat); g.appendChild(t);
        layer.appendChild(g); setTimeout(() => g.remove(), ms);
        const str = svg.querySelectorAll(".str")[s];
        if (str) { str.classList.remove("vib"); void str.getBBox(); str.classList.add("vib"); setTimeout(() => str.classList.remove("vib"), 600); }
      },
      showScale(rootPc, steps, p = {}) {
        if (!p.keep) marks.clear();
        const from = p.from != null ? p.from : geo.lo, to = p.to != null ? p.to : geo.hi;
        BS.scalePositions(rootPc, steps, { tuning: st.tuning, from, to }).forEach((n) => {
          const label = p.label === "notes" ? MB.pcName(n.midi, st.flat) : p.label === "none" ? "" : n.label;
          marks.set(key(n.s, n.f), { cls: n.iv === 0 ? "root" : p.cls || "mark", label });
        });
        drawDots(); return api;
      },
      setLabels(mode, root) { st.labels = mode; if (root != null) st.root = root; drawDots(); return api; },
      setTuning(t) { st.tuning = tun(t); bass.tuning = st.tuning; [...marks.keys()].forEach((k) => { if (+k.split(",")[0] >= st.tuning.length) marks.delete(k); }); render(); return api; },
      setRange(from, frets) { st.from = from; if (frets != null) st.frets = frets; render(); return api; },
      setFlat(f) { st.flat = !!f; render(); return api; },
      pos: (s, f) => [geo.cx(f), geo.y(s)],
      redraw: render,
      midi: (s, f) => st.tuning[s] + f,
    };
    render();
    MB.onTheme(() => drawDots());
    return api;
  };
  /** 프렛 구간 [from,to]에서 음계 음 자리 → [{s,f,midi,pc,deg,iv,label}] */
  BS.scalePositions = function (rootPc, steps, { tuning, from = 0, to = 12 } = {}) {
    const t = tun(tuning), set = new Map(steps.map((x, i) => [MB.mod(x, 12), i])), out = [];
    for (let s = 0; s < t.length; s++) for (let f = from; f <= to; f++) {
      const midi = t[s] + f, iv = MB.mod(midi - rootPc, 12);
      if (set.has(iv)) out.push({ s, f, midi, pc: MB.mod(midi, 12), deg: set.get(iv), iv, label: IV_LABELS[iv] });
    }
    return out;
  };
  /**
   * 근음 자리(s, f)를 기준으로 한 음정 모양: intervals(반음, 음수 가능) → 손 범위 [f−2, f+4] 안의 자리 [{s,f,iv,label}]
   * 예: BS.shape(0, 3, [0, 7, 12]) → G 근음–5도–옥타브.
   */
  BS.shape = function (s0, f0, intervals, { tuning } = {}) {
    const t = tun(tuning), root = t[s0] + f0;
    return intervals.map((iv) => {
      const m = root + iv;
      const cands = [];
      for (let s = 0; s < t.length; s++) { const f = m - t[s]; if (f >= 0 && f >= f0 - 2 && f <= f0 + 4) cands.push({ s, f }); }
      if (!cands.length) for (let s = 0; s < t.length; s++) { const f = m - t[s]; if (f >= 0 && f <= 24) cands.push({ s, f }); }
      cands.sort((a, b) => Math.abs(a.f - f0) - Math.abs(b.f - f0) || a.s - b.s);
      return cands[0] ? Object.assign(cands[0], { iv, label: IV_LABELS[MB.mod(iv, 12)], midi: m }) : null;
    }).filter(Boolean);
  };

  /* ------------------------------------------------------------ tab notation */
  const TECH_TEXT = { slap: "T", pop: "P", dead: "×", g: "×" };
  /**
   * TAB 악보 SVG(줄 수 = 튜닝 길이). 반응형.
   *   notes: [{t(박), d(박), s, f, tech:"h"|"p"|"/"|"\\"|"dead"|"slap"|"pop"|"harm"|"pm"|"~"}]
   *   BS.tab(el, notes, {beatsPerBar:4, chords:[{t,name}], rhythm:true, tuning, barsPerLine}) → {highlight(i), at(beat), clear(), setNotes(), notes}
   */
  BS.tab = function (sel, notes, o = {}) {
    const host = $(sel);
    host.classList.add("bs-tab");
    let list = notes.filter((n) => n && n.s != null).slice().sort((a, b) => a.t - b.t || a.s - b.s);
    const bpb = o.beatsPerBar || 4;
    let cur = -1, curBeat = -1, layout = null;
    const nStr = () => tun(o.tuning).length;
    function totalBeats() { const last = list.reduce((m, n) => Math.max(m, n.t + (n.d || 1)), 0); return Math.max(o.minBeats || bpb, Math.ceil(last / bpb - 1e-6) * bpb); }
    function render() {
      const n = nStr();
      const width = Math.max(300, host.clientWidth || 640);
      const bars = Math.round(totalBeats() / bpb);
      const minBarW = o.barWidth || bpb * (o.beatWidth || 52);
      const perLine = o.barsPerLine || Math.max(1, Math.min(bars, Math.floor((width - 40) / minBarW)));
      const lines = Math.ceil(bars / perLine);
      const gap = 14, left = 34, lineH = gap * (n - 1) + (o.rhythm !== false ? 66 : 36) + (o.chords ? 18 : 0);
      const barW = (width - left - 8) / perLine;
      const topPad = o.chords ? 24 : 18;
      const H = lines * lineH + 4;
      const P = [`<svg viewBox="0 0 ${width} ${H}" role="img" aria-label="베이스 TAB 악보">`];
      layout = { width, perLine, barW, left, lineH, gap, topPad };
      const xOf = (t) => { const bar = Math.floor(t / bpb + 1e-9), line = Math.floor(bar / perLine), inBar = t - bar * bpb; return { x: left + (bar % perLine) * barW + 12 + (inBar / bpb) * (barW - 18), line }; };
      layout.xOf = xOf;
      const span = gap * (n - 1);
      for (let L = 0; L < lines; L++) {
        const y0 = L * lineH + topPad;
        const nb = Math.min(perLine, bars - L * perLine);
        const xEnd = left + nb * barW;
        for (let k = 0; k < n; k++) P.push(`<line class="tl" x1="${left - 26}" y1="${y0 + k * gap}" x2="${xEnd}" y2="${y0 + k * gap}"/>`);
        ["T", "A", "B"].forEach((c, k) => P.push(`<text class="clef" x="${left - 22}" y="${y0 + span * (0.18 + k * 0.36) + 4}">${c}</text>`));
        for (let b = 0; b <= nb; b++) { const x = left + b * barW; P.push(`<line class="bar" x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + span}"/>`); }
        if (L === lines - 1) P.push(`<line class="bar end" x1="${xEnd - 3}" y1="${y0}" x2="${xEnd - 3}" y2="${y0 + span}"/>`);
        P.push(`<rect class="playhead" data-line="${L}" x="-10" y="${y0 - 6}" width="3" height="${span + 12}" rx="1.5"/>`);
      }
      (o.chords || []).forEach((c) => { const { x, line } = xOf(c.t); P.push(`<text class="chname" x="${x - 4}" y="${line * lineH + topPad - 10}">${c.name}</text>`); });
      const yOf = (s, line) => line * lineH + topPad + (n - 1 - s) * gap;
      list.forEach((nt, i) => {
        const { x, line } = xOf(nt.t);
        const y = yOf(nt.s, line);
        const txt = nt.f == null || nt.tech === "dead" || nt.tech === "x" ? "×" : nt.tech === "harm" ? `&lt;${nt.f}&gt;` : String(nt.f);
        const w = 6 + 6.4 * String(txt).replace(/&[lg]t;/g, "<").length;
        P.push(`<g class="tn" data-i="${i}"><rect x="${x - w / 2}" y="${y - 7}" width="${w}" height="14" rx="3"/><text x="${x}" y="${y + 4}">${txt}</text></g>`);
        if (nt.tech === "slap" || nt.tech === "pop") P.push(`<text class="techl" x="${x}" y="${line * lineH + topPad + span + 12}" text-anchor="middle">${TECH_TEXT[nt.tech]}</text>`);
        if (nt.tech === "~") P.push(`<text class="techl" x="${x + w / 2 + 2}" y="${y - 6}">~~</text>`);
        if (nt.tech === "pm") P.push(`<text class="techl" x="${x - 6}" y="${line * lineH + topPad - 3}">P.M.</text>`);
      });
      list.forEach((nt, i) => {
        if (!nt.tech || !["h", "p", "/", "\\"].includes(nt.tech)) return;
        const prev = list.slice(0, i).reverse().find((m) => m.s === nt.s); if (!prev) return;
        const a = xOf(prev.t), b = xOf(nt.t); if (a.line !== b.line) return;
        const y = yOf(nt.s, b.line);
        if (nt.tech === "h" || nt.tech === "p") P.push(`<path class="tech" d="M${a.x + 4} ${y - 8} Q${(a.x + b.x) / 2} ${y - 19} ${b.x - 4} ${y - 8}"/><text class="techl" x="${(a.x + b.x) / 2}" y="${y - 17}" text-anchor="middle">${nt.tech.toUpperCase()}</text>`);
        else { const up = nt.f > prev.f; P.push(`<line class="tech" x1="${a.x + 8}" y1="${y + (up ? 4 : -4)}" x2="${b.x - 8}" y2="${y + (up ? -4 : 4)}"/>`); }
      });
      if (o.rhythm !== false) {
        const groups = new Map();
        list.forEach((nt) => { const k = Math.round(nt.t * 1000); if (!groups.has(k)) groups.set(k, { t: nt.t, d: nt.d || 1 }); else groups.get(k).d = Math.min(groups.get(k).d, nt.d || 1); });
        const gs = [...groups.values()].sort((a, b) => a.t - b.t);
        const beams = new Map();
        gs.forEach((g) => {
          const { x, line } = xOf(g.t); const yb = line * lineH + topPad + span + 16, ye = yb + 22;
          g.x = x; g.line = line; g.ye = ye;
          const hollow = g.d >= 2;
          if (g.d < 4) P.push(`<line class="stem" x1="${x}" y1="${yb}" x2="${x}" y2="${hollow ? ye - 4 : ye}"/>`);
          if (hollow) P.push(`<ellipse class="head" cx="${g.d >= 4 ? x : x - 3.6}" cy="${ye}" rx="4.4" ry="3.2" transform="rotate(-20 ${g.d >= 4 ? x : x - 3.6} ${ye})"/>`);
          if (g.d < 1 - 1e-6) { const k = g.line + ":" + Math.floor(g.t + 1e-6); if (!beams.has(k)) beams.set(k, []); beams.get(k).push(g); }
          if ([3, 1.5, 0.75].some((v) => Math.abs(g.d - v) < 1e-6)) P.push(`<circle class="dotted" cx="${x + 5}" cy="${ye - 3}" r="1.6"/>`);
        });
        beams.forEach((grp) => {
          if (grp.length === 1) { const g = grp[0]; const k2 = g.d <= 0.25 + 1e-6 ? 2 : 1; for (let k = 0; k < k2; k++) P.push(`<path class="flag" d="M${g.x} ${g.ye - k * 5} q6 -2 8 -9"/>`); return; }
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
      setNotes(nn, chords) { list = nn.filter((n) => n && n.s != null).slice().sort((a, b) => a.t - b.t || a.s - b.s); if (chords) o.chords = chords; render(); },
      setTuning(t) { o.tuning = t; render(); },
      highlight(i) {
        cur = i; host.querySelectorAll(".tn.now").forEach((g) => g.classList.remove("now"));
        if (i < 0 || !list[i]) return;
        const t = list[i].t;
        list.forEach((nt, k) => { if (Math.abs(nt.t - t) < 1e-6) { const g = host.querySelector(`.tn[data-i="${k}"]`); if (g) g.classList.add("now"); } });
      },
      /** 박 t에 있는 음들을 강조(정렬 인덱스를 몰라도 됨) */
      highlightAt(t) { const i = list.findIndex((nt) => Math.abs(nt.t - t) < 1e-6); api.highlight(i); },
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
   * TAB 음표 재생(기법 반영) → BS.scheduler 객체
   *   BS.playTab(notes, {bpm, bass, loop, tab, groove(드럼 그루브 이름), swing, onNote(i, n), onEnd, onStop})
   */
  BS.playTab = function (notes, o = {}) {
    const b = o.bass || BS.default();
    const sorted = notes.filter((n) => n && n.s != null).slice().sort((a, b2) => a.t - b2.t || a.s - b2.s);
    const total = o.length || Math.max(4, Math.ceil(sorted.reduce((m, n) => Math.max(m, n.t + (n.d || 1)), 0) / 4 - 1e-6) * 4);
    const evs = sorted.map((n, i) => Object.assign({}, n, { i, kind: "bass" }));
    if (o.groove) BS.drumEvents(o.groove, total / 4).forEach((e) => evs.push(e));
    const voices = {};
    return BS.scheduler(evs, {
      bpm: o.bpm || 90, loop: !!o.loop, length: total, swing: o.swing,
      onEvent(n, when, spb) {
        if (n.kind === "drum") { MB.drum(n.drum, when, { vel: n.vel * 0.75 }); return; }
        const d = (n.d || 1) * spb * 0.95;
        if (n.tech === "dead" || n.tech === "x" || n.f == null) { b.dead(n.s, { when }); return; }
        if ((n.tech === "/" || n.tech === "\\") && voices[n.s]) {
          const pv = voices[n.s]; pv.bend((n.f - pv._f) * 100, when, Math.min(0.12, spb * 0.4)); pv.release(when + d, 0.06); return;
        }
        const legato = n.tech === "h" || n.tech === "p";
        const v = b.pluck(n.s, n.f, { when, dur: d, vel: (legato ? 0.5 : 1) * (n.vel || 0.85),
          tone: n.tech === "slap" ? "slap" : n.tech === "pop" ? "pop" : n.tech === "pm" ? "muted" : n.tone,
          pos: n.tech === "harm" ? 0.5 : undefined, bright: n.tech === "harm" ? 0.95 : undefined });
        if (!v) return;
        if (n.tech === "harm") { const mult = { 12: 2, 7: 3, 19: 3, 5: 4, 24: 4, 4: 5, 9: 5 }[n.f] || 2; v.bend(1200 * Math.log2(mult) - n.f * 100, when, 0.002); }
        if (n.tech === "~") for (let k = 0; k < 10; k++) v.bend(k % 2 ? 0 : 25, when + 0.12 + k * 0.1, 0.1);
        voices[n.s] = v;
      },
      onUI(n) { if (n.kind !== "bass") return; if (o.tab) { o.tab.highlightAt(n.t); o.tab.at(n.t); } o.onNote && o.onNote(n.i, n); },
      onEnd() { if (o.tab) o.tab.clear(); o.onEnd && o.onEnd(); },
      onStop() { if (o.tab) o.tab.clear(); b.stop(); o.onStop && o.onStop(); },
    });
  };
  /**
   * 텍스트 TAB → 음표. 가는 줄부터 줄마다 한 행(G|D|A|E, 5현이면 G|D|A|E|B), 칸 하나 = step박.
   *   숫자 두 자리, 기법 문자 h p / \ x(데드) T P(슬랩·팝, 숫자 바로 뒤) 인식.
   */
  BS.parseAsciiTab = function (text, { step = 0.5 } = {}) {
    const rows = text.trim().split(/\n/).map((r) => r.replace(/^[^|]*\|/, "").replace(/\|\s*$/, "")).filter((r) => r.length);
    const n = rows.length, out = [];
    rows.forEach((row, r) => {
      const s = n - 1 - r; let col = 0, lastTech = null;
      for (let i = 0; i < row.length; i++) {
        const c = row[i];
        if (c === "|") continue;
        if (/\d/.test(c)) {
          const t0 = col * step;
          let num = c; if (/\d/.test(row[i + 1] || "")) { num += row[i + 1]; i++; col++; }
          const note = { t: t0, d: step, s, f: +num };
          if (lastTech) { note.tech = lastTech; lastTech = null; }
          if (row[i + 1] === "T") note.tech = "slap"; else if (row[i + 1] === "P") note.tech = "pop";
          out.push(note);
        } else if ("hp/\\".includes(c)) lastTech = c;
        else if (c === "x") out.push({ t: col * step, d: step, s, f: null, tech: "dead" });
        col++;
      }
    });
    // 다음 음까지를 길이로
    out.sort((a, b) => a.t - b.t);
    out.forEach((nt, i) => { const nx = out.slice(i + 1).find((m) => m.t > nt.t + 1e-6); if (nx) nt.d = nx.t - nt.t; });
    return out;
  };

  /* ------------------------------------------------------------ bass-clef staff */
  /**
   * 낮은음자리표 한 단 보표(조표 없음, 임시표만). 베이스 악보 관례대로 실음보다 한 옥타브 위에 적는다(written = midi + 12).
   *   notes: [{t(박), d(박), m(MIDI 실음) | rest:true}]
   *   BS.staff(el, notes, {beatsPerBar:4, chords:[{t,name}], flat, labels:"none"|"notes", concert:false(실음 그대로)})
   *   → {highlightAt(t), at(beat), clear(), setNotes(notes, chords)}
   */
  /** 쉼표는 유니코드 음악 기호(𝄻 𝄼 …)가 대부분의 폰트에 없어 도형으로 그린다. y0 = 오선 맨 윗줄, sp = 줄 간격 */
  function restGlyph(x, y0, sp, d) {
    const f = (v) => +v.toFixed(2);
    if (d >= 4) return `<rect class="rest" x="${f(x - sp * 0.55)}" y="${f(y0 + sp)}" width="${f(sp * 1.1)}" height="${f(sp * 0.5)}"/>`;
    if (d >= 2) return `<rect class="rest" x="${f(x - sp * 0.55)}" y="${f(y0 + sp * 1.5)}" width="${f(sp * 1.1)}" height="${f(sp * 0.5)}"/>`;
    if (d >= 1) return `<path class="rest l" d="M${f(x - 3)} ${f(y0 + sp * 0.6)}L${f(x + 3)} ${f(y0 + sp * 1.5)}L${f(x - 2.6)} ${f(y0 + sp * 2.3)}L${f(x + 3.4)} ${f(y0 + sp * 3.2)}"/>`;
    const n = d >= 0.5 ? 1 : 2;
    let s = `<path class="rest l" d="M${f(x + 3.2)} ${f(y0 + sp * (n === 1 ? 1.1 : 0.8))}L${f(x - 2.8)} ${f(y0 + sp * 3)}"/>`;
    for (let k = 0; k < n; k++) {
      const cy = y0 + sp * ((n === 1 ? 1.1 : 0.8) + k * 0.7);
      s += `<circle class="rest" cx="${f(x + 2.1)}" cy="${f(cy)}" r="1.9"/>`
        + `<path class="rest l" d="M${f(x + 3.4)} ${f(cy - 0.6)}q2.6 -0.6 3 2"/>`;
    }
    return s;
  }
  BS.staff = function (sel, notes, o = {}) {
    const host = $(sel);
    host.classList.add("bs-staff");
    let list = notes.slice().sort((a, b) => a.t - b.t);
    const bpb = o.beatsPerBar || 4;
    let layout = null, curT = null, curBeat = -1;
    function render() {
      const width = Math.max(300, host.clientWidth || 640);
      const last = list.reduce((m, n) => Math.max(m, n.t + (n.d || 1)), 0);
      const bars = Math.max(1, Math.ceil(last / bpb - 1e-6));
      const perLine = o.barsPerLine || Math.max(1, Math.min(bars, Math.floor((width - 60) / (bpb * (o.beatWidth || 46)))));
      const lines = Math.ceil(bars / perLine);
      const sp = 9, left = 48, top = o.chords ? 46 : 34, lineH = sp * 4 + 78 + (o.labels === "notes" ? 14 : 0);
      const barW = (width - left - 8) / perLine;
      const H = lines * lineH + 8;
      const P = [`<svg viewBox="0 0 ${width} ${H}" role="img" aria-label="낮은음자리표 악보">`];
      const xOf = (t) => { const bar = Math.floor(t / bpb + 1e-9), line = Math.floor(bar / perLine), inBar = t - bar * bpb; return { x: left + (bar % perLine) * barW + 16 + (inBar / bpb) * (barW - 24), line }; };
      layout = { xOf, lineH, top, sp };
      // 맨 아랫줄 = G2(실음 G1). pos = 옥타브×7 + 글자
      const bottomPos = 2 * 7 + 4;
      const yOf = (pos, line) => line * lineH + top + sp * 4 - (pos - bottomPos) * (sp / 2);
      for (let L = 0; L < lines; L++) {
        const y0 = L * lineH + top, nb = Math.min(perLine, bars - L * perLine), xEnd = left + nb * barW;
        for (let k = 0; k < 5; k++) P.push(`<line class="sl" x1="8" y1="${y0 + k * sp}" x2="${xEnd}" y2="${y0 + k * sp}"/>`);
        P.push(`<text class="clef" x="10" y="${y0 + sp * 2.9}">𝄢</text>`);
        for (let b = 1; b <= nb; b++) { const x = left + b * barW; P.push(`<line class="bar${L === lines - 1 && b === nb ? " end" : ""}" x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + sp * 4}"/>`); }
        P.push(`<rect class="playhead" data-line="${L}" x="-10" y="${y0 - 10}" width="3" height="${sp * 4 + 20}" rx="1.5"/>`);
      }
      (o.chords || []).forEach((c) => { const { x, line } = xOf(c.t); P.push(`<text class="chname" x="${x - 4}" y="${line * lineH + top - 22}">${c.name}</text>`); });
      const beams = new Map();
      list.forEach((n, i) => {
        const { x, line } = xOf(n.t); const d = n.d || 1;
        if (n.rest || n.m == null) { P.push(restGlyph(x, line * lineH + top, sp, d)); return; }
        const sp_ = MB.spell(n.m + (o.concert ? 0 : 12), o.flat);
        const y = yOf(sp_.pos, line), y0 = line * lineH + top;
        P.push(`<g class="n" data-i="${i}">`);
        // 덧줄
        for (let ly = y0 + sp * 5; ly <= y + 0.1; ly += sp) P.push(`<line class="ledger" x1="${x - 9}" y1="${ly}" x2="${x + 9}" y2="${ly}"/>`);
        for (let ly = y0 - sp; ly >= y - 0.1; ly -= sp) P.push(`<line class="ledger" x1="${x - 9}" y1="${ly}" x2="${x + 9}" y2="${ly}"/>`);
        if (sp_.acc) P.push(`<text class="acc" x="${x - 13}" y="${y + 5}">${sp_.acc > 0 ? "♯" : "♭"}</text>`);
        const hollow = d >= 2;
        P.push(`<ellipse class="head${hollow ? " hollow" : ""}" cx="${x}" cy="${y}" rx="5.4" ry="3.9" transform="rotate(-20 ${x} ${y})"/>`);
        const up = sp_.pos < bottomPos + 4; // 가운데 줄 아래면 기둥 위로
        const sx = up ? x + 5 : x - 5, sy2 = up ? y - 28 : y + 28;
        if (d < 4) P.push(`<line class="stem" x1="${sx}" y1="${y}" x2="${sx}" y2="${sy2}"/>`);
        if ([3, 1.5, 0.75].some((v) => Math.abs(d - v) < 1e-6)) P.push(`<circle class="head" cx="${x + 9}" cy="${y - 2}" r="1.6"/>`);
        if (o.labels === "notes") P.push(`<text class="lab" x="${x}" y="${y0 + sp * 4 + 44}">${MB.pcName(n.m, o.flat)}</text>`);
        P.push(`</g>`);
        if (d < 1 - 1e-6) { const k = line + ":" + Math.floor(n.t + 1e-6); if (!beams.has(k)) beams.set(k, []); beams.get(k).push({ x: sx, y: sy2, d, up }); }
      });
      beams.forEach((grp) => {
        if (grp.length === 1) { const g = grp[0]; const k2 = g.d <= 0.25 + 1e-6 ? 2 : 1; for (let k = 0; k < k2; k++) P.push(`<path class="flag" d="M${g.x} ${g.y + (g.up ? k * 5 : -k * 5)} q7 ${g.up ? 4 : -4} 8 ${g.up ? 12 : -12}"/>`); return; }
        const up = grp.filter((g) => g.up).length >= grp.length / 2;
        const a = grp[0], b = grp[grp.length - 1];
        const yb = up ? Math.min(...grp.map((g) => g.y)) : Math.max(...grp.map((g) => g.y));
        P.push(`<line class="beam" x1="${a.x}" y1="${yb}" x2="${b.x}" y2="${yb}"/>`);
        if (grp.some((g) => g.d <= 0.25 + 1e-6)) P.push(`<line class="beam" x1="${a.x}" y1="${yb + (up ? 5 : -5)}" x2="${b.x}" y2="${yb + (up ? 5 : -5)}"/>`);
      });
      P.push(`</svg>`);
      host.innerHTML = P.join("");
      if (curT != null) api.highlightAt(curT);
      if (curBeat >= 0) api.at(curBeat);
    }
    const api = {
      el: host,
      get notes() { return list; },
      setNotes(nn, chords) { list = nn.slice().sort((a, b) => a.t - b.t); if (chords) o.chords = chords; render(); },
      highlightAt(t) {
        curT = t; host.querySelectorAll(".n.now").forEach((g) => g.classList.remove("now"));
        list.forEach((n, i) => { if (Math.abs(n.t - t) < 1e-6) { const g = host.querySelector(`.n[data-i="${i}"]`); if (g) g.classList.add("now"); } });
      },
      at(beat) {
        curBeat = beat; if (!layout) return;
        host.querySelectorAll(".playhead").forEach((r) => r.setAttribute("x", -10));
        if (beat < 0) return;
        const { x, line } = layout.xOf(beat);
        const r = host.querySelector(`.playhead[data-line="${line}"]`); if (r) r.setAttribute("x", x - 1.5);
      },
      clear() { curT = null; curBeat = -1; host.querySelectorAll(".n.now").forEach((g) => g.classList.remove("now")); api.at(-1); },
      render,
    };
    render();
    if (window.ResizeObserver) { let lastW = host.clientWidth; new ResizeObserver(() => { if (Math.abs(host.clientWidth - lastW) > 8) { lastW = host.clientWidth; render(); } }).observe(host); }
    return api;
  };
})();
