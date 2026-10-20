/* ==========================================================================
   PianoBook 피아노 전용 스크립트 — 전역 객체 PN (common.js의 MB 위에서 동작)
   - 피아노 음원: 비조화 배음(f_n = n·f0·√(1+Bn²)) + 배음별 2단 감쇠 + 유니즌 현 맥놀이 + 해머 잡음을 버퍼로 합성
   - PN.piano(): 건반을 누르고(noteOn) 떼는(noteOff) 가상 피아노. 댐퍼·소스테누토·소프트 페달, 소리 나는 순간의 콜백(on)
   - 위젯: 건반(PN.keyboard), 큰보표 악보(PN.staff), 피아노 롤(PN.roll)
   - 이론: 건반 기하, 조표와 음 철자, 스케일 운지표, 자동 운지, 코드 이름 해석, 보이싱, 반주 패턴
   - 도구: 박 단위 이벤트 스케줄러(PN.scheduler), 메트로놈 클릭, 녹음기, Web MIDI 입력
   음 번호는 MIDI(가온 다 C4 = 60, A4 = 69 = 440 Hz). 88건반은 A0(21)–C8(108).
   이 파일은 common.js 다음에 defer 없이 로드한다.
   ========================================================================== */
(function () {
  "use strict";
  const PN = (window.PN = {});
  const SVGNS = "http://www.w3.org/2000/svg";
  const $ = (sel) => (typeof sel === "string" ? document.querySelector(sel) : sel);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  /* ------------------------------------------------------------ keyboard geometry */
  PN.LOWEST = 21; PN.HIGHEST = 108; PN.MIDDLE_C = 60;
  PN.WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
  PN.isBlack = (m) => [1, 3, 6, 8, 10].includes(MB.mod(m, 12));
  PN.isWhite = (m) => !PN.isBlack(m);
  /** 88건반에서 몇 번째 건반인가(1–88) */
  PN.keyNumber = (m) => m - 20;
  /** 피아노 주파수: 평균율 f = 440·2^((m−69)/12) */
  PN.freq = (m, a4 = 440) => a4 * Math.pow(2, (m - 69) / 12);
  /** m 이상(dir=1)·이하(dir=−1)의 가장 가까운 흰 건반 */
  PN.snapWhite = (m, dir = 1) => { while (PN.isBlack(m)) m += dir; return m; };
  PN.SOLFEGE = ["도", "도♯", "레", "레♯", "미", "파", "파♯", "솔", "솔♯", "라", "라♯", "시"];
  PN.LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  PN.LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  PN.KO_LETTERS = { C: "다", D: "라", E: "마", F: "바", G: "사", A: "가", B: "나" };

  /* ------------------------------------------------------------ inharmonicity & tuning */
  /** 비조화 계수 B(m) 근사: 베이스 감은 현 ~2×10⁻⁴, 가온 다 ~4×10⁻⁴, 최고음 ~10⁻². log10 B를 구간 선형으로 */
  PN.inharmonicity = function (m) {
    const lg = m < 60 ? MB.lerp(-3.7, -3.4, (m - 21) / 39) : MB.lerp(-3.4, -1.8, (m - 60) / 48);
    return Math.pow(10, lg);
  };
  /** n번 배음의 주파수: f_n = n·f0·√(1 + B n²) */
  PN.partialFreq = (f0, n, B) => n * f0 * Math.sqrt(1 + B * n * n);
  /** 스트레치 튜닝(레일스백 곡선) 근사: 가온 다 부근 0, 최저음 약 −30센트, 최고음 약 +35센트 */
  PN.stretchCents = function (m) {
    const x = (m - 64) / 44;
    return x < 0 ? -30 * Math.pow(-x, 2.2) : 35 * Math.pow(x, 2.2);
  };

  /* ------------------------------------------------------------ piano sound (buffer synthesis) */
  const _bufCache = new Map();
  /** 음 하나의 모델 매개변수(장 스크립트에서 그림·표로 보여 줄 때도 쓴다) */
  PN.noteModel = function (m, layer = 1, o = {}) {
    const f0 = PN.freq(m);
    const B = PN.inharmonicity(m) * (o.B != null ? o.B : 1);
    const tau1 = Math.min(9, 2.4 * Math.pow(2, -(m - 60) / 18)) * (o.decay || 1); // 여운(aftersound) 시간 상수(초)
    const beta = o.strike != null ? o.strike : 1 / 8.3; // 해머가 때리는 위치(현 길이 비)
    const fc = f0 * (3 + 3.5 * layer) + 500 * layer + (o.bright || 0) * 3000; // 해머 펠트 경도 → 밝기
    const fmax = Math.min(o.sr ? o.sr * 0.45 : 20000, 9000 + 3500 * layer);
    const nMax = Math.max(1, Math.min(m < 45 ? 34 : 24, Math.floor(fmax / f0)));
    const partials = [];
    for (let n = 1; n <= nMax; n++) {
      const fn = PN.partialFreq(f0, n, B);
      if (fn > fmax) break;
      let a = (Math.abs(Math.sin(Math.PI * n * beta)) + 0.04) / Math.pow(n, 0.75) * Math.exp(-fn / fc);
      if (n === 1 && m < 40) a *= 0.55; // 최저음역은 기본음이 약하다(향판이 낮은 주파수를 잘 내지 못함)
      const tau = tau1 / (1 + ((n - 1) * f0) / 900 + Math.pow(fn / 6000, 2));
      partials.push({ n, f: fn, a, tau });
    }
    return { m, f0, B, tau1, beta, fc, partials, dur: Math.min(o.maxDur || 6, 4.6 * tau1 + 0.4) };
  };
  /**
   * 음 하나를 합성한 AudioBuffer(캐시). layer 0·1·2 = 여리게·보통·세게(해머가 단단할수록 고배음이 많다).
   * 배음마다 즉답음(prompt sound, 빠른 감쇠)과 여운(aftersound, 느린 감쇠)의 합, 두 유니즌 현의 맥놀이(AM)를 곱한다.
   */
  PN.buffer = function (ctx, m, layer = 1, o = {}) {
    const sr = ctx.sampleRate;
    const key = [sr, m, layer, o.B, o.decay, o.strike, o.bright, o.unison, o.maxDur].join("|");
    if (_bufCache.has(key)) return _bufCache.get(key);
    const md = PN.noteModel(m, layer, Object.assign({ sr }, o));
    const len = Math.floor(sr * md.dur), b = ctx.createBuffer(1, len, sr), y = b.getChannelData(0);
    const rnd = MB.rng(m * 7 + layer + 3);
    const unison = (o.unison != null ? o.unison : 0.7) * (m < 30 ? 0.5 : 1); // 유니즌 현 사이 틀어짐(센트)
    const wPrompt = 0.62, BLK = 32;
    let norm = 0;
    for (const p of md.partials) {
      const w = (2 * Math.PI * p.f) / sr, c = Math.cos(w), s = Math.sin(w);
      const ph = rnd() * 2 * Math.PI;
      let re = Math.cos(ph), im = Math.sin(ph);
      const d1 = Math.exp(-1 / (sr * p.tau * 0.16)), d2 = Math.exp(-1 / (sr * p.tau));
      let e1 = wPrompt, e2 = 1 - wPrompt;
      const beat = p.f * (Math.pow(2, unison / 1200) - 1) * (0.6 + rnd() * 0.8), depth = 0.22, bph = rnd() * 6.283;
      const stopAt = Math.min(len, Math.ceil(sr * p.tau * 9.5));
      norm += p.a;
      for (let i = 0; i < stopAt; i += BLK) {
        const mod = 1 - depth + depth * Math.cos(2 * Math.PI * beat * (i / sr) + bph);
        const amp = p.a * mod, end = Math.min(stopAt, i + BLK);
        for (let k = i; k < end; k++) {
          const nr = re * c - im * s; im = re * s + im * c; re = nr;
          y[k] += amp * (e1 + e2) * im;
          e1 *= d1; e2 *= d2;
        }
      }
    }
    // 해머가 현을 때리는 '톡' 소리: 1차 저역 통과한 짧은 잡음
    const hLen = Math.floor(sr * 0.03), hk = Math.exp(-2 * Math.PI * Math.min(5000, 900 + md.f0 * 2) / sr);
    let lp = 0;
    for (let k = 0; k < hLen; k++) { lp = lp * hk + (rnd() * 2 - 1) * (1 - hk); y[k] += lp * norm * (0.18 + 0.12 * layer) * Math.exp(-k / (sr * 0.006)); }
    let peak = 0; for (let k = 0; k < Math.min(len, sr * 0.3); k++) peak = Math.max(peak, Math.abs(y[k]));
    const g = 0.9 / (peak || 1), fade = Math.floor(sr * 0.05);
    for (let k = 0; k < len; k++) y[k] *= g * (k > len - fade ? (len - k) / fade : 1);
    b._model = md;
    _bufCache.set(key, b);
    if (_bufCache.size > 140) _bufCache.delete(_bufCache.keys().next().value);
    return b;
  };
  PN.layerOf = (vel) => (vel < 0.42 ? 0 : vel < 0.78 ? 1 : 2);
  /** 벨로시티(0–1) → 음량 배율. 해머 속도와 음압은 대략 지수 관계라 곡선을 준다(ppp ≈ −36 dB) */
  PN.velGain = (vel) => 0.015 + 0.985 * Math.pow(clamp(vel, 0, 1), 1.9);
  /** 댐퍼 없는 최고음역: F♯6(90)부터 위는 댐퍼가 없어 건반을 떼도 울린다 */
  PN.NO_DAMPER = 90;
  /** 건반을 뗐을 때 댐퍼가 현을 누르는 시간 상수(초): 굵고 긴 저음 현일수록 늦게 멈춘다 */
  PN.dampTime = (m) => clamp(0.32 - (m - 21) * 0.0042, 0.06, 0.32);

  /**
   * MB.play(m, {inst:"grand", dur:null, vel, pn:{soft, bright, B, decay, strike, unison, layer}}) 로 부르는 악기.
   * 오프라인 렌더(MB.render)에서도 쓸 수 있다.
   */
  MB.INSTRUMENTS.grand = function (ctx, f, t0, vel, dest, o) {
    const p = o.pn || {};
    const m = Math.round(MB.ftom(f));
    let layer = p.layer != null ? p.layer : PN.layerOf(vel);
    if (p.soft) layer = Math.max(0, layer - 1);
    const buf = PN.buffer(ctx, clamp(m, 12, 120), layer, p);
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = f / PN.freq(m);
    const g = ctx.createGain(), lvl = 0.55 * PN.velGain(vel) * (p.soft ? 0.72 : 1);
    g.gain.value = lvl;
    src.connect(g); g.connect(dest); src.start(t0);
    const end0 = t0 + buf.duration / src.playbackRate.value;
    const v = {
      end: end0, m, buffer: buf,
      release(t, rr) {
        t = Math.max(t != null ? t : ctx.currentTime, t0 + 0.004);
        // 짧은 rr(≤0.05)은 강제 정지(정지 버튼). 그 밖에는 댐퍼 모델: 최고음역은 댐퍼가 없다
        if (rr == null && m >= PN.NO_DAMPER && !p.forceDamp) return end0;
        const tau = rr != null ? rr / 5 : PN.dampTime(m);
        // 지금 값에서 이어 줄인다(하프 페달을 여러 번 바꿔도 음량이 튀지 않게)
        if (g.gain.cancelAndHoldAtTime) g.gain.cancelAndHoldAtTime(t);
        else { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(t <= ctx.currentTime + 0.01 ? g.gain.value : lvl, t); }
        g.gain.setTargetAtTime(0, t, tau);
        const e = Math.min(end0, t + tau * 6);
        // 하프 페달처럼 느린 감쇠는 멈춤 시각을 고정하지 않는다(다시 빨라질 수 있음)
        if (rr == null || rr <= 0.6) { try { src.stop(e + 0.05); } catch (er) {} }
        v.end = e; return e;
      },
    };
    return v;
  };
  MB.INSTRUMENT_NAMES.grand = "그랜드 피아노(물리 모델 근사)";

  /** 처음 연주하기 전에 버퍼를 미리 만들어 둔다(사용자 클릭 뒤에만 부를 것) */
  PN.warm = function (midis, layers = [1]) {
    const ctx = MB.ctx(); if (!ctx) return;
    const q = []; midis.forEach((m) => layers.forEach((l) => q.push([m, l])));
    const idle = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 30));
    const step = (dl) => { while (q.length && dl.timeRemaining() > 4) { const [m, l] = q.shift(); PN.buffer(ctx, m, l); } if (q.length) idle(step); };
    idle(step);
  };

  /** 오디오 시각 when에 fn을 실행(화면 갱신용) */
  PN.at = function (when, fn) {
    const dt = Math.max(0, (when - MB.now()) * 1000);
    return dt < 4 ? (fn(), 0) : setTimeout(fn, dt);
  };

  /* ------------------------------------------------------------ virtual piano */
  /**
   * 가상 피아노. 건반마다 한 음, 같은 건반을 다시 치면 앞 음을 짧게 멈추고 새로 친다.
   *   const p = PN.piano({dest, soft, stereo, pn:{...음색 매개변수}});
   *   p.noteOn(m, vel, when) · p.noteOff(m, when) · p.play(m, {when, dur, vel}) · p.chord([m…], {when, dur, vel, roll})
   *   p.pedal(true|false|0..1, when) 댐퍼 · p.sostenuto(bool, when) · p.soft = true(우나 코르다)
   *   p.on(cb) → cb({type:"on"|"off"|"pedal"|"sostenuto", m, vel, when, value})
   */
  PN.piano = function (o = {}) {
    const held = new Map();     // 손가락이 누르고 있는 건반 m → voice
    const ringing = new Map();  // 건반은 뗐지만 페달로 울리는 m → voice
    const sost = new Set();     // 소스테누토가 잡고 있는 건반
    const cbs = [];
    let sustain = 0;
    const emit = (ev) => cbs.forEach((cb) => { try { cb(ev); } catch (e) { console.error(e); } });
    const api = {
      soft: !!o.soft, stereo: o.stereo !== false, dest: o.dest || null, pn: Object.assign({}, o.pn),
      get sustain() { return sustain; },
      get held() { return [...held.keys()]; },
      get sounding() { return [...new Set([...held.keys(), ...ringing.keys()])]; },
      on(cb) { cbs.push(cb); return api; },
      noteOn(m, vel = 0.7, when) {
        const ctx = MB.ctx(); if (!ctx) return null;
        const t = when != null ? Math.max(when, ctx.currentTime) : ctx.currentTime + 0.005;
        const old = held.get(m) || ringing.get(m);
        if (old) { try { old.release(t, 0.04); } catch (e) {} }
        ringing.delete(m);
        const v = MB.play(m, { inst: "grand", dur: null, when: t, vel, dest: api.dest || undefined,
          pan: api.stereo ? clamp((m - 64) / 70, -0.6, 0.6) : 0, pn: Object.assign({ soft: api.soft }, api.pn) });
        if (!v) return null;
        held.set(m, v);
        emit({ type: "on", m, vel, when: t });
        return v;
      },
      /** voice를 주면 그 음일 때만 뗀다(같은 건반을 이미 다시 쳤으면 무시) */
      noteOff(m, when, voice) {
        const ctx = MB.ctx(); if (!ctx) return;
        const t = when != null ? Math.max(when, ctx.currentTime) : ctx.currentTime;
        const v = held.get(m); if (!v || (voice && v !== voice)) return;
        held.delete(m);
        emit({ type: "off", m, when: t });
        if (sustain > 0.15 || sost.has(m)) { ringing.set(m, v); if (sustain > 0.15 && sustain < 0.7) v.release(t, 0.6 + 4 * sustain); return; }
        v.release(t);
      },
      play(m, p = {}) {
        const ctx = MB.ctx(); if (!ctx) return null;
        const t = p.when != null ? p.when : ctx.currentTime + 0.01;
        const v = api.noteOn(m, p.vel != null ? p.vel : 0.7, t);
        api.noteOff(m, t + (p.dur != null ? p.dur : 0.6));
        return v;
      },
      /** 화음. roll(초)만큼 아래에서 위로 흩어 친다(아르페지아토) */
      chord(ms, p = {}) {
        const ctx = MB.ctx(); if (!ctx) return [];
        const t = p.when != null ? p.when : ctx.currentTime + 0.01;
        return ms.slice().sort((a, b) => a - b).map((m, i) => api.play(m, Object.assign({}, p, { when: t + i * (p.roll || 0) })));
      },
      /** 댐퍼 페달. true/1 = 끝까지, 0.3–0.6 = 하프 페달(댐퍼가 현에 살짝 닿아 천천히 줄어든다), false/0 = 뗌 */
      pedal(down, when) {
        const ctx = MB.ctx(); if (!ctx) return;
        const t = when != null ? Math.max(when, ctx.currentTime) : ctx.currentTime;
        const val = down === true ? 1 : down === false ? 0 : clamp(+down || 0, 0, 1);
        sustain = val;
        if (val <= 0.15) ringing.forEach((v, m) => { if (!sost.has(m)) { v.release(t); ringing.delete(m); } });
        else if (val < 0.7) ringing.forEach((v, m) => { if (!sost.has(m)) v.release(t, 0.6 + 4 * val); });
        emit({ type: "pedal", value: val, when: t });
      },
      /** 소스테누토(가운데) 페달: 밟는 순간 누르고 있던 건반만 붙잡는다 */
      sostenuto(down, when) {
        const ctx = MB.ctx(); if (!ctx) return;
        const t = when != null ? Math.max(when, ctx.currentTime) : ctx.currentTime;
        if (down) held.forEach((v, m) => sost.add(m));
        else { sost.forEach((m) => { const v = ringing.get(m); if (v && sustain <= 0.15) { v.release(t); ringing.delete(m); } }); sost.clear(); }
        emit({ type: "sostenuto", value: down ? 1 : 0, when: t });
      },
      /** 모든 소리를 멈추고 페달을 뗀다 */
      stop() {
        const ctx = MB.ctx(); if (!ctx) return;
        const t = ctx.currentTime;
        held.forEach((v, m) => { v.release(t, 0.05); emit({ type: "off", m, when: t }); });
        ringing.forEach((v) => v.release(t, 0.05));
        held.clear(); ringing.clear(); sost.clear(); sustain = 0;
      },
    };
    return api;
  };
  let _default = null;
  /** 공용 피아노 */
  PN.default = () => _default || (_default = PN.piano());

  /** 메트로놈 클릭(accent면 높고 크게) */
  PN.click = function (when, accent = false, o = {}) {
    const ctx = MB.ctx(); if (!ctx) return;
    const t = when != null ? Math.max(when, ctx.currentTime) : ctx.currentTime + 0.005;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.frequency.value = accent ? 1760 : 1175; osc.type = "sine";
    const v = (o.vel != null ? o.vel : 0.5) * (accent ? 1 : 0.65);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(g); g.connect(o.dest || MB.out); osc.start(t); osc.stop(t + 0.08);
  };

  /* ------------------------------------------------------------ scheduler */
  /**
   * 박 단위 이벤트 스케줄러(오디오 시계 기준 미리 예약). 템포를 바꿔도 이어진다.
   *   PN.scheduler(events, {bpm:()=>n, length(박), loop, onEvent(ev, when, spb, loopNo), onUI(ev), onEnd, onStop, onStart})
   *   → {start, stop, toggle, running, setEvents}. 이벤트는 {t(박), ...}. 화면은 onUI에서 바꾼다.
   */
  PN.scheduler = function (events, o = {}) {
    let list = events.slice().sort((a, b) => a.t - b.t);
    let timer = 0, raf = 0, running = false, idx = 0, loopNo = 0, beatPos = 0, lastTime = 0;
    const queue = [];
    const bpm = () => (typeof o.bpm === "function" ? o.bpm() : o.bpm || 90);
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
        try { o.onEvent && o.onEvent(ev, when, spb, loopNo); } catch (e) { console.error(e); }
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
        if (q.end) { api.stop(true); o.onEnd && o.onEnd(); return; }
        o.onUI && o.onUI(q.ev);
      }
      raf = requestAnimationFrame(ui);
    }
    const api = {
      start() {
        const ctx = MB.ctx(); if (!ctx || running) return;
        running = true; idx = 0; beatPos = 0; loopNo = 0; lastTime = ctx.currentTime + 0.08; queue.length = 0;
        o.onStart && o.onStart();
        tick(); if (running) timer = setInterval(tick, 25); raf = requestAnimationFrame(ui);
      },
      stop(natural) { if (!running) return; running = false; stopTimers(); if (raf) cancelAnimationFrame(raf); raf = 0; queue.length = 0; o.onStop && o.onStop(natural === true); },
      toggle() { running ? api.stop() : api.start(); return running; },
      setEvents(ev) { list = ev.slice().sort((a, b) => a.t - b.t); if (running) { idx = list.findIndex((e) => e.t >= beatPos + 1e-6); if (idx < 0) idx = list.length; } },
      /** 지금 재생 위치(박, 대략) */
      get beat() { if (!running) return 0; const spb = 60 / bpm(); return beatPos + (MB.now() - lastTime) / spb; },
      get running() { return running; },
    };
    return api;
  };

  /**
   * 음표 목록 재생. 이벤트 {t, d, m | ms:[…], vel, hand} 또는 페달 {t, pedal:true|false|0.5}.
   *   PN.playEvents(events, {bpm, piano, loop, length, legato(0–1), click(박마다 메트로놈), beatsPerBar,
   *                          staff(highlight), keyboard, onNote(ev, i), onEnd, onStop, swing(0.5–0.75)})
   *   → scheduler. 재생 중 건반 표시는 piano.on으로 자동으로 따라간다(keyboard는 piano를 공유할 때만 필요 없음).
   */
  PN.playEvents = function (events, o = {}) {
    const piano = o.piano || PN.default();
    const legato = o.legato != null ? o.legato : 0.95;
    const evs = events.map((e, i) => Object.assign({ i }, e));
    const L = o.length || (evs.length ? Math.ceil(Math.max(...evs.map((e) => e.t + (e.d || 0))) - 1e-6) : 4);
    const bpb = o.beatsPerBar || 4;
    // 음 끄기를 따로 예약한다: 끄는 순간의 페달 상태로 판정해야 '떼고 다시 밟기'가 맞게 동작한다
    evs.slice().forEach((e) => {
      if (e.pedal != null || e.click) return;
      const lg = e.legato != null ? e.legato : legato;
      e._off = { t: Math.min(e.t + (e.d || 1) * lg, L - 1e-4), off: e };
      if (e._off.t <= e.t) e._off.t = e.t + 1e-4;
      evs.push(e._off);
    });
    if (o.click) for (let b = 0; b < L; b++) evs.push({ t: b, click: true, accent: b % bpb === 0 });
    const sw = (t) => { const s = typeof o.swing === "function" ? o.swing() : o.swing; if (!s || s === 0.5) return t; const b = Math.floor(t), fr = t - b; return Math.abs(fr - 0.5) < 1e-6 ? b + s : t; };
    let sched;
    sched = PN.scheduler(evs, Object.assign({}, o, {
      length: L,
      onEvent(ev, when, spb) {
        if (ev.click) { if (!o.clickOn || o.clickOn()) PN.click(when, ev.accent); return; }
        if (ev.off) { const on = ev.off, ms = on.ms || (on.m != null ? [on.m] : []); ms.forEach((m, k) => piano.noteOff(m, when, on._v && on._v[k])); return; }
        const w = when + (sw(ev.t) - ev.t) * spb;
        if (ev.pedal != null) { piano.pedal(ev.pedal, w); return; }
        const ms = ev.ms || (ev.m != null ? [ev.m] : []);
        ev._v = ms.map((m, k) => piano.noteOn(m, ev.vel != null ? ev.vel : 0.7, w + k * (ev.roll || 0)));
        o.onSchedule && o.onSchedule(ev, w, spb);
      },
      onUI(ev) {
        if (ev.off) return;
        if (ev.click || ev.pedal != null) { o.onTick && ev.click && o.onTick(ev); return; }
        if (o.staff) o.staff.highlight(ev.i);
        o.onNote && o.onNote(ev, ev.i);
      },
      onStop(natural) { piano.pedal(false); if (!natural) piano.stop(); if (o.staff) o.staff.highlight(-1); o.onStop && o.onStop(natural); },
    }));
    return sched;
  };

  /* ------------------------------------------------------------ key signatures & spelling */
  /** 조표의 올림(+)·내림(−) 개수 → 장조 으뜸음 */
  PN.MAJOR_BY_FIFTHS = { "-7": "C♭", "-6": "G♭", "-5": "D♭", "-4": "A♭", "-3": "E♭", "-2": "B♭", "-1": "F", 0: "C", 1: "G", 2: "D", 3: "A", 4: "E", 5: "B", 6: "F♯", 7: "C♯" };
  PN.MINOR_BY_FIFTHS = { "-7": "A♭", "-6": "E♭", "-5": "B♭", "-4": "F", "-3": "C", "-2": "G", "-1": "D", 0: "A", 1: "E", 2: "B", 3: "F♯", 4: "C♯", 5: "G♯", 6: "D♯", 7: "A♯" };
  PN.SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
  PN.FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
  /** 으뜸음 pc(·단조) → 조표 수(−6..6). F♯/G♭은 6(올림)이 아니라 −6(내림)을 기본으로, prefer로 바꿀 수 있다 */
  PN.keyFifths = function (keyPc, minor = false, prefer) {
    const pc = MB.mod(keyPc + (minor ? 3 : 0), 12);
    let k = MB.mod(pc * 7, 12); if (k > 6) k -= 12;
    if (k === 6 && prefer !== "sharp") k = -6;
    if (k === -6 && prefer === "sharp") k = 6;
    if (prefer === "flat" && k === 5) k = -7; if (prefer === "sharp" && k === -5) k = 7;
    return k;
  };
  /** 조표 k에서 각 글자(C..B)의 변화(+1, 0, −1) */
  PN.keyAccidentals = function (k) {
    const acc = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
    if (k > 0) PN.SHARP_ORDER.slice(0, k).forEach((L) => (acc[L] = 1));
    if (k < 0) PN.FLAT_ORDER.slice(0, -k).forEach((L) => (acc[L] = -1));
    return acc;
  };
  const ACC_STR = { "-2": "𝄫", "-1": "♭", 0: "", 1: "♯", 2: "𝄪" };
  PN.accStr = (a) => ACC_STR[a] || "";
  /**
   * 음 철자: 조표 k에 맞게 m을 글자+변화표로. 반환 {letter, acc, oct, step(=oct·7+글자), name("F♯4"), ko("올림 바")}
   * 조표 음은 그대로, 나머지 반음은 올림조에서는 ♯, 내림조에서는 ♭(다장조: C♯ E♭ F♯ G♯ B♭).
   * spell 인자로 "Eb" 같은 철자를 강제할 수 있다.
   */
  PN.spell = function (m, k = 0, spell) {
    let letter, acc;
    if (spell) {
      const mm = /^([A-Ga-g])([#♯b♭x𝄪𝄫]*)/.exec(spell);
      letter = mm[1].toUpperCase(); acc = 0;
      for (const ch of mm[2]) acc += ch === "#" || ch === "♯" ? 1 : ch === "x" || ch === "𝄪" ? 2 : ch === "𝄫" ? -2 : -1;
    } else {
      const ka = PN.keyAccidentals(k), pc = MB.mod(m, 12);
      // 조표 음인가?
      for (const L of PN.LETTERS) if (MB.mod(PN.LETTER_PC[PN.LETTERS.indexOf(L)] + ka[L], 12) === pc) { letter = L; acc = ka[L]; break; }
      // 흰 건반 음은 제자리표(♮)로: 내림조의 E, 올림조의 C 등
      if (letter == null && PN.WHITE_PCS.includes(pc)) { letter = PN.LETTERS[PN.WHITE_PCS.indexOf(pc)]; acc = 0; }
      if (letter == null) {
        const useSharp = k > 0 || (k === 0 && pc !== 3 && pc !== 10);
        for (const L of PN.LETTERS) {
          const base = MB.mod(PN.LETTER_PC[PN.LETTERS.indexOf(L)] + ka[L], 12);
          if (useSharp && MB.mod(base + 1, 12) === pc) { letter = L; acc = ka[L] + 1; break; }
          if (!useSharp && MB.mod(base - 1, 12) === pc) { letter = L; acc = ka[L] - 1; break; }
        }
        if (letter == null || Math.abs(acc) > 1) { const n = (useSharp ? MB.SHARP_NAMES : MB.FLAT_NAMES)[pc]; letter = n[0]; acc = n.length > 1 ? (n[1] === "♯" ? 1 : -1) : 0; }
      }
    }
    const li = PN.LETTERS.indexOf(letter);
    const oct = Math.floor((m - acc - PN.LETTER_PC[li]) / 12) - 1;
    const step = oct * 7 + li;
    const koAcc = acc === 1 ? "올림 " : acc === -1 ? "내림 " : acc === 2 ? "겹올림 " : acc === -2 ? "겹내림 " : "";
    return { letter, acc, oct, step, li, name: letter + PN.accStr(acc) + oct, short: letter + PN.accStr(acc), ko: koAcc + PN.KO_LETTERS[letter], solfege: ["도", "레", "미", "파", "솔", "라", "시"][li] + (acc > 0 ? "♯" : acc < 0 ? "♭" : "") };
  };
  /** 보표 위치(step = 옥타브·7 + 글자 번호, C4 = 28)와 조표 → MIDI */
  PN.stepToMidi = function (step, k = 0) {
    const li = MB.mod(step, 7), oct = Math.floor(step / 7), L = PN.LETTERS[li];
    return (oct + 1) * 12 + PN.LETTER_PC[li] + PN.keyAccidentals(k)[L];
  };
  PN.STEP = { C4: 28, E4: 30, F5: 38, G2: 18, A3: 26, B4: 34, D3: 22, G4: 32, F3: 24 };

  /* ------------------------------------------------------------ scale fingerings */
  /**
   * 장음계 운지(한 옥타브 상행 8음, 오른손 rh·왼손 lh). 두 옥타브 이상은 마지막 음 대신 처음 운지를 이어 간다.
   * 흰 건반 으뜸음 C G D A E: 오른손 123 1234 5, 왼손 54321 321. F·B와 검은 건반 조는 엄지가 흰 건반에 오도록 바뀐다.
   */
  PN.SCALE_FINGERS = {
    major: {
      0: { rh: "12312345", lh: "54321321" }, 7: { rh: "12312345", lh: "54321321" }, 2: { rh: "12312345", lh: "54321321" },
      9: { rh: "12312345", lh: "54321321" }, 4: { rh: "12312345", lh: "54321321" }, 11: { rh: "12312345", lh: "43214321" },
      5: { rh: "12341234", lh: "54321321" }, 10: { rh: "41231234", lh: "32143213" }, 3: { rh: "31234123", lh: "32143213" },
      8: { rh: "34123123", lh: "32143213" }, 1: { rh: "23123412", lh: "32143213" }, 6: { rh: "23412312", lh: "43213214" },
    },
    harmonicMinor: {
      9: { rh: "12312345", lh: "54321321" }, 4: { rh: "12312345", lh: "54321321" }, 2: { rh: "12312345", lh: "54321321" },
      7: { rh: "12312345", lh: "54321321" }, 0: { rh: "12312345", lh: "54321321" }, 5: { rh: "12341234", lh: "54321321" },
      11: { rh: "12312345", lh: "43214321" }, 6: { rh: "34123123", lh: "43213214" }, 1: { rh: "34123123", lh: "32143213" },
      8: { rh: "34123123", lh: "32143213" }, 3: { rh: "31234123", lh: "21432132" }, 10: { rh: "21231234", lh: "21321432" },
    },
  };
  PN.SCALE_FINGERS.minor = PN.SCALE_FINGERS.harmonicMinor;
  /**
   * 스케일 음과 운지: PN.scaleFingering(keyPc, "major", "R", {octaves:1, start(MIDI), down:true(내려오기 포함)})
   * → [{m, finger, deg}] (운지표가 없으면 PN.autoFinger로 계산)
   */
  PN.scaleFingering = function (keyPc, scale = "major", hand = "R", o = {}) {
    const steps = (MB.SCALES[scale] || MB.SCALES.major).steps, oct = o.octaves || 1;
    const start = o.start != null ? o.start : (hand === "R" ? 60 : 48) + MB.mod(keyPc, 12);
    const up = [];
    for (let i = 0; i <= steps.length * oct; i++) up.push({ m: MB.scaleNote(start, steps, i), deg: i % steps.length });
    const tbl = PN.SCALE_FINGERS[scale] && PN.SCALE_FINGERS[scale][MB.mod(keyPc, 12)];
    if (tbl && steps.length === 7) {
      const f = (hand === "R" ? tbl.rh : tbl.lh).split("").map(Number);
      up.forEach((n, i) => {
        const j = i % 7, last = i === up.length - 1;
        n.finger = last ? f[7] : f[j];
      });
    } else {
      PN.autoFinger(up.map((n) => n.m), hand).forEach((f, i) => (up[i].finger = f));
    }
    if (!o.down) return up;
    const down = up.slice(0, -1).reverse().map((n) => Object.assign({}, n));
    if (tbl && steps.length === 7) {
      // 내려올 때는 같은 음에 같은 손가락(꼭대기 음만 마지막 손가락)
      const f = (hand === "R" ? tbl.rh : tbl.lh).split("").map(Number);
      down.forEach((n) => { const i = up.findIndex((u) => u.m === n.m); n.finger = i % 7 === 0 && i > 0 && i < up.length - 1 ? f[0] : up[i].finger; });
    }
    return up.concat(down);
  };
  /**
   * 자동 운지(동적 계획법). 선율 midis를 한 손으로 칠 때 손가락 1–5를 고른다.
   * 비용: 손가락 간격에 비해 너무 넓거나 좁은 음정, 엄지 밑 넘기기·손가락 넘기기(3·4에서 하면 가볍게),
   * 엄지·새끼의 검은 건반, 다른 음에 같은 손가락. 왼손은 음높이를 뒤집어 오른손 규칙을 쓴다.
   */
  PN.autoFinger = function (midis, hand = "R") {
    const n = midis.length; if (!n) return [];
    const ps = hand === "L" ? midis.map((m) => -m) : midis.slice();
    const black = midis.map(PN.isBlack);
    const cost = (fa, pa, fb, pb, bb) => {
      const d = pb - pa;
      let c = 0;
      if (fb === 1 && bb) c += 2.5;
      if (fb === 5 && bb) c += 1;
      if (fa === fb) return c + (d === 0 ? 0 : 7 + Math.abs(d));
      if (fb > fa) {
        const g = fb - fa, ideal = fa === 1 ? [0, 2, 3.5, 5, 7][g] : 1.5 * g, max = fa === 1 ? 2 * g + 6 : 2 * g + 2;
        if (d <= 0) {
          // 손가락을 오른쪽으로 옮기며 음은 내려감 = 넘기기. 엄지 위로 2·3·4가 넘어가는 것만 허용
          if (fa === 1 && d < 0 && -d <= 5) return c + 1 + (fb === 3 ? 0 : fb === 4 ? 0.6 : fb === 2 ? 0.8 : 6) + Math.max(0, -d - 3);
          return c + 9;
        }
        return c + Math.abs(d - ideal) * 0.5 + Math.max(0, d - max) * 2;
      }
      // fb < fa: 손가락이 왼쪽으로
      const g = fa - fb, ideal = fb === 1 ? -[0, 2, 3.5, 5, 7][g] : -1.5 * g, max = fb === 1 ? 2 * g + 6 : 2 * g + 2;
      if (d >= 0) {
        if (fb === 1 && d > 0 && d <= 5) return c + (fa === 3 ? 1 : fa === 4 ? 1.5 : fa === 2 ? 2 : 6) + Math.max(0, d - 3);
        return c + 9;
      }
      return c + Math.abs(d - ideal) * 0.5 + Math.max(0, -d - max) * 2;
    };
    const D = [...Array(n)].map(() => [0, Infinity, Infinity, Infinity, Infinity, Infinity]);
    const P = [...Array(n)].map(() => [0, 0, 0, 0, 0, 0]);
    for (let f = 1; f <= 5; f++) D[0][f] = (f === 1 && black[0] ? 2.5 : 0) + (f === 5 && black[0] ? 1 : 0) + (f === 1 ? 0 : 0.2);
    for (let i = 1; i < n; i++) for (let fb = 1; fb <= 5; fb++) for (let fa = 1; fa <= 5; fa++) {
      const c = D[i - 1][fa] + cost(fa, ps[i - 1], fb, ps[i], black[i]);
      if (c < D[i][fb]) { D[i][fb] = c; P[i][fb] = fa; }
    }
    let best = 1; for (let f = 2; f <= 5; f++) if (D[n - 1][f] < D[n - 1][best]) best = f;
    const out = Array(n); out[n - 1] = best;
    for (let i = n - 1; i > 0; i--) out[i - 1] = P[i][out[i]];
    return out;
  };

  /* ------------------------------------------------------------ chord names & voicings */
  const QUALITY_ALIASES = [
    ["maj13", "maj9"], ["maj9", "maj9"], ["maj7#11", "maj7s11"], ["maj7♯11", "maj7s11"], ["maj7", "maj7"], ["M7", "maj7"], ["Δ7", "maj7"], ["Δ", "maj7"],
    ["m(maj7)", "mMaj7"], ["mMaj7", "mMaj7"], ["m7b5", "hdim7"], ["m7♭5", "hdim7"], ["ø7", "hdim7"], ["ø", "hdim7"],
    ["m11", "min11"], ["m9", "min9"], ["m7", "min7"], ["-7", "min7"], ["m6", "min6"], ["min", "min"], ["m", "min"], ["-", "min"],
    ["dim7", "dim7"], ["°7", "dim7"], ["o7", "dim7"], ["dim", "dim"], ["°", "dim"], ["o", "dim"],
    ["aug7", "aug7"], ["7#5", "aug7"], ["7♯5", "aug7"], ["+7", "aug7"], ["aug", "aug"], ["+", "aug"],
    ["7sus4", "sus47"], ["7sus", "sus47"], ["sus4", "sus4"], ["sus2", "sus2"], ["sus", "sus4"], ["add9", "add9"], ["add2", "add9"],
    ["7b9", "dom7b9"], ["7♭9", "dom7b9"], ["7#9", "dom7s9"], ["7♯9", "dom7s9"], ["13", "dom13"], ["11", "dom11"], ["9", "dom9"], ["7", "dom7"], ["6", "maj6"], ["5", "pow"], ["", "maj"],
  ];
  /** "Cmaj7", "F#m7b5", "B♭7/D", "Am" → {root(pc), quality(MB.CHORDS 키), bass(pc|null), sym, flat} */
  PN.parseChord = function (name) {
    const mm = /^\s*([A-Ga-g])([#♯b♭]?)(.*?)(?:\/([A-Ga-g][#♯b♭]?))?\s*$/.exec(name || "");
    if (!mm) return null;
    const root = MB.mod(MB.parseNote(mm[1].toUpperCase() + (mm[2] || "") + "4"), 12);
    const rest = mm[3] || "";
    const hit = QUALITY_ALIASES.find(([s]) => rest === s) || QUALITY_ALIASES.find(([s]) => s && rest.startsWith(s));
    const quality = hit ? hit[1] : "maj";
    const bass = mm[4] ? MB.mod(MB.parseNote(mm[4][0].toUpperCase() + mm[4].slice(1) + "4"), 12) : null;
    const flat = /[#♯]/.test(mm[2] || "") ? false : /[b♭]/.test(mm[2] || "") || MB.prefersFlats(root, quality === "min" || quality === "min7" || quality === "min6");
    return { root, quality, bass, flat, sym: MB.chordSymbol(root, quality, flat, bass), iv: MB.CHORDS[quality].iv };
  };
  const asChord = (c) => (typeof c === "string" ? PN.parseChord(c) : c);
  /** m 이상의 가장 가까운 pc 음 */
  PN.above = (pc, m) => m + MB.mod(pc - m, 12);
  /** 범위 [lo, hi] 안에서 center에 가장 가까운 pc 음 */
  PN.nearestPc = (pc, center) => { const a = PN.above(pc, center - 6); return a; };
  /**
   * 보이싱. chord는 이름 또는 parseChord 결과. type:
   *   close(밀집, 오른손 3·4음, 왼손 근음) · open(왼손 근음+5도, 오른손 3·7·(9)) · shell(왼손 근음–3·7 둘)
   *   rootlessA(3·5·7·9, 속7은 3·13·7·9) · rootlessB(7·9·3·5, 속7은 7·9·3·13) · drop2(밀집 4음에서 위에서 둘째를 옥타브 내림)
   * o: {center(오른손 꼭대기 근처, 기본 67), bass(왼손 근음 범위 하한, 기본 36), inversion, prev(이전 오른손, 보이스 리딩)}
   * → {lh:[], rh:[], all:[] (정렬), chord}
   */
  PN.voicing = function (chord, type = "close", o = {}) {
    const c = asChord(chord); if (!c) return { lh: [], rh: [], all: [] };
    const iv = c.iv.map((x) => MB.mod(x, 12));
    const has = (x) => iv.includes(x);
    const third = has(4) ? 4 : has(3) ? 3 : has(5) ? 5 : has(2) ? 2 : 4;
    const fifth = has(7) ? 7 : has(6) ? 6 : has(8) ? 8 : 7;
    const seventh = has(10) ? 10 : has(11) ? 11 : has(9) && c.quality === "dim7" ? 9 : null;
    const bassLo = o.bass != null ? o.bass : 36;
    const bassPc = c.bass != null ? c.bass : c.root;
    const bassNote = PN.above(bassPc, bassLo);
    const center = o.center != null ? o.center : 67;
    const pcs = (arr) => arr.map((x) => MB.mod(c.root + x, 12));
    const stackUnder = (ivs, top) => { // ivs를 아래에서 위로 쌓되 꼭대기가 top 근처
      const out = []; let m = PN.above(MB.mod(c.root + ivs[0], 12), top - 14);
      out.push(m);
      for (let i = 1; i < ivs.length; i++) { m = PN.above(MB.mod(c.root + ivs[i], 12), m + 1); out.push(m); }
      while (out[out.length - 1] > top + 5) out.forEach((_, i) => (out[i] -= 12));
      while (out[out.length - 1] < top - 6) out.forEach((_, i) => (out[i] += 12));
      return out;
    };
    let lh = [], rh = [];
    const ninth = 2, dom = c.quality.startsWith("dom") || c.quality === "sus47" || c.quality === "aug7";
    if (type === "close") {
      const tones = c.iv.filter((x) => x < 12);
      if (o.prev && o.prev.length) rh = MB.voiceLead(o.prev, [...new Set(pcs(tones))], [center - 14, center + 7]);
      else { let inv = o.inversion || 0; const base = tones.map((x) => x); for (let k = 0; k < inv; k++) base.push(base.shift() + 12); rh = stackUnder(base, center); }
      lh = [bassNote];
    } else if (type === "open") {
      lh = [bassNote, bassNote + 7 + (fifth - 7)];
      rh = stackUnder(seventh != null ? [third, seventh, ninth + 12] : [third, 12, third + 12].map((x) => x), center);
    } else if (type === "shell") {
      const lo = Math.max(bassNote + 7, o.low != null ? o.low : 46);
      const a = PN.above(MB.mod(c.root + third, 12), lo), b = seventh != null ? PN.above(MB.mod(c.root + seventh, 12), lo) : PN.above(MB.mod(c.root + fifth, 12), lo);
      lh = [bassNote, ...[a, b].sort((x, y) => x - y)];
    } else if (type === "rootlessA" || type === "rootlessB") {
      const sev = seventh != null ? seventh : 11;
      const top = dom ? 9 : fifth;
      const A = [third, top, sev, ninth + 12], Bf = [sev, ninth + 12, third + 12, top + 12];
      const ivs = type === "rootlessA" ? A : Bf;
      const lo = o.low != null ? o.low : 50; // 가장 낮은 음을 D3–C4 근처에
      let m0 = PN.above(MB.mod(c.root + ivs[0], 12), lo);
      lh = [m0]; for (let i = 1; i < ivs.length; i++) lh.push(PN.above(MB.mod(c.root + ivs[i], 12), lh[i - 1] + 1));
    } else if (type === "drop2") {
      const tones = (seventh != null ? [0, third, fifth, seventh] : [0, third, fifth, 12]);
      let close = stackUnder(tones, center);
      if (o.inversion) for (let k = 0; k < o.inversion; k++) { close.push(close.shift() + 12); }
      close.sort((x, y) => x - y);
      const d = close.splice(close.length - 2, 1)[0] - 12;
      rh = [d, ...close].sort((x, y) => x - y);
      lh = [bassNote];
    } else {
      rh = stackUnder(c.iv, center); lh = [bassNote];
    }
    return { lh, rh, all: [...lh, ...rh].sort((x, y) => x - y), chord: c };
  };

  /* ------------------------------------------------------------ accompaniment patterns */
  /** 반주 패턴: 이름 → {name, beats(기본 길이), meter} */
  PN.ACCOMP = {
    block:   { name: "블록 코드(온음표)", beats: 4 },
    pulse:   { name: "4분 블록", beats: 4 },
    root5:   { name: "근음–5도 + 코드", beats: 4 },
    alberti: { name: "알베르티 베이스", beats: 4 },
    arp:     { name: "아르페지오(1–5–8–10)", beats: 4 },
    ballad:  { name: "발라드(8분 분산)", beats: 4 },
    waltz:   { name: "왈츠(쿵–짝–짝)", beats: 3 },
    stride:  { name: "스트라이드", beats: 4 },
    bossa:   { name: "보사노바", beats: 4 },
    boogie:  { name: "부기우기(왼손 8분)", beats: 4 },
    charleston: { name: "찰스턴 컴핑", beats: 4 },
  };
  /**
   * 코드 하나에 대한 반주 이벤트. PN.accomp("Am", "alberti", {beats, t0, bass, center, prev, vel})
   * → {events:[{t, d, m|ms, hand:"L"|"R", vel}], rh(오른손 보이싱, 다음 코드의 prev로)}
   */
  PN.accomp = function (chord, pattern = "block", o = {}) {
    const c = asChord(chord); const beats = o.beats || (PN.ACCOMP[pattern] || {}).beats || 4, t0 = o.t0 || 0;
    const v = PN.voicing(c, "close", { center: o.center != null ? o.center : 67, bass: o.bass, prev: o.prev });
    const R = v.lh[0], third = PN.above(MB.mod(c.root + c.iv[1], 12), R + 1), fifth = PN.above(MB.mod(c.root + (c.iv[2] != null ? c.iv[2] : 7), 12), R + 1);
    const vel = o.vel != null ? o.vel : 0.62, rv = vel * 0.95, E = [];
    const L = (t, d, m, k = 1) => { if (t < beats - 1e-6) E.push({ t: t0 + t, d: Math.min(d, beats - t), m, hand: "L", vel: vel * k }); };
    const Rh = (t, d, ms, k = 1) => { if (t < beats - 1e-6) E.push({ t: t0 + t, d: Math.min(d, beats - t), ms, hand: "R", vel: rv * k }); };
    const lowTri = MB.voiceLead([R, R + 4, R + 7].map((x) => x + 12), [c.root, MB.mod(c.root + c.iv[1], 12), MB.mod(c.root + (c.iv[2] != null ? c.iv[2] : 7), 12)], [R + 5, R + 22]);
    switch (pattern) {
      case "pulse": for (let b = 0; b < beats; b++) { if (b % 2 === 0) L(b, 2, R); Rh(b, 0.9, v.rh, b % 2 ? 0.8 : 1); } break;
      case "root5": for (let b = 0; b < beats; b += 2) { L(b, 2, b % 4 === 0 ? R : fifth - (fifth - R > 9 ? 12 : 0)); } Rh(0, beats, v.rh); break;
      case "alberti": { const [lo, mid, hi] = lowTri; const seq = [lo, hi, mid, hi]; for (let i = 0; i < beats * 2; i++) L(i / 2, 0.5, seq[i % 4], i % 4 === 0 ? 1 : 0.8); break; }
      case "arp": { const seq = [R, R + 7 + (fifth - R - 7), R + 12, third + 12, R + 12, fifth]; for (let i = 0; i < beats * 2; i++) L(i / 2, 0.5 * (i === 0 ? 2 : 1), seq[i % seq.length], i === 0 ? 1 : 0.78); Rh(0, beats, v.rh, 0.85); break; }
      case "ballad": { const seq = [R, fifth, R + 12, third + 12, R + 24 > 72 ? R + 12 : third + 12, R + 12, fifth, R + 12]; for (let i = 0; i < beats * 2; i++) L(i / 2, 0.5, seq[i % 8], i % 8 === 0 ? 1 : 0.72); Rh(0, beats, v.rh, 0.8); break; }
      case "waltz": for (let b = 0; b < beats; b++) { if (b % 3 === 0) L(b, 1, R); else Rh(b, 0.85, lowTri, 0.7); } break;
      case "stride": for (let b = 0; b < beats; b++) { if (b % 2 === 0) L(b, 0.9, b % 4 === 0 ? R - 12 >= 28 ? R - 12 : R : fifth - 12 >= 28 ? fifth - 12 : fifth); else E.push({ t: t0 + b, d: 0.8, ms: lowTri, hand: "L", vel: vel * 0.75 }); } break;
      case "bossa": { const f5 = fifth - (fifth - R > 9 ? 12 : 0); L(0, 1.5, R); L(1.5, 0.5, f5, 0.8); L(2, 1.5, f5); L(3.5, 0.5, R, 0.8); [[0, 0.5], [1.5, 0.5], [3, 0.5]].forEach(([t, d]) => Rh(t, d, v.rh, 0.75)); if (beats > 4) for (let b = 4; b < beats; b += 4) { L(b, 1.5, R); L(b + 1.5, 0.5, f5, 0.8); L(b + 2, 1.5, f5); L(b + 3.5, 0.5, R, 0.8); } break; }
      case "boogie": { const ivs = [0, 4, 7, 9, 10, 9, 7, 4]; for (let i = 0; i < beats * 2; i++) L(i / 2, 0.5, R + ivs[i % 8], i % 2 ? 0.75 : 1); break; }
      case "charleston": L(0, 1, R); L(2, 1, fifth - (fifth - R > 9 ? 12 : 0), 0.85); Rh(0, 0.7, v.rh); Rh(1.5, 0.5, v.rh, 0.85); break;
      default: L(0, beats, R); Rh(0, beats, v.rh); break;
    }
    return { events: E, rh: v.rh, lh: v.lh, chord: c };
  };
  /**
   * 코드 진행 반주. chords: ["C","Am",…] 또는 [{name, beats}] → {events, chords:[{t, name}], length}
   * 오른손은 앞 코드에서 가장 가깝게(보이스 리딩) 이어진다.
   */
  PN.progEvents = function (chords, pattern = "block", o = {}) {
    let t = 0, prev = o.prev || null; const E = [], marks = [];
    const per = o.beats || (PN.ACCOMP[pattern] || {}).beats || 4;
    chords.forEach((ch) => {
      const nm = typeof ch === "string" ? ch : ch.name, b = typeof ch === "string" ? per : ch.beats || per;
      if (!nm || nm === "-" || nm === "%") { t += b; return; }
      const r = PN.accomp(nm, pattern, Object.assign({}, o, { beats: b, t0: t, prev: o.lead === false ? null : prev }));
      E.push(...r.events); marks.push({ t, name: r.chord.sym }); prev = r.rh; t += b;
    });
    return { events: E, chords: marks, length: t };
  };

  /* ------------------------------------------------------------ recorder & MIDI */
  /** 피아노에서 나는 음을 기록. rec.start() · rec.stop() → [{t(초), d(초), m, vel}] · rec.toBeats(bpm, grid) */
  PN.recorder = function (piano) {
    let on = false, t0 = 0; const open = new Map(), out = [], pedals = [];
    piano.on((ev) => {
      if (!on) return;
      if (ev.type === "on") { const n = { t: ev.when - t0, d: 0.1, m: ev.m, vel: ev.vel }; open.set(ev.m, n); out.push(n); }
      else if (ev.type === "off") { const n = open.get(ev.m); if (n) { n.d = Math.max(0.03, ev.when - t0 - n.t); open.delete(ev.m); } }
      else if (ev.type === "pedal") pedals.push({ t: ev.when - t0, pedal: ev.value });
    });
    return {
      start() { out.length = 0; pedals.length = 0; open.clear(); t0 = MB.now(); on = true; },
      stop() { on = false; const now = MB.now() - t0; open.forEach((n) => (n.d = Math.max(0.03, now - n.t))); open.clear(); return out.slice(); },
      get recording() { return on; },
      get notes() { return out.slice(); },
      get pedals() { return pedals.slice(); },
      get elapsed() { return on ? MB.now() - t0 : 0; },
      /** 초 → 박, grid(박)로 양자화(0이면 그대로) */
      toBeats(bpm, grid = 0) {
        const q = (x) => (grid ? Math.round(x / grid) * grid : x);
        return out.map((n) => ({ t: q((n.t * bpm) / 60), d: Math.max(grid || 0.05, q((n.d * bpm) / 60)), m: n.m, vel: n.vel }));
      },
    };
  };
  /** Web MIDI 입력: await PN.midiIn(cb) → {stop(), names}. cb({type:"on"|"off"|"pedal"|"cc", m, vel, cc, value}) */
  PN.midiIn = async function (cb) {
    if (!navigator.requestMIDIAccess) throw new Error("이 브라우저는 Web MIDI를 지원하지 않습니다(Chrome·Edge 권장).");
    const access = await navigator.requestMIDIAccess();
    const handler = (e) => {
      const [st, a, b] = e.data, type = st & 0xf0;
      if (type === 0x90 && b > 0) cb({ type: "on", m: a, vel: b / 127 });
      else if (type === 0x80 || (type === 0x90 && b === 0)) cb({ type: "off", m: a });
      else if (type === 0xb0 && a === 64) cb({ type: "pedal", value: b / 127 });
      else if (type === 0xb0) cb({ type: "cc", cc: a, value: b / 127 });
    };
    const inputs = [...access.inputs.values()];
    inputs.forEach((i) => i.addEventListener("midimessage", handler));
    access.onstatechange = (e) => { if (e.port.type === "input" && e.port.state === "connected") e.port.addEventListener("midimessage", handler); };
    return { names: inputs.map((i) => i.name), stop() { [...access.inputs.values()].forEach((i) => i.removeEventListener("midimessage", handler)); access.onstatechange = null; } };
  };
  /** 피아노에 MIDI 입력을 바로 연결 */
  PN.connectMidi = (piano, extra) => PN.midiIn((ev) => {
    if (ev.type === "on") piano.noteOn(ev.m, ev.vel);
    else if (ev.type === "off") piano.noteOff(ev.m);
    else if (ev.type === "pedal") piano.pedal(ev.value >= 0.5 ? 1 : ev.value > 0.2 ? ev.value : 0);
    extra && extra(ev);
  });

  /* ------------------------------------------------------------ keyboard widget */
  const QWERTY = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ";": 16, "'": 17 };
  PN.QWERTY = QWERTY;
  const keyboards = [];
  let activeKb = null;
  function pickKeyboard() {
    if (activeKb && document.body.contains(activeKb.el)) { const r = activeKb.el.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight && r.width) return activeKb; activeKb = null; }
    let best = null, bd = Infinity; const mid = innerHeight / 2;
    keyboards.forEach((kb) => { if (!kb.qwerty || !document.body.contains(kb.el)) return; const r = kb.el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight || !r.width) return; const d = Math.abs((r.top + r.bottom) / 2 - mid); if (d < bd) { bd = d; best = kb; } });
    return best;
  }
  const downKeys = new Map();
  document.addEventListener("keydown", (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const tg = e.target; if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) && tg.type !== "range" && tg.type !== "checkbox")) return;
    const k = e.key.toLowerCase();
    const kb = pickKeyboard(); if (!kb) return;
    if (k === "z" || k === "x") { kb.shiftOctave(k === "z" ? -1 : 1); e.preventDefault(); return; }
    if (k === " " && kb.spacePedal) { kb.piano.pedal(true); kb.el.classList.add("pedal"); e.preventDefault(); return; }
    if (!(k in QWERTY)) return;
    const m = kb.qwertyBase + QWERTY[k];
    if (downKeys.has(k)) return;
    downKeys.set(k, { kb, m });
    kb.press(m, kb.opts.vel != null ? kb.opts.vel : 0.72, "key");
    e.preventDefault();
  });
  document.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (k === " ") { const kb = pickKeyboard(); if (kb && kb.spacePedal) { kb.piano.pedal(false); kb.el.classList.remove("pedal"); e.preventDefault(); } return; }
    const d = downKeys.get(k); if (!d) return;
    downKeys.delete(k); d.kb.release(d.m, "key");
  });
  window.addEventListener("blur", () => { downKeys.forEach((d) => d.kb.release(d.m, "key")); downKeys.clear(); });

  /**
   * 건반 위젯. PN.keyboard(sel, {from:48, to:72, labels:"none"|"names"|"octave"|"solfege"|"ko"|"degrees"|"midi"|"c",
   *   root(도수 표기 기준 pc), flat, play:true, vel(고정 벨로시티, 없으면 건반 앞쪽을 누를수록 세게), piano, qwerty:true,
   *   spacePedal, onDown(m, vel), onUp(m), follow:true(피아노 소리를 건반 눌림으로 표시), compact, height})
   *   → {el, piano, mark(list, cls), set(list, cls), clear(cls), unmark(m), flash(m, ms, cls), down(m), up(m),
   *      press(m, vel), release(m), setRange(from, to), setLabels(mode, root), shiftOctave(±1), range}
   * mark 목록은 MIDI 번호 또는 {m, label, cls}. 점 cls: mark alt root ok bad ghost dim finger(손가락 번호 원)
   */
  PN.keyboard = function (sel, o = {}) {
    const host = $(sel); host.classList.add("pn-kb");
    if (o.compact) host.classList.add("compact");
    const piano = o.piano || PN.piano();
    const st = { from: PN.snapWhite(o.from != null ? o.from : 48, -1), to: PN.snapWhite(o.to != null ? o.to : 72, 1), labels: o.labels || "none", root: o.root || 0, flat: !!o.flat };
    const marks = new Map(); // m → {cls, label}
    let svg, geo; const downSet = new Set();
    const api = { el: host, piano, opts: o, qwerty: o.qwerty !== false, spacePedal: !!o.spacePedal, qwertyBase: 60 };
    function geometry() {
      const whites = []; for (let m = st.from; m <= st.to; m++) if (PN.isWhite(m)) whites.push(m);
      const ww = 24, wh = o.height || 120, bw = 14, bh = Math.round(wh * 0.63);
      const x = new Map();
      whites.forEach((m, i) => x.set(m, i * ww));
      const OFF = { 1: -1.5, 3: 1.5, 6: -2, 8: 0, 10: 2 };
      for (let m = st.from; m <= st.to; m++) if (PN.isBlack(m)) x.set(m, x.get(m - 1) + ww - bw / 2 + OFF[MB.mod(m, 12)]);
      return { whites, ww, wh, bw, bh, x, W: whites.length * ww, top: 4 };
    }
    function labelFor(m) {
      const pc = MB.mod(m, 12);
      switch (st.labels) {
        case "names": return MB.pcName(pc, st.flat);
        case "octave": return MB.noteName(m, st.flat);
        case "solfege": return PN.isWhite(m) ? PN.SOLFEGE[pc] : "";
        case "ko": return PN.isWhite(m) ? PN.KO_LETTERS[PN.LETTERS[PN.WHITE_PCS.indexOf(pc)]] : "";
        case "degrees": return GTL[MB.mod(m - st.root, 12)];
        case "midi": return String(m);
        case "c": return pc === 0 ? "C" + (Math.floor(m / 12) - 1) : "";
        case "white": return PN.isWhite(m) ? MB.pcName(pc) : "";
        default: return "";
      }
    }
    function render() {
      geo = geometry(); const g = geo, P = [];
      const minW = Math.round(g.whites.length * (o.minKey || 15));
      P.push(`<svg viewBox="-1 0 ${g.W + 2} ${g.wh + g.top + 2}" style="min-width:${minW}px" role="img" aria-label="피아노 건반">`);
      P.push(`<rect class="felt" x="-1" y="0" width="${g.W + 2}" height="${g.top + 1}"/>`);
      const key = (m, black) => {
        const x = g.x.get(m), w = black ? g.bw : g.ww, h = black ? g.bh : g.wh;
        const lab = labelFor(m);
        let s = `<g class="k ${black ? "bk" : "wk"}${m === 60 ? " mid" : ""}" data-m="${m}"><rect x="${x + (black ? 0 : 0.5)}" y="${g.top}" width="${w - (black ? 0 : 1)}" height="${h}" rx="${black ? 2 : 3}"/>`;
        if (lab) s += `<text class="kl" x="${x + w / 2}" y="${g.top + h - (black ? 6 : 8)}">${lab}</text>`;
        return s + `</g>`;
      };
      g.whites.forEach((m) => P.push(key(m, false)));
      for (let m = st.from; m <= st.to; m++) if (PN.isBlack(m)) P.push(key(m, true));
      P.push(`<g class="dots"></g></svg>`);
      host.innerHTML = P.join("");
      svg = host.querySelector("svg");
      svg.querySelectorAll(".k").forEach((k) => { const m = +k.dataset.m; if (downSet.has(m)) k.classList.add("down"); });
      drawMarks(); bind();
    }
    function drawMarks() {
      const layer = svg.querySelector(".dots"); if (!layer) return;
      const g = geo, P = [];
      marks.forEach((mk, m) => {
        if (m < st.from || m > st.to || !g.x.has(m)) return;
        const black = PN.isBlack(m), w = black ? g.bw : g.ww;
        const cx = g.x.get(m) + w / 2, cy = g.top + (black ? g.bh - 22 : g.wh - 30), r = black ? 6 : 8;
        P.push(`<g class="dot ${mk.cls || "mark"}" data-m="${m}"><circle cx="${cx}" cy="${cy}" r="${r}"/>${mk.label != null && mk.label !== "" ? `<text x="${cx}" y="${cy + 3.5}">${mk.label}</text>` : ""}</g>`);
      });
      layer.innerHTML = P.join("");
    }
    // 포인터: 누른 채 미끄러지면 글리산도
    const pointers = new Map();
    function keyFrom(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const k = el && el.closest && el.closest(".pn-kb .k");
      if (!k || !host.contains(k)) return null;
      const m = +k.dataset.m, r = k.getBoundingClientRect();
      const vel = o.vel != null ? o.vel : clamp(0.3 + 0.65 * ((e.clientY - r.top) / Math.max(1, r.height)), 0.2, 0.98);
      return { m, vel };
    }
    function bind() {
      svg.addEventListener("pointerdown", (e) => {
        if (e.button > 0) return;
        const hit = keyFrom(e); if (!hit) return;
        activeKb = api; e.preventDefault();
        try { svg.setPointerCapture(e.pointerId); } catch (er) {}
        pointers.set(e.pointerId, hit.m); api.press(hit.m, hit.vel, "pointer");
      });
      svg.addEventListener("pointermove", (e) => {
        if (!pointers.has(e.pointerId)) return;
        const hit = keyFrom(e); const cur = pointers.get(e.pointerId);
        if (!hit || hit.m === cur) return;
        api.release(cur, "pointer"); pointers.set(e.pointerId, hit.m); api.press(hit.m, hit.vel, "pointer");
      });
      const end = (e) => { if (!pointers.has(e.pointerId)) return; api.release(pointers.get(e.pointerId), "pointer"); pointers.delete(e.pointerId); };
      svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end); svg.addEventListener("lostpointercapture", end);
    }
    let warmed = false; const playedSet = new Set();
    api.press = function (m, vel = 0.72, src = "api") {
      if (!warmed) { warmed = true; MB.ctx(); PN.warm(range(st.from, st.to)); }
      let ok = true;
      if (o.onDown) ok = o.onDown(m, vel, src) !== false;
      if (ok && o.play !== false) { piano.noteOn(m, vel); playedSet.add(m); }
      else api.down(m);
      return api;
    };
    api.release = function (m, src = "api") {
      if (o.onUp) o.onUp(m, src);
      if (o.play !== false && playedSet.delete(m)) piano.noteOff(m); else api.up(m);
      return api;
    };
    const range = (a, b) => { const r = []; for (let m = a; m <= b; m++) r.push(m); return r; };
    api.down = (m) => { downSet.add(m); const k = svg && svg.querySelector(`.k[data-m="${m}"]`); if (k) k.classList.add("down"); return api; };
    api.up = (m) => { downSet.delete(m); const k = svg && svg.querySelector(`.k[data-m="${m}"]`); if (k) k.classList.remove("down"); return api; };
    if (o.follow !== false) piano.on((ev) => {
      if (ev.type === "on") PN.at(ev.when, () => api.down(ev.m));
      else if (ev.type === "off") PN.at(ev.when, () => api.up(ev.m));
      else if (ev.type === "pedal") PN.at(ev.when, () => host.classList.toggle("pedal", ev.value > 0.15));
    });
    const norm = (it) => (typeof it === "number" ? { m: it } : it);
    api.mark = (list, cls) => { (Array.isArray(list) ? list : [list]).forEach((it) => { const n = norm(it); marks.set(n.m, { cls: n.cls || cls || "mark", label: n.label }); }); drawMarks(); return api; };
    api.clear = (cls) => { if (!cls) marks.clear(); else [...marks].forEach(([m, mk]) => { if (mk.cls === cls) marks.delete(m); }); drawMarks(); return api; };
    api.set = (list, cls) => { api.clear(cls); return api.mark(list, cls); };
    api.unmark = (m) => { marks.delete(m); drawMarks(); return api; };
    api.has = (m) => marks.has(m);
    api.flash = (m, ms = 500, cls = "on") => {
      const layer = svg.querySelector(".dots"); if (!layer || !geo.x.has(m)) return api;
      const black = PN.isBlack(m), w = black ? geo.bw : geo.ww, cx = geo.x.get(m) + w / 2, cy = geo.top + (black ? geo.bh - 22 : geo.wh - 30);
      const gg = document.createElementNS(SVGNS, "g"); gg.setAttribute("class", "dot " + cls);
      gg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${black ? 6 : 8}"/>`;
      layer.appendChild(gg); setTimeout(() => gg.remove(), ms);
      return api;
    };
    api.setRange = (from, to) => { st.from = PN.snapWhite(from, -1); st.to = PN.snapWhite(to, 1); fixBase(); render(); return api; };
    api.setLabels = (mode, root) => { st.labels = mode; if (root != null) st.root = root; render(); return api; };
    api.setFlat = (f) => { st.flat = !!f; render(); return api; };
    function fixBase() { let b = st.from + MB.mod(-st.from, 12); if (b + 12 > st.to + 1) b = st.from + MB.mod(-st.from, 12) - 12; if (b < st.from - 12) b = st.from; api.qwertyBase = o.qwertyBase != null ? o.qwertyBase : clamp(60, st.from + MB.mod(-st.from, 12), Math.max(st.from, st.to - 11)); if (MB.mod(api.qwertyBase, 12)) api.qwertyBase += MB.mod(-api.qwertyBase, 12); }
    api.shiftOctave = (d) => { api.qwertyBase = clamp(api.qwertyBase + 12 * d, 24, 96); o.onOctave && o.onOctave(api.qwertyBase); return api; };
    Object.defineProperty(api, "range", { get: () => [st.from, st.to] });
    Object.defineProperty(api, "labels", { get: () => st.labels });
    host.addEventListener("pointerenter", () => { if (api.qwerty) activeKb = api; });
    fixBase(); render();
    keyboards.push(api);
    return api;
  };
  const GTL = ["R", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];
  PN.IV_LABELS = GTL;
  PN.intervalLabel = (semis) => GTL[MB.mod(semis, 12)];

  /* ------------------------------------------------------------ staff widget */
  const TREBLE_PATH = "M13.6 58.5c-1.6 4.8-8.6 4-8.9-1.3-.2-3.9 4.6-5.6 6.6-2.8 1.6 2.3-.3 5.3-2.9 4.3 M13.6 58.5c1.2-6.5.2-25-1.1-35.5-1.4-10.6.3-21.6 5.6-25.5 3.6-2.7 5.4 3.4 3.8 8.7-2.6 8.8-14.6 15.8-16.6 25.7-1.8 9.1 4.9 15.2 11.9 13.6 6.5-1.5 7.5-11.1 1.1-12.9-5.8-1.6-9.9 4.5-6.4 8.6";
  const BASS_PATH = "M3 4.5c1.5-4.8 9.6-6 12.6-.8 3.7 6.4-2.3 17.6-13.4 23.8 M3 4.5c-.6 2.3 1.2 4.3 3.5 3.9 2.2-.4 2.7-3.5.8-4.6";
  /**
   * 악보(오선) 위젯. PN.staff(sel, notes, {clef:"treble"|"bass"|"grand", key(조표 수 −7..7), time:[4,4], bars, barsPerLine,
   *   width(viewBox 폭, 기본 760), chords:[{t,name}], marks:[{t, text, staff:"treble"|"bass", where:"above"|"below"}],
   *   pedal:[{t0,t1}], names(음 이름 표시: true|"ko"|"solfege"), rests:true, split(큰보표에서 손 지정 없을 때 경계, 60),
   *   fingering:true, onClick(i, note), onPick({step, m, staff, t}), compact, endBar:true, beam:true})
   * 음표 {t(박), d(박: 4 2 1 .5 .25, 점음표 3 1.5 .75), m | ms:[…], hand:"R"|"L"|staff 지정 "treble"|"bass",
   *   spell:"E♭"(철자 강제), finger, tie(다음 같은 음으로 붙임줄), cls, label, rest:true}
   * → {el, highlight(i), at(beat), clear(), setNotes(notes, opts), notes, layout}
   */
  PN.staff = function (sel, notes, o = {}) {
    const host = $(sel); host.classList.add("pn-staff");
    let opts = Object.assign({ clef: "treble", key: 0, time: [4, 4], width: 760, rests: true, beam: true, fingering: true, endBar: true, split: 60 }, o);
    let list = [], lay = null;
    const SP = 10; // 줄 간격
    const api = { el: host };
    function staffOf(n) {
      if (opts.clef !== "grand") return opts.clef;
      if (n.staff) return n.staff;
      if (n.hand === "L") return "bass"; if (n.hand === "R") return "treble";
      const ms = n.ms || [n.m]; const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
      return avg >= opts.split ? "treble" : "bass";
    }
    const TOP = { treble: 38, bass: 26 }; // 맨 윗줄의 step(F5, A3)
    function render() {
      const W = opts.width, bpb = (opts.time[0] * 4) / opts.time[1];
      const beamGroup = opts.beamGroup || (opts.time[1] === 8 && opts.time[0] % 3 === 0 ? 1.5 : 1);
      const k = opts.key || 0;
      const end = list.reduce((a, n) => Math.max(a, n.t + (n.d || 1)), 0);
      const bars = opts.bars || Math.max(1, Math.ceil(end / bpb - 1e-6));
      const staves = opts.clef === "grand" ? ["treble", "bass"] : [opts.clef];
      const clefW = 30, keyW = Math.abs(k) * 8 + (k ? 6 : 0), timeW = opts.time && opts.showTime !== false ? 20 : 0;
      const left0 = 8 + clefW + keyW + timeW + 8, leftN = 8 + clefW + keyW + 8;
      const minBeat = opts.minBeat || (opts.compact ? 22 : 34);
      const bpl = opts.barsPerLine || Math.max(1, Math.min(bars, Math.floor((W - left0 - 8) / (bpb * minBeat + 14))));
      const lines = Math.ceil(bars / bpl);
      const hasF = opts.fingering && list.some((n) => n.finger != null);
      const aboveH = (opts.chords && opts.chords.length ? 34 : 24) + (hasF ? 22 : 0) + (opts.above || 0), staffH = SP * 4, gapGrand = 64 + (hasF && opts.clef === "grand" ? 16 : 0), below = 30 + (hasF ? 14 : 0) + (opts.names ? 6 : 0) + (opts.below || 0);
      const sysH = aboveH + staffH + (staves.length > 1 ? gapGrand + staffH : 0) + below;
      const H = lines * sysH + 4;
      const P = [];
      P.push(`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="악보">`);
      const sysInfo = [];
      for (let L = 0; L < lines; L++) {
        const y0 = L * sysH + aboveH;
        const yS = { [staves[0]]: y0 }; if (staves[1]) yS[staves[1]] = y0 + staffH + gapGrand;
        const left = L === 0 ? left0 : leftN;
        const b0 = L * bpl, b1 = Math.min(bars, b0 + bpl), nb = b1 - b0;
        const usable = W - left - 8;
        const barW = usable / bpl;
        const x0 = left;
        sysInfo.push({ y0, yS, b0, b1, x0, barW, bpb, left });
        // 오선
        staves.forEach((sname) => {
          const y = yS[sname];
          for (let i = 0; i < 5; i++) P.push(`<line class="sl" x1="6" y1="${y + i * SP}" x2="${x0 + nb * barW}" y2="${y + i * SP}"/>`);
          // 음자리표
          if (sname === "treble") P.push(`<path class="clef" d="${TREBLE_PATH}" transform="translate(10 ${y - 12}) scale(0.92)"/>`);
          else P.push(`<g transform="translate(11 ${y + 2})"><path class="clef" d="${BASS_PATH}"/><circle class="clefdot" cx="20" cy="${5}" r="1.7"/><circle class="clefdot" cx="20" cy="${15}" r="1.7"/></g>`);
          // 조표
          const accs = k > 0 ? PN.SHARP_ORDER.slice(0, k) : PN.FLAT_ORDER.slice(0, -k);
          const SHP = { treble: { F: 38, C: 35, G: 39, D: 36, A: 33, E: 37, B: 34 }, bass: { F: 24, C: 21, G: 25, D: 22, A: 19, E: 23, B: 20 } };
          const FLP = { treble: { B: 34, E: 37, A: 33, D: 36, G: 32, C: 35, F: 31 }, bass: { B: 20, E: 23, A: 19, D: 22, G: 18, C: 21, F: 17 } };
          accs.forEach((Lt, i) => {
            const step = (k > 0 ? SHP : FLP)[sname][Lt], yy = y + (TOP[sname] - step) * SP / 2;
            P.push(`<text class="acc ks" x="${8 + clefW + 4 + i * 8}" y="${yy + 4}">${k > 0 ? "♯" : "♭"}</text>`);
          });
          if (L === 0 && timeW) {
            const tx = 8 + clefW + keyW + 10;
            P.push(`<text class="tsig" x="${tx}" y="${y + SP * 2 - 1}">${opts.time[0]}</text><text class="tsig" x="${tx}" y="${y + SP * 4 - 1}">${opts.time[1]}</text>`);
          }
        });
        // 마디선
        const yTop = yS[staves[0]], yBot = yS[staves[staves.length - 1]] + staffH;
        P.push(`<line class="bar" x1="6" y1="${yTop}" x2="6" y2="${yBot}"/>`);
        if (staves.length > 1) P.push(`<path class="brace" d="M4 ${yTop} q-6 ${(yBot - yTop) / 4} 0 ${(yBot - yTop) / 2} q-6 ${(yBot - yTop) / 4} 0 ${(yBot - yTop) / 2}"/>`);
        for (let b = 1; b <= nb; b++) {
          const x = x0 + b * barW, last = b0 + b === bars && opts.endBar;
          staves.length > 1 ? P.push(`<line class="bar${last ? " end" : ""}" x1="${x}" y1="${yTop}" x2="${x}" y2="${yBot}"/>`) : P.push(`<line class="bar${last ? " end" : ""}" x1="${x}" y1="${yTop}" x2="${x}" y2="${yBot}"/>`);
          if (last) P.push(`<line class="bar thin" x1="${x - 4}" y1="${yTop}" x2="${x - 4}" y2="${yBot}"/>`);
        }
        if (opts.barNumbers !== false && L > 0) P.push(`<text class="barno" x="${x0}" y="${yTop - 6}">${b0 + 1}</text>`);
      }
      const xAt = (t) => { const b = Math.min(bars - 1, Math.floor(t / bpb + 1e-9)), si = sysInfo[Math.floor(b / bpl)]; const pad = 12; return { si, x: si.x0 + (b - si.b0) * si.barW + pad + ((t - b * bpb) / bpb) * (si.barW - pad - 6) }; };
      // 음표 배치
      const items = list.map((n, i) => {
        const sname = staffOf(n), ms = n.rest ? [] : (n.ms || [n.m]).slice().sort((a, b) => a - b);
        const sp = ms.map((m, j) => PN.spell(m, k, Array.isArray(n.spell) ? n.spell[j] : n.spell));
        return { n, i, sname, ms, sp, ...xAt(n.t + 1e-6) };
      });
      // 쉼표 자동 채우기
      const rests = [];
      if (opts.rests) staves.forEach((sname) => {
        for (let b = 0; b < bars; b++) {
          const a = b * bpb, z = a + bpb;
          const iv = items.filter((it) => it.sname === sname && it.n.t < z - 1e-6 && it.n.t + (it.n.d || 1) > a + 1e-6).map((it) => [Math.max(a, it.n.t), Math.min(z, it.n.t + (it.n.d || 1))]).sort((p, q) => p[0] - q[0]);
          if (!iv.length) { if (list.length || opts.clef === "grand") rests.push({ sname, t: a, d: bpb, whole: true }); continue; }
          let cur = a; const gaps = [];
          iv.forEach(([s, e]) => { if (s > cur + 1e-6) gaps.push([cur, s]); cur = Math.max(cur, e); });
          if (cur < z - 1e-6) gaps.push([cur, z]);
          gaps.forEach(([s, e]) => {
            let t = s;
            while (t < e - 1e-6) {
              let size = [4, 2, 1, 0.5, 0.25].find((sz) => sz <= e - t + 1e-6 && Math.abs(((t - a) / sz) - Math.round((t - a) / sz)) < 1e-6 && sz <= bpb) || 0.25;
              rests.push({ sname, t, d: size }); t += size;
            }
          });
        }
      });
      // 붙임줄·빔을 위한 보조
      const heads = [];
      const yOf = (sname, step, si) => si.yS[sname] + (TOP[sname] - step) * SP / 2;
      const midStep = { treble: 34, bass: 22 };
      // 빔 묶기
      const beamable = items.filter((it) => it.ms.length && (it.n.d || 1) < 1 - 1e-6 && opts.beam && !it.n.noBeam);
      const groups = new Map();
      beamable.forEach((it) => { const gk = it.sname + "|" + Math.floor(it.n.t / beamGroup + 1e-6) + "|" + (it.n.voice || 0); if (!groups.has(gk)) groups.set(gk, []); groups.get(gk).push(it); });
      const beamOf = new Map();
      groups.forEach((g) => { if (g.length >= 2) { g.sort((a, b) => a.n.t - b.n.t); g.forEach((it) => beamOf.set(it, g)); } });
      // 기둥 방향
      items.forEach((it) => {
        if (!it.ms.length) return;
        const g = beamOf.get(it), arr = g || [it];
        const steps = arr.flatMap((x) => x.sp.map((s) => s.step));
        const far = steps.reduce((a, s) => (Math.abs(s - midStep[it.sname]) > Math.abs(a - midStep[it.sname]) ? s : a), steps[0]);
        it.up = it.n.stem ? it.n.stem === "up" : far < midStep[it.sname] || (far === midStep[it.sname] && false);
      });
      const accState = new Map(); // 마디별 임시표 상태
      items.forEach((it) => {
        const { n, si, sname } = it; const x = it.x, d = n.d || 1;
        const cls = ["pn-n", n.cls || "", it.ms.length ? "" : "restn"].join(" ").trim();
        const G = [`<g class="${cls}" data-i="${it.i}">`];
        if (!it.ms.length) { G.push(restGlyph(x, si.yS[sname], d)); G.push(`</g>`); P.push(G.join("")); return; }
        const steps = it.sp.map((s) => s.step);
        const filled = d < 2 - 1e-6, stemmed = d < 4 - 1e-6;
        const dotted = [3, 1.5, 0.75, 0.375].some((v) => Math.abs(d - v) < 1e-6);
        // 2도 겹침: 기둥 반대쪽으로 머리를 민다
        const offs = steps.map(() => 0);
        for (let j = 1; j < steps.length; j++) if (steps[j] - steps[j - 1] === 1 && offs[j - 1] === 0) offs[j] = it.up ? 11 : -11;
        const barNo = Math.floor(n.t / bpb + 1e-9);
        // 덧줄
        const top = TOP[sname], bot = top - 8;
        const lo = Math.min(...steps), hi = Math.max(...steps);
        for (let s = bot - 2; s >= lo; s -= 2) G.push(`<line class="ledger" x1="${x - 8}" y1="${yOf(sname, s, si)}" x2="${x + 8 + (offs.some((v) => v > 0) ? 11 : 0)}" y2="${yOf(sname, s, si)}"/>`);
        for (let s = top + 2; s <= hi; s += 2) G.push(`<line class="ledger" x1="${x - 8}" y1="${yOf(sname, s, si)}" x2="${x + 8 + (offs.some((v) => v > 0) ? 11 : 0)}" y2="${yOf(sname, s, si)}"/>`);
        // 임시표
        let accCol = 0;
        it.sp.slice().reverse().forEach((s, jr) => {
          const j = it.sp.length - 1 - jr;
          const keyAcc = PN.keyAccidentals(k)[s.letter];
          const sk = sname + "|" + barNo + "|" + s.step;
          const prev = accState.has(sk) ? accState.get(sk) : keyAcc;
          if (s.acc !== prev || n.courtesy) {
            const sym = s.acc === 0 ? "♮" : PN.accStr(s.acc);
            G.push(`<text class="acc" x="${x - 17 - accCol * 8 + Math.min(0, offs[j])}" y="${yOf(sname, s.step, si) + 4}">${sym}</text>`);
            accCol = (accCol + 1) % 3;
          }
          accState.set(sk, s.acc);
        });
        // 머리
        it.sp.forEach((s, j) => {
          const y = yOf(sname, s.step, si), hx = x + offs[j];
          G.push(`<ellipse class="head${filled ? "" : " open"}" cx="${hx}" cy="${y}" rx="${d >= 4 ? 6.4 : 5.6}" ry="${d >= 4 ? 4.4 : 4.1}" transform="rotate(-18 ${hx} ${y})"/>`);
          heads.push({ it, j, x: hx, y, m: it.ms[j] });
          if (dotted) G.push(`<circle class="ndot" cx="${x + 10 + Math.max(0, ...offs)}" cy="${y - (s.step % 2 === 0 ? SP / 2 : 0)}" r="1.6"/>`);
        });
        // 기둥과 꼬리
        if (stemmed) {
          const yLo = yOf(sname, lo, si), yHi = yOf(sname, hi, si);
          const sx = it.up ? x + 5.2 : x - 5.2;
          const g = beamOf.get(it);
          let yEnd;
          if (g) {
            if (!g._beam) {
              const ends = g.map((q) => { const ql = Math.min(...q.sp.map((s) => s.step)), qh = Math.max(...q.sp.map((s) => s.step)); return it.up ? yOf(sname, qh, q.si) - 32 : yOf(sname, ql, q.si) + 32; });
              const first = g[0], last = g[g.length - 1];
              const fx = (first.up ? first.x + 5.2 : first.x - 5.2), lx = (last.up ? last.x + 5.2 : last.x - 5.2);
              let y1 = ends[0], y2 = ends[ends.length - 1];
              const slope = clamp((y2 - y1) / Math.max(1, lx - fx), -0.25, 0.25);
              // 모든 기둥이 최소 길이를 갖도록 빔을 평행 이동
              let shift = 0;
              g.forEach((q, qi) => { const qx = q.up ? q.x + 5.2 : q.x - 5.2; const yl = y1 + slope * (qx - fx); shift = it.up ? Math.min(shift, ends[qi] - yl) : Math.max(shift, ends[qi] - yl); });
              g._beam = { fx, y1: y1 + shift, slope, lx };
            }
            const bm = g._beam; yEnd = bm.y1 + bm.slope * (sx - bm.fx);
            if (g[g.length - 1] === it) {
              const yb = (xx) => bm.y1 + bm.slope * (xx - bm.fx);
              const dy = it.up ? 1 : -1;
              P.push(`<path class="beam" d="M${bm.fx} ${yb(bm.fx)} L${bm.lx} ${yb(bm.lx)} L${bm.lx} ${yb(bm.lx) + 4.5 * dy} L${bm.fx} ${yb(bm.fx) + 4.5 * dy}Z"/>`);
              // 16분음표 둘째 빔
              for (let q = 0; q < g.length; q++) {
                const a = g[q]; if ((a.n.d || 1) > 0.375) continue;
                const ax = a.up ? a.x + 5.2 : a.x - 5.2, nb = g[q + 1] && (g[q + 1].n.d || 1) <= 0.375 ? g[q + 1] : null;
                const bx = nb ? (nb.up ? nb.x + 5.2 : nb.x - 5.2) : q > 0 && (g[q - 1].n.d || 1) > 0.375 ? ax - 8 : ax + 8;
                if (nb || !(q > 0 && (g[q - 1].n.d || 1) <= 0.375)) {
                  const yy1 = yb(ax) + 7.5 * dy, yy2 = yb(bx) + 7.5 * dy;
                  P.push(`<path class="beam" d="M${ax} ${yy1} L${bx} ${yy2} L${bx} ${yy2 + 4 * dy} L${ax} ${yy1 + 4 * dy}Z"/>`);
                }
              }
            }
          } else yEnd = it.up ? Math.min(yHi - 32, yOf(sname, midStep[sname], si)) : Math.max(yLo + 32, yOf(sname, midStep[sname], si));
          it._yEnd = yEnd;
          G.push(`<line class="stem" x1="${sx}" y1="${it.up ? yLo - 1 : yHi + 1}" x2="${sx}" y2="${yEnd}"/>`);
          if (!beamOf.get(it) && d < 1 - 1e-6) {
            const nf = d <= 0.375 ? 2 : 1;
            for (let f = 0; f < nf; f++) {
              const yy = yEnd + (it.up ? f * 7 : -f * 7);
              G.push(it.up ? `<path class="flag" d="M${sx} ${yy} c1 6 9 8 7 17 c2-7-3-10-7-11"/>` : `<path class="flag" d="M${sx} ${yy} c1 -6 9 -8 7 -17 c2 7 -3 10 -7 11"/>`);
            }
          }
        }
        // 손가락 번호(높은음자리표는 위, 낮은음자리표는 아래), 음 이름, 라벨
        if (opts.fingering && n.finger != null) {
          const fs = Array.isArray(n.finger) ? n.finger.slice() : [n.finger];
          const above = n.fingerBelow ? false : n.fingerAbove ? true : sname === "treble";
          const yHiH = yOf(sname, hi, si), yLoH = yOf(sname, lo, si), sTop = si.yS[sname], sBot = sTop + staffH;
          const yStemEnd = stemmed ? it._yEnd : null;
          if (above) {
            let y = Math.min(sTop - 9, yHiH - 10, it.up && yStemEnd != null ? yStemEnd - 6 : Infinity);
            fs.slice().reverse().forEach((f, j) => G.push(`<text class="fing" x="${x}" y="${y - j * 10}">${f}</text>`));
          } else {
            let y = Math.max(sBot + 16, yLoH + 17, !it.up && yStemEnd != null ? yStemEnd + 14 : -Infinity);
            fs.forEach((f, j) => G.push(`<text class="fing" x="${x}" y="${y + j * 10}">${f}</text>`));
          }
        }
        if (opts.names) {
          const nm = it.sp.map((s) => (opts.names === "ko" ? s.ko : opts.names === "solfege" ? s.solfege : s.short)).reverse().join(" ");
          G.push(`<text class="nname" x="${x}" y="${si.yS[sname] + staffH + 22 + (it.up ? 0 : 6)}">${nm}</text>`);
        }
        if (n.label) G.push(`<text class="nlabel" x="${x}" y="${si.yS[sname] + staffH + (opts.names ? 34 : 22)}">${n.label}</text>`);
        G.push(`<rect class="nhit" x="${x - 10}" y="${si.yS[sname] - 24}" width="20" height="${staffH + 48}"/>`);
        G.push(`</g>`);
        P.push(G.join(""));
      });
      rests.forEach((r) => { const { si, x } = xAt(r.t + 1e-6); const xx = r.whole ? si.x0 + (Math.floor(r.t / bpb) - si.b0 + 0.5) * si.barW : x; P.push(`<g class="pn-rest">${restGlyph(xx, si.yS[r.sname], r.whole ? 4 : r.d, r.whole)}</g>`); });
      // 붙임줄
      items.forEach((it) => {
        if (!it.n.tie || !it.ms.length) return;
        const nx = items.find((q) => q.i > it.i && q.sname === it.sname && q.n.t >= it.n.t + (it.n.d || 1) - 1e-6 && q.ms.some((m) => it.ms.includes(m)));
        if (!nx) return;
        it.sp.forEach((s, j) => {
          if (!nx.ms.includes(it.ms[j])) return;
          const y = yOf(it.sname, s.step, it.si), dir = it.up ? 1 : -1, x1 = it.x + 6, x2 = nx.si === it.si ? nx.x - 6 : it.x + 26;
          P.push(`<path class="tie" d="M${x1} ${y + 5 * dir} Q${(x1 + x2) / 2} ${y + 13 * dir} ${x2} ${y + 5 * dir}"/>`);
        });
      });
      // 코드 기호, 표시, 페달
      (opts.chords || []).forEach((c) => { const { si, x } = xAt(c.t + 1e-6); P.push(`<text class="chname" x="${x - 4}" y="${si.yS[staves[0]] - 16}">${c.name}</text>`); });
      (opts.marks || []).forEach((mk) => {
        const { si, x } = xAt(mk.t + 1e-6), sname = mk.staff || staves[staves.length - 1];
        const y = mk.where === "above" ? si.yS[sname] - 14 : mk.where === "between" && staves.length > 1 ? si.yS.treble + staffH + gapGrand / 2 + 4 : si.yS[sname] + staffH + 22;
        P.push(`<text class="mark-t${/^[pmfsz]+$/.test(mk.text) ? " dyn" : ""}" x="${x}" y="${y}">${mk.text}</text>`);
      });
      (opts.pedal || []).forEach((pd) => {
        const a = xAt(pd.t0 + 1e-6), b = xAt(Math.max(pd.t0, pd.t1 - 1e-3));
        const sname = staves[staves.length - 1];
        if (a.si !== b.si) return;
        const y = a.si.yS[sname] + staffH + 24, x2 = pd.t1 >= bars * bpb - 1e-6 ? a.si.x0 + (bars - a.si.b0) * a.si.barW - 4 : xAt(pd.t1 + 1e-6).x - 6;
        P.push(`<path class="pedal" d="M${a.x - 4} ${y - 9} L${a.x - 4} ${y} L${x2} ${y} L${x2} ${y - 9}"/>`);
      });
      // 재생 표시선
      P.push(`<line class="playhead" x1="0" y1="0" x2="0" y2="0" style="display:none"/>`);
      // 클릭해서 음 고르기
      if (opts.onPick) sysInfo.forEach((si, L) => staves.forEach((sname) => P.push(`<rect class="pick" data-l="${L}" data-s="${sname}" x="${si.x0}" y="${si.yS[sname] - 30}" width="${(si.b1 - si.b0) * si.barW}" height="${staffH + 60}"/>`)));
      P.push(`</svg>`);
      host.innerHTML = P.join("");
      lay = { sysInfo, xAt, bpb, bars, staves, yOf, heads, items, H, W };
      const svg = host.querySelector("svg");
      if (opts.onClick) svg.querySelectorAll(".pn-n").forEach((g) => { g.style.cursor = "pointer"; g.addEventListener("click", () => opts.onClick(+g.dataset.i, list[+g.dataset.i])); });
      if (opts.onPick) svg.querySelectorAll(".pick").forEach((r) => r.addEventListener("pointerdown", (e) => {
        const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        const si = sysInfo[+r.dataset.l], sname = r.dataset.s;
        const step = Math.round(TOP[sname] - ((p.y - si.yS[sname]) * 2) / SP);
        const bi = Math.floor((p.x - si.x0) / si.barW), t = (si.b0 + bi) * bpb + clamp((p.x - si.x0 - bi * si.barW - 12) / (si.barW - 18), 0, 0.999) * bpb;
        opts.onPick({ step, m: PN.stepToMidi(step, k), staff: sname, t, x: p.x, y: p.y });
      }));
    }
    function restGlyph(x, y, d, whole) {
      if (whole || d >= 4) return `<rect class="rest" x="${x - 6}" y="${y + SP}" width="12" height="5"/>`;
      if (d >= 2) return `<rect class="rest" x="${x - 6}" y="${y + SP * 2 - 5}" width="12" height="5"/>`;
      if (d >= 1) return `<path class="rest q" d="M${x - 2} ${y + 6} l5 7 l-5 6 l5 7 c-5 -2 -7 2 -3 6 c-7 -3 -5 -10 1 -7 l-5 -6 l4 -6z"/>`;
      const fl = d <= 0.375 ? 2 : 1, P = [`<line class="rest-s" x1="${x + 3}" y1="${y + 12}" x2="${x - 2}" y2="${y + 30 + (fl - 1) * 6}"/>`];
      for (let f = 0; f < fl; f++) P.push(`<circle class="rest-d" cx="${x - 2 + f * -1.5}" cy="${y + 13 + f * 7}" r="2.4"/><path class="rest-s" d="M${x - 2 - f * 1.5} ${y + 14 + f * 7} q3 1 ${5 - f * 0.5} -2"/>`);
      return P.join("");
    }
    api.highlight = (i) => { host.querySelectorAll(".pn-n.now").forEach((g) => g.classList.remove("now")); (Array.isArray(i) ? i : [i]).forEach((j) => { if (j >= 0) host.querySelectorAll(`.pn-n[data-i="${j}"]`).forEach((g) => g.classList.add("now")); }); return api; };
    api.mark = (i, cls) => { host.querySelectorAll(`.pn-n[data-i="${i}"]`).forEach((g) => g.classList.add(cls)); return api; };
    api.unmark = (cls) => { host.querySelectorAll(`.pn-n.${cls}`).forEach((g) => g.classList.remove(cls)); return api; };
    api.at = (beat) => {
      const ph = host.querySelector(".playhead"); if (!ph || !lay) return api;
      if (beat == null || beat < 0 || beat > lay.bars * lay.bpb) { ph.style.display = "none"; return api; }
      const { si, x } = lay.xAt(Math.min(beat, lay.bars * lay.bpb - 1e-3));
      const yT = si.yS[lay.staves[0]] - 12, yB = si.yS[lay.staves[lay.staves.length - 1]] + SP * 4 + 12;
      ph.setAttribute("x1", x); ph.setAttribute("x2", x); ph.setAttribute("y1", yT); ph.setAttribute("y2", yB); ph.style.display = "";
      return api;
    };
    api.clear = () => { api.highlight(-1); api.at(null); return api; };
    api.setNotes = (ns, oo) => { list = (ns || []).slice(); if (oo) opts = Object.assign(opts, oo); render(); return api; };
    api.setOptions = (oo) => { opts = Object.assign(opts, oo); render(); return api; };
    Object.defineProperty(api, "notes", { get: () => list });
    Object.defineProperty(api, "layout", { get: () => lay });
    Object.defineProperty(api, "options", { get: () => opts });
    api.setNotes(notes || []);
    return api;
  };
  /** 문자열로 음표 쓰기: "C4/1 D4/1 E4/2 | [C4 E4 G4]/4 r/1" → 음표 배열(t 자동). "/"는 박 길이, r = 쉼표 */
  PN.parseNotes = function (text, o = {}) {
    let t = o.t0 || 0; const out = [];
    (text.match(/\[[^\]]*\](?:\/[\d.]+)?~?|\S+/g) || []).forEach((tok) => {
      if (tok === "|") return;
      const mm = /^(\[[^\]]+\]|[^/]+)(?:\/([\d.]+))?(~)?$/.exec(tok); if (!mm) return;
      const d = mm[2] ? +mm[2] : o.d || 1;
      if (mm[1] === "r") { t += d; return; }
      const names = mm[1].startsWith("[") ? mm[1].slice(1, -1).split(/[\s,]+/).filter(Boolean) : [mm[1]];
      const ms = names.map((n) => MB.parseNote(n.replace("#", "♯")));
      const ev = Object.assign({ t, d }, ms.length > 1 ? { ms } : { m: ms[0] }, o.hand ? { hand: o.hand } : {});
      if (mm[3]) ev.tie = true;
      out.push(ev); t += d;
    });
    return out;
  };

  /* ------------------------------------------------------------ piano roll */
  /**
   * 피아노 롤(캔버스). PN.roll(canvas, {from:48, to:84, beats:8, aspect, notes:[{t, d, m, hand, cls}]})
   * → {set(notes), now(beat|null), draw(), cv}. 세로축 = 음높이(검은 건반 줄은 어둡게), 가로축 = 박
   */
  PN.roll = function (canvas, o = {}) {
    let notes = o.notes || [], now = null;
    const st = { from: o.from || 48, to: o.to || 84, beats: o.beats || 8 };
    const cv = MB.canvas(canvas, (ctx, w, h) => {
      const P = MB.palette(), n = st.to - st.from + 1, rh = h / n, left = 28;
      for (let m = st.from; m <= st.to; m++) {
        const y = h - (m - st.from + 1) * rh;
        if (PN.isBlack(m)) { ctx.fillStyle = P.grid; ctx.globalAlpha = 0.35; ctx.fillRect(left, y, w - left, rh); ctx.globalAlpha = 1; }
        if (MB.mod(m, 12) === 0) { ctx.fillStyle = P.textDim; ctx.font = "10px " + getComputedStyle(document.body).getPropertyValue("--mono"); ctx.fillText("C" + (m / 12 - 1), 2, y + rh - 1); ctx.strokeStyle = P.grid; ctx.beginPath(); ctx.moveTo(left, y + rh); ctx.lineTo(w, y + rh); ctx.stroke(); }
      }
      const bx = (b) => left + (b / st.beats) * (w - left);
      for (let b = 0; b <= st.beats; b++) { ctx.strokeStyle = P.grid; ctx.lineWidth = b % 4 === 0 ? 1.4 : 0.6; ctx.beginPath(); ctx.moveTo(bx(b), 0); ctx.lineTo(bx(b), h); ctx.stroke(); }
      notes.forEach((nt) => {
        if (nt.m < st.from || nt.m > st.to) return;
        const y = h - (nt.m - st.from + 1) * rh, x = bx(nt.t), ww = Math.max(2, bx(nt.t + nt.d) - x - 1);
        ctx.fillStyle = nt.color || (nt.hand === "L" ? P.accent2 : P.accent);
        if (now != null && nt.t <= now && now < nt.t + nt.d) ctx.fillStyle = P.warn;
        ctx.globalAlpha = nt.vel != null ? 0.45 + 0.55 * nt.vel : 1;
        ctx.fillRect(x, y + 0.5, ww, Math.max(1.5, rh - 1)); ctx.globalAlpha = 1;
      });
      if (now != null) { ctx.strokeStyle = P.bad; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx(now), 0); ctx.lineTo(bx(now), h); ctx.stroke(); }
    }, { aspect: o.aspect || 0.42, maxHeight: o.maxHeight || 340, minHeight: 160 });
    return {
      cv,
      set(ns, oo) { notes = ns || []; if (oo) Object.assign(st, oo); cv.redraw(); },
      now(b) { now = b; cv.redraw(); },
      draw() { cv.redraw(); },
      get range() { return [st.from, st.to]; },
    };
  };

  /* ------------------------------------------------------------ small helpers for chapters */
  /** 음 이름 표시: 조 k 기준 철자(예: "E♭4"), ko면 우리말("내림 마") */
  PN.name = (m, k = 0, ko = false) => { const s = PN.spell(m, k); return ko ? s.ko : s.name; };
  /** 셈여림 기호 ↔ 벨로시티 */
  PN.DYNAMICS = [
    { sym: "ppp", vel: 0.16, name: "피아니시시모" }, { sym: "pp", vel: 0.26, name: "피아니시모" }, { sym: "p", vel: 0.38, name: "피아노" },
    { sym: "mp", vel: 0.5, name: "메초 피아노" }, { sym: "mf", vel: 0.62, name: "메초 포르테" }, { sym: "f", vel: 0.75, name: "포르테" },
    { sym: "ff", vel: 0.87, name: "포르티시모" }, { sym: "fff", vel: 0.97, name: "포르티시시모" },
  ];
  PN.dynVel = (sym) => (PN.DYNAMICS.find((d) => d.sym === sym) || { vel: 0.62 }).vel;
  /** 셈여림 버튼 스타일 정지 버튼 연결: 버튼 클릭 시 모든 소리 정지 */
  PN.stopButton = (btn, extra) => { const b = $(btn); if (b) b.addEventListener("click", () => { extra && extra(); MB.stopAll(); }); };
})();
