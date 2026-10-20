/* ==========================================================================
   DrumBook 드럼 전용 스크립트 — 전역 객체 DR (common.js의 MB 위에서 동작)
   - 드럼 음원: 원형 막의 베셀 모드 합(킥·스네어·탐) + 스네어 와이어 잡음 + 비조화 금속 부분음(심벌)을 버퍼로 합성
   - DR.kit(): 조각(piece)마다 튜닝·감쇠를 바꿀 수 있는 가상 드럼 킷. 하이햇 열림·초크, 플램·드래그·버즈, 룸 잔향
   - 위젯: 드럼 악보(DR.staff), 스텝 그리드(DR.grid), 위에서 본 킷(DR.kitView), 패드(DR.pads), 타임라인(DR.timeline)
   - 리듬: 패턴 문자열 해석(DR.parse), 그루브·루디먼트 사전, 스케줄러(스윙·휴머나이즈·조각별 타이밍), 메트로놈
   - 도구: 탭 기록·타이밍 채점, 녹음기, Web MIDI(GM 드럼 맵), 유클리드 리듬, 카운팅 음절
   시간 t는 언제나 4분음표 = 1박(BPM도 4분음표 기준). 6/8의 한 마디는 3박, 7/8은 3.5박이다.
   이 파일은 common.js 다음에 defer 없이 로드한다.
   ========================================================================== */
(function () {
  "use strict";
  const DR = (window.DR = {});
  const SVGNS = "http://www.w3.org/2000/svg";
  const $ = (sel) => (typeof sel === "string" ? document.querySelector(sel) : sel);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const EPS = 1e-6;

  /* ------------------------------------------------------------ pieces */
  /**
   * 킷의 조각. step = 보표 위치(아래 E4 줄 = 30, 위 F5 줄 = 38), head = 음표 머리(n 보통, x, xc 원 친 x, d 다이아몬드, tri 세모, slash 빗금),
   * limb = hand | foot(기둥 방향·성부), gm = General MIDI 드럼 번호, group = 초크 묶음.
   */
  DR.PIECES = {
    kick:    { ko: "베이스 드럼(킥)", short: "BD", en: "Bass drum (Kick)", step: 31, head: "n", limb: "foot", gm: 36, pan: 0, level: 1.0 },
    snare:   { ko: "스네어", short: "SN", en: "Snare drum", step: 35, head: "n", limb: "hand", gm: 38, pan: 0.04, level: 0.78 },
    rim:     { ko: "림샷", short: "RS", en: "Rim shot", step: 35, head: "slash", limb: "hand", gm: 40, pan: 0.04, level: 0.9 },
    xstick:  { ko: "크로스 스틱", short: "XS", en: "Cross-stick", step: 35, head: "xc", limb: "hand", gm: 37, pan: 0.04, level: 0.55 },
    hat:     { ko: "하이햇(닫힘)", short: "HH", en: "Hi-hat (closed)", step: 39, head: "x", limb: "hand", gm: 42, pan: -0.32, level: 0.36, group: "hat" },
    hatHalf: { ko: "하이햇(반열림)", short: "HX", en: "Hi-hat (half-open)", step: 39, head: "x", mark: "half", limb: "hand", gm: 46, pan: -0.32, level: 0.34, group: "hat" },
    hatOpen: { ko: "하이햇(열림)", short: "HO", en: "Hi-hat (open)", step: 39, head: "x", mark: "o", limb: "hand", gm: 46, pan: -0.32, level: 0.33, group: "hat" },
    hatFoot: { ko: "하이햇 페달", short: "HF", en: "Hi-hat pedal (foot)", step: 29, head: "x", limb: "foot", gm: 44, pan: -0.3, level: 0.3, group: "hat" },
    ride:    { ko: "라이드", short: "RD", en: "Ride cymbal", step: 38, head: "x", limb: "hand", gm: 51, pan: 0.38, level: 0.3, group: "ride" },
    bell:    { ko: "라이드 벨", short: "RB", en: "Ride bell", step: 38, head: "d", limb: "hand", gm: 53, pan: 0.38, level: 0.3, group: "ride" },
    crash:   { ko: "크래시", short: "CR", en: "Crash cymbal", step: 40, head: "x", limb: "hand", gm: 49, pan: -0.22, level: 0.42, group: "crash" },
    tom1:    { ko: "하이 탐", short: "T1", en: "High tom", step: 37, head: "n", limb: "hand", gm: 50, pan: -0.12, level: 0.74 },
    tom2:    { ko: "미드 탐", short: "T2", en: "Mid tom", step: 36, head: "n", limb: "hand", gm: 47, pan: 0.1, level: 0.76 },
    floor:   { ko: "플로어 탐", short: "FT", en: "Floor tom", step: 33, head: "n", limb: "hand", gm: 43, pan: 0.3, level: 0.82 },
    cowbell: { ko: "카우벨", short: "CB", en: "Cowbell", step: 41, head: "tri", limb: "hand", gm: 56, pan: 0.18, level: 0.3 },
    clave:   { ko: "클라베", short: "CL", en: "Claves", step: 42, head: "x", limb: "hand", gm: 75, pan: -0.15, level: 0.34 },
    shaker:  { ko: "셰이커", short: "SH", en: "Shaker", step: 43, head: "x", limb: "hand", gm: 70, pan: 0.22, level: 0.26 },
    clap:    { ko: "핸드클랩", short: "CP", en: "Hand clap", step: 34, head: "x", limb: "hand", gm: 39, pan: 0, level: 0.5 },
  };
  /** 표준 킷의 조각 순서(위 = 심벌, 아래 = 발) */
  DR.KIT = ["crash", "ride", "hat", "tom1", "tom2", "snare", "floor", "kick", "hatFoot"];
  DR.ORDER = ["crash", "clave", "shaker", "cowbell", "ride", "bell", "hatOpen", "hatHalf", "hat", "tom1", "tom2", "snare", "rim", "xstick", "clap", "floor", "kick", "hatFoot"];
  /** 패턴 문자열의 줄 이름 → 조각 */
  DR.ALIAS = { HH: "hat", HC: "hat", HO: "hatOpen", HX: "hatHalf", HF: "hatFoot", HP: "hatFoot", SN: "snare", SD: "snare", S: "snare", RS: "rim", XS: "xstick", CS: "xstick",
    BD: "kick", KD: "kick", K: "kick", T1: "tom1", HT: "tom1", T2: "tom2", MT: "tom2", FT: "floor", T3: "floor", LT: "floor",
    RD: "ride", RC: "ride", RB: "bell", CR: "crash", CC: "crash", CB: "cowbell", CL: "clave", SH: "shaker", CP: "clap" };
  DR.pieceOf = (name) => (DR.PIECES[name] ? name : DR.ALIAS[String(name).toUpperCase()] || null);
  DR.isFoot = (p) => (DR.PIECES[p] || {}).limb === "foot";
  /** General MIDI 드럼 번호 → 조각 */
  DR.GM = { 35: "kick", 36: "kick", 37: "xstick", 38: "snare", 39: "clap", 40: "rim", 41: "floor", 43: "floor", 45: "tom2", 47: "tom2", 48: "tom1", 50: "tom1",
    42: "hat", 44: "hatFoot", 46: "hatOpen", 49: "crash", 57: "crash", 52: "crash", 55: "crash", 51: "ride", 59: "ride", 53: "bell", 56: "cowbell", 75: "clave", 70: "shaker", 69: "shaker", 82: "shaker" };
  /** 기본 셈여림(벨로시티 0–1) */
  DR.VEL = { ghost: 0.28, soft: 0.5, normal: 0.75, accent: 1 };
  /** 벨로시티 → 음량 배율(스틱 속도와 음압은 대략 거듭제곱 관계: 고스트 0.28 ≈ −17.6 dB) */
  DR.velGain = (v) => 0.02 + 0.98 * Math.pow(clamp(v, 0, 1), 1.7);
  DR.layerOf = (v) => (v < 0.38 ? 0 : v < 0.62 ? 1 : v < 0.86 ? 2 : 3);
  const LAYER_VEL = [0.28, 0.5, 0.75, 1];

  /* ------------------------------------------------------------ membrane physics */
  /** 베셀 함수 J_m(x) (급수, |x| < 25에서 충분히 정확) */
  DR.besselJ = function (m, x) {
    let sum = 0, term = Math.pow(x / 2, m);
    for (let k = 1; k <= m; k++) term /= k;
    for (let k = 0; k < 60; k++) {
      sum += term;
      term *= -(x * x / 4) / ((k + 1) * (k + 1 + m));
      if (Math.abs(term) < 1e-14 * Math.abs(sum) && k > 4) break;
    }
    return sum;
  };
  /**
   * 이상적인 원형 막의 모드 (m 지름 마디선 수, n 원 마디선 수, j = J_m의 n번째 영점, ratio = j/j01).
   * f_mn = j_mn / (2πa) · √(T/σ)
   */
  DR.MODES = [
    [0, 1, 2.4048], [1, 1, 3.8317], [2, 1, 5.1356], [0, 2, 5.5201], [3, 1, 6.3802], [1, 2, 7.0156], [4, 1, 7.5883], [2, 2, 8.4172],
    [0, 3, 8.6537], [5, 1, 8.7715], [3, 2, 9.7610], [6, 1, 9.9361], [1, 3, 10.1735], [4, 2, 11.0647], [7, 1, 11.0864], [2, 3, 11.6198],
  ].map(([m, n, j]) => ({ m, n, j, ratio: j / 2.4048, name: `(${m},${n})` }));
  /** 막의 기본 주파수 f01 = 2.405/(2πa)·√(T/σ). T 장력(N/m), sigma 면밀도(kg/m²), a 반지름(m) */
  DR.membraneFreq = (T, sigma, a) => (2.4048 / (2 * Math.PI * a)) * Math.sqrt(T / sigma);
  /** 중심에서 r(0–1, 1 = 가장자리) 떨어진 곳을 쳤을 때 (m,n) 모드가 받는 진폭 |J_m(j·r)| (중심은 m = 0만 울린다) */
  DR.modeAmp = (m, n, r) => { const md = DR.MODES.find((x) => x.m === m && x.n === n); return md ? Math.abs(DR.besselJ(m, md.j * clamp(r, 0, 1))) : 0; };
  /** 모드 모양 Z(r, θ) = J_m(j r)·cos(mθ) (그림용) */
  DR.modeShape = (md, r, th) => DR.besselJ(md.m, md.j * r) * Math.cos(md.m * th);
  /** 공기 하중·헤드 두 장의 결합으로 실제 드럼 모드 비는 이상 막보다 좁혀진다. k = 0이면 이상 막, 1이면 실측에 가까운 값 */
  DR.realRatio = (ratio, k = 1) => 1 + (ratio - 1) * (1 - 0.32 * k);

  /* ------------------------------------------------------------ DSP helpers (buffer synthesis) */
  function biquad(type, f, Q, sr) {
    const w = (2 * Math.PI * clamp(f, 10, sr * 0.45)) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * Q);
    let b0, b1, b2, a0, a1, a2;
    if (type === "lp") { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === "hp") { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; } // bp (0 dB peak)
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  }
  /** 감쇠 사인 모드들을 더한다. modes: [{f, a, tau, ph, att}] · glide: 처음 음높이가 (1+glide)배에서 tg초 시간 상수로 내려온다 */
  function addModes(y, sr, modes, glide = 0, tg = 0.03) {
    const BLK = 32;
    for (const md of modes) {
      if (!(md.a > 0) || md.f <= 0 || md.f > sr * 0.47) continue;
      const n = Math.min(y.length, Math.ceil(sr * md.tau * 7));
      const d = Math.exp(-1 / (sr * md.tau));
      const att = md.att ? Math.exp(-1 / (sr * md.att)) : 0; // 블룸: 1 − e^{−t/att}
      let re = Math.cos(md.ph || 0), im = Math.sin(md.ph || 0), env = md.a, rise = 1;
      for (let i = 0; i < n; i += BLK) {
        const t = i / sr;
        const f = md.f * (1 + glide * Math.exp(-t / tg));
        const w = (2 * Math.PI * f) / sr, c = Math.cos(w), s = Math.sin(w);
        const end = Math.min(n, i + BLK);
        for (let k = i; k < end; k++) {
          const nr = re * c - im * s; im = re * s + im * c; re = nr;
          y[k] += env * (att ? 1 - rise : 1) * im;
          env *= d; if (att) rise *= att;
        }
        const r = 1 / Math.hypot(re, im); re *= r; im *= r;
      }
    }
  }
  /** 거른 잡음(포락선 곱) */
  function addNoise(y, sr, rnd, o) {
    const n = Math.min(y.length, Math.ceil(sr * (o.tau * 7 + (o.delay || 0))));
    const f1 = o.hp ? biquad("hp", o.hp, o.q || 0.707, sr) : null, f2 = o.lp ? biquad("lp", o.lp, o.q || 0.707, sr) : null, f3 = o.bp ? biquad("bp", o.bp, o.bq || 1, sr) : null;
    const d = Math.exp(-1 / (sr * o.tau)), att = o.att ? Math.exp(-1 / (sr * o.att)) : 0, d0 = Math.floor((o.delay || 0) * sr);
    let env = o.a, rise = 1;
    for (let k = d0; k < n; k++) {
      let x = rnd() * 2 - 1;
      if (f1) x = f1(x); if (f2) x = f2(x); if (f3) x = f3(x);
      const mod = o.mod ? o.mod(k) : 1;
      y[k] += x * env * (att ? 1 - rise : 1) * mod;
      env *= d; if (att) rise *= att;
    }
  }
  /** 금속 판(심벌)의 비조화 부분음 목록: 로그 간격으로 흩어진 N개, 높을수록 빨리 사라진다 */
  function metalPartials(rnd, o) {
    const out = [];
    const lf = Math.log(o.f0), hf = Math.log(o.f1);
    for (let i = 0; i < o.n; i++) {
      const u = (i + rnd()) / o.n;
      const f = Math.exp(lf + (hf - lf) * u);
      const tilt = Math.pow(f / o.peak, f < o.peak ? o.lowTilt : -o.highTilt);
      const tau = o.tau * Math.pow(f / o.f0, -o.decayTilt) * (0.7 + 0.6 * rnd());
      out.push({ f, a: tilt * (0.5 + rnd()), tau, ph: rnd() * 6.283, att: o.att ? o.att * (0.5 + f / o.f1) : 0 });
    }
    return out;
  }

  /* ------------------------------------------------------------ voices: one function per piece */
  /**
   * 조각 하나의 모델 매개변수(장 스크립트에서 그림·표로 보여 줄 때도 쓴다).
   * prm: {tune(반음), decay(배수), snares(0–1, 스네어 와이어 장력), pos(0 중심 – 1 가장자리), muffle(0–1), beater("felt"|"plastic")}
   */
  DR.model = function (piece, vel = 0.75, prm = {}) {
    const P = DR.PIECES[piece] || DR.PIECES.snare;
    const tune = Math.pow(2, (prm.tune || 0) / 12), dk = prm.decay != null ? prm.decay : 1, muffle = prm.muffle || 0;
    const base = { kick: 52, snare: 185, rim: 185, xstick: 185, tom1: 196, tom2: 147, floor: 98 }[piece];
    if (base) {
      const f0 = base * tune;
      const pos = prm.pos != null ? prm.pos : { kick: 0.12, tom1: 0.3, tom2: 0.3, floor: 0.3, snare: 0.32, rim: 0.36, xstick: 0.9 }[piece];
      const tau0 = { kick: 0.34, snare: 0.2, rim: 0.2, xstick: 0.08, tom1: 0.5, tom2: 0.6, floor: 0.75 }[piece] * dk * (1 - 0.75 * muffle) * Math.pow(tune, -0.35);
      const nModes = piece === "kick" ? 6 : 12;
      const modes = DR.MODES.slice(0, nModes).map((md, i) => {
        const ratio = DR.realRatio(md.ratio, piece === "kick" ? 0.6 : 1);
        const exc = Math.abs(DR.besselJ(md.m, md.j * pos)) + (md.m === 0 ? 0.04 : 0.02);
        const tilt = Math.pow(ratio, -(1.9 - 1.3 * vel));
        return { f: f0 * ratio, a: exc * tilt, tau: tau0 / (1 + i * (piece === "kick" ? 0.9 : 0.45)), mode: md };
      });
      return { piece, f0, pos, tau0, modes, glide: (piece === "kick" ? 0.35 : 0.12) * (0.4 + vel) * (1 - 0.5 * muffle), tg: piece === "kick" ? 0.03 : 0.045, dur: Math.min(3, tau0 * 6 + 0.12) };
    }
    const cym = {
      crash: { f0: 240, f1: 14000, n: 70, peak: 3800, tau: 1.9, dur: 3.6 },
      ride: { f0: 300, f1: 12000, n: 60, peak: 4600, tau: 2.6, dur: 3.8 },
      bell: { f0: 600, f1: 9000, n: 20, peak: 1800, tau: 2.4, dur: 3.2 },
      hat: { f0: 2400, f1: 15000, n: 36, peak: 8000, tau: 0.05, dur: 0.35 },
      hatHalf: { f0: 2400, f1: 15000, n: 36, peak: 8000, tau: 0.22, dur: 1.1 },
      hatOpen: { f0: 2400, f1: 15000, n: 36, peak: 8000, tau: 0.6, dur: 2.0 },
      hatFoot: { f0: 1200, f1: 12000, n: 24, peak: 4500, tau: 0.03, dur: 0.25 },
    }[piece];
    if (cym) return Object.assign({ piece }, cym, { f0: cym.f0 * tune, f1: Math.min(16000, cym.f1 * tune), peak: cym.peak * tune, tau: cym.tau * dk * (1 - 0.7 * muffle), dur: cym.dur * Math.min(1.6, dk) });
    return { piece, tune, dk, dur: { cowbell: 0.7, clave: 0.25, shaker: 0.25, clap: 0.6 }[piece] || 0.5 };
  };

  function synth(piece, layer, variant, prm, sr) {
    const vel = LAYER_VEL[layer];
    const md = DR.model(piece, vel, prm);
    const len = Math.max(64, Math.floor(sr * md.dur));
    const y = new Float32Array(len);
    const rnd = MB.rng(1 + variant * 7919 + layer * 131 + piece.length * 17 + (piece.charCodeAt(1) || 0));
    const sn = prm.snares != null ? prm.snares : 1;
    switch (piece) {
      case "kick": {
        addModes(y, sr, md.modes.map((m) => Object.assign({ ph: 0 }, m)), md.glide, md.tg);
        // 비터가 헤드를 때리는 '딱': 펠트 비터는 둥글게, 플라스틱 비터는 밝게
        const hard = prm.beater === "plastic" ? 1 : 0;
        addNoise(y, sr, rnd, { a: (0.25 + 0.5 * vel) * (0.6 + 0.8 * hard), tau: 0.004, bp: 2600 + 2400 * hard, bq: 0.8 });
        addNoise(y, sr, rnd, { a: 0.5 * vel, tau: 0.012, lp: 180 });
        break;
      }
      case "snare": case "rim": {
        const body = md.modes.map((m) => Object.assign({ ph: rnd() * 0.4 }, m));
        if (piece === "rim") { body.forEach((m) => (m.a *= 1.5)); body.push({ f: 920, a: 0.5, tau: 0.05, ph: 0 }, { f: 1670, a: 0.3, tau: 0.03, ph: 0 }); }
        addModes(y, sr, body, md.glide, md.tg);
        let peakBody = 0; for (let k = 0; k < Math.min(len, sr * 0.05); k++) peakBody = Math.max(peakBody, Math.abs(y[k]));
        // 스네어 와이어: 아래 헤드가 와이어를 튕겨 내는 넓은 대역 잡음. 몸통 진동이 클수록 세게 부딪힌다(AM 결합)
        const wireTau = (0.07 + 0.09 * vel) * (prm.decay != null ? Math.sqrt(prm.decay) : 1);
        const bodyCopy = y.slice(0, Math.min(len, Math.ceil(sr * 0.5)));
        addNoise(y, sr, rnd, { a: sn * (0.35 + 0.55 * vel) * peakBody * 1.6, tau: wireTau, hp: 1600, lp: 4200 + 6000 * vel, delay: 0.0015,
          mod: (k) => 0.45 + 0.55 * Math.min(1, Math.abs(bodyCopy[k] || 0) / (peakBody || 1) * 2.2) });
        addNoise(y, sr, rnd, { a: (0.2 + 0.4 * vel) * peakBody * (piece === "rim" ? 2.2 : 1), tau: piece === "rim" ? 0.004 : 0.0025, bp: 4200, bq: 0.7 });
        break;
      }
      case "xstick": {
        addModes(y, sr, [{ f: 540, a: 0.6, tau: 0.035 }, { f: 1180, a: 0.8, tau: 0.03 }, { f: 1960, a: 0.45, tau: 0.018 }, { f: 3100, a: 0.25, tau: 0.01 }]);
        addModes(y, sr, md.modes.slice(0, 4).map((m) => Object.assign({}, m, { a: m.a * 0.25 })));
        addNoise(y, sr, rnd, { a: 0.4, tau: 0.003, bp: 2600, bq: 1.2 });
        addNoise(y, sr, rnd, { a: 0.05 * sn, tau: 0.05, hp: 2000 });
        break;
      }
      case "tom1": case "tom2": case "floor": {
        addModes(y, sr, md.modes.map((m) => Object.assign({ ph: 0 }, m)), md.glide, md.tg);
        let pk = 0; for (let k = 0; k < Math.min(len, sr * 0.05); k++) pk = Math.max(pk, Math.abs(y[k]));
        addNoise(y, sr, rnd, { a: (0.15 + 0.35 * vel) * pk, tau: 0.004, bp: 3000, bq: 0.7 });
        addNoise(y, sr, rnd, { a: 0.03 * sn * pk, tau: 0.08, hp: 2500 }); // 스네어 와이어 공명(snare buzz)
        break;
      }
      case "crash": case "ride": case "bell": {
        const ps = metalPartials(rnd, { f0: md.f0, f1: md.f1, n: md.n, peak: md.peak, lowTilt: 0.6, highTilt: 0.9 - 0.5 * vel, tau: md.tau, decayTilt: piece === "bell" ? 0.35 : 0.5, att: piece === "crash" ? 0.012 + 0.02 * vel : piece === "ride" ? 0.004 : 0 });
        if (piece === "bell") [620, 1240, 1860, 2610, 3420].forEach((f, i) => ps.push({ f: f * (1 + (rnd() - 0.5) * 0.03) * Math.pow(2, (prm.tune || 0) / 12), a: [1.6, 1.1, 0.8, 0.5, 0.35][i], tau: md.tau * (1.2 - 0.15 * i), ph: rnd() * 6 }));
        if (piece === "ride") { // 스틱 핑: 4–6 kHz 부근의 뚜렷한 부분음
          for (let i = 0; i < 6; i++) ps.push({ f: (4300 + 1400 * rnd()) * Math.pow(2, (prm.tune || 0) / 12), a: 0.9 + 0.5 * vel, tau: 0.35 + 0.3 * rnd(), ph: rnd() * 6 });
        }
        addModes(y, sr, ps);
        let pk = 0; for (let k = 0; k < Math.min(len, sr * 0.1); k++) pk = Math.max(pk, Math.abs(y[k]));
        if (piece === "crash") addNoise(y, sr, rnd, { a: pk * (0.25 + 0.3 * vel), tau: md.tau * 0.55, hp: 3200, att: 0.01 });
        else addNoise(y, sr, rnd, { a: pk * 0.18, tau: md.tau * 0.4, hp: 5000 });
        addNoise(y, sr, rnd, { a: pk * (0.25 + 0.4 * vel), tau: 0.003, bp: 5000, bq: 0.6 }); // 스틱 끝 소리
        break;
      }
      case "hat": case "hatHalf": case "hatOpen": case "hatFoot": {
        const ps = metalPartials(rnd, { f0: md.f0, f1: md.f1, n: md.n, peak: md.peak, lowTilt: 1.0, highTilt: 0.6 - 0.3 * vel, tau: md.tau, decayTilt: 0.25 });
        addModes(y, sr, ps);
        let pk = 0; for (let k = 0; k < Math.min(len, sr * 0.02); k++) pk = Math.max(pk, Math.abs(y[k]));
        // 두 장의 심벌이 서로 부딪히는 '치익'(열릴수록 지글거림이 길다)
        const sizzle = piece === "hatOpen" ? 1 : piece === "hatHalf" ? 0.8 : 0.5;
        addNoise(y, sr, rnd, { a: pk * (0.8 + 0.5 * vel) * sizzle, tau: md.tau * (piece === "hatHalf" ? 0.9 : 0.7), hp: 6500, lp: 15000,
          mod: piece === "hatHalf" ? (k) => 0.7 + 0.3 * Math.sin(k / sr * 2 * Math.PI * 23 + Math.sin(k / sr * 40)) : null });
        if (piece === "hatFoot") addNoise(y, sr, rnd, { a: pk * 1.2, tau: 0.018, bp: 1100, bq: 1.2, delay: 0.002 });
        else addNoise(y, sr, rnd, { a: pk * (0.5 + 0.6 * vel), tau: 0.002, bp: 7000, bq: 0.7 });
        break;
      }
      case "cowbell": {
        const ps = [];
        [562, 845].forEach((f0) => { for (let h = 1; h <= 9; h += 2) ps.push({ f: f0 * h * md.tune, a: 1 / h, tau: 0.22 * md.dk / (1 + h * 0.2), ph: 0 }); });
        addModes(y, sr, ps);
        const f = biquad("bp", 2600 * md.tune, 0.9, sr); for (let k = 0; k < len; k++) y[k] = y[k] * 0.4 + f(y[k]) * 1.6;
        break;
      }
      case "clave": addModes(y, sr, [{ f: 2480 * md.tune, a: 1, tau: 0.03 * md.dk }, { f: 4950 * md.tune, a: 0.2, tau: 0.012 }]); addNoise(y, sr, rnd, { a: 0.2, tau: 0.002, bp: 3000 }); break;
      case "shaker": addNoise(y, sr, rnd, { a: 1, tau: 0.045 * md.dk, att: 0.012, bp: 7000, bq: 0.9 }); break;
      case "clap": {
        [0, 0.009, 0.018, 0.028].forEach((dl, i) => addNoise(y, sr, rnd, { a: i === 3 ? 0.9 : 0.7, tau: i === 3 ? 0.12 * md.dk : 0.005, bp: 1150, bq: 1.4, delay: dl }));
        break;
      }
      default: addModes(y, sr, [{ f: 440, a: 1, tau: 0.1 }]);
    }
    // 정규화(같은 조각 안에서는 층마다 같은 기준), 끝부분 페이드
    let peak = 0; for (let k = 0; k < len; k++) peak = Math.max(peak, Math.abs(y[k]));
    const g = 0.9 / (peak || 1), fade = Math.min(len >> 1, Math.floor(sr * 0.03));
    for (let k = 0; k < len; k++) y[k] *= g * (k > len - fade ? (len - k) / fade : 1);
    return y;
  }

  const _buf = new Map();
  const VARIANTS = { crash: 2, ride: 2, bell: 2, hatOpen: 2, hatHalf: 2 };
  function prmKey(p) { return [p.tune ? Math.round(p.tune * 20) / 20 : 0, p.decay != null ? Math.round(p.decay * 40) / 40 : 1, p.snares != null ? Math.round(p.snares * 20) / 20 : 1, p.pos != null ? Math.round(p.pos * 50) / 50 : "-", p.muffle ? Math.round(p.muffle * 20) / 20 : 0, p.beater || ""].join(","); }
  /**
   * 조각 하나를 합성한 샘플(Float32Array, 캐시). 그림·스펙트럼용으로도 쓴다.
   *   DR.samples("snare", {vel, tune, decay, snares, pos, muffle, variant, sr})
   */
  DR.samples = function (piece, o = {}) {
    const sr = o.sr || (MB.out && MB.out.context ? MB.out.context.sampleRate : 44100); // 클릭 전에는 오디오 컨텍스트를 만들지 않는다
    const layer = o.layer != null ? o.layer : DR.layerOf(o.vel != null ? o.vel : 0.75);
    const variant = (o.variant || 0) % (VARIANTS[piece] || 3);
    const key = [piece, layer, variant, sr, prmKey(o)].join("|");
    if (_buf.has(key)) return _buf.get(key);
    const y = synth(piece, layer, variant, o, sr);
    _buf.set(key, y);
    if (_buf.size > 220) _buf.delete(_buf.keys().next().value);
    return y;
  };
  const _abuf = new Map();
  function audioBuffer(ctx, piece, layer, variant, prm) {
    const key = [piece, layer, variant, ctx.sampleRate, prmKey(prm)].join("|");
    let b = _abuf.get(key);
    if (b) return b;
    const y = DR.samples(piece, Object.assign({}, prm, { layer, variant, sr: ctx.sampleRate }));
    b = ctx.createBuffer(1, y.length, ctx.sampleRate); b.getChannelData(0).set(y);
    _abuf.set(key, b);
    if (_abuf.size > 220) _abuf.delete(_abuf.keys().next().value);
    return b;
  }
  /** 처음 연주하기 전에 버퍼를 미리 만들어 둔다(사용자 클릭 뒤에만 부를 것) */
  DR.warm = function (pieces = DR.KIT, prm = {}) {
    const ctx = MB.ctx(); if (!ctx) return;
    const q = []; pieces.forEach((p) => [2, 3, 1, 0].forEach((l) => q.push([p, l])));
    const idle = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 30));
    const step = (dl) => { while (q.length && dl.timeRemaining() > 4) { const [p, l] = q.shift(); audioBuffer(ctx, p, l, 0, prm[p] || {}); } if (q.length) idle(step); };
    idle(step);
  };

  /** 오디오 시각 when에 fn을 실행(화면 갱신용) */
  DR.at = function (when, fn) {
    const dt = Math.max(0, (when - MB.now()) * 1000);
    return dt < 4 ? (fn(), 0) : setTimeout(fn, dt);
  };

  /* ------------------------------------------------------------ room reverb */
  const _room = new WeakMap();
  function roomIR(ctx) {
    if (_room.has(ctx)) return _room.get(ctx);
    const sr = ctx.sampleRate, len = Math.floor(sr * 0.9), b = ctx.createBuffer(2, len, sr), rnd = MB.rng(77);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let k = 0; k < len; k++) { lp = lp * 0.55 + (rnd() * 2 - 1) * 0.45; d[k] = lp * Math.exp(-k / (sr * 0.16)) * (k < sr * 0.004 ? k / (sr * 0.004) : 1); } }
    _room.set(ctx, b); return b;
  }

  /* ------------------------------------------------------------ virtual kit */
  const _kits = new Set();
  /**
   * 가상 드럼 킷.
   *   const kit = DR.kit({dest, room(0–1), stereo, params:{snare:{tune, decay, snares, pos, muffle}, kick:{beater}}, hatOpen(0–1)})
   *   kit.hit(piece, vel, when, {tune, decay, pos, open, flam, drag, buzz(초), hand, src}) → 실제 친 시각
   *   kit.flam(piece, vel, when, {gap}) · kit.drag(...) · kit.buzz(piece, vel, when, dur)
   *   kit.hatPedal(open 0–1, when, chick) 하이햇 페달(0 = 밟아 닫음, 1 = 열림). piece "hat"은 지금 페달 상태로 친다.
   *   kit.choke(group, when) · kit.set(piece, {tune…}) · kit.mute = {kick:true} · kit.stop()
   *   kit.on(cb) → cb({type:"hit"|"pedal", p, v, when, hand, src, grace})
   */
  DR.kit = function (o = {}) {
    const cbs = [], active = new Map(); // group → [{src, g, end}]
    let bus = null, wet = null, ctxRef = null, hatPedal = o.hatOpen || 0;
    // 미리 예약된 페달 변화: 하이햇을 칠 때는 그 시각의 페달 상태를 쓴다
    let pedalLog = [];
    const pedalAt = (t) => { let v = pedalLog.length ? pedalLog[0].before : hatPedal; for (const e of pedalLog) { if (e.t <= t + 1e-4) v = e.v; else break; } return v; };
    const emit = (ev) => cbs.forEach((cb) => { try { cb(ev); } catch (e) { console.error(e); } });
    function ensure() {
      const ctx = MB.ctx(); if (!ctx) return null;
      if (ctxRef !== ctx) {
        ctxRef = ctx;
        bus = ctx.createGain(); bus.gain.value = o.gain != null ? o.gain : 0.9; bus.connect(o.dest || MB.out);
        const conv = ctx.createConvolver(); conv.buffer = roomIR(ctx);
        wet = ctx.createGain(); wet.gain.value = api.room; wet.connect(conv); conv.connect(o.dest || MB.out);
      }
      return ctx;
    }
    function play(piece, vel, t, prm, hand, asked) {
      const ctx = ensure(); if (!ctx) return;
      const P = DR.PIECES[piece]; if (!P) return;
      // 묶음 이름(hat)으로 뮤트·음량을 주면 hatOpen·hatHalf에도 적용된다
      const base = asked || piece, grp = P.group === "hat" && piece !== "hatFoot" ? "hat" : piece;
      if (api.mute && (api.mute[piece] || api.mute[base] || api.mute[grp])) return;
      const layer = DR.layerOf(vel);
      const nv = VARIANTS[piece] || 3;
      const variant = (api._rr = (api._rr || 0) + 1) % nv;
      const buf = audioBuffer(ctx, piece, layer, variant, prm);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain(), lvl = P.level * DR.velGain(vel);
      const lv = [piece, base, grp].map((k) => api.levels[k]).find((x) => x != null);
      g.gain.value = lvl * (lv != null ? lv : 1);
      src.connect(g);
      let out = g;
      if (api.stereo && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = clamp(P.pan || 0, -1, 1); g.connect(pn); out = pn; }
      out.connect(bus); if (api.room > 0) out.connect(wet);
      src.start(t);
      const v = { src, g, end: t + buf.duration, piece };
      // 초크: 같은 묶음(하이햇 등)의 앞 소리를 멈춘다. 하이햇은 새로 칠 때마다 앞의 열린 소리가 닫힌다
      if (P.group === "hat") chokeGroup("hat", t, 0.012);
      if (P.group) { const list = active.get(P.group) || []; list.push(v); active.set(P.group, list.filter((x) => x.end > t)); }
      src.onended = () => { const list = active.get(P.group); if (list) { const i = list.indexOf(v); if (i >= 0) list.splice(i, 1); } };
      return v;
    }
    function chokeGroup(group, t, tau = 0.03) {
      const list = active.get(group); if (!list) return;
      list.forEach((v) => { if (v.end > t && v.startAt !== t) { try { v.g.gain.setTargetAtTime(0, t, tau); v.src.stop(t + tau * 8); } catch (e) {} v.end = t; } });
      active.set(group, []);
    }
    const api = {
      room: o.room != null ? o.room : 0.14, stereo: o.stereo !== false, params: {}, levels: Object.assign({}, o.levels), mute: o.mute || null,
      on(cb) { cbs.push(cb); return api; },
      off(cb) { const i = cbs.indexOf(cb); if (i >= 0) cbs.splice(i, 1); return api; },
      set(piece, prm) { api.params[piece] = Object.assign({}, api.params[piece], prm); return api; },
      setRoom(v) { api.room = v; if (wet) wet.gain.value = v; },
      get hatOpen() { return hatPedal; },
      /** 조각을 친다. 하이햇 "hat"은 페달 상태(hatOpen)를 따른다. 반환: 실제 친 오디오 시각 */
      hit(piece, vel = 0.75, when, h = {}) {
        const ctx = ensure(); if (!ctx) return 0;
        piece = DR.pieceOf(piece) || piece;
        if (!DR.PIECES[piece]) return 0;
        // 꾸밈음이 앞에 붙으므로 바로 칠 때는 본음을 조금 늦춘다
        if (h.flam) return api.flam(piece, vel, when != null ? when : ctx.currentTime + 0.035, h);
        if (h.drag) return api.drag(piece, vel, when != null ? when : ctx.currentTime + 0.075, h);
        const t = when != null ? Math.max(when, ctx.currentTime) : ctx.currentTime + 0.004;
        if (h.buzz) return api.buzz(piece, vel, t, h.buzz, h);
        let p = piece;
        const open = h.open != null ? h.open : piece === "hat" ? pedalAt(t) : null;
        if (piece === "hat" && open != null) p = open > 0.7 ? "hatOpen" : open > 0.25 ? "hatHalf" : "hat";
        const prm = Object.assign({}, api.params[piece] || {}, api.params[p] || {}, pick(h));
        const v = play(p, clamp(vel, 0.02, 1), t, prm, h.hand, piece);
        if (v) v.startAt = t;
        emit({ type: "hit", p: piece, sound: p, v: vel, when: t, hand: h.hand, src: h.src || "api", grace: h.grace || 0 });
        return t;
      },
      /** 플램: 반대 손의 작은 꾸밈음이 gap초 먼저(기본 25 ms) */
      flam(piece, vel = 0.85, when, h = {}) {
        const gap = h.gap != null ? h.gap : 0.025, t = when != null ? when : MB.now() + 0.03;
        const gh = h.hand === "R" ? "L" : h.hand === "L" ? "R" : undefined;
        api.hit(piece, h.graceVel != null ? h.graceVel : Math.min(0.42, vel * 0.4), t - gap, { hand: gh, src: h.src, grace: 1, pos: h.pos });
        return api.hit(piece, vel, t, Object.assign(pick(h), { hand: h.hand, src: h.src }));
      },
      /** 드래그(러프): 같은 손의 두 꾸밈음(더블 바운스)이 앞에 붙는다 */
      drag(piece, vel = 0.8, when, h = {}) {
        const gap = h.gap != null ? h.gap : 0.032, t = when != null ? when : MB.now() + 0.08;
        const gh = h.hand === "R" ? "L" : h.hand === "L" ? "R" : undefined;
        api.hit(piece, h.graceVel != null ? h.graceVel : Math.min(0.4, vel * 0.38), t - 2 * gap, { hand: gh, src: h.src, grace: 2 });
        api.hit(piece, h.graceVel != null ? h.graceVel * 0.85 : Math.min(0.34, vel * 0.33), t - gap, { hand: gh, src: h.src, grace: 2 });
        return api.hit(piece, vel, t, Object.assign(pick(h), { hand: h.hand, src: h.src }));
      },
      /** 버즈(다중 바운스): dur초 동안 스틱이 헤드 위에서 여러 번 튄다(약 25 Hz, 점점 약하게) */
      buzz(piece, vel = 0.6, when, dur = 0.12, h = {}) {
        const ctx = ensure(); if (!ctx) return 0;
        const t = when != null ? Math.max(when, ctx.currentTime) : ctx.currentTime + 0.01;
        const rate = h.rate || 26, n = Math.max(2, Math.round(dur * rate));
        for (let i = 0; i < n; i++) {
          const ti = t + (i / rate) * (1 + (i % 2 ? 0.04 : -0.03));
          const v = vel * (i === 0 ? 1 : 0.62 * Math.pow(0.9, i));
          const pv = play(piece, clamp(v, 0.02, 1), ti, Object.assign({}, api.params[piece] || {}, pick(h)), h.hand);
          if (pv) pv.startAt = ti;
        }
        emit({ type: "hit", p: piece, sound: piece, v: vel, when: t, hand: h.hand, src: h.src || "api", buzz: dur });
        return t;
      },
      /** 하이햇 페달: 0 = 밟아서 닫음, 1 = 완전히 엶. chick이면 닫힐 때 '칙' 소리 */
      hatPedal(open, when, chick = false) {
        const ctx = ensure(); if (!ctx) return;
        const t = when != null ? Math.max(when, ctx.currentTime) : ctx.currentTime + 0.004;
        const v = open === true ? 1 : open === false ? 0 : clamp(+open || 0, 0, 1);
        const prev = pedalAt(t);
        if (v < 0.25 && prev >= 0.25) { if (chick) api.hit("hatFoot", 0.6, t, { src: "pedal" }); else chokeGroup("hat", t, 0.02); }
        const now = ctx.currentTime;
        pedalLog = pedalLog.filter((e) => e.t > now - 1 && e.t < t);
        pedalLog.push({ t, v, before: prev });
        hatPedal = v;
        emit({ type: "pedal", value: v, when: t });
      },
      /** 손으로 심벌을 잡아 소리를 멈춘다(크래시 초크) */
      choke(group = "crash", when) { const ctx = ensure(); if (!ctx) return; chokeGroup(group, when != null ? when : ctx.currentTime, 0.025); },
      stop() {
        const ctx = MB.ctx(); if (!ctx || !ctxRef) return;
        const t = ctx.currentTime;
        if (bus) { const old = bus, oldWet = wet; old.gain.setTargetAtTime(0, t, 0.015); oldWet.gain.setTargetAtTime(0, t, 0.015); setTimeout(() => { try { old.disconnect(); oldWet.disconnect(); } catch (e) {} }, 300); }
        ctxRef = null; bus = null; wet = null; active.clear();
      },
    };
    function pick(h) { const r = {}; ["tune", "decay", "pos", "snares", "muffle", "beater"].forEach((k) => { if (h[k] != null) r[k] = h[k]; }); return r; }
    if (o.params) Object.keys(o.params).forEach((k) => api.set(k, o.params[k]));
    _kits.add(api);
    return api;
  };
  let _default = null;
  /** 공용 킷 */
  DR.default = () => _default || (_default = DR.kit());
  // MB.stopAll(정지 버튼·음소거)이 킷 소리도 멈추게 한다
  const _stopAll = MB.stopAll;
  MB.stopAll = function () { _stopAll(); _kits.forEach((k) => { try { k.stop(); } catch (e) {} }); };

  /* ------------------------------------------------------------ metronome click */
  /** 메트로놈 클릭. accent면 높고 크게. voice: "beep" | "wood" | "cowbell" */
  DR.click = function (when, accent = false, o = {}) {
    const ctx = MB.ctx(); if (!ctx) return;
    const t = when != null ? Math.max(when, ctx.currentTime) : ctx.currentTime + 0.005;
    const level = (o.vel != null ? o.vel : 0.5) * (accent === "sub" ? 0.38 : accent ? 1 : 0.65);
    const dest = o.dest || MB.out;
    if (o.voice === "wood" || o.voice === "cowbell") {
      const osc = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
      osc.type = o.voice === "wood" ? "triangle" : "square";
      osc.frequency.value = o.voice === "wood" ? (accent === true ? 1900 : 1450) : (accent === true ? 800 : 560);
      bp.type = "bandpass"; bp.frequency.value = o.voice === "wood" ? 1800 : 2600; bp.Q.value = 1.5;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level * 1.4, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + (o.voice === "wood" ? 0.04 : 0.12));
      osc.connect(bp); bp.connect(g); g.connect(dest); osc.start(t); osc.stop(t + 0.15);
      return;
    }
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.frequency.value = accent === true ? 1760 : accent === "sub" ? 880 : 1175; osc.type = "sine";
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g); g.connect(dest); osc.start(t); osc.stop(t + 0.07);
  };

  /* ------------------------------------------------------------ scheduler */
  /**
   * 박 단위 이벤트 스케줄러(오디오 시계 기준 미리 예약). 템포를 바꿔도 이어진다.
   *   DR.scheduler(events, {bpm:()=>n, length(박), loop, onEvent(ev, when, spb, loopNo), onUI(ev, loopNo), onEnd, onStop, onStart, onLoop(loopNo)})
   *   → {start, stop, toggle, running, setEvents, beat, loopNo}. 이벤트는 {t(박), ...}. 화면은 onUI에서 바꾼다.
   */
  DR.scheduler = function (events, o = {}) {
    let list = events.slice().sort((a, b) => a.t - b.t);
    let timer = 0, raf = 0, running = false, idx = 0, loopNo = 0, beatPos = 0, lastTime = 0;
    const queue = [];
    const bpm = () => (typeof o.bpm === "function" ? o.bpm() : o.bpm || 100);
    const length = () => (typeof o.length === "function" ? o.length() : o.length) || (list.length ? Math.ceil(list[list.length - 1].t + EPS) : 4);
    function tick() {
      const ctx = MB.ctx(), horizon = ctx.currentTime + 0.12;
      for (let guard = 0; guard < 1024; guard++) {
        const spb = 60 / bpm();
        const ev = list[idx];
        const L = length();
        const nextT = ev && ev.t < L ? ev.t : L;
        const when = lastTime + (nextT - beatPos) * spb;
        if (when > horizon) break;
        if (!ev || ev.t >= L) {
          if (!o.loop) { queue.push({ end: true, time: lastTime + (L - beatPos) * spb }); stopTimers(); return; }
          lastTime = lastTime + (L - beatPos) * spb; beatPos = 0; idx = 0; loopNo++;
          queue.push({ loop: loopNo, time: lastTime });
          if (!list.length) break;
          continue;
        }
        lastTime = when; beatPos = ev.t;
        try { o.onEvent && o.onEvent(ev, when, spb, loopNo); } catch (e) { console.error(e); }
        queue.push({ ev, time: when, loopNo });
        idx++;
      }
    }
    function stopTimers() { clearInterval(timer); timer = 0; }
    function ui() {
      raf = 0; if (!running) return;
      const now = MB.now();
      while (queue.length && queue[0].time <= now) {
        const q = queue.shift();
        if (q.end) { api.stop(true); o.onEnd && o.onEnd(); return; }
        if (q.loop != null) { o.onLoop && o.onLoop(q.loop); continue; }
        try { o.onUI && o.onUI(q.ev, q.loopNo); } catch (e) { console.error(e); }
      }
      raf = requestAnimationFrame(ui);
    }
    const api = {
      start() {
        const ctx = MB.ctx(); if (!ctx || running) return;
        running = true; idx = 0; beatPos = 0; loopNo = 0; lastTime = ctx.currentTime + 0.08; queue.length = 0;
        api.t0 = lastTime;
        o.onStart && o.onStart(lastTime);
        tick(); if (running) timer = setInterval(tick, 25); raf = requestAnimationFrame(ui);
      },
      stop(natural) { if (!running) return; running = false; stopTimers(); if (raf) cancelAnimationFrame(raf); raf = 0; queue.length = 0; o.onStop && o.onStop(natural === true); },
      toggle() { running ? api.stop() : api.start(); return running; },
      setEvents(ev) { list = ev.slice().sort((a, b) => a.t - b.t); if (running) { idx = list.findIndex((e) => e.t >= beatPos + EPS); if (idx < 0) idx = list.length; } },
      /** 지금 재생 위치(박, 대략, 0 ≤ beat < length) */
      get beat() { if (!running) return 0; const spb = 60 / bpm(); const b = beatPos + (MB.now() - lastTime) / spb; return b < 0 ? b + length() : b; },
      get loopNo() { return loopNo; },
      get running() { return running; },
    };
    return api;
  };

  /** 스윙: 한 쌍(2·unit박)의 앞 칸이 ratio만큼 차지하도록 박 안의 위치를 구간 선형으로 옮긴다. ratio 0.5 = 정박, 0.667 = 셋잇단 */
  DR.swingTime = function (t, ratio = 0.5, unit = 0.5) {
    if (!ratio || Math.abs(ratio - 0.5) < 1e-4) return t;
    const P = 2 * unit, b = Math.floor(t / P + EPS) * P, x = t - b;
    if (x < EPS) return t;
    return x <= unit ? b + (x / unit) * ratio * P : b + ratio * P + ((x - unit) / unit) * (1 - ratio) * P;
  };

  /**
   * 드럼 이벤트 재생. 이벤트 {t, p, v, open, flam, drag, buzz(박), hand}.
   *   DR.playEvents(events, {bpm, kit, loop, length, beatsPerBar, click, clickOn:()=>bool, clickSub(세분 수), clickVoice,
   *     swing(0.5–0.75 또는 함수), swingUnit(0.5 = 8분, 0.25 = 16분), humanize:{ms, vel} | ms, offsets:{piece: ms} | (ev)=>ms,
   *     mute:{piece:true} | (piece)=>bool, staff, grid, onHit(ev, i, when), onNote(ev, i), onBeat(beat), onEnd, onStop, onLoop})
   *   → scheduler. staff를 주면 이벤트 순서 i(= 배열 인덱스)로 악보를 강조하고 재생선을 움직인다. grid를 주면 지금 칸을 표시한다.
   */
  DR.playEvents = function (events, o = {}) {
    const kit = o.kit || DR.default();
    const bpb = o.beatsPerBar || 4;
    const evs = events.map((e, i) => Object.assign({ i }, e));
    const maxT = evs.length ? Math.max(...evs.map((e) => e.t)) : 0;
    const L = o.length || Math.max(bpb, Math.ceil((maxT + 1e-3) / bpb) * bpb);
    const all = evs.slice();
    if (o.click || o.clickOn) {
      const sub = o.clickSub || 1;
      for (let k = 0; k < Math.round(L * sub); k++) { const t = k / sub; all.push({ t, click: true, accent: Math.abs(t % bpb) < EPS ? true : Math.abs(t - Math.round(t)) < EPS ? false : "sub" }); }
    }
    for (let b = 0; b < L; b++) all.push({ t: b, beatMark: b });
    const num = (x, ...a) => (typeof x === "function" ? x(...a) : x);
    const hum = () => { const h = num(o.humanize); if (!h) return [0, 0]; const ms = typeof h === "number" ? h : h.ms || 0, vv = typeof h === "number" ? 0 : h.vel || 0; return [MB.randn() * ms / 1000, MB.randn() * vv]; };
    const sched = DR.scheduler(all, Object.assign({}, o, {
      length: L,
      onEvent(ev, when, spb, loopNo) {
        if (ev.beatMark != null) return;
        if (ev.click) { if (o.clickOn ? o.clickOn() : true) DR.click(when, ev.accent, { voice: num(o.clickVoice), vel: num(o.clickVel) }); return; }
        const muted = typeof o.mute === "function" ? o.mute(ev.p, ev, loopNo) : o.mute && o.mute[ev.p];
        if (muted) { o.onMuted && o.onMuted(ev, ev.i, when, loopNo); return; }
        const sw = num(o.swing, ev), unit = num(o.swingUnit, ev) || 0.5;
        let w = when + (DR.swingTime(ev.t, sw, unit) - ev.t) * spb;
        const off = typeof o.offsets === "function" ? o.offsets(ev) : o.offsets ? o.offsets[ev.p] : 0;
        const [dt, dv] = hum();
        w += (off || 0) / 1000 + dt + (ev.dt || 0) / 1000;
        const vel = clamp((ev.v != null ? ev.v : DR.VEL.normal) * (1 + dv), 0.02, 1);
        const h = { open: ev.open, flam: ev.flam, drag: ev.drag, buzz: ev.buzz ? ev.buzz * spb : 0, hand: ev.hand, src: "seq" };
        if (ev.pedal != null) kit.hatPedal(ev.pedal, w, ev.chick);
        if (ev.p) kit.hit(ev.p, vel, Math.max(MB.now(), w), h);
        o.onHit && o.onHit(ev, ev.i, w, loopNo);
      },
      onUI(ev) {
        if (ev.click) return;
        if (ev.beatMark != null) { o.onBeat && o.onBeat(ev.beatMark); return; }
        if (o.staff) o.staff.highlight(evs.filter((e) => Math.abs(e.t - ev.t) < EPS).map((e) => e.i));
        if (o.grid) o.grid.nowBeat(ev.t);
        o.onNote && o.onNote(ev, ev.i);
      },
      onStop(natural) { if (o.staff) { o.staff.highlight(-1); o.staff.at(null); } if (o.grid) o.grid.now(-1); if (!natural) kit.stop(); o.onStop && o.onStop(natural); },
    }));
    // 재생 중 패턴 바꾸기: 새 배열로 인덱스를 다시 매긴다(악보에도 같은 배열을 넘길 것)
    const baseSet = sched.setEvents;
    sched.setEvents = function (next) {
      evs.length = 0; next.forEach((e, i) => evs.push(Object.assign({ i }, e)));
      baseSet(evs.concat(all.filter((e) => e.click || e.beatMark != null)));
    };
    if (o.staff) {
      const tick = () => { if (!sched.running) return; o.staff.at(sched.beat); requestAnimationFrame(tick); };
      const st = sched.start; sched.start = function () { st(); requestAnimationFrame(tick); };
    }
    return sched;
  };

  /** 메트로놈. {bpm, beats(마디당 박), sub(1 4분, 2 8분, 3 셋잇단, 4 16분), accent, voice, gap:[울리는 마디, 쉬는 마디], onBeat(beat, bar, when, sounding)} */
  DR.metronome = function (o = {}) {
    const ev = [];
    const beats = () => num0(o.beats) || 4, sub = () => num0(o.sub) || 1;
    function num0(x) { return typeof x === "function" ? x() : x; }
    function build() { ev.length = 0; const B = beats(), S = sub(); for (let k = 0; k < B * S; k++) ev.push({ t: k / S, beat: Math.floor(k / S), sub: k % S }); return ev; }
    const sched = DR.scheduler(build(), {
      bpm: o.bpm, loop: true, length: () => beats(),
      onEvent(e, when, spb, loopNo) {
        const g = num0(o.gap), on = !g || loopNo % (g[0] + g[1]) < g[0];
        if (on && (e.sub === 0 || num0(o.subOn) !== false)) DR.click(when, e.sub ? "sub" : e.beat === 0 && num0(o.accent) !== false, { voice: num0(o.voice), vel: num0(o.vel) });
        e._on = on; e._when = when; e._bar = loopNo;
      },
      onUI(e) { o.onBeat && o.onBeat(e.beat, e._bar, e._when, e._on, e.sub); },
      onStart: o.onStart, onStop: o.onStop,
    });
    sched.rebuild = () => sched.setEvents(build());
    const st = sched.start; sched.start = () => { sched.setEvents(build()); st(); };
    return sched;
  };

  /* ------------------------------------------------------------ pattern text */
  /**
   * 패턴 문자열 → 이벤트. 줄마다 "조각이름 문자열" 또는 객체 {hat:"x.x.", snare:"..x."}.
   *   DR.parse(`HH x.x.x.x.x.x.x.x.
   *             SN ....x.......x...
   *             BD x.......x.x.....`, {div:4, t0:0})
   * 문자: . - _ 쉼 · x 보통 · X 액센트 · g 고스트 · o 열린 하이햇 · O 액센트 열림 · h 반열림 · f 플램 · F 액센트 플램 · d 드래그 · z 버즈 · b 벨 · 1–9 벨로시티 n/9
   * | 와 공백은 읽기 쉽게 넣는 마디·박 구분이라 무시한다. div = 한 박의 칸 수(8분 2, 셋잇단 3, 16분 4, 16분 셋잇단 6).
   * 줄 이름 ST(또는 sticking)는 R/L 스티킹으로 같은 칸의 손 이벤트에 hand를 붙인다.
   */
  DR.parse = function (spec, o = {}) {
    const div = o.div || 4, t0 = o.t0 || 0;
    const rows = [];
    if (typeof spec === "string") {
      spec.split(/\n/).map((l) => l.trim()).filter(Boolean).forEach((l) => { const m = l.match(/^(\S+)\s+(.+)$/); if (m) rows.push([m[1], m[2]]); });
    } else Object.keys(spec || {}).forEach((k) => rows.push([k, spec[k]]));
    const out = []; let sticking = null;
    rows.forEach(([name, str]) => {
      const s = String(str).replace(/[|\s]/g, "");
      if (/^(ST|sticking|stick)$/i.test(name)) { sticking = s; return; }
      const piece = DR.pieceOf(name); if (!piece) return;
      [...s].forEach((c, i) => {
        const e = charEvent(piece, c); if (!e) return;
        e.t = t0 + i / div; out.push(e);
      });
    });
    if (sticking) out.forEach((e) => { const c = sticking[Math.round((e.t - t0) * div)]; if ((c === "R" || c === "L") && !DR.isFoot(e.p)) e.hand = c; });
    return DR.sort(out);
  };
  function charEvent(piece, c) {
    const V = DR.VEL;
    switch (c) {
      case "x": return { p: piece, v: V.normal };
      case "X": case ">": return { p: piece, v: V.accent };
      case "g": case "(": return { p: piece, v: V.ghost };
      case "o": return { p: piece === "hat" ? "hatOpen" : piece, v: V.normal };
      case "O": return { p: piece === "hat" ? "hatOpen" : piece, v: V.accent };
      case "h": return { p: piece === "hat" || piece === "hatOpen" ? "hatHalf" : piece, v: V.normal };
      case "f": return { p: piece, v: 0.85, flam: true };
      case "F": return { p: piece, v: V.accent, flam: true };
      case "d": return { p: piece, v: 0.8, drag: true };
      case "z": return { p: piece, v: 0.55, buzz: 0.25 };
      case "Z": return { p: piece, v: 0.8, buzz: 0.25 };
      case "b": return { p: piece === "ride" ? "bell" : piece, v: V.normal };
      case "B": return { p: piece === "ride" ? "bell" : piece, v: V.accent };
      default: if (/[1-9]/.test(c)) return { p: piece, v: +c / 9 }; return null;
    }
  }
  /** 이벤트 정렬(시간, 그다음 조각 순서) */
  DR.sort = (evs) => evs.sort((a, b) => a.t - b.t || DR.ORDER.indexOf(a.p) - DR.ORDER.indexOf(b.p));
  /** 이벤트 → 패턴 문자열 객체 {piece: "x.."} (rows 순서, length 박, div 칸/박) */
  DR.toSpec = function (events, o = {}) {
    const div = o.div || 4, L = o.length || 4, n = Math.round(L * div);
    const rows = o.rows || [...new Set(events.map((e) => baseRow(e.p)))];
    const out = {}; rows.forEach((r) => (out[r] = Array(n).fill(".")));
    events.forEach((e) => {
      const r = baseRow(e.p), i = Math.round(e.t * div); if (!out[r] || i < 0 || i >= n) return;
      let c = e.v >= 0.9 ? "X" : e.v <= 0.4 ? "g" : "x";
      if (e.p === "hatOpen") c = e.v >= 0.9 ? "O" : "o"; else if (e.p === "hatHalf") c = "h"; else if (e.p === "bell") c = "b";
      if (e.flam) c = e.v >= 0.9 ? "F" : "f"; if (e.drag) c = "d"; if (e.buzz) c = "z";
      out[r][i] = c;
    });
    Object.keys(out).forEach((k) => (out[k] = out[k].join("")));
    return out;
  };
  const baseRow = (p) => (p === "hatOpen" || p === "hatHalf" ? "hat" : p === "bell" ? "ride" : p);
  /** 패턴을 박만큼 밀어 붙여 잇기: DR.concat([evA, 4], [evB, 4]) → 이어진 이벤트 */
  DR.concat = function (...parts) {
    const out = []; let t = 0;
    parts.forEach(([evs, len]) => { evs.forEach((e) => out.push(Object.assign({}, e, { t: e.t + t }))); t += len; });
    return out;
  };

  /* ------------------------------------------------------------ grooves */
  /** 그루브 사전. spec는 DR.parse 형식, div는 한 박의 칸 수, bars는 마디 수, swing은 스윙 비율 */
  DR.GROOVES = {
    rock8:     { name: "8비트 록", genre: "록", bpm: 100, div: 2, spec: "HH xxxxxxxx\nSN ..x...x.\nBD x...x...", desc: "하이햇 8분음표, 스네어 2·4박(백비트), 킥 1·3박. 모든 그루브의 출발점." },
    rock8b:    { name: "8비트 록(킥 변형)", genre: "록", bpm: 104, div: 2, spec: "HH xxxxxxxx\nSN ..x...x.\nBD x..xx...", desc: "3박 앞의 &에 킥을 하나 더해 앞으로 끌고 가는 느낌." },
    ballad:    { name: "발라드(크로스 스틱)", genre: "팝", bpm: 70, div: 4, spec: "HH x.x.x.x.x.x.x.x.\nXS ....x.......x...\nBD x.......x.x.....", desc: "스네어 대신 크로스 스틱으로 부드럽게. 느린 템포에서 8분 하이햇이 시간을 채운다." },
    rock16:    { name: "16비트 록", genre: "록", bpm: 92, div: 4, spec: "HH xxxxxxxxxxxxxxxx\nSN ....X.......X...\nBD x.....x...x.....", desc: "한 손 16분 하이햇. 템포가 빨라지면 양손으로 나눠 친다." },
    pop16:     { name: "16비트 팝(양손 하이햇)", genre: "팝", bpm: 108, div: 4, spec: "HH Xxxx.xxxXxxx.xxx\nSN ....X.......X...\nBD x..x..x...x.....\nST RLRLRLRLRLRLRLRL", desc: "양손 교대 16분 하이햇에 박마다 액센트. 2·4박에서는 오른손이 하이햇 대신 스네어로 간다." },
    halftime:  { name: "하프타임", genre: "록", bpm: 140, div: 2, spec: "HH xxxxxxxx\nSN ....X...\nBD x.....x.", desc: "백비트를 3박 하나로 줄여 템포의 절반처럼 느끼게 한다." },
    disco:     { name: "디스코", genre: "디스코", bpm: 118, div: 4, spec: "HH x.o.x.o.x.o.x.o.\nSN ....X.......X...\nBD x...x...x...x...", desc: "포 온 더 플로어 킥과 &마다 열리는 하이햇." },
    house:     { name: "하우스", genre: "전자", bpm: 124, div: 4, spec: "HH ..o...o...o...o.\nCP ....x.......x...\nBD x...x...x...x...", desc: "킥이 네 박을 모두 밟고, 열린 하이햇은 &에만, 2·4박에 클랩." },
    funk:      { name: "펑크(고스트 노트)", genre: "펑크", bpm: 96, div: 4, spec: "HH x.x.x.x.x.x.x.o.\nSN ..g.X..g.g..X.g.\nBD x.x.......x..x..", desc: "16분 고스트 노트가 백비트 사이를 채우고, 킥은 16분 위치에서 엇갈린다." },
    linear:    { name: "리니어 펑크", genre: "펑크", bpm: 92, div: 4, spec: "HH x..x.x..x....x.x\nSN .g..X.g..g..X.g.\nBD ..x....x..xx....", desc: "두 조각이 같은 칸에서 겹치지 않는 '한 줄' 그루브. 16칸이 손·발로 나뉜다." },
    shuffle:   { name: "셔플", genre: "블루스", bpm: 112, div: 3, spec: "HH x.xx.xx.xx.x\nSN ...X.....X..\nBD x.....x.....", desc: "셋잇단의 첫째·셋째 칸만 치는 '길게–짧게' 리듬." },
    halfShuffle: { name: "하프타임 셔플", genre: "록", bpm: 84, div: 3, spec: "HH x.xx.xx.xx.x\nSN .g..g.X...g.\nBD x....x......", desc: "셔플 하이햇 사이의 빈 셋잇단을 고스트 노트로 채우고 백비트는 3박에." },
    jazz:      { name: "재즈 스윙(라이드)", genre: "재즈", bpm: 140, div: 3, spec: "RD x..x.xx..x.x\nHF ...x.....x..\nBD 3..3..3..3..", desc: "'딩 딩–가 딩 딩–가' 라이드, 2·4박 하이햇 페달, 아주 여린 4분 킥(페더링)." },
    shuffle128:{ name: "12/8 블루스 발라드", genre: "블루스", bpm: 60, div: 3, spec: "HH xxxxxxxxxxxx\nSN ...X.....X..\nBD x.....x.x...", desc: "한 박을 셋으로 나눈 8분음표 열둘. 느린 블루스·소울 발라드." },
    reggae:    { name: "레게 원 드롭", genre: "레게", bpm: 76, div: 4, spec: "HH x.x.x.x.x.x.x.x.\nXS ........X.......\nBD ........x.......", desc: "1박을 비우고 3박에 킥과 크로스 스틱이 함께 떨어진다." },
    boombap:   { name: "붐뱁 힙합", genre: "힙합", bpm: 90, div: 4, swing: 0.58, swingUnit: 0.25, spec: "HH x.x.x.x.x.x.x.x.\nSN ....X.......X...\nBD x.....xx..x.....", desc: "느슨하게 스윙하는 16분과 묵직한 2·4박 스네어." },
    dnb:       { name: "드럼 앤 베이스(투스텝)", genre: "전자", bpm: 172, div: 4, spec: "HH x.x.x.x.x.x.x.x.\nSN ....X.......X...\nBD x.........x.....", desc: "킥이 1박과 3박의 &에만. 빠른 템포의 '투스텝'." },
    punk:      { name: "펑크 록(스캥크 비트)", genre: "록", bpm: 180, div: 2, spec: "RD xxxxxxxx\nSN .x.x.x.x\nBD x.x.x.x.", desc: "킥과 스네어가 8분음표로 번갈아 '쿵딱쿵딱'." },
    train:     { name: "트레인 비트", genre: "컨트리", bpm: 150, div: 4, spec: "SN ggggXgggggggXggg\nBD x.......x.......\nST RLRLRLRLRLRLRLRL", desc: "스네어 16분 고스트 위에 2·4박 액센트. 기차 바퀴처럼 굴러간다." },
    metal:     { name: "더블 베이스", genre: "메탈", bpm: 160, div: 4, spec: "CR x.x.x.x.x.x.x.x.\nSN ....X.......X...\nBD xxxxxxxxxxxxxxxx", desc: "두 발로 16분 킥을 연타. 손은 크래시 8분과 백비트." },
    bossa:     { name: "보사노바", genre: "브라질", bpm: 130, div: 2, bars: 2, spec: "HH xxxxxxxxxxxxxxxx\nXS x..x..x...x..x..\nBD x..xx..xx..xx..x", desc: "8분 하이햇, 두 마디 클라베를 크로스 스틱으로, 킥은 '쿵–쿠쿵'." },
    afro128:   { name: "12/8 아프로 쿠반(벨 패턴)", genre: "라틴", bpm: 100, div: 3, spec: "CB x.x.xx.x.x.x\nSN ...g..X..g..\nBD x.....x.....", desc: "카우벨이 12칸 벨 패턴(x.x.xx.x.x.x)을 치는 아프리카–쿠바 계열 리듬. 한 박 = 점4분음표." },
  };
  /** 그루브 → 이벤트 */
  DR.groove = (key, o = {}) => { const g = DR.GROOVES[key]; return g ? DR.parse(g.spec, Object.assign({ div: g.div }, o)) : []; };
  DR.grooveLength = (key) => { const g = DR.GROOVES[key]; return g ? 4 * (g.bars || 1) * (g.beats ? g.beats / 4 : 1) : 4; };
  /** 클라베·벨 패턴(16분 격자, 두 마디 = 32칸) */
  DR.CLAVE = {
    son32: { name: "손 클라베 3–2", div: 4, spec: "x..x..x...x.x...", note: "2/2로 세는 두 마디를 4/4 한 마디(16분 격자)로 적었다." },
    son23: { name: "손 클라베 2–3", div: 4, spec: "..x.x...x..x..x." },
    rumba32: { name: "룸바 클라베 3–2", div: 4, spec: "x..x...x..x.x..." },
    bossa: { name: "보사노바 클라베", div: 4, spec: "x..x..x...x..x.." },
    bell68: { name: "6/8 벨(스탠더드 패턴)", div: 3, spec: "x.x.xx.x.x.x" },
    tresillo: { name: "트레시요 3+3+2", div: 4, spec: "x..x..x.x..x..x." },
  };

  /* ------------------------------------------------------------ rudiments */
  /**
   * 루디먼트 사전(PAS 40 중 일부). sticking 토큰: R/L 보통, 뒤에 ^ 액센트, 앞에 소문자 꾸밈음(l·r 플램, ll·rr 드래그), 뒤에 z 버즈, - 쉼.
   * div = 한 박의 칸 수.
   */
  DR.RUDIMENTS = {
    single:      { pas: 1, ko: "싱글 스트로크 롤", en: "Single Stroke Roll", div: 4, sticking: "R L R L R L R L", group: "roll" },
    single4:     { pas: 2, ko: "싱글 스트로크 포", en: "Single Stroke Four", div: 6, sticking: "R L R L^ - - L R L R^ - -", group: "roll" },
    single7:     { pas: 3, ko: "싱글 스트로크 세븐", en: "Single Stroke Seven", div: 6, sticking: "R L R L R L R^ - - - - -", group: "roll" },
    buzz:        { pas: 4, ko: "멀티플 바운스 롤(버즈 롤)", en: "Multiple Bounce Roll", div: 4, sticking: "Rz Lz Rz Lz Rz Lz Rz Lz", group: "roll" },
    triple:      { pas: 5, ko: "트리플 스트로크 롤", en: "Triple Stroke Roll", div: 6, sticking: "R R R L L L R R R L L L", group: "roll" },
    double:      { pas: 6, ko: "더블 스트로크 롤", en: "Double Stroke Open Roll", div: 4, sticking: "R R L L R R L L", group: "roll" },
    five:        { pas: 7, ko: "5타 롤", en: "Five Stroke Roll", div: 8, sticking: "R R L L R^ - - - L L R R L^ - - -", group: "roll" },
    six:         { pas: 8, ko: "6타 롤", en: "Six Stroke Roll", div: 6, sticking: "R^ L L R R L^ R^ L L R R L^", group: "roll" },
    seven:       { pas: 9, ko: "7타 롤", en: "Seven Stroke Roll", div: 8, sticking: "L L R R L L R^ - R R L L R R L^ -", group: "roll" },
    paradiddle:  { pas: 16, ko: "싱글 패러디들", en: "Single Paradiddle", div: 4, sticking: "R^ L R R L^ R L L", group: "diddle" },
    double_pd:   { pas: 17, ko: "더블 패러디들", en: "Double Paradiddle", div: 6, sticking: "R^ L R L R R L^ R L R L L", group: "diddle" },
    triple_pd:   { pas: 18, ko: "트리플 패러디들", en: "Triple Paradiddle", div: 4, sticking: "R^ L R L R L R R L^ R L R L R L L", group: "diddle" },
    pdd:         { pas: 19, ko: "패러디들–디들", en: "Paradiddle-diddle", div: 6, sticking: "R^ L R R L L R^ L R R L L", group: "diddle" },
    flam:        { pas: 20, ko: "플램", en: "Flam", div: 2, sticking: "lR^ - rL^ -", group: "flam" },
    flam_accent: { pas: 21, ko: "플램 액센트", en: "Flam Accent", div: 3, sticking: "lR^ L R rL^ R L", group: "flam" },
    flam_tap:    { pas: 22, ko: "플램 탭", en: "Flam Tap", div: 4, sticking: "lR^ R rL^ L lR^ R rL^ L", group: "flam" },
    flamacue:    { pas: 23, ko: "플라마큐", en: "Flamacue", div: 4, sticking: "lR L^ R L lR - - -", group: "flam" },
    flam_pd:     { pas: 24, ko: "플램 패러디들", en: "Flam Paradiddle", div: 4, sticking: "lR^ L R R rL^ R L L", group: "flam" },
    pataflafla:  { pas: 27, ko: "파타플라플라", en: "Pataflafla", div: 4, sticking: "lR L R rL rL R L lR", group: "flam" },
    swiss:       { pas: 28, ko: "스위스 아미 트리플렛", en: "Swiss Army Triplet", div: 3, sticking: "lR^ R L lR^ R L", group: "flam" },
    drag:        { pas: 31, ko: "드래그(러프)", en: "Drag", div: 2, sticking: "llR^ - rrL^ -", group: "drag" },
    drag_tap:    { pas: 32, ko: "싱글 드래그 탭", en: "Single Drag Tap", div: 2, sticking: "llR L^ rrL R^", group: "drag" },
    lesson25:    { pas: 34, ko: "레슨 25", en: "Lesson 25", div: 4, sticking: "llR L R^ - rrL R L^ -", group: "drag" },
    ratamacue:   { pas: 38, ko: "싱글 래터머큐", en: "Single Ratamacue", div: 3, sticking: "llR L R L^ - - rrL R L R^ - -", group: "drag" },
  };
  DR.RUDIMENT_GROUPS = { roll: "롤", diddle: "디들(패러디들)", flam: "플램", drag: "드래그" };
  /** 스티킹 문자열 → 토큰 [{hand, acc, grace, buzz, rest}] */
  DR.parseSticking = function (s) {
    return String(s).trim().split(/\s+/).map((tok) => {
      if (tok === "-" || tok === ".") return { rest: true };
      const m = tok.match(/^([lr]*)([RL])(\^?)(z?)$/);
      if (!m) return { rest: true };
      return { hand: m[2], acc: !!m[3], grace: m[1].length, buzz: !!m[4] };
    });
  };
  /**
   * 루디먼트 → 이벤트. DR.rudiment("paradiddle", {reps:2, piece:"snare", t0:0, accent:0.95, tap:0.5, orchestrate:{R:"snare", L:"snare"}})
   * 이벤트에 hand와 flam/drag/buzz가 붙는다. 반환 배열에 .length(박)가 붙는다(evs.beats).
   */
  DR.rudiment = function (key, o = {}) {
    const r = typeof key === "string" ? DR.RUDIMENTS[key] : key;
    if (!r) return [];
    const toks = DR.parseSticking(r.sticking), div = o.div || r.div, reps = o.reps || 1;
    const acc = o.accent != null ? o.accent : 0.95, tap = o.tap != null ? o.tap : 0.5;
    const out = [];
    for (let k = 0; k < reps; k++) toks.forEach((tk, i) => {
      if (tk.rest) return;
      const piece = o.orchestrate ? o.orchestrate[tk.hand] || o.piece || "snare" : o.piece || "snare";
      const e = { t: (o.t0 || 0) + (k * toks.length + i) / div, p: piece, v: tk.acc ? acc : tap, hand: tk.hand };
      if (tk.grace === 1) e.flam = true;
      if (tk.grace >= 2) e.drag = true;
      if (tk.buzz) e.buzz = 1 / div;
      if (tk.acc) e.acc = true;
      out.push(e);
    });
    out.beats = (reps * toks.length) / div;
    return out;
  };

  /* ------------------------------------------------------------ counting & rhythm math */
  /** 한 박의 세분 음절. div 1: 1 2 3 4 · 2: 1 & · 3: 1 trip let · 4: 1 e & a · 6: 1 la li & la li */
  DR.SYLLABLES = { 1: [""], 2: ["", "&"], 3: ["", "trip", "let"], 4: ["", "e", "&", "a"], 6: ["", "la", "li", "&", "la", "li"], 8: ["", "", "e", "", "&", "", "a", ""] };
  /** 카운트 라벨 목록(beats박 × div칸): ["1","e","&","a","2",…] */
  DR.counts = function (div = 4, beats = 4, o = {}) {
    const syl = (o.syllables || DR.SYLLABLES)[div] || DR.SYLLABLES[4];
    const out = [];
    for (let b = 0; b < beats; b++) for (let k = 0; k < div; k++) out.push(k === 0 ? String(b + 1) : syl[k] || "");
    return out;
  };
  /** 유클리드 리듬 E(k, n): n칸에 k개의 음을 가장 고르게(브레젠험 방식). rot만큼 돌린다 → [1,0,…] */
  DR.euclid = function (k, n, rot = 0) {
    const out = [];
    for (let i = 0; i < n; i++) { const j = (((i + rot) % n) + n) % n; out.push(k > 0 && (j * k) % n < k ? 1 : 0); }
    return out;
  };
  /** 폴리리듬 a:b를 length박 동안 → {a:[t…], b:[t…], lcm} */
  DR.polyrhythm = function (a, b, length = 4) {
    const A = [], B = [];
    for (let i = 0; i < a; i++) A.push((i * length) / a);
    for (let i = 0; i < b; i++) B.push((i * length) / b);
    const g = (x, y) => (y ? g(y, x % y) : x);
    return { a: A, b: B, lcm: (a * b) / g(a, b) };
  };
  DR.msPerBeat = (bpm) => 60000 / bpm;
  /** 세분 칸 하나의 길이(ms) */
  DR.msPerStep = (bpm, div) => 60000 / bpm / div;
  /** 빠르기말 */
  DR.TEMPI = [{ name: "Largo", ko: "아주 느리게", lo: 40, hi: 60 }, { name: "Adagio", ko: "느리게", lo: 66, hi: 76 }, { name: "Andante", ko: "걷는 빠르기로", lo: 76, hi: 108 }, { name: "Moderato", ko: "보통 빠르게", lo: 108, hi: 120 }, { name: "Allegro", ko: "빠르게", lo: 120, hi: 156 }, { name: "Presto", ko: "아주 빠르게", lo: 168, hi: 200 }];

  /* ------------------------------------------------------------ input: keys, taps, MIDI, recorder */
  /** 컴퓨터 키보드 → 조각. F·J는 스네어 왼손·오른손, D·K는 하이햇, 스페이스·X는 킥 */
  DR.KEYS = {
    f: ["snare", "L"], j: ["snare", "R"], d: ["hat", "L"], k: ["hat", "R"], " ": ["kick"], x: ["kick"], b: ["kick"], z: ["hatFoot"],
    e: ["hatOpen", "L"], i: ["ride", "R"], o: ["bell", "R"], u: ["crash", "R"], q: ["crash", "L"], g: ["tom1", "R"], h: ["tom2", "R"], l: ["floor", "R"],
    s: ["xstick", "L"], v: ["rim", "R"],
  };
  DR.KEY_HINT = '<span class="dr-hint"><kbd>F</kbd>/<kbd>J</kbd> 스네어 · <kbd>D</kbd>/<kbd>K</kbd> 하이햇 · <kbd>Space</kbd>/<kbd>X</kbd> 킥 · <kbd>G</kbd><kbd>H</kbd><kbd>L</kbd> 탐 · <kbd>I</kbd> 라이드 · <kbd>U</kbd> 크래시</span>';
  const _targets = []; let _active = null;
  function visible(el) { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; }
  function keyTarget() {
    if (_active && document.contains(_active.el) && visible(_active.el)) return _active;
    let best = null, bd = Infinity;
    _targets.forEach((t) => { if (!document.contains(t.el) || !visible(t.el)) return; const r = t.el.getBoundingClientRect(); const d = Math.abs((r.top + r.bottom) / 2 - innerHeight / 2); if (d < bd) { bd = d; best = t; } });
    return best;
  }
  /** 키 입력을 받을 대상 등록: {el, hit(piece, vel, hand, src)} (kitView·pads·tapper가 자동 등록) */
  DR.keyTarget = function (el, hit) { const t = { el, hit }; _targets.push(t); el.addEventListener("pointerdown", () => (_active = t), true); return t; };
  const _held = new Set();
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
    const k = e.key.toLowerCase(), m = DR.KEYS[k]; if (!m) return;
    const t = keyTarget(); if (!t) return;
    if (k === " " || e.target === document.body) e.preventDefault();
    if (_held.has(k)) return; _held.add(k);
    t.hit(m[0], e.shiftKey ? 1 : 0.8, m[1], "key");
  });
  document.addEventListener("keyup", (e) => _held.delete(e.key.toLowerCase()));

  /**
   * Web MIDI 입력. cb({type:"hit", p, v, note} | {type:"hat", value} | {type:"cc", cc, value}). → Promise<{names, stop()}>
   * CC4(풋 컨트롤러)는 하이햇 열림 정도로 바꿔 준다(0 = 닫힘).
   */
  DR.midiIn = async function (cb) {
    if (!navigator.requestMIDIAccess) throw new Error("이 브라우저는 Web MIDI를 지원하지 않습니다(Chrome·Edge 권장).");
    const acc = await navigator.requestMIDIAccess();
    const handler = (e) => {
      const [st, d1, d2] = e.data, type = st & 0xf0;
      if (type === 0x90 && d2 > 0) { const p = DR.GM[d1]; if (p) cb({ type: "hit", p, v: d2 / 127, note: d1 }); }
      else if (type === 0xb0) { if (d1 === 4) cb({ type: "hat", value: 1 - d2 / 127 }); cb({ type: "cc", cc: d1, value: d2 / 127 }); }
    };
    const bound = new Set();
    const bind = () => acc.inputs.forEach((i) => { if (!bound.has(i)) { i.addEventListener("midimessage", handler); bound.add(i); } });
    bind();
    acc.onstatechange = bind; // 나중에 꽂은 패드도 잡는다
    return { get names() { return [...acc.inputs.values()].map((i) => i.name); }, stop() { acc.onstatechange = null; bound.forEach((i) => i.removeEventListener("midimessage", handler)); bound.clear(); } };
  };
  /** MIDI 패드를 킷에 연결 → Promise<{names, stop}> */
  DR.connectMidi = (kit, extra) => DR.midiIn((ev) => {
    if (ev.type === "hit") kit.hit(ev.p, ev.v, null, { src: "midi" });
    else if (ev.type === "hat") kit.hatPedal(ev.value);
    extra && extra(ev);
  });

  const HUMAN = { key: 1, pointer: 1, midi: 1, tap: 1 };
  /**
   * 사람이 친 타격(src가 key·pointer·midi·tap인 것)만 모은다. 장에서 만든 탭 버튼은 kit.hit(p, v, null, {src:"tap"})로 친다. DR.tapper(kit, {onTap({when, p, v, hand, src})}) → {taps, clear(), stop()}
   * when은 오디오 시계 시각(초)이라 스케줄러가 예약한 박 시각과 바로 비교할 수 있다.
   */
  DR.tapper = function (kit, o = {}) {
    const taps = [];
    const cb = (ev) => { if (ev.type !== "hit" || !HUMAN[ev.src] || ev.grace) return; const tp = { when: ev.when, p: ev.p, v: ev.v, hand: ev.hand, src: ev.src }; taps.push(tp); o.onTap && o.onTap(tp); };
    kit.on(cb);
    return { taps, clear() { taps.length = 0; }, stop() { kit.off(cb); } };
  };
  /**
   * 타이밍 채점: 기대 시각 목록(초)과 실제 탭(초)을 가장 가까운 것끼리 짝짓는다.
   *   DR.score(expected, taps, {window: 0.15}) → {pairs:[{exp, tap, dev(ms)}], mean, sd, absMean, hits, misses, extra}
   */
  DR.score = function (expected, taps, o = {}) {
    const win = o.window != null ? o.window : 0.15;
    const used = new Set(), pairs = [];
    const T = taps.map((t) => (typeof t === "number" ? t : t.when));
    expected.forEach((e) => {
      let bi = -1, bd = Infinity;
      T.forEach((t, i) => { if (used.has(i)) return; const d = Math.abs(t - e); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0 && bd <= win) { used.add(bi); pairs.push({ exp: e, tap: T[bi], dev: (T[bi] - e) * 1000 }); }
      else pairs.push({ exp: e, tap: null, dev: null });
    });
    const devs = pairs.filter((p) => p.dev != null).map((p) => p.dev);
    const mean = devs.length ? devs.reduce((a, b) => a + b, 0) / devs.length : 0;
    const sd = devs.length > 1 ? Math.sqrt(devs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (devs.length - 1)) : 0;
    const absMean = devs.length ? devs.reduce((a, b) => a + Math.abs(b), 0) / devs.length : 0;
    return { pairs, mean, sd, absMean, hits: devs.length, misses: expected.length - devs.length, extra: T.length - used.size };
  };
  /** 녹음기: 사람이 친 타격을 기록. DR.recorder(kit) → {start(), stop() → [{t(초), p, v, hand}], toEvents(bpm, div, t0), recording} */
  DR.recorder = function (kit) {
    let rec = false, t0 = 0;
    const notes = [];
    kit.on((ev) => { if (rec && ev.type === "hit" && HUMAN[ev.src] && !ev.grace) notes.push({ t: ev.when - t0, p: ev.p, v: ev.v, hand: ev.hand }); });
    return {
      start(at) { notes.length = 0; t0 = at != null ? at : MB.now(); rec = true; },
      stop() { rec = false; return notes.slice(); },
      get recording() { return rec; },
      get notes() { return notes; },
      /** 초 → 박, div칸 격자로 퀀타이즈(div = 0이면 그대로). strength 0–1 */
      toEvents(bpm, div = 4, strength = 1) {
        const spb = 60 / bpm;
        return DR.sort(notes.filter((n) => n.t / spb > -0.25).map((n) => { const b = n.t / spb, q = div ? Math.round(b * div) / div : b; return { t: Math.max(0, b + (q - b) * strength), p: n.p, v: n.v, hand: n.hand }; }));
      },
    };
  };

  /* ------------------------------------------------------------ widget: drum staff */
  const SP = 10; // 줄 간격
  const mk = (tag, attrs, parent) => { const el = document.createElementNS(SVGNS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); if (parent) parent.appendChild(el); return el; };
  const DUPLE = [[1.5, 0, 1], [1, 0, 0], [0.75, 1, 1], [0.5, 1, 0], [0.375, 2, 1], [0.25, 2, 0], [0.125, 3, 0]]; // [길이, 빔 수, 점]
  const TRIP = [[1, 0, 0], [2 / 3, 0, 0], [1 / 3, 1, 0], [1 / 6, 2, 0], [1 / 12, 3, 0]];
  function fitValues(d, table) { const out = []; let rest = d; for (let guard = 0; guard < 8 && rest > EPS; guard++) { const v = table.find((x) => x[0] <= rest + EPS); if (!v) break; out.push(v); rest -= v[0]; } return out; }
  /** 박자표에 맞는 빔 묶음(4분음표 단위 길이 배열) */
  DR.beamGroups = function (time = [4, 4]) {
    const [n, d] = time;
    if (d === 4 || d === 2) return Array(Math.round((n * 4) / d)).fill(1);
    if (d === 8 && n % 3 === 0) return Array(n / 3).fill(1.5);
    if (d === 8) { const g = []; let left = n; while (left > 3) { g.push(1); left -= 2; } g.push(left / 2); return g; }
    if (d === 16) return Array(Math.ceil(n / 4)).fill(1);
    return Array(n).fill(4 / d);
  };
  /**
   * 드럼 악보(타악기 보표). 이벤트 배열을 그대로 받는다.
   *   DR.staff(sel, events, {time:[4,4], bars, barsPerLine, width(viewBox, 기본 760), groups(빔 묶음, 박 단위 배열),
   *     voices:2(손 위·발 아래) | 1(모두 위), sticking:true(R/L), counts:true|"all", countDiv, rests:true, barNumbers,
   *     endBar:"end"|"repeat"|"single", showTime:true, compact, onClick(i, ev)})
   *   → {highlight(i | [i…] | -1), at(beat | null), mark(i, cls), unmark(cls), setEvents(events, opts), setOptions(opts), events, el}
   * 음표 머리: 북 = 보통, 심벌 = x, 열린 하이햇 위 o, 액센트 >, 고스트 ( ), 플램·드래그 = 작은 꾸밈음, 버즈 = 기둥 위 z.
   */
  DR.staff = function (sel, events = [], o = {}) {
    const host = $(sel);
    host.classList.add("dr-staff");
    let opts = Object.assign({ time: [4, 4], voices: 2, rests: true, sticking: false, counts: false, endBar: "end", showTime: true, width: 760 }, o);
    let evs = [], svg = null, layout = null, playhead = null, groupsEls = [];
    function barLen() { return (opts.time[0] * 4) / opts.time[1]; }
    function build() {
      host.innerHTML = "";
      const W = opts.width, BL = barLen();
      const maxT = evs.length ? Math.max(...evs.map((e) => e.t)) : 0;
      const bars = opts.bars || Math.max(1, Math.ceil((maxT + EPS) / BL));
      const bpl = Math.min(bars, opts.barsPerLine || (bars <= 2 ? bars : 2));
      const lines = Math.ceil(bars / bpl);
      const rowsBelow = (opts.sticking ? 16 : 0) + (opts.counts ? 16 : 0);
      const topPad = opts.compact ? 48 : 58, below = (opts.voices === 1 ? 26 : 48) + rowsBelow;
      const lineH = topPad + 4 * SP + below + 8;
      const H = lines * lineH;
      svg = mk("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "드럼 악보" }, host);
      const groupDef = opts.groups || DR.beamGroups(opts.time);
      layout = { lines: [], bars, bpl, lineH, W, BL, xOf: null };
      const left0 = 8, clefW = 26, tsW = opts.showTime ? 24 : 0, nameW = 0, right = 8;
      const xs = [];
      for (let L = 0; L < lines; L++) {
        const top = L * lineH + topPad, g = mk("g", {}, svg);
        const startX = left0 + clefW + (L === 0 ? tsW : 0) + nameW;
        for (let k = 0; k < 5; k++) mk("line", { x1: left0, x2: W - right, y1: top + k * SP, y2: top + k * SP, class: "sl" }, g);
        mk("rect", { x: left0 + 8, y: top + SP, width: 3.2, height: 2 * SP, class: "clef" }, g);
        mk("rect", { x: left0 + 14.5, y: top + SP, width: 3.2, height: 2 * SP, class: "clef" }, g);
        if (L === 0 && opts.showTime) {
          const tx = left0 + clefW + tsW / 2 - 2;
          mk("text", { x: tx, y: top + SP * 1.75, class: "tsig" }, g).textContent = opts.time[0];
          mk("text", { x: tx, y: top + SP * 3.75, class: "tsig" }, g).textContent = opts.time[1];
        }
        const nb = Math.min(bpl, bars - L * bpl), bw = (W - right - startX) / bpl;
        for (let b = 0; b < nb; b++) {
          const bar = L * bpl + b, x0 = startX + b * bw, x1 = x0 + bw;
          xs[bar] = { x0, x1, top, line: L };
          const last = bar === bars - 1;
          if (last && opts.endBar === "end") { mk("line", { x1: x1 - 5, x2: x1 - 5, y1: top, y2: top + 4 * SP, class: "bar thin" }, g); mk("rect", { x: x1 - 3, y: top, width: 3, height: 4 * SP, class: "bar-thick" }, g); }
          else if (last && opts.endBar === "repeat") { mk("line", { x1: x1 - 5, x2: x1 - 5, y1: top, y2: top + 4 * SP, class: "bar thin" }, g); mk("rect", { x: x1 - 3, y: top, width: 3, height: 4 * SP, class: "bar-thick" }, g); mk("circle", { cx: x1 - 10, cy: top + 1.5 * SP, r: 1.8, class: "ndot" }, g); mk("circle", { cx: x1 - 10, cy: top + 2.5 * SP, r: 1.8, class: "ndot" }, g); }
          else mk("line", { x1, x2: x1, y1: top, y2: top + 4 * SP, class: "bar" }, g);
          if (opts.barNumbers && bar > 0) mk("text", { x: x0 + 2, y: top - 6, class: "barno" }, g).textContent = bar + 1;
        }
        layout.lines.push({ top, g });
      }
      const pad = 14;
      const xOf = (t) => { const bar = Math.floor(t / BL + EPS), r = xs[bar]; if (!r) return null; const f = (t - bar * BL) / BL; return r.x0 + pad + f * (r.x1 - r.x0 - 2 * pad - 6); };
      const yOf = (step, top) => top + (38 - step) * (SP / 2);
      layout.xOf = xOf; layout.xs = xs; layout.yOf = yOf;
      // 음표를 성부·묶음별로
      groupsEls = [];
      const voicesList = opts.voices === 1 ? [["up", () => true]] : [["up", (e) => !DR.isFoot(e.p)], ["down", (e) => DR.isFoot(e.p)]];
      for (let bar = 0; bar < bars; bar++) {
        const r = xs[bar]; if (!r) continue;
        const top = r.top, g = layout.lines[r.line].g;
        let gStart = bar * BL;
        groupDef.forEach((glen) => {
          const gEnd = gStart + glen;
          voicesList.forEach(([dir, test]) => {
            const inG = evs.filter((e) => test(e) && e.t >= gStart - EPS && e.t < gEnd - EPS);
            const voiceInBar = evs.some((e) => test(e) && e.t >= bar * BL - EPS && e.t < (bar + 1) * BL - EPS);
            drawGroup(g, top, dir, inG, gStart, gEnd, voiceInBar);
          });
          if (opts.counts) drawCounts(g, top, gStart, gEnd, bar);
          gStart = gEnd;
        });
      }
      playhead = mk("line", { x1: -10, x2: -10, y1: 0, y2: 0, class: "playhead", visibility: "hidden" }, svg);
      function drawCounts(g, top, gs, ge) {
        const glen = ge - gs;
        const div = gridOf(evs.filter((e) => e.t >= gs - EPS && e.t < ge - EPS).map((e) => e.t - gs), glen, opts.countDiv);
        const n = Math.round(glen * div), y = top + 4 * SP + (opts.voices === 1 ? 26 : 46) + (opts.sticking ? 16 : 0) + 12;
        const syl = DR.SYLLABLES[div] || DR.SYLLABLES[4], eighthBased = opts.time[1] === 8;
        for (let k = 0; k < n; k++) {
          const t = gs + k / div, x = xOf(t); if (x == null) continue;
          const inBar = t - Math.floor(t / BL + EPS) * BL;
          let label;
          if (eighthBased) { const e8 = inBar * 2; label = Math.abs(e8 - Math.round(e8)) < EPS ? String(Math.round(e8) + 1) : "&"; }
          else label = k === 0 ? String(Math.floor(inBar + EPS) + 1) : syl[k] || "";
          const show = opts.counts === "all" || k === 0 || evs.some((e) => Math.abs(e.t - t) < EPS);
          if (show && label) mk("text", { x, y, class: "cnt" + (k === 0 ? " b" : "") }, g).textContent = label;
        }
      }
      function drawGroup(g, top, dir, inG, gs, ge, voiceInBar) {
        const up = dir === "up";
        const glen = ge - gs;
        const times = [...new Set(inG.map((e) => +(e.t - gs).toFixed(6)))].sort((a, b) => a - b);
        if (!times.length) {
          if (opts.rests && (up || voiceInBar)) {
            const vals = glen === 1.5 ? [[1.5, 0, 1]] : fitValues(glen, DUPLE);
            let tt = gs; vals.forEach((v) => { drawRest(g, xOf(tt + (glen > 1 ? 0 : 0)) + (glen === 1 ? 0 : 0), top, up, v[1], v[2], v[0] >= 1 && v[1] === 0); tt += v[0]; });
          }
          return;
        }
        const div = gridOf(times, glen);
        const trip = div % 3 === 0 && glen <= 1 + EPS;
        const table = trip ? TRIP : DUPLE;
        const items = []; // {t, dur, beams, dot, rest, evs}
        if (times[0] > EPS) fitValues(times[0], table).reduce((tt, v) => { items.push({ t: gs + tt, dur: v[0], beams: v[1], dot: v[2], rest: true }); return tt + v[0]; }, 0);
        times.forEach((t, k) => {
          const nextT = k + 1 < times.length ? times[k + 1] : glen;
          const vals = fitValues(nextT - t, table);
          const tAbs = gs + t, es = inG.filter((e) => Math.abs(e.t - tAbs) < EPS);
          vals.forEach((v, j) => items.push(j === 0 ? { t: tAbs, dur: v[0], beams: v[1], dot: v[2], evs: es } : { t: tAbs + vals.slice(0, j).reduce((a, x) => a + x[0], 0), dur: v[0], beams: v[1], dot: v[2], rest: true }));
        });
        const notes = items.filter((it) => !it.rest);
        // 기둥 끝 높이
        const heads = notes.map((n) => n.evs.map((e) => yOf(DR.PIECES[e.p] ? DR.PIECES[e.p].step : 35, top)));
        const allY = heads.flat();
        const beamed = notes.filter((n) => n.beams > 0);
        const stemLen = 30;
        const beamY = up ? Math.min(...allY) - stemLen : Math.max(...allY) + stemLen;
        const useBeam = beamed.length >= 2;
        notes.forEach((n, k) => {
          const x = xOf(n.t); if (x == null) return;
          const grp = mk("g", { class: "dr-n" }, g);
          n.el = grp; n.x = x;
          n.evs.forEach((e) => { groupsEls.push({ i: evs.indexOf(e), el: grp }); });
          const ys = heads[k], yTop = Math.min(...ys), yBot = Math.max(...ys);
          const sx = up ? x + 5 : x - 5;
          const yEnd = useBeam && n.beams > 0 ? beamY : up ? yTop - stemLen : yBot + stemLen;
          mk("line", { x1: sx, x2: sx, y1: up ? yBot : yTop, y2: yEnd, class: "stem" }, grp);
          // 머리
          n.evs.forEach((e) => drawHead(grp, x, yOf(DR.PIECES[e.p] ? DR.PIECES[e.p].step : 35, top), e, top));
          if (n.dot) n.evs.forEach((e) => mk("circle", { cx: x + 10, cy: yOf(DR.PIECES[e.p].step, top) - ((DR.PIECES[e.p].step % 2 === 0) ? SP / 2 : 0), r: 1.7, class: "ndot" }, grp));
          // 플래그(혼자인 8분·16분)
          if (n.beams > 0 && !useBeam) for (let b = 0; b < n.beams; b++) { const fy = yEnd + (up ? b * 7 : -b * 7); mk("path", { d: up ? `M${sx} ${fy} q 2 9 9 13 q -4 -7 -9 -8 z` : `M${sx} ${fy} q 2 -9 9 -13 q -4 7 -9 8 z`, class: "flag" }, grp); }
          // 버즈
          if (n.evs.some((e) => e.buzz)) mk("text", { x: sx, y: (yEnd + (up ? yTop : yBot)) / 2 + 4, class: "buzz" }, grp).textContent = "z";
          // 액센트·열림 표시(기둥 끝 바깥)
          const accY = up ? Math.min(yEnd, yTop) - 8 : Math.max(yEnd, yBot) + 14;
          if (n.evs.some((e) => e.acc || (e.v != null && e.v >= 0.9))) mk("path", { d: `M${x - 5} ${accY - 4} L${x + 5} ${accY - 1} L${x - 5} ${accY + 2}`, class: "accent" }, grp);
          const om = n.evs.find((e) => DR.PIECES[e.p] && DR.PIECES[e.p].mark);
          if (om) {
            const oy = up ? accY - 10 : accY + 10;
            mk("circle", { cx: x, cy: oy, r: 3.6, class: "omark" }, grp);
            if (DR.PIECES[om.p].mark === "half") mk("line", { x1: x - 4.5, x2: x + 4.5, y1: oy + 4, y2: oy - 4, class: "omark-l" }, grp);
          }
          // 스티킹
          if (opts.sticking && up) {
            const hd = [...new Set(n.evs.map((e) => e.hand).filter(Boolean))].join("/");
            if (hd) mk("text", { x, y: top + 4 * SP + (opts.voices === 1 ? 24 : 44) + 2, class: "stk" }, grp).textContent = hd;
          }
          if (opts.onClick) { const hit = mk("rect", { x: x - 8, y: yTop - 8, width: 16, height: yBot - yTop + 16, class: "nhit" }, grp); hit.addEventListener("click", () => opts.onClick(evs.indexOf(n.evs[0]), n.evs[0])); }
        });
        // 쉼표
        if (opts.rests) items.filter((it) => it.rest).forEach((it) => drawRest(g, xOf(it.t), top, up, it.beams, it.dot, it.dur >= 1));
        // 빔
        if (useBeam) {
          const bx = beamed.map((n) => (up ? n.x + 5 : n.x - 5));
          const thick = 4.4, gap = 7;
          mk("rect", { x: Math.min(...bx) - 0.6, y: up ? beamY : beamY - thick, width: Math.max(...bx) - Math.min(...bx) + 1.2, height: thick, class: "beam" }, g);
          for (let lvl = 2; lvl <= 3; lvl++) {
            const yb = up ? beamY + (lvl - 1) * gap : beamY - thick - (lvl - 1) * gap;
            for (let k = 0; k < beamed.length; k++) {
              const n = beamed[k]; if (n.beams < lvl) continue;
              const nxt = beamed[k + 1], prv = beamed[k - 1];
              if (nxt && nxt.beams >= lvl) mk("rect", { x: bx[k] - 0.6, y: yb, width: bx[k + 1] - bx[k] + 1.2, height: thick, class: "beam" }, g);
              else if (!(prv && prv.beams >= lvl)) { const w = 8, toLeft = !nxt || (prv && k === beamed.length - 1); mk("rect", { x: toLeft ? bx[k] - w : bx[k], y: yb, width: w, height: thick, class: "beam" }, g); }
            }
          }
        }
        if (trip && notes.length) {
          const x0 = xOf(gs) - 2, x1 = xOf(gs + glen * (1 - 1 / div)) + 6, yb = up ? Math.min(beamY, ...allY) - 10 : Math.max(beamY, ...allY) + 16;
          mk("text", { x: (x0 + x1) / 2, y: yb, class: "tuplet" }, g).textContent = String(div === 6 ? 6 : 3);
        }
      }
      function drawHead(grp, x, y, e, top) {
        const P = DR.PIECES[e.p] || { head: "n", step: 35 };
        const ghost = e.ghost || (e.v != null && e.v <= 0.4);
        // 덧줄
        for (let s = 40; s <= P.step; s += 2) mk("line", { x1: x - 9, x2: x + 9, y1: yOf(s, top), y2: yOf(s, top), class: "ledger" }, grp);
        for (let s = 28; s >= P.step; s -= 2) mk("line", { x1: x - 9, x2: x + 9, y1: yOf(s, top), y2: yOf(s, top), class: "ledger" }, grp);
        drawHeadShape(grp, x, y, P.head, 1);
        if (ghost) { mk("path", { d: `M${x - 8} ${y - 6} q -4 6 0 12`, class: "paren" }, grp); mk("path", { d: `M${x + 8} ${y - 6} q 4 6 0 12`, class: "paren" }, grp); }
        if (e.flam || e.drag) {
          const n = e.drag ? 2 : 1;
          for (let k = 0; k < n; k++) {
            const gx = x - 15 - (n - 1 - k) * 7;
            drawHeadShape(grp, gx, y, P.head, 0.62);
            mk("line", { x1: gx + 3, x2: gx + 3, y1: y, y2: y - 20, class: "stem grace" }, grp);
            if (n === 1) mk("line", { x1: gx - 2, x2: gx + 8, y1: y - 8, y2: y - 16, class: "stem grace" }, grp);
          }
          if (n === 2) mk("line", { x1: x - 19, x2: x - 12 + 3, y1: y - 20, y2: y - 20, class: "stem grace" }, grp);
        }
      }
      function drawHeadShape(grp, x, y, head, s) {
        const rx = 5.4 * s, ry = 3.9 * s;
        if (head === "x" || head === "xc") {
          mk("path", { d: `M${x - rx} ${y - ry - 0.5} L${x + rx} ${y + ry + 0.5} M${x - rx} ${y + ry + 0.5} L${x + rx} ${y - ry - 0.5}`, class: "xhead" }, grp);
          if (head === "xc") mk("circle", { cx: x, cy: y, r: 7.2 * s, class: "xcirc" }, grp);
        } else if (head === "d") mk("path", { d: `M${x - rx} ${y} L${x} ${y - ry - 1.5} L${x + rx} ${y} L${x} ${y + ry + 1.5} z`, class: "head" }, grp);
        else if (head === "tri") mk("path", { d: `M${x - rx} ${y + ry} L${x} ${y - ry - 1} L${x + rx} ${y + ry} z`, class: "head" }, grp);
        else {
          mk("ellipse", { cx: x, cy: y, rx, ry, transform: `rotate(-20 ${x} ${y})`, class: "head" }, grp);
          if (head === "slash") mk("line", { x1: x - 8 * s, x2: x + 8 * s, y1: y + 6 * s, y2: y - 6 * s, class: "slashl" }, grp);
        }
      }
      function drawRest(g, x, top, up, beams, dot, quarter) {
        if (x == null) return;
        const cy = up ? top + 2 * SP : top + 3.9 * SP;
        if (quarter && beams === 0) {
          mk("path", { d: `M${x - 2} ${cy - 14} L${x + 3.5} ${cy - 7} L${x - 1.5} ${cy - 1} L${x + 3.5} ${cy + 5} Q${x - 4} ${cy + 2} ${x + 0.5} ${cy + 11}`, class: "rest-q" }, g);
        } else {
          for (let b = 0; b < Math.max(1, beams); b++) {
            const yy = cy - 6 + b * 7;
            mk("circle", { cx: x - 2 - b * 1.5, cy: yy, r: 2.1, class: "rest" }, g);
            mk("path", { d: `M${x - 2 - b * 1.5} ${yy + 1.5} q 4 1 6 -2.5`, class: "rest-s" }, g);
          }
          mk("line", { x1: x + 4, y1: cy - 8, x2: x - 1 - (beams - 1) * 2, y2: cy + 6 + (beams - 1) * 6, class: "rest-s" }, g);
        }
        if (dot) mk("circle", { cx: x + 8, cy: cy - 3, r: 1.6, class: "ndot" }, g);
      }
    }
    /** 묶음 안 위치들을 담는 가장 거친 격자(칸/박) */
    function gridOf(times, glen, force) {
      if (force) return force;
      for (const d of [1, 2, 4, 3, 6, 8, 12]) if (times.every((t) => Math.abs(t * d - Math.round(t * d)) < 1e-4)) { if (d === 1 && glen > 1 + EPS) continue; return d === 1 ? (times.length > 1 || times[0] > EPS ? 2 : 1) : d; }
      return 4;
    }
    const api = {
      el: host,
      get events() { return evs; },
      get layout() { return layout; },
      setEvents(e, o2) { evs = (e || []).filter((x) => DR.PIECES[x.p]); if (o2) opts = Object.assign(opts, o2); build(); return api; },
      setOptions(o2) { opts = Object.assign(opts, o2); build(); return api; },
      highlight(i) {
        const set = new Set(Array.isArray(i) ? i : i == null || i < 0 ? [] : [i]);
        groupsEls.forEach((x) => x.el.classList.remove("now"));
        groupsEls.forEach((x) => { if (set.has(x.i)) x.el.classList.add("now"); });
      },
      mark(i, cls = "ok") { groupsEls.forEach((x) => { if (x.i === i) x.el.classList.add(cls); }); },
      unmark(cls) { groupsEls.forEach((x) => (cls ? x.el.classList.remove(cls) : x.el.classList.remove("ok", "bad", "alt", "ghost"))); },
      /** 재생선(박). null이면 숨김 */
      at(beat) {
        if (!playhead) return;
        if (beat == null || !layout) { playhead.setAttribute("visibility", "hidden"); return; }
        const BL = layout.BL, bar = Math.floor(beat / BL + EPS) % layout.bars, x = layout.xOf(bar * BL + (beat - Math.floor(beat / BL + EPS) * BL));
        const r = layout.xs[bar]; if (x == null || !r) return;
        playhead.setAttribute("x1", x); playhead.setAttribute("x2", x);
        playhead.setAttribute("y1", r.top - 30); playhead.setAttribute("y2", r.top + 4 * SP + 30);
        playhead.setAttribute("visibility", "visible");
      },
    };
    api.setEvents(events);
    return api;
  };

  /* ------------------------------------------------------------ widget: step grid */
  /**
   * 스텝 시퀀서 격자.
   *   DR.grid(sel, {rows:["hat","snare","kick"], div:4, beats:4, spec:{hat:"x.x."}|문자열, cycle:{hat:[".","x","X","o"]}, perLine:16,
   *     labels:"short"|"ko", counts:true, kit, play:true(누를 때 소리), onChange(events, spec)})
   *   → {events(), spec(), set(spec), now(step | -1), nowBeat(beat), clear(), setDiv(div, beats), el}
   */
  DR.grid = function (sel, o = {}) {
    const host = $(sel);
    host.classList.add("dr-grid");
    let rows = o.rows || ["hat", "snare", "kick"], div = o.div || 4, beats = o.beats || 4;
    const cyc = Object.assign({ hat: [".", "x", "X", "o"], snare: [".", "x", "X", "g"], ride: [".", "x", "X", "b"] }, o.cycle);
    let data = {};
    const kit = o.kit || DR.default();
    function n() { return Math.round(div * beats); }
    function blank() { rows.forEach((r) => (data[r] = Array(n()).fill("."))); }
    function setSpec(spec) {
      blank();
      if (!spec) return;
      const obj = typeof spec === "string" ? {} : spec;
      if (typeof spec === "string") spec.split(/\n/).map((l) => l.trim()).filter(Boolean).forEach((l) => { const m = l.match(/^(\S+)\s+(.+)$/); if (m) obj[m[1]] = m[2]; });
      Object.keys(obj).forEach((k) => { const p = DR.pieceOf(k); const row = p === "hatOpen" ? "hat" : p; if (!data[row]) return; const s = String(obj[k]).replace(/[|\s]/g, ""); for (let i = 0; i < n(); i++) data[row][i] = s[i] && s[i] !== "-" && s[i] !== "_" ? s[i] : "."; });
    }
    let cellEls = [];
    function render() {
      const N = n(), per = o.perLine || (N <= 16 ? N : div * 4 <= 16 ? Math.floor(16 / (div * 4)) * div * 4 : div * 2 <= 16 ? div * 2 : div); // 줄바꿈은 박 경계에서
      const chunks = Math.ceil(N / per);
      const cnt = DR.counts(div, beats);
      let html = "";
      for (let c = 0; c < chunks; c++) {
        html += `<div class="dr-gblock" style="--n:${Math.min(per, N - c * per)}">`;
        rows.forEach((r) => {
          const P = DR.PIECES[r];
          html += `<div class="dr-grow"><span class="lab" title="${P.ko}">${o.labels === "ko" ? P.ko.replace(/\(.*\)/, "") : P.short}</span><div class="cells">`;
          for (let i = c * per; i < Math.min(N, (c + 1) * per); i++) html += `<button class="${i % div === 0 ? "bt " : ""}c-${cls(data[r][i])}" data-r="${r}" data-i="${i}" aria-label="${P.ko} ${i + 1}">${glyph(data[r][i])}</button>`;
          html += `</div></div>`;
        });
        if (o.counts !== false) { html += `<div class="dr-grow cnt"><span class="lab"></span><div class="cells">`; for (let i = c * per; i < Math.min(N, (c + 1) * per); i++) html += `<span class="${i % div === 0 ? "bt" : ""}">${cnt[i]}</span>`; html += `</div></div>`; }
        html += `</div>`;
      }
      host.innerHTML = html;
      cellEls = [...host.querySelectorAll("button[data-i]")];
    }
    const cls = (c) => (c === "." ? "off" : c === "X" || c === "O" || c === "F" || c === "B" ? "acc" : c === "g" ? "ghost" : c === "o" || c === "h" ? "open" : c === "b" ? "bell" : c === "f" || c === "d" || c === "z" ? "orn" : "on");
    const glyph = (c) => (c === "." ? "" : c === "o" || c === "O" ? "○" : c === "g" ? "·" : c === "X" ? "▲" : c === "f" ? "f" : c === "d" ? "d" : c === "z" ? "z" : c === "b" ? "◆" : c === "h" ? "◐" : "●");
    host.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]"); if (!b) return;
      const r = b.dataset.r, i = +b.dataset.i, list = cyc[r] || [".", "x", "X"];
      const cur = data[r][i], k = list.indexOf(cur);
      data[r][i] = list[(k + 1) % list.length];
      b.className = `${i % div === 0 ? "bt " : ""}c-${cls(data[r][i])}`; b.textContent = glyph(data[r][i]);
      if (o.play !== false && data[r][i] !== ".") { MB.ctx(); const ev = charEvent(r, data[r][i]); if (ev) kit.hit(ev.p, ev.v, null, { open: ev.p === "hatOpen" ? 1 : undefined, flam: ev.flam, drag: ev.drag, src: "grid" }); }
      o.onChange && o.onChange(api.events(), api.spec());
    });
    let nowI = -1;
    const api = {
      el: host,
      spec() { const s = {}; rows.forEach((r) => (s[r] = data[r].join(""))); return s; },
      events() { return DR.parse(api.spec(), { div }); },
      set(spec) { setSpec(spec); render(); return api; },
      setRows(r) { const old = api.spec(); rows = r; setSpec(old); render(); return api; },
      setDiv(d, b) { const old = api.events(); div = d; if (b) beats = b; blank(); old.forEach((e) => { const i = Math.round(e.t * div); const row = e.p === "hatOpen" || e.p === "hatHalf" ? "hat" : e.p === "bell" ? "ride" : e.p; if (data[row] && Math.abs(e.t * div - i) < 1e-4 && i < n()) data[row][i] = DR.toSpec([e], { div, length: beats, rows: [row] })[row][i]; }); render(); return api; },
      clear() { blank(); render(); o.onChange && o.onChange([], api.spec()); return api; },
      now(i) { if (nowI === i) return; nowI = i; cellEls.forEach((b) => b.classList.toggle("now", +b.dataset.i === i)); },
      nowBeat(t) { api.now(Math.round(t * div)); },
      get div() { return div; }, get beats() { return beats; }, get rows() { return rows; },
    };
    setSpec(o.spec); render();
    return api;
  };

  /* ------------------------------------------------------------ widget: kit seen from above */
  const KIT_LAYOUT = {
    kick:    { x: 203, y: 150, r: 0, w: 80, h: 56 },
    floor:   { x: 296, y: 194, r: 44 },
    snare:   { x: 126, y: 186, r: 36, rim: true },
    tom1:    { x: 166, y: 92, r: 28 },
    tom2:    { x: 240, y: 92, r: 31 },
    hat:     { x: 54, y: 168, r: 34, cym: true },
    ride:    { x: 344, y: 92, r: 52, cym: true, bell: 15 },
    crash:   { x: 90, y: 72, r: 46, cym: true },
    hatFoot: { x: 54, y: 248, pedal: true },
    kickPedal: { x: 203, y: 248, pedal: true },
  };

  /**
   * 위에서 내려다본 드럼 킷(SVG). 누르면 소리가 나고, 킷이 치면(재생 포함) 그 조각이 번쩍인다.
   *   DR.kitView(sel, {kit, pieces(보일 조각), labels:true, keys:true, play:true, onHit(piece, vel, hand, src)}) → {flash(piece), el, kit}
   * 스네어 가장자리 = 림샷, 라이드 가운데 = 벨, 하이햇 페달을 누르면 열림/닫힘이 바뀐다.
   */
  DR.kitView = function (sel, o = {}) {
    const host = $(sel);
    host.classList.add("dr-kit");
    const kit = o.kit || DR.default();
    const show = new Set(o.pieces || ["crash", "ride", "hat", "tom1", "tom2", "snare", "floor", "kick", "hatFoot"]);
    const svg = mk("svg", { viewBox: "0 0 410 292", role: "img", "aria-label": "드럼 킷 (위에서 본 모습)" }, host);
    const els = {};
    function draw(name, L) {
      const g = mk("g", { class: "dr-pc " + (L.cym ? "cym" : L.pedal ? "pedal" : "drum"), "data-p": name }, svg);
      if (name === "kick") {
        mk("rect", { x: L.x - L.w / 2, y: L.y - L.h / 2, width: L.w, height: L.h, rx: 10, class: "shell" }, g);
        mk("rect", { x: L.x - L.w / 2 + 6, y: L.y - L.h / 2 + 4, width: L.w - 12, height: 8, rx: 3, class: "hoop" }, g);
      } else if (L.pedal) {
        mk("rect", { x: L.x - 13, y: L.y - 22, width: 26, height: 40, rx: 5, class: "plate" }, g);
      } else {
        mk("circle", { cx: L.x, cy: L.y, r: L.r, class: L.cym ? "metal" : "shell" }, g);
        if (!L.cym) mk("circle", { cx: L.x, cy: L.y, r: L.r - 4, class: "head" }, g);
        else for (let k = 1; k < 4; k++) mk("circle", { cx: L.x, cy: L.y, r: L.r * (k / 4), class: "groove" }, g);
        if (L.bell) mk("circle", { cx: L.x, cy: L.y, r: L.bell, class: "bellc" }, g);
        if (L.cym && !L.bell) mk("circle", { cx: L.x, cy: L.y, r: L.r * 0.18, class: "bellc" }, g);
      }
      if (o.labels !== false) mk("text", { x: L.x, y: name === "kick" ? L.y + 6 : L.pedal ? L.y + 34 : L.y + 4, class: "lab" }, g).textContent = name === "kickPedal" ? "킥" : name === "hatFoot" ? "HH 페달" : DR.PIECES[name].ko.replace(/\(.*\)/, "").replace("베이스 드럼", "킥");
      els[name] = g;
      g.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        const r = svg.getBoundingClientRect(), sx = 410 / r.width, px = (e.clientX - r.left) * sx, py = (e.clientY - r.top) * sx;
        const d = L.r ? Math.hypot(px - L.x, py - L.y) / L.r : 0.3;
        let piece = name === "kickPedal" ? "kick" : name, vel = clamp(0.95 - 0.35 * d, 0.35, 1);
        if (name === "hatFoot") { MB.ctx(); const open = kit.hatOpen < 0.5; kit.hatPedal(open ? 1 : 0, null, !open); g.classList.toggle("open", open); els.hat && els.hat.classList.toggle("open", open); o.onHit && o.onHit("hatFoot", 0.6, null, "pointer"); return; }
        if (name === "snare" && d > 0.86) piece = "rim";
        if (name === "ride" && d < L.bell / L.r) piece = "bell";
        hitP(piece, vel, px < 205 ? "L" : "R", "pointer");
      });
    }
    Object.keys(KIT_LAYOUT).forEach((k) => { if (show.has(k) || (k === "kickPedal" && show.has("kick"))) draw(k, KIT_LAYOUT[k]); });
    function hitP(piece, vel, hand, src) {
      MB.ctx();
      if (o.play === false) { flash(piece); o.onHit && o.onHit(piece, vel, hand, src); return; }
      const h = { hand, src };
      if (piece === "hatOpen") h.open = 1;
      kit.hit(piece, vel, null, h);
      o.onHit && o.onHit(piece, vel, hand, src);
    }
    function flash(piece) {
      const name = piece === "rim" || piece === "xstick" ? "snare" : piece === "bell" ? "ride" : piece.startsWith("hat") && piece !== "hatFoot" ? "hat" : piece;
      const g = els[name]; if (!g) return;
      g.classList.remove("hit"); void g.getBoundingClientRect(); g.classList.add("hit");
      clearTimeout(g._t); g._t = setTimeout(() => g.classList.remove("hit"), 140);
      if (piece === "kick" && els.kickPedal) { els.kickPedal.classList.add("hit"); setTimeout(() => els.kickPedal.classList.remove("hit"), 140); }
    }
    kit.on((ev) => { if (ev.type === "hit" && !ev.grace) DR.at(ev.when, () => flash(ev.sound === "hatFoot" ? "hatFoot" : ev.p)); if (ev.type === "pedal") DR.at(ev.when, () => { const op = ev.value >= 0.25; els.hat && els.hat.classList.toggle("open", op); els.hatFoot && els.hatFoot.classList.toggle("open", op); }); });
    if (o.keys !== false) DR.keyTarget(host, (p, v, hand, src) => { if (show.has(p) || p === "rim" || p === "bell" || p === "xstick" || p === "hatOpen") hitP(p, v, hand, src); else if (p === "hatFoot" && show.has("hat")) hitP(p, v, hand, src); });
    return { el: host, kit, flash, hit: hitP };
  };

  /**
   * 패드(버튼) 줄. DR.pads(sel, {kit, pieces:["kick","snare","hat"], keys:true, labels:"ko"|"short", onHit(piece, vel, hand, src)}) → {flash, el}
   * 패드 아래쪽을 누를수록 세다(위 = 여리게).
   */
  DR.pads = function (sel, o = {}) {
    const host = $(sel);
    host.classList.add("dr-pads");
    const kit = o.kit || DR.default();
    const pieces = o.pieces || ["hat", "snare", "kick"];
    const keyOf = (p) => Object.keys(DR.KEYS).filter((k) => DR.KEYS[k][0] === p && k !== " ").slice(0, 2).map((k) => k.toUpperCase()).join("·");
    host.innerHTML = pieces.map((p) => `<button data-p="${p}"><b>${o.labels === "short" ? DR.PIECES[p].short : DR.PIECES[p].ko.replace(/\(.*\)/, "")}</b>${o.keys !== false ? `<small>${p === "kick" ? "Space·X" : keyOf(p)}</small>` : ""}</button>`).join("");
    const els = {}; host.querySelectorAll("button").forEach((b) => (els[b.dataset.p] = b));
    function hitP(p, vel, hand, src) { MB.ctx(); kit.hit(p, vel, null, { hand, src, open: p === "hatOpen" ? 1 : undefined }); o.onHit && o.onHit(p, vel, hand, src); }
    host.addEventListener("pointerdown", (e) => {
      const b = e.target.closest("button[data-p]"); if (!b) return; e.preventDefault();
      const r = b.getBoundingClientRect(), vel = clamp(0.4 + 0.6 * ((e.clientY - r.top) / r.height), 0.3, 1);
      hitP(b.dataset.p, o.vel || vel, null, "pointer");
    });
    function flash(p) { const b = els[p] || (p === "hatOpen" || p === "hatHalf" ? els.hat : null); if (!b) return; b.classList.add("hit"); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove("hit"), 120); }
    kit.on((ev) => { if (ev.type === "hit" && !ev.grace) DR.at(ev.when, () => flash(ev.p)); });
    if (o.keys !== false) DR.keyTarget(host, (p, v, hand, src) => { if (els[p] || (p === "hatOpen" && els.hat)) hitP(p, v, hand, src); });
    return { el: host, flash, hit: hitP };
  };

  /**
   * 타임라인(캔버스): 조각별 줄에 기대 이벤트(점)와 실제 탭(막대)을 시간 축에 그린다.
   *   DR.timeline(canvas, {rows, beats, div, events, taps:[{t(박), p}], aspect}) → {set({events, taps, beats}), now(beat|null), draw()}
   */
  DR.timeline = function (canvas, o = {}) {
    let st = Object.assign({ rows: ["hat", "snare", "kick"], beats: 4, div: 4, events: [], taps: [], now: null }, o);
    const cv = MB.canvas(canvas, (ctx, w, h) => {
      const L = 46, R = 8, T = 6, B = 18, rows = st.rows, rh = (h - T - B) / rows.length;
      const x = (t) => L + (t / st.beats) * (w - L - R);
      ctx.font = "600 11px " + getComputedStyle(document.body).getPropertyValue("--mono");
      for (let k = 0; k <= st.beats * st.div; k++) {
        const t = k / st.div; ctx.strokeStyle = MB.color(k % st.div === 0 ? "border" : "surface-2") || "#888"; ctx.lineWidth = k % (st.div * 4) === 0 ? 1.6 : 1;
        ctx.beginPath(); ctx.moveTo(x(t), T); ctx.lineTo(x(t), h - B); ctx.stroke();
        if (k % st.div === 0 && k < st.beats * st.div) { ctx.fillStyle = MB.color("text-faint"); ctx.fillText(String((k / st.div) % 4 + 1), x(t) + 3, h - 5); }
      }
      rows.forEach((r, i) => {
        const y = T + i * rh + rh / 2;
        ctx.fillStyle = MB.color("text-dim"); ctx.fillText(DR.PIECES[r] ? DR.PIECES[r].short : r, 6, y + 4);
        st.events.filter((e) => baseRow(e.p) === r || e.p === r).forEach((e) => { ctx.fillStyle = MB.color("accent"); ctx.globalAlpha = e.v != null ? 0.35 + 0.65 * e.v : 1; ctx.beginPath(); ctx.arc(x(e.t), y, 4 + 2 * (e.v || 0.75), 0, 7); ctx.fill(); ctx.globalAlpha = 1; });
        st.taps.filter((e) => baseRow(e.p) === r || e.p === r || (!e.p && i === 0)).forEach((e) => { ctx.fillStyle = MB.color(e.cls || "accent-2"); ctx.fillRect(x(e.t) - 1.5, y - rh * 0.38, 3, rh * 0.76); });
      });
      if (st.now != null) { ctx.strokeStyle = MB.color("warn"); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x(st.now), T); ctx.lineTo(x(st.now), h - B); ctx.stroke(); }
    }, { aspect: o.aspect || ((w) => (w < 500 ? 0.42 : 0.26)), maxHeight: o.maxHeight || 220 });
    return { set(p) { Object.assign(st, p); cv.redraw(); }, now(b) { st.now = b; cv.redraw(); }, draw: () => cv.redraw(), cv };
  };

  /** 정지 버튼 연결 */
  DR.stopButton = (btn, extra) => { const b = $(btn); if (b) b.addEventListener("click", () => { extra && extra(); MB.stopAll(); }); };
  /** 재생/정지 토글 버튼: DR.toggleButton("#btn", () => sched, ["▶ 재생", "■ 정지"]) */
  DR.toggleButton = function (btn, getSched, labels = ["▶ 재생", "■ 정지"]) {
    const b = $(btn); if (!b) return;
    let cur = null;
    const set = (on) => { b.textContent = on ? labels[1] : labels[0]; b.classList.toggle("playing", on); };
    b.addEventListener("click", () => {
      MB.ctx();
      if (cur && cur.running) { cur.stop(); set(false); return; }
      cur = getSched(); if (!cur) return;
      const os = cur.stop; cur.stop = function (n) { os.call(cur, n); set(false); };
      cur.start(); set(true);
    });
    return { reset() { if (cur && cur.running) cur.stop(); set(false); }, get sched() { return cur; } };
  };
})();
