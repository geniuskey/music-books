/* ==========================================================================
   EnsembleBook 합주 전용 스크립트 — 전역 객체 EN (common.js의 MB 위에서 동작)
   - 악기 사전(EN.INSTR): 음역·조옮김·음자리표·악기군·무대 자리·음량 등급
   - 음원: 악기마다 '음원 스펙트럼 × 몸통·관 공명(포먼트)'으로 배음을 계산해(EN.spectrum) 그대로 소리를 낸다.
     활(헬름홀츠 톱니)·리드(홀수 배음)·에지톤(숨소리)·입술 버징(셈여림에 따라 밝아짐)·막(비조화 모드)·뜯은 현.
     비브라토, 주법(arco·pizz·trem·stacc·mute·pont·tasto·flutter·stopped·roll), 섹션(여러 연주자의 미세한 어긋남).
   - 공간: 합성 임펄스 응답 홀 잔향(EN.HALLS), 채널마다 음량·좌우·거리·뮤트·솔로가 있는 믹서(EN.mixer)
   - 음악: 짧은 악보 표기(EN.parse), 4성부 자동 화성(EN.harmonize), 곡 사전(EN.PIECES), 편성 사전(EN.ARRANGE)과
     편곡(EN.arrange), 여러 파트를 함께 돌리는 재생기(EN.player)
   - 분석: 스펙트럼 무게 중심, 임계대역(Bark·ERB), 간단한 마스킹 추정(EN.masking), dB 합
   - 위젯: 파트별 피아노 롤(EN.roll), 믹서 패널(EN.mixerUI), 무대 배치도(EN.stage), 음역표(EN.rangeChart),
     정적 스펙트럼 그림(EN.drawSpectra)
   이 파일은 common.js 다음에 defer 없이 로드한다.
   ========================================================================== */
(function () {
  "use strict";
  const EN = (window.EN = {});
  const $ = (sel) => (typeof sel === "string" ? document.querySelector(sel) : sel);
  const fnv = (v) => (typeof v === "function" ? v() : v);

  /* ------------------------------------------------------------ families & instruments */
  EN.FAMILIES = {
    strings:    { name: "현악기", en: "Strings", color: "en-str" },
    woodwinds:  { name: "목관악기", en: "Woodwinds", color: "en-ww" },
    brass:      { name: "금관악기", en: "Brass", color: "en-br" },
    percussion: { name: "타악기", en: "Percussion", color: "en-pc" },
    keyboard:   { name: "하프·건반", en: "Harp & Keyboards", color: "en-kb" },
  };
  /**
   * lo/hi: 실음 음역(MIDI), comfy: 편하게 쓰는 음역, transpose: 실음 = 기보 + transpose(반음),
   * clef: 주로 쓰는 음자리표, x/y: 무대 자리(x −1 왼쪽 … 1 오른쪽, y 0 앞 … 1 뒤, 객석에서 본 모습),
   * level: 같은 셈여림에서의 상대 음압(바이올린 한 대 = 1), section: 표준 2관 편성의 인원
   */
  EN.INSTR = {
    violin:     { name: "바이올린", en: "Violin", short: "Vn", family: "strings", model: "bowed", lo: 55, hi: 100, comfy: [55, 93], clef: "treble", transpose: 0, x: -0.55, y: 0.2, level: 1, section: 14,
                  formants: [[280, 60, 0.9], [460, 70, 1.2], [550, 90, 1.0], [2900, 1300, 1.5]], floor: 0.3, rolloff: 5200, vib: [5.8, 16], attack: 0.07 },
    viola:      { name: "비올라", en: "Viola", short: "Va", family: "strings", model: "bowed", lo: 48, hi: 88, comfy: [48, 81], clef: "alto", transpose: 0, x: 0.35, y: 0.25, level: 0.9, section: 10,
                  formants: [[230, 50, 0.9], [350, 70, 1.1], [440, 80, 0.8], [2100, 1100, 1.2]], floor: 0.3, rolloff: 4200, vib: [5.5, 15], attack: 0.08 },
    cello:      { name: "첼로", en: "Cello", short: "Vc", family: "strings", model: "bowed", lo: 36, hi: 81, comfy: [36, 72], clef: "bass", transpose: 0, x: 0.6, y: 0.3, level: 1.1, section: 8,
                  formants: [[100, 25, 0.9], [190, 40, 1.1], [220, 50, 0.9], [1400, 800, 1.1]], floor: 0.35, rolloff: 3600, vib: [5.3, 14], attack: 0.09 },
    contrabass: { name: "더블베이스", en: "Double Bass", short: "Cb", family: "strings", model: "bowed", lo: 28, hi: 67, comfy: [28, 60], clef: "bass", transpose: -12, x: 0.85, y: 0.55, level: 1.1, section: 6,
                  formants: [[60, 15, 0.9], [100, 25, 1.1], [130, 30, 0.8], [800, 500, 0.9]], floor: 0.35, rolloff: 2400, vib: [5, 12], attack: 0.12 },
    flute:      { name: "플루트", en: "Flute", short: "Fl", family: "woodwinds", model: "flute", lo: 60, hi: 96, comfy: [62, 93], clef: "treble", transpose: 0, x: -0.12, y: 0.55, level: 0.6, section: 2,
                  vib: [5.2, 9], attack: 0.06, breath: 0.07 },
    piccolo:    { name: "피콜로", en: "Piccolo", short: "Picc", family: "woodwinds", model: "flute", lo: 74, hi: 108, comfy: [74, 103], clef: "treble", transpose: 12, x: -0.2, y: 0.55, level: 0.75, section: 1,
                  vib: [5.5, 8], attack: 0.04, breath: 0.08 },
    oboe:       { name: "오보에", en: "Oboe", short: "Ob", family: "woodwinds", model: "reed2", lo: 58, hi: 91, comfy: [62, 86], clef: "treble", transpose: 0, x: 0.12, y: 0.55, level: 0.75, section: 2,
                  formants: [[1150, 300, 1.5], [2900, 700, 0.6]], floor: 0.22, rolloff: 6000, vib: [5.4, 8], attack: 0.03 },
    englishHorn:{ name: "잉글리시 호른", en: "English Horn", short: "E.H.", family: "woodwinds", model: "reed2", lo: 52, hi: 81, comfy: [53, 77], clef: "treble", transpose: -7, x: 0.2, y: 0.55, level: 0.65, section: 1,
                  formants: [[950, 250, 1.4], [2300, 600, 0.45]], floor: 0.22, rolloff: 5000, vib: [5.2, 7], attack: 0.035 },
    clarinet:   { name: "클라리넷", en: "Clarinet (B♭)", short: "Cl", family: "woodwinds", model: "reed1", lo: 50, hi: 94, comfy: [52, 89], clef: "treble", transpose: -2, x: -0.12, y: 0.68, level: 0.75, section: 2,
                  cutoff: 1700, vib: [5, 0], attack: 0.035 },
    bassoon:    { name: "바순", en: "Bassoon", short: "Bn", family: "woodwinds", model: "reed2", lo: 34, hi: 75, comfy: [34, 70], clef: "bass", transpose: 0, x: 0.12, y: 0.68, level: 0.7, section: 2,
                  formants: [[480, 130, 1.6], [1180, 300, 0.7]], floor: 0.16, rolloff: 3800, vib: [5, 5], attack: 0.04 },
    horn:       { name: "호른", en: "Horn (F)", short: "Hn", family: "brass", model: "brass", lo: 34, hi: 77, comfy: [41, 74], clef: "treble", transpose: -7, x: -0.45, y: 0.8, level: 1.4, section: 4,
                  formants: [[420, 260, 1.0]], floor: 0.35, bright: [1500, 1700], p: [1.9, 1.15], vib: [5, 0], attack: 0.05 },
    trumpet:    { name: "트럼펫", en: "Trumpet (B♭)", short: "Tpt", family: "brass", model: "brass", lo: 52, hi: 82, comfy: [55, 79], clef: "treble", transpose: -2, x: 0.1, y: 0.88, level: 1.9, section: 2,
                  formants: [[1300, 600, 1.2], [2600, 900, 0.5]], floor: 0.3, bright: [3200, 5500], p: [1.7, 1.15], vib: [5, 3], attack: 0.025 },
    trombone:   { name: "트롬본", en: "Trombone", short: "Tbn", family: "brass", model: "brass", lo: 40, hi: 74, comfy: [40, 70], clef: "bass", transpose: 0, x: 0.35, y: 0.88, level: 1.9, section: 3,
                  formants: [[560, 300, 1.0], [1200, 500, 0.6]], floor: 0.3, bright: [2200, 4000], p: [1.8, 1.15], vib: [4.8, 0], attack: 0.035 },
    tuba:       { name: "튜바", en: "Tuba", short: "Tba", family: "brass", model: "brass", lo: 26, hi: 65, comfy: [28, 58], clef: "bass", transpose: 0, x: 0.55, y: 0.88, level: 1.6, section: 1,
                  formants: [[230, 120, 1.0]], floor: 0.3, bright: [800, 1700], p: [2.0, 1.0], vib: [4.5, 0], attack: 0.06 },
    timpani:    { name: "팀파니", en: "Timpani", short: "Timp", family: "percussion", model: "timpani", lo: 38, hi: 57, comfy: [40, 55], clef: "bass", transpose: 0, x: -0.25, y: 1, level: 2.2, section: 1 },
    glockenspiel:{ name: "글로켄슈필", en: "Glockenspiel", short: "Glk", family: "percussion", model: "glock", lo: 79, hi: 108, comfy: [79, 105], clef: "treble", transpose: 24, x: -0.6, y: 1, level: 0.9, section: 1 },
    cymbals:    { name: "심벌즈", en: "Cymbals", short: "Cym", family: "percussion", model: "cymbal", lo: 60, hi: 60, comfy: [60, 60], clef: "perc", transpose: 0, x: 0.2, y: 1, level: 1.2, section: 1, unpitched: true },
    bassDrum:   { name: "큰북", en: "Bass Drum", short: "B.D.", family: "percussion", model: "bassdrum", lo: 36, hi: 36, comfy: [36, 36], clef: "perc", transpose: 0, x: 0.05, y: 1, level: 2, section: 1, unpitched: true },
    snare:      { name: "작은북", en: "Snare Drum", short: "S.D.", family: "percussion", model: "snare", lo: 60, hi: 60, comfy: [60, 60], clef: "perc", transpose: 0, x: 0.4, y: 1, level: 1.3, section: 1, unpitched: true },
    triangle:   { name: "트라이앵글", en: "Triangle", short: "Tri", family: "percussion", model: "triangle", lo: 60, hi: 60, comfy: [60, 60], clef: "perc", transpose: 0, x: 0.55, y: 1, level: 0.6, section: 1, unpitched: true },
    harp:       { name: "하프", en: "Harp", short: "Hp", family: "keyboard", model: "harp", lo: 23, hi: 104, comfy: [31, 98], clef: "grand", transpose: 0, x: -0.85, y: 0.55, level: 0.7, section: 1 },
    celesta:    { name: "첼레스타", en: "Celesta", short: "Cel", family: "keyboard", model: "celesta", lo: 60, hi: 108, comfy: [60, 105], clef: "grand", transpose: 12, x: -0.85, y: 0.75, level: 0.55, section: 1 },
    piano:      { name: "피아노", en: "Piano", short: "Pno", family: "keyboard", model: "piano", lo: 21, hi: 108, comfy: [28, 100], clef: "grand", transpose: 0, x: 0, y: 0.1, level: 1.3, section: 1 },
  };
  EN.KEYS = Object.keys(EN.INSTR);
  EN.ORCH_ORDER = ["piccolo", "flute", "oboe", "englishHorn", "clarinet", "bassoon", "horn", "trumpet", "trombone", "tuba", "timpani", "glockenspiel", "triangle", "cymbals", "snare", "bassDrum", "harp", "celesta", "piano", "violin", "viola", "cello", "contrabass"];
  EN.inst = (k) => EN.INSTR[k] || EN.INSTR.violin;
  EN.name = (k) => EN.inst(k).name;
  /** 악기군 색(CSS 변수 값) */
  EN.color = (k) => MB.color((EN.FAMILIES[EN.inst(k).family] || EN.FAMILIES.strings).color) || MB.color("accent");
  EN.familyColor = (fam) => MB.color((EN.FAMILIES[fam] || EN.FAMILIES.strings).color);
  /** 기보음 ↔ 실음 */
  EN.written = (k, sounding) => sounding - EN.inst(k).transpose;
  EN.sounding = (k, written) => written + EN.inst(k).transpose;
  EN.inRange = (k, m) => m >= EN.inst(k).lo && m <= EN.inst(k).hi;
  EN.inComfy = (k, m) => m >= EN.inst(k).comfy[0] && m <= EN.inst(k).comfy[1];
  /** 음역 안으로 옥타브를 접는다 */
  EN.fold = (k, m) => { const I = EN.inst(k); if (I.unpitched) return m; while (m < I.lo) m += 12; while (m > I.hi) m -= 12; return m; };
  EN.TRANSPOSE_NAMES = { 0: "C(실음)", "-2": "B♭", "-7": "F", "-3": "A", "-9": "E♭", 12: "한 옥타브 위", "-12": "한 옥타브 아래", 24: "두 옥타브 위" };
  /** 셈여림 → 벨로시티 */
  EN.DYN = { ppp: 0.12, pp: 0.22, p: 0.34, mp: 0.46, mf: 0.58, f: 0.72, ff: 0.86, fff: 1 };
  EN.DYN_NAMES = { ppp: "피아니시시모", pp: "피아니시모", p: "피아노", mp: "메조피아노", mf: "메조포르테", f: "포르테", ff: "포르티시모", fff: "포르티시시모" };
  EN.dynOf = (vel) => Object.keys(EN.DYN).reduce((a, b) => (Math.abs(EN.DYN[b] - vel) < Math.abs(EN.DYN[a] - vel) ? b : a), "mf");
  EN.ARTS = {
    arco: "아르코(활)", legato: "레가토", stacc: "스타카토", spicc: "스피카토", pizz: "피치카토", trem: "트레몰로",
    mute: "약음기", pont: "술 폰티첼로", tasto: "술 타스토", harm: "하모닉스", flutter: "플러터 텅잉", stopped: "막은 음(호른)", roll: "롤",
  };

  /* ------------------------------------------------------------ spectral model */
  const formantGain = (f, fm, floor) => { let g = floor; for (const [fc, bw, a] of fm) g += a / (1 + ((f - fc) / bw) * ((f - fc) / bw)); return g; };
  /**
   * 한 음의 배음 진폭(정규화 전 선형). 소리와 그림이 같은 함수를 쓴다.
   *   EN.spectrum("violin", 69, {vel:0.6, art:"arco"}) → [{k, f, a(최댓값 1), db}]
   * 타악기·하프 같은 감쇠 음원은 시작 직후의 스펙트럼(근사)을 돌려준다.
   */
  EN.harmonicAmps = function (k, m, o = {}) {
    const I = EN.inst(k), f0 = MB.mtof(m), vel = o.vel != null ? o.vel : 0.6, art = o.art || "";
    const N = Math.max(1, Math.min(48, Math.floor((o.fmax || 15000) / f0)));
    const A = [];
    for (let n = 1; n <= N; n++) {
      const f = n * f0;
      let a = 0;
      switch (I.model) {
        case "bowed": {
          const beta = art === "pont" ? 0.035 : art === "tasto" ? 0.22 : 0.11;
          a = (1 / n) * (0.3 + 0.7 * Math.abs(Math.sin(n * Math.PI * beta)) / Math.max(0.15, Math.sin(Math.PI * beta) * 1.0)) * 0.5;
          a *= Math.pow(n, -(1 - vel) * 0.55);
          if (art === "tasto") a *= Math.pow(n, -0.6);
          if (art === "pont") a *= Math.pow(n, 0.25);
          if (art === "harm") a = n === 1 ? 1 : n === 2 ? 0.05 : 0.01 / n;
          let fm = I.formants;
          if (art === "mute") fm = fm.map(([fc, bw, g], i) => (i === fm.length - 1 ? [fc * 0.8, bw, g * 0.25] : [fc, bw, g]));
          a *= formantGain(f, fm, I.floor);
          a /= Math.sqrt(1 + Math.pow(f / (art === "mute" ? I.rolloff * 0.55 : I.rolloff), 4));
          break;
        }
        case "flute": {
          const low = MB.clamp((80 - m) / 20, 0, 1); // 낮은 음역일수록 배음이 적다
          const dec = 1.25 - 0.55 * vel + 0.45 * low;
          a = Math.exp(-(n - 1) * dec);
          if (n === 2) a *= 1.25 - 0.4 * low;
          a /= Math.sqrt(1 + Math.pow(f / 6000, 4));
          break;
        }
        case "reed1": { // 클라리넷: 한쪽이 막힌 원통관 — 낮은 음역(샬뤼모)에서는 짝수 배음이 약하다
          const even = m < 70 ? 0.07 + 0.08 * vel : 0.35;
          a = (n % 2 ? 1 : even) / n;
          a *= Math.pow(n, -(1 - vel) * 0.5);
          const fc = I.cutoff || 1700;
          if (f > fc) a *= Math.pow(fc / f, 2.2 - 0.8 * vel);
          break;
        }
        case "reed2": { // 오보에·바순: 원뿔관 + 겹리드 — 모든 배음, 강한 포먼트
          a = Math.pow(n, -0.75) * formantGain(f, I.formants, I.floor);
          a *= Math.pow(n, -(1 - vel) * 0.6);
          if (n === 1 && m < 67) a *= 0.6;
          a /= Math.sqrt(1 + Math.pow(f / I.rolloff, 4));
          break;
        }
        case "brass": {
          const p = I.p[0] - I.p[1] * vel; // 셈여림이 클수록 고역이 산다(관 속 비선형 전파)
          a = Math.pow(n, -Math.max(0.35, p));
          a *= formantGain(f, I.formants, I.floor);
          const cut = I.bright[0] + I.bright[1] * vel * vel;
          a /= Math.sqrt(1 + Math.pow(f / cut, 4));
          if (art === "mute") a *= formantGain(f, [[1800, 500, 1.6]], 0.08) * (f < 500 ? f / 500 : 1);
          if (art === "stopped") a *= formantGain(f, [[2600, 700, 1.4]], 0.2) * (n === 1 ? 0.3 : 1);
          if (n === 1 && m < I.lo + 6) a *= 0.7;
          break;
        }
        case "harp": a = Math.pow(n, -1.6) * Math.abs(Math.sin(n * Math.PI * 0.3)) * (n === 1 ? 1.3 : 1); break;
        case "piano": a = [1, 0.45, 0.32, 0.18, 0.14, 0.09, 0.06, 0.05, 0.03, 0.02, 0.015, 0.01][n - 1] || 0; break;
        case "celesta": a = n === 1 ? 1 : n === 4 ? 0.1 : 0; break;
        default: a = n === 1 ? 1 : 0;
      }
      A.push(Math.max(0, a));
    }
    return A;
  };
  EN.spectrum = function (k, m, o = {}) {
    const I = EN.inst(k), f0 = MB.mtof(m);
    if (I.model === "timpani") return TIMP_MODES.map(([r, a]) => ({ k: r, f: f0 * r, a, db: MB.db(a) }));
    if (I.model === "glock") return GLOCK_MODES.map(([r, a]) => ({ k: r, f: f0 * r, a, db: MB.db(a) }));
    const A = EN.harmonicAmps(k, m, o), mx = Math.max(...A) || 1;
    return A.map((a, i) => ({ k: i + 1, f: f0 * (i + 1), a: a / mx, db: MB.db(a / mx) }));
  };
  /** 스펙트럼 무게 중심(Hz) — '밝기'의 수치 */
  EN.centroid = function (k, m, o) {
    const S = EN.spectrum(k, m, o); let num = 0, den = 0;
    S.forEach((p) => { const e = p.a * p.a; num += p.f * e; den += e; });
    return den ? num / den : MB.mtof(m);
  };
  /** 임계대역: Bark(Zwicker)와 ERB(Glasberg–Moore) */
  EN.bark = (f) => 13 * Math.atan(0.00076 * f) + 3.5 * Math.atan(Math.pow(f / 7500, 2));
  EN.erb = (f) => 24.7 * (4.37 * f / 1000 + 1);
  /** 여러 소리의 음압 합(비상관 합): dB 배열 → dB */
  EN.sumDb = (dbs) => 10 * Math.log10(dbs.reduce((s, d) => s + Math.pow(10, d / 10), 0) || 1e-12);

  /* ------------------------------------------------------------ voices */
  const TIMP_MODES = [[1, 1, 2.8], [1.504, 0.55, 1.9], [1.742, 0.32, 1.2], [2.0, 0.3, 1.1], [2.245, 0.18, 0.8], [2.494, 0.15, 0.6], [2.8, 0.08, 0.5]];
  const GLOCK_MODES = [[1, 1, 2.4], [2.76, 0.28, 0.7], [5.4, 0.12, 0.3], [8.93, 0.05, 0.15]];
  const waveCache = new WeakMap();
  function waveFor(ctx, k, m, vel, art) {
    let c = waveCache.get(ctx); if (!c) waveCache.set(ctx, (c = new Map()));
    const vb = Math.round(vel * 6) / 6, key = k + "|" + Math.round(m) + "|" + vb + "|" + (art || "");
    if (c.has(key)) return c.get(key);
    const A = EN.harmonicAmps(k, Math.round(m), { vel: vb, art, fmax: Math.min(16000, ctx.sampleRate * 0.45) });
    const rms = Math.sqrt(A.reduce((s, a) => s + a * a, 0)) || 1;
    const w = MB.wave(A.map((a) => a / rms), null, ctx);
    c.set(key, w);
    if (c.size > 600) c.delete(c.keys().next().value);
    return w;
  }
  const rnd = MB.rng(2026);
  /** 연속음(현·관). o.en = {art, players, vib(배수), spread(센트), seed} */
  function sustainedVoice(ctx, k, f, t0, vel, dest, o) {
    const I = EN.inst(k), E = o.en || {}, art = E.art || "";
    const m = MB.ftom(f);
    const fam = I.family;
    const out = ctx.createGain();
    const amp = Math.pow(vel, 1.5) * 0.22 * (E.level != null ? E.level : 1);
    out.gain.value = amp;
    let node = out;
    // 트레몰로(현)·플러터 텅잉(관): 빠른 진폭 변조
    let am = null;
    if (art === "trem" || art === "flutter") {
      const tg = ctx.createGain(); tg.gain.value = 0.55;
      am = ctx.createOscillator(); am.frequency.value = art === "trem" ? 12 + rnd() * 2 : 22 + rnd() * 4;
      const ag = ctx.createGain(); ag.gain.value = 0.45;
      am.connect(ag); ag.connect(tg.gain); am.start(t0);
      tg.connect(out); node = tg;
    }
    out.connect(dest);
    const env = ctx.createGain();
    // 금관·관악기의 '피어남': 어택 동안 저역 통과 필터가 열린다
    let lp = null;
    if (fam === "brass" || fam === "woodwinds") {
      lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.5;
      const open = Math.min(18000, f * (fam === "brass" ? 4 + 16 * vel : 6 + 10 * vel) + 600);
      lp.frequency.setValueAtTime(Math.min(open, f * (fam === "brass" ? 1.6 : 2.5) + 200), t0);
      lp.frequency.setTargetAtTime(open, t0 + 0.005, (fam === "brass" ? 0.05 : 0.03) * (1.4 - vel));
      env.connect(lp); lp.connect(node);
    } else env.connect(node);
    const short = art === "stacc" || art === "spicc";
    const atk = (I.attack || 0.05) * (art === "legato" ? 1.8 : short ? 0.45 : 1) * (1.25 - 0.5 * vel);
    const envCfg = { a: atk, d: short ? 0.08 : 0.25, s: short ? 0.55 : fam === "brass" ? 0.8 : 0.88, r: fam === "strings" ? 0.22 : 0.12 };
    if (fam === "brass") envCfg.d = 0.12;
    const adsr = MB.adsr(env.gain, t0, Object.assign(envCfg, o.env));
    // 섹션: 여러 연주자를 최대 maxSub개의 하위 음성으로. 연주자마다 음높이·비브라토·출발이 조금씩 다르다.
    const players = Math.max(1, E.players || 1), sub = Math.min(players, E.maxSub || 5);
    const spread = E.spread != null ? E.spread : players > 1 ? 9 : 0; // 센트(표준편차 근사)
    const level = E.real ? Math.sqrt(players / sub) : Math.sqrt(1 / sub);
    const nodes = [];
    const vibRate = I.vib ? I.vib[0] : 5, vibDepth = (I.vib ? I.vib[1] : 0) * (E.vib != null ? E.vib : 1) * (art === "harm" ? 0.5 : 1);
    for (let i = 0; i < sub; i++) {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(waveFor(ctx, k, m, vel, art));
      osc.frequency.value = f;
      const det = sub > 1 ? (i - (sub - 1) / 2) / Math.max(1, (sub - 1) / 2) * spread + (rnd() - 0.5) * spread * 0.6 : 0;
      osc.detune.value = det + (o.detune || 0);
      const jitter = sub > 1 ? rnd() * 0.035 : 0;
      // 음 시작의 작은 '스쿱'(금관은 아래에서, 현·관은 거의 없음)
      const scoop = fam === "brass" ? -35 * (1.1 - vel) : 0;
      if (scoop) { osc.detune.setValueAtTime(det + scoop, t0 + jitter); osc.detune.setTargetAtTime(det, t0 + jitter, 0.025); }
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0, t0); sg.gain.setValueAtTime(0, t0 + jitter); sg.gain.linearRampToValueAtTime(level, t0 + jitter + 0.02);
      osc.connect(sg); sg.connect(env);
      if (vibDepth > 0 && !short) {
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = vibRate * (1 + (sub > 1 ? (rnd() - 0.5) * 0.18 : 0));
        const delay = (E.vibDelay != null ? E.vibDelay : 0.18) + (sub > 1 ? rnd() * 0.1 : 0);
        lg.gain.setValueAtTime(0, t0); lg.gain.setValueAtTime(0, t0 + delay); lg.gain.linearRampToValueAtTime(vibDepth, t0 + delay + 0.35);
        lfo.connect(lg); lg.connect(osc.detune); lfo.start(t0 + rnd() * 0.2); nodes.push(lfo);
      }
      osc.start(t0); nodes.push(osc);
    }
    // 활 잡음·숨소리: 대역 통과 잡음(어택에서 크고, 지속음에서 작게)
    const nz = fam === "strings" ? (art === "harm" ? 0.04 : 0.025) : fam === "woodwinds" ? (I.breath || 0.02) : 0.008;
    if (nz > 0) {
      const src = ctx.createBufferSource(); src.buffer = MB.noiseBuffer(ctx); src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.value = fam === "strings" ? Math.min(9000, Math.max(1500, f * 6)) : Math.min(10000, f * 3 + 1500); bp.Q.value = 0.9;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0, t0); ng.gain.linearRampToValueAtTime(nz * 3.2 * (1 + (art === "spicc" ? 1 : 0)), t0 + 0.01);
      ng.gain.setTargetAtTime(nz * (0.4 + 0.6 * vel), t0 + 0.02, atk * 0.8 + 0.02);
      src.connect(bp); bp.connect(ng); ng.connect(env);
      src.start(t0, rnd() * 1.5); nodes.push(src);
    }
    if (am) nodes.push(am);
    return {
      release(t, rr) { const end = adsr.release(t, rr); nodes.forEach((n) => { try { n.stop(end + 0.05); } catch (e) {} }); this.end = end; return end; },
    };
  }
  /** 몸통 공명을 바이쿼드 피킹 필터로 근사(피치카토·하프용) */
  function bodyChain(ctx, k, dest) {
    const I = EN.inst(k);
    let first = null, last = null;
    (I.formants || []).forEach(([fc, bw, a]) => {
      const b = ctx.createBiquadFilter(); b.type = "peaking"; b.frequency.value = fc; b.Q.value = Math.max(0.5, fc / (bw * 2)); b.gain.value = 3 + a * 5;
      if (last) last.connect(b); else first = b; last = b;
    });
    if (!first) return dest;
    last.connect(dest);
    return first;
  }
  function pluckVoice(ctx, k, f, t0, vel, dest, o) {
    const I = EN.inst(k), harp = I.model === "harp";
    const dur = harp ? (f < 150 ? 6 : 4) : f < 100 ? 2.2 : 1.4;
    const buf = MB.ksBuffer(ctx, f, { dur, decay: harp ? 0.9985 : 0.993, bright: harp ? 0.45 + 0.25 * vel : 0.25 + 0.3 * vel, pos: harp ? 0.3 : 0.18, seed: Math.round(f) % 11 });
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = buf._rate;
    const g = ctx.createGain(); const peak = Math.pow(vel, 1.3) * (harp ? 0.42 : 0.5) * ((o.en && o.en.level) || 1);
    g.gain.value = peak;
    src.connect(g); g.connect(harp ? dest : bodyChain(ctx, k, dest)); src.start(t0);
    const end0 = t0 + buf.duration / buf._rate, rel = MB.releaser(g.gain, peak);
    return { end: end0, release(t, rr = harp ? 0.6 : 0.12) { t = Math.max(t, t0 + 0.01); const e = Math.min(end0, rel.release(t, rr)); try { src.stop(e + 0.05); } catch (er) {} this.end = e; return e; } };
  }
  /** 모드 합(팀파니·글로켄슈필·첼레스타·트라이앵글): [비율, 진폭, 감쇠초] */
  function modalVoice(ctx, f, t0, vel, dest, modes, o, click) {
    const out = ctx.createGain(); out.gain.value = Math.pow(vel, 1.3) * 0.3 * ((o.en && o.en.level) || 1); out.connect(dest);
    const nodes = [], gains = [];
    modes.forEach(([r, a, d]) => {
      const osc = ctx.createOscillator(); osc.frequency.value = f * r;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a, t0 + 0.002); g.gain.setTargetAtTime(0, t0 + 0.002, d / 4.6);
      osc.connect(g); g.connect(out); osc.start(t0); osc.stop(t0 + d * 1.6 + 0.1); nodes.push(osc); gains.push(g);
    });
    if (click) {
      const src = ctx.createBufferSource(); src.buffer = MB.noiseBuffer(ctx);
      const bp = ctx.createBiquadFilter(); bp.type = click.type || "lowpass"; bp.frequency.value = click.f; bp.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.setValueAtTime(click.a, t0); g.gain.setTargetAtTime(0, t0, click.d);
      src.connect(bp); bp.connect(g); g.connect(out); src.start(t0, rnd()); src.stop(t0 + click.d * 8); nodes.push(src);
    }
    const end0 = t0 + Math.max(...modes.map((x) => x[2])) * 1.6;
    return { end: end0, release(t, rr = 0.3) { t = Math.max(t, t0 + 0.01); gains.forEach((g) => { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, rr / 4); }); this.end = Math.min(end0, t + rr); return this.end; } };
  }
  function timpaniVoice(ctx, f, t0, vel, dest, o) {
    const art = (o.en && o.en.art) || "";
    const modes = TIMP_MODES.map(([r, a, d]) => [r, a * (r > 1 ? 0.6 + 0.6 * vel : 1), d]);
    const hit = (t, v) => modalVoice(ctx, f, t, v, dest, modes, o, { f: 300 + 500 * v, a: 0.8, d: 0.04 });
    if (art === "roll") {
      const dur = o.dur != null ? o.dur : 1.5, vs = [];
      for (let t = 0; t < dur; t += 0.055) vs.push(hit(t0 + t + (rnd() - 0.5) * 0.008, vel * (0.55 + 0.2 * rnd())));
      return { release(t, rr) { vs.forEach((v) => v.release(Math.max(t, t0 + dur), rr || 0.6)); return t + 0.6; } };
    }
    // (0,1) 모드의 '둥' 하는 짧은 저음을 더한다
    const th = modalVoice(ctx, f * 0.62, t0, vel * 0.6, dest, [[1, 0.7, 0.25]], o);
    const v = hit(t0, vel);
    return { release(t, rr) { th.release(t, rr); return v.release(t, rr || 0.9); } };
  }
  function percVoice(ctx, k, t0, vel, dest, o) {
    const I = EN.inst(k), lv = (o.en && o.en.level) || 1;
    if (I.model === "cymbal") { MB.drum("crash", t0, { ctx, vel: vel * 0.9 * lv, dest, decay: 1.4 }); return { end: t0 + 3, release(t) { return t; } }; }
    if (I.model === "snare") {
      if (o.en && o.en.art === "roll") { const dur = o.dur || 1; for (let t = 0; t < dur; t += 0.045) MB.drum("snare", t0 + t, { ctx, vel: vel * (0.4 + 0.15 * rnd()) * lv, dest }); }
      else MB.drum("snare", t0, { ctx, vel: vel * lv, dest });
      return { end: t0 + 0.4, release(t) { return t; } };
    }
    if (I.model === "bassdrum") {
      return modalVoice(ctx, 52, t0, vel, dest, [[1, 1, 1.4], [1.55, 0.35, 0.6], [2.2, 0.15, 0.35]], o, { f: 400, a: 0.6, d: 0.03 });
    }
    if (I.model === "triangle") return modalVoice(ctx, 1320, t0, vel * 0.8, dest, [[1, 0.5, 2.4], [2.71, 0.6, 2.0], [4.43, 0.45, 1.6], [6.12, 0.3, 1.2], [8.1, 0.2, 0.9]], o, { type: "highpass", f: 6000, a: 0.3, d: 0.01 });
    return { release(t) { return t; } };
  }
  /** 모든 EN 악기를 MB.INSTRUMENTS에 등록 → MB.play(m, {inst:"violin", en:{art, players}}) */
  EN.KEYS.forEach((k) => {
    const I = EN.INSTR[k];
    if (k === "piano") return; // 피아노는 MB의 피아노 음원을 그대로 쓴다
    MB.INSTRUMENTS[k] = function (ctx, f, t0, vel, dest, o) {
      const art = (o.en && o.en.art) || "";
      switch (I.model) {
        case "bowed": return art === "pizz" ? pluckVoice(ctx, k, f, t0, vel, dest, o) : sustainedVoice(ctx, k, f, t0, vel, dest, o);
        case "harp": return pluckVoice(ctx, k, f, t0, vel, dest, o);
        case "timpani": return timpaniVoice(ctx, f, t0, vel, dest, o);
        case "glock": return modalVoice(ctx, f, t0, vel, dest, GLOCK_MODES, o, { type: "highpass", f: 3000, a: 0.25, d: 0.006 });
        case "celesta": return modalVoice(ctx, f, t0, vel, dest, [[1, 1, 1.5], [4, 0.1, 0.4], [6.8, 0.03, 0.2]], o, { type: "bandpass", f: 2000, a: 0.12, d: 0.01 });
        case "cymbal": case "snare": case "bassdrum": case "triangle": return percVoice(ctx, k, t0, vel, dest, o);
        default: return sustainedVoice(ctx, k, f, t0, vel, dest, o);
      }
    };
    MB.INSTRUMENT_NAMES[k] = I.name;
  });
  /** 감쇠 음원(스스로 사라지는 소리)인가 */
  EN.isDecaying = (k, art) => { const md = EN.inst(k).model; return ["harp", "piano", "timpani", "glock", "celesta", "cymbal", "snare", "bassdrum", "triangle"].includes(md) || art === "pizz"; };
  /**
   * 악기 한 음. EN.note("cello", 48, {dur:1.5, vel:0.6, art:"arco", players:1, when, dest, level})
   *   art가 stacc·spicc면 길이를 줄인다. 셈여림 이름(vel:"mf")도 된다. 음량은 악기의 level 등급을 반영한다(raw:true면 무시).
   */
  EN.note = function (k, m, o = {}) {
    const I = EN.inst(k);
    let vel = o.vel != null ? o.vel : 0.6; if (typeof vel === "string") vel = EN.DYN[vel] || 0.6;
    const art = o.art || "";
    let dur = o.dur === undefined ? 1 : o.dur;
    if (dur != null && (art === "stacc" || art === "spicc")) dur = Math.min(dur * 0.5, art === "spicc" ? 0.12 : 0.22);
    if (dur != null && EN.isDecaying(k, art) && art !== "roll") dur = Math.max(dur, I.model === "harp" ? 2.5 : 1.2);
    const level = (o.raw ? 1 : Math.sqrt(I.level)) * (o.level != null ? o.level : 1);
    return MB.play(m, {
      inst: k, dur, vel, when: o.when, dest: o.dest, pan: o.pan, detune: o.detune, env: o.env, ctx: o.ctx,
      en: { art, players: o.players, spread: o.spread, real: o.real, vib: o.vib, vibDelay: o.vibDelay, level, maxSub: o.maxSub },
    });
  };
  /** 화음(여러 음)을 같은 악기로 */
  EN.chord = (k, ms, o = {}) => ms.map((m) => EN.note(k, m, o));

  /* ------------------------------------------------------------ halls (synthetic impulse responses) */
  EN.HALLS = {
    dry:       { name: "무반향실", en: "Anechoic", rt60: 0, pre: 0, size: 0, desc: "반사음이 없다. 악기 소리 그대로." },
    studio:    { name: "녹음 스튜디오", en: "Studio", rt60: 0.45, pre: 0.006, size: 0.25, desc: "흡음재로 짧게 다듬은 방." },
    chamber:   { name: "실내악 홀", en: "Chamber hall", rt60: 1.3, pre: 0.014, size: 0.5, desc: "400–800석. 4중주가 또렷하게 들린다." },
    concert:   { name: "콘서트홀", en: "Concert hall", rt60: 2.0, pre: 0.024, size: 0.8, desc: "2000석 안팎. 오케스트라를 위한 잔향." },
    cathedral: { name: "대성당", en: "Cathedral", rt60: 5.5, pre: 0.04, size: 1, desc: "돌로 된 큰 공간. 화음이 겹쳐 흐려진다." },
  };
  const irCache = new Map();
  /** 스테레오 임펄스 응답: 초기 반사(크기에 따른 몇 개의 탭) + 주파수에 따라 다르게 감쇠하는 잡음 꼬리 */
  EN.impulse = function (ctx, hall) {
    const H = typeof hall === "string" ? EN.HALLS[hall] || EN.HALLS.concert : hall;
    const sr = ctx.sampleRate, rt = Math.max(0.05, H.rt60 || 0.05);
    const key = [sr, rt, H.pre, H.size, H.damp || 0].join("|");
    if (irCache.has(key)) { const b = irCache.get(key); irCache.delete(key); irCache.set(key, b); return b; }
    const len = Math.ceil(sr * Math.min(8, rt * 1.4 + 0.1)), buf = ctx.createBuffer(2, len, sr);
    const r = MB.rng(Math.round(rt * 1000) + 3);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      const pre = Math.floor((H.pre || 0.01) * sr);
      // 잔향 꼬리: 고역은 rt60의 55%, 저역은 rt60 그대로(공기 흡수·벽 흡음 근사)
      let lo = 0;
      const tauHi = (rt * 0.55) / 6.91, tauLo = rt / 6.91;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / sr, n = r() * 2 - 1;
        lo += 0.08 * (n - lo);
        const hi = n - lo;
        const fade = Math.min(1, t / 0.03);
        d[i] = fade * (lo * 2.2 * Math.exp(-t / tauLo) + hi * 0.7 * Math.exp(-t / tauHi));
      }
      // 초기 반사: 크기가 클수록 늦고 듬성듬성
      const taps = 6 + Math.round(H.size * 6);
      for (let j = 0; j < taps; j++) {
        const t = (H.pre || 0.01) * (0.3 + j * 0.45) + r() * 0.006 * (1 + H.size * 4);
        const i = Math.floor(t * sr); if (i < len) d[i] += (r() < 0.5 ? -1 : 1) * 0.6 * Math.exp(-j * 0.25) * (ch ? 0.9 : 1);
      }
    }
    // 에너지(Σh²)를 1로 맞춘다: 컨볼버가 소리의 세기를 바꾸지 않으므로 잔향의 크기는 믹서의 잔향 비율만으로 정해진다.
    // (최댓값으로 맞추면 긴 잔향일수록 에너지가 +18…+28 dB 커져 직접음보다 잔향이 훨씬 커지고 마스터에서 찌그러진다.)
    let e = 0;
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) e += d[i] * d[i]; }
    const norm = 1 / Math.sqrt(e / 2 || 1);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] *= norm; }
    irCache.set(key, buf);
    // 세이빈 실험처럼 홀을 계속 새로 만들면 IR(최대 8초 스테레오 ≈ 3 MB)이 끝없이 쌓이므로 오래된 것부터 버린다
    if (irCache.size > 10) irCache.delete(irCache.keys().next().value);
    return buf;
  };
  /** 세이빈 공식: RT60 = 0.161·V / A (V 부피 m³, A 흡음력 m²) */
  EN.sabine = (V, A) => (0.161 * V) / Math.max(1e-6, A);

  /* ------------------------------------------------------------ mixer */
  /**
   * 채널 믹서. 악기는 channel(id).input에 연결한다(EN.player가 알아서 연결).
   *   const mx = EN.mixer({hall:"concert", wet:0.3, width:1})
   *   const ch = mx.channel("vn1", {gain:1, pan:-0.5, dist:0.2, mute:false, solo:false, inst:"violin"})
   *   ch.set({gain, pan, dist}); mx.solo("vn1", true); mx.mute("vc", true); mx.setHall("cathedral"); mx.setWet(0.4)
   *   ch.level() → 최근 RMS(dBFS) · ch.analyser · mx.analyser(마스터)
   * 거리(dist 0 앞 … 1 뒤): 직접음이 작아지고(1/(1+1.6·d)), 고역이 줄고, 조금 늦게 오며, 잔향 비율이 커진다.
   * 잔향: 임펄스 응답은 에너지 1로 정규화돼 있고, 잔향 비율(wet)은 직접음 대비 잔향의 크기다. 콘서트홀·wet 0.32·거리 0.3에서
   * 잔향 대 직접음 비가 약 −4 dB(좋은 객석의 균형)이고, 잔향 시간이 길수록 조금 더 커진다.
   * 홀을 바꾸면 두 컨볼버 사이를 짧게 크로스페이드해 앞 홀의 꼬리가 뚝 끊기지 않게 하고, 잔향 비율만 바꿀 때는 컨볼버를 건드리지 않는다
   * (ConvolverNode.buffer를 다시 넣으면 잔향이 처음부터 다시 쌓이며 소리가 끊긴다).
   */
  EN.mixer = function (o = {}) {
    const ctx = MB.ctx(); if (!ctx) return null;
    const out = ctx.createGain(); out.gain.value = o.gain != null ? o.gain : 1;
    // 여러 파트가 더해져도 마스터 리미터가 계속 눌러 대지 않도록 둔 고정 여유(headroom)
    const trim = ctx.createGain(); trim.gain.value = o.trim != null ? o.trim : 0.7;
    out.connect(trim); trim.connect(o.dest || MB.out);
    const sendBus = ctx.createGain();
    const slots = [0, 1].map(() => { const conv = ctx.createConvolver(); conv.normalize = false; const g = ctx.createGain(); g.gain.value = 0; sendBus.connect(conv); conv.connect(g); g.connect(out); return { conv, g }; });
    let cur = 0;
    const an = ctx.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0.7; out.connect(an);
    let hall = o.hall || "concert", wetAmt = o.wet != null ? o.wet : 0.32, width = o.width != null ? o.width : 1;
    const chans = new Map();
    const td = new Float32Array(1024);
    const hallOf = () => (typeof hall === "string" ? EN.HALLS[hall] : hall);
    const wetGain = (H) => (H && H.rt60 ? wetAmt * 2.1 * Math.pow(H.rt60 / 2, 0.35) : 0);
    function applyHall(first) {
      const H = hallOf(), t = ctx.currentTime;
      if (!H || !H.rt60) { slots.forEach((s) => s.g.gain.setTargetAtTime(0, t, 0.05)); return; }
      const buf = EN.impulse(ctx, H);
      if (slots[cur].conv.buffer !== buf) {
        // 지금 쓰지 않는 쪽에 새 임펄스 응답을 넣고 크로스페이드(처음 만들 때는 바로)
        const nx = first || !slots[cur].conv.buffer ? cur : 1 - cur;
        if (nx !== cur) slots[cur].g.gain.setTargetAtTime(0, t, 0.12);
        slots[nx].conv.buffer = buf;
        cur = nx;
      }
      slots[cur].g.gain.setTargetAtTime(wetGain(H), t, first ? 0.005 : 0.06);
    }
    function anySolo() { for (const c of chans.values()) if (c.state.solo) return true; return false; }
    function applyAll() { chans.forEach((c) => c.apply()); }
    const api = {
      ctx, out, trim, verb: sendBus, analyser: an,
      get hall() { return hall; }, get wet() { return wetAmt; },
      setHall(h) { hall = h; applyHall(); },
      setWet(w) { wetAmt = w; const H = hallOf(); slots[cur].g.gain.setTargetAtTime(wetGain(H), ctx.currentTime, 0.03); },
      setWidth(w) { width = w; applyAll(); },
      channel(id, opts = {}) {
        if (chans.has(id)) return chans.get(id);
        const input = ctx.createGain();
        const fader = ctx.createGain();
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.5;
        const dl = ctx.createDelay(0.1);
        const pan = ctx.createStereoPanner();
        const direct = ctx.createGain(), send = ctx.createGain();
        const a = ctx.createAnalyser(); a.fftSize = 2048; a.smoothingTimeConstant = 0.6;
        input.connect(fader); fader.connect(a); fader.connect(lp); lp.connect(dl); dl.connect(pan); pan.connect(direct); direct.connect(out);
        lp.connect(send); send.connect(sendBus);
        const I = opts.inst ? EN.inst(opts.inst) : null;
        const c = {
          id, input, analyser: a,
          state: Object.assign({ gain: 1, pan: I ? I.x : 0, dist: I ? I.y : 0.3, mute: false, solo: false, send: 1 }, opts),
          set(p, quiet) { Object.assign(c.state, p); if (p.solo != null) applyAll(); else c.apply(); },
          apply() {
            const s = c.state, t = ctx.currentTime, d = MB.clamp(s.dist, 0, 1.2);
            const audible = !s.mute && (!anySolo() || s.solo);
            fader.gain.setTargetAtTime(audible ? s.gain : 0, t, 0.02);
            pan.pan.setTargetAtTime(MB.clamp(s.pan * width, -1, 1), t, 0.02);
            direct.gain.setTargetAtTime(1 / (1 + 1.6 * d), t, 0.03);
            lp.frequency.setTargetAtTime(17000 - 10000 * Math.min(1, d), t, 0.03);
            dl.delayTime.setTargetAtTime(0.002 + d * 0.014, t, 0.03);
            send.gain.setTargetAtTime(s.send * (0.55 + 0.25 * d), t, 0.03);
          },
          /** 최근 RMS(dBFS) */
          level() { a.getFloatTimeDomainData(td); let s = 0; for (let i = 0; i < td.length; i++) s += td[i] * td[i]; return MB.db(Math.sqrt(s / td.length)); },
          get audible() { return !c.state.mute && (!anySolo() || c.state.solo); },
        };
        chans.set(id, c);
        c.apply();
        return c;
      },
      has: (id) => chans.has(id),
      channels: () => [...chans.values()],
      mute(id, v) { const c = chans.get(id); if (c) c.set({ mute: v }); },
      solo(id, v) { const c = chans.get(id); if (c) c.set({ solo: v }); },
      clearSolo() { chans.forEach((c) => { c.state.solo = false; }); applyAll(); },
      level() { an.getFloatTimeDomainData(td); let s = 0; for (let i = 0; i < td.length; i++) s += td[i] * td[i]; return MB.db(Math.sqrt(s / td.length)); },
    };
    applyHall(true);
    return api;
  };

  /* ------------------------------------------------------------ notation & pieces */
  /**
   * 짧은 악보 표기 → 음표 배열. 박 단위.
   *   EN.parse("mf C5:1 D5:.5 E5:.5 | F5:2 r:2 [C4 E4 G4]:4 G4:1' >A4:1 @pizz C4 @arco")
   *   음 이름 + 옥타브(C4=60), ♯은 # 또는 ♯, ♭은 b 또는 ♭. ":길이"를 생략하면 앞 음의 길이.
   *   r = 쉼표, [ ] = 화음, | = 마디줄(무시), 셈여림(ppp…fff), 끝의 ' = 스타카토, 앞의 > = 악센트, @주법 = 이후 주법.
   *   → [{t, d, m, vel, art}] (화음은 같은 t의 여러 음)
   */
  EN.parse = function (src, o = {}) {
    const out = []; let t = o.t || 0, d = 1, vel = o.vel != null ? o.vel : EN.DYN.mf, art = o.art || "";
    const toks = String(src).replace(/\[/g, " [ ").replace(/\]/g, " ] ").split(/\s+/).filter(Boolean);
    const noteOf = (s) => MB.parseNote(s.replace("♯", "#").replace("♭", "b"));
    for (let i = 0; i < toks.length; i++) {
      let tk = toks[i];
      if (tk === "|") continue;
      if (EN.DYN[tk] != null) { vel = EN.DYN[tk]; continue; }
      if (tk[0] === "@") { art = tk.slice(1) === "arco" || tk.slice(1) === "ord" ? "" : tk.slice(1); continue; }
      if (tk === "[") {
        const ms = []; i++;
        while (i < toks.length && toks[i] !== "]") { ms.push(noteOf(toks[i])); i++; }
        let after = toks[i + 1] && toks[i + 1][0] === ":" ? toks[++i] : "";
        let a = art, accent = false;
        if (after.endsWith("'")) { a = "stacc"; after = after.slice(0, -1); }
        if (after.length > 1) d = parseFloat(after.slice(1));
        ms.forEach((m) => out.push({ t, d, m, vel: accent ? Math.min(1, vel + 0.15) : vel, art: a }));
        t += d; continue;
      }
      let accent = false, a = art;
      if (tk[0] === ">") { accent = true; tk = tk.slice(1); }
      if (tk.endsWith("'")) { a = "stacc"; tk = tk.slice(0, -1); }
      const [nm, len] = tk.split(":");
      if (len) d = parseFloat(len);
      if (nm === "r") { t += d; continue; }
      const m = noteOf(nm);
      if (m == null || isNaN(m)) continue;
      out.push({ t, d, m, vel: accent ? Math.min(1, vel + 0.15) : vel, art: a });
      t += d;
    }
    return out;
  };
  /** 음표 배열의 길이(박) */
  EN.length = (notes) => notes.reduce((mx, n) => Math.max(mx, n.t + n.d), 0);
  /** 음표를 반음만큼 옮긴다 */
  EN.shift = (notes, semis) => notes.map((n) => Object.assign({}, n, { m: n.m + semis }));
  /** 박 이동 */
  EN.delay = (notes, beats) => notes.map((n) => Object.assign({}, n, { t: n.t + beats }));
  /** 같은 음표열을 times번 이어 붙인다 */
  EN.repeat = (notes, times, len) => { const L = len || EN.length(notes), out = []; for (let i = 0; i < times; i++) notes.forEach((n) => out.push(Object.assign({}, n, { t: n.t + i * L }))); return out; };

  /**
   * 4성부 화성 붙이기: 소프라노 선율과 코드 진행 → {S, A, T, B} 음표열.
   *   EN.harmonize(melody, [{t, d, sym:"C"}, ...], {bassRhythm:"chord"|"beat", inner:"chord"|"beat", vel})
   *   알토·테너는 화음 구성음에서 앞 음과 가장 가깝게, 소프라노 아래·성부 간격 한 옥타브 이내로,
   *   3음을 빠뜨리지 않고, 외성·내성 사이의 병행 5도·8도를 피하도록 고른다. 베이스는 근음(슬래시면 그 음).
   */
  EN.harmonize = function (melody, chords, o = {}) {
    const R = Object.assign({ A: [55, 74], T: [48, 67], B: [36, 57] }, o.ranges);
    const vel = o.vel != null ? o.vel : EN.DYN.mf;
    const S = melody.map((n) => Object.assign({}, n));
    const A = [], T = [], B = [];
    let prev = null;
    const sopAt = (t0, t1) => { const ns = S.filter((n) => n.t < t1 && n.t + n.d > t0); return ns.length ? ns : [{ m: 79 }]; };
    const parallel = (p, q, a, b) => { // 두 성부 p→a, q→b
      const i1 = MB.mod(p - q, 12), i2 = MB.mod(a - b, 12);
      return p !== a && q !== b && ((i1 === 7 && i2 === 7) || (i1 === 0 && i2 === 0));
    };
    chords.forEach((c) => {
      const pc = parseSym(c.sym);
      if (!pc) return;
      const segs = o.inner === "beat" ? splitBeats(c) : [c];
      segs.forEach((sg, si) => {
        const sops = sopAt(sg.t, sg.t + sg.d), sMin = Math.min(...sops.map((n) => n.m)), sFirst = sops[0].m;
        // 베이스
        let bm = null, bestB = Infinity;
        for (let m = R.B[0]; m <= R.B[1]; m++) {
          if (MB.mod(m, 12) !== pc.bass) continue;
          const cost = prev ? Math.abs(m - prev.B) : Math.abs(m - 45);
          if (cost < bestB) { bestB = cost; bm = m; }
        }
        let best = null, bestC = Infinity;
        for (let a = R.A[0]; a <= Math.min(R.A[1], sMin - 1); a++) {
          if (!pc.pcs.includes(MB.mod(a, 12)) || sFirst - a > 12) continue;
          for (let tn = R.T[0]; tn <= Math.min(R.T[1], a - 1); tn++) {
            if (!pc.pcs.includes(MB.mod(tn, 12)) || a - tn > 12 || tn - bm < 3) continue;
            const set = new Set([sFirst, a, tn, bm].map((m) => MB.mod(m, 12)));
            let cost = 0;
            if (!set.has(pc.third)) cost += 20;
            if (set.size < Math.min(3, pc.pcs.length)) cost += 8;
            if (pc.pcs.length >= 4 && set.size < 4) cost += 3;
            if (prev) {
              cost += Math.abs(a - prev.A) + Math.abs(tn - prev.T);
              const now = [sFirst, a, tn, bm], was = [prev.S, prev.A, prev.T, prev.B];
              for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (parallel(was[i], was[j], now[i], now[j])) cost += 14;
            } else cost += Math.abs(a - 64) * 0.3 + Math.abs(tn - 57) * 0.3;
            // 이끎음(3도가 반음 위로 해결하는 음)을 겹치지 않는다
            if (MB.mod(a, 12) === MB.mod(tn, 12) && MB.mod(a, 12) === pc.third) cost += 6;
            if (cost < bestC) { bestC = cost; best = { a, tn }; }
          }
        }
        if (!best) best = { a: Math.min(sMin - 3, 64), tn: Math.min(sMin - 7, 57) };
        const bv = o.bassRhythm === "beat" ? splitBeats(sg) : [sg];
        A.push({ t: sg.t, d: sg.d, m: best.a, vel }); T.push({ t: sg.t, d: sg.d, m: best.tn, vel });
        bv.forEach((b) => B.push({ t: b.t, d: b.d, m: bm, vel }));
        prev = { S: sFirst, A: best.a, T: best.tn, B: bm };
      });
    });
    return { S, A, T, B };
  };
  function splitBeats(c) { const o = []; for (let t = c.t; t < c.t + c.d - 1e-6; t += 1) o.push({ t, d: Math.min(1, c.t + c.d - t), sym: c.sym }); return o; }
  const QMAP = [["maj7", [0, 4, 7, 11]], ["m7b5", [0, 3, 6, 10]], ["dim7", [0, 3, 6, 9]], ["m7", [0, 3, 7, 10]], ["7", [0, 4, 7, 10]], ["dim", [0, 3, 6]], ["aug", [0, 4, 8]], ["sus4", [0, 5, 7]], ["sus2", [0, 2, 7]], ["m", [0, 3, 7]], ["", [0, 4, 7]]];
  function parseSym(sym) {
    const mm = String(sym).trim().match(/^([A-G])([#♯b♭]?)(.*?)(?:\/([A-G][#♯b♭]?))?$/);
    if (!mm) return null;
    const pcOf = (l, acc) => MB.mod({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[l] + (acc === "#" || acc === "♯" ? 1 : acc === "b" || acc === "♭" ? -1 : 0), 12);
    const root = pcOf(mm[1], mm[2]);
    const q = QMAP.find(([s]) => mm[3] === s) || QMAP[QMAP.length - 1];
    const pcs = q[1].map((i) => MB.mod(root + i, 12));
    const bass = mm[4] ? pcOf(mm[4][0], mm[4].slice(1)) : root;
    return { root, pcs, third: pcs[1], bass, sym };
  }
  EN.parseChord = parseSym;
  /** "C | Am | F G7 | C" → [{t, d, sym}] (마디 안 코드는 균등 분할) */
  EN.progression = function (str, beatsPerBar = 4, t0 = 0) {
    const out = []; let t = t0;
    String(str).split("|").map((b) => b.trim()).filter(Boolean).forEach((bar) => {
      const cs = bar.split(/\s+/), d = beatsPerBar / cs.length;
      cs.forEach((sym) => { out.push({ t, d, sym }); t += d; });
    });
    return out;
  };

  /* --- 곡 사전. 모든 곡은 공유 저작물(작곡가 사후 70년 이상)이거나 이 책을 위해 새로 지은 것이다. */
  function buildPieces() {
    const P = {};
    // 파헬벨 〈캐논 D장조〉(1680년경) — 2마디 화성 바탕 위에서 세 성부가 2마디 간격으로 같은 선율을 따라 들어간다.
    const ground = EN.parse("mf D3:1 A2 B2 F#2 G2 D2 G2 A2");
    const p1 = EN.parse("mf F#5:1 E5 D5 C#5 B4 A4 B4 C#5");
    const p2 = EN.parse("mf D5:1 C#5 B4 A4 G4 F#4 G4 E4");
    const p3 = EN.parse("mf D4:.5 F#4 A4 G4 F#4 D4 F#4 E4 D4 B3 D4 A4 G4 B4 A4 G4");
    const seq = (list, from) => { const o = []; list.forEach((p, i) => EN.delay(p, from + i * 8).forEach((n) => o.push(n))); return o; };
    P.canon = {
      title: "캐논 D장조", by: "J. 파헬벨 (1680년경)", key: "D", bpm: 66, meter: [4, 4], beats: 56,
      order: ["V1", "V2", "V3", "B"], names: { V1: "선율 1", V2: "선율 2(2마디 뒤)", V3: "선율 3(4마디 뒤)", B: "바탕음(그라운드)" },
      roles: { V1: "melody", V2: "counter", V3: "counter", B: "bass" },
      lines: { B: EN.repeat(ground, 7, 8), V1: seq([p1, p2, p3, p1, p2, p3], 8), V2: seq([p1, p2, p3, p1, p2], 16), V3: seq([p1, p2, p3, p1], 24) },
      chords: EN.repeat(EN.progression("D A Bm F#m | G D G A"), 7, 8),
    };
    // 베토벤 교향곡 9번 4악장 〈환희의 송가〉 주제(1824). 화성은 이 책이 붙인 4성부.
    const odeMel = EN.parse("mf F#5:1 F#5 G5 A5 | A5 G5 F#5 E5 | D5 D5 E5 F#5 | F#5:1.5 E5:.5 E5:2 | F#5:1 F#5 G5 A5 | A5 G5 F#5 E5 | D5 D5 E5 F#5 | E5:1.5 D5:.5 D5:2");
    const odeCh = EN.progression("D | A7 | D | D A | D | A7 | D | A D");
    const ode = EN.harmonize(odeMel, odeCh, { bassRhythm: "beat", inner: "chord" });
    P.ode = { title: "환희의 송가", by: "L. v. 베토벤 (1824) · 4성부 화성은 이 책", key: "D", bpm: 96, meter: [4, 4], beats: 32,
      order: ["S", "A", "T", "B"], names: { S: "선율(소프라노)", A: "알토", T: "테너", B: "베이스" }, roles: { S: "melody", A: "harmony", T: "harmony", B: "bass" },
      lines: ode, chords: odeCh };
    // 이 책을 위해 지은 4성부 코랄(C장조, 2프레이즈).
    const chMel = EN.parse("mp E5:1 D5 C5 D5 | E5 F5 E5:2 | G5:1 F5 E5 D5 | C5 D5 E5:2 | E5:1 F5 G5 A5 | G5 F5 E5:2 | D5:1 E5 F5 D5 | C5:4");
    const chCh = EN.progression("C G Am G | C Dm C C | Em Dm Am G | Am G C C | C Dm C F | Em Dm C C | G C Dm G7 | C");
    const chorale = EN.harmonize(chMel, chCh, { inner: "chord" });
    P.chorale = { title: "작은 코랄", by: "이 책을 위해 지은 곡", key: "C", bpm: 72, meter: [4, 4], beats: 32,
      order: ["S", "A", "T", "B"], names: { S: "소프라노", A: "알토", T: "테너", B: "베이스" }, roles: { S: "melody", A: "harmony", T: "harmony", B: "bass" },
      lines: chorale, chords: chCh };
    // 이 책을 위해 지은 금관 팡파르(B♭장조).
    const fMel = EN.parse("f B♭4:.75 B♭4:.25 D5:1 F5:1.5 D5:.5 | B♭5:2 F5:2 | G5:.75 F5:.25 E♭5:1 D5:1 C5:1 | D5:3 r:1 | B♭4:.75 B♭4:.25 D5:1 F5:1.5 D5:.5 | E♭5:1 G5:1 B♭5:1.5 A5:.5 | B♭5:1 F5:1 D5:1 C5:1 | B♭4:3 r:1");
    const fCh = EN.progression("B♭ | B♭ | E♭ F | B♭ | B♭ | E♭ | B♭ B♭ B♭ F | B♭");
    const fan = EN.harmonize(fMel, fCh, { inner: "chord", bassRhythm: "beat", ranges: { A: [55, 72], T: [46, 65], B: [34, 53] } });
    P.fanfare = { title: "축제 팡파르", by: "이 책을 위해 지은 곡", key: "B♭", bpm: 104, meter: [4, 4], beats: 32,
      order: ["S", "A", "T", "B"], names: { S: "선율", A: "둘째 성부", T: "셋째 성부", B: "베이스" }, roles: { S: "melody", A: "harmony", T: "harmony", B: "bass" },
      lines: fan, chords: fCh };
    // 이 책을 위해 지은 목가(F장조, 6/8 느낌을 3박 단위로).
    const pMel = EN.parse("p C5:1 A4:.5 B♭4:.5 C5:1 | D5:1.5 C5:1.5 | B♭4:1 G4:.5 A4:.5 B♭4:1 | C5:3 | A4:1 F4:.5 G4:.5 A4:1 | B♭4:1.5 D5:1.5 | C5:1 B♭4:.5 A4:.5 G4:1 | F4:3");
    const pCh = EN.progression("F | B♭ F | C7 | F | F | B♭ | C7 | F", 3);
    const past = EN.harmonize(pMel, pCh, { inner: "chord", ranges: { A: [53, 72], T: [46, 65], B: [36, 53] } });
    P.pastorale = { title: "들판의 노래", by: "이 책을 위해 지은 곡", key: "F", bpm: 76, meter: [3, 4], beats: 24,
      order: ["S", "A", "T", "B"], names: { S: "선율", A: "알토", T: "테너", B: "베이스" }, roles: { S: "melody", A: "harmony", T: "harmony", B: "bass" },
      lines: past, chords: pCh };
    return P;
  }
  EN.PIECES = buildPieces();
  EN.PIECE_NAMES = Object.fromEntries(Object.entries(EN.PIECES).map(([k, p]) => [k, p.title]));

  /**
   * 편성 사전: 곡의 성부(order의 0·1·2·3번)를 악기에 나눠 준다.
   *   {v: 성부 번호, inst, oct(옥타브 이동), label, players, vel(배수), art}
   *   같은 성부를 두 악기에 주면 '겹치기(더블링)'다.
   */
  EN.ARRANGE = {
    quartet:      { name: "현악 4중주", parts: [{ v: 0, inst: "violin", label: "제1 바이올린" }, { v: 1, inst: "violin", label: "제2 바이올린" }, { v: 2, inst: "viola" }, { v: 3, inst: "cello" }] },
    windQuintet:  { name: "목관 5중주", parts: [{ v: 0, inst: "flute" }, { v: 1, inst: "oboe" }, { v: 2, inst: "clarinet" }, { v: 2, inst: "horn", oct: -1, vel: 0.8 }, { v: 3, inst: "bassoon" }] },
    brassQuintet: { name: "금관 5중주", parts: [{ v: 0, inst: "trumpet", label: "제1 트럼펫" }, { v: 1, inst: "trumpet", label: "제2 트럼펫" }, { v: 2, inst: "horn" }, { v: 3, inst: "trombone", oct: 1 }, { v: 3, inst: "tuba" }] },
    pianoTrio:    { name: "피아노 3중주", parts: [{ v: 0, inst: "violin" }, { v: 3, inst: "cello" }, { v: 1, inst: "piano", label: "피아노(오른손)" }, { v: 2, inst: "piano", label: "피아노(왼손)" }] },
    reedTrio:     { name: "목관 3중주", parts: [{ v: 0, inst: "oboe" }, { v: 1, inst: "clarinet" }, { v: 3, inst: "bassoon" }] },
    stringOrch:   { name: "현악 합주", parts: [{ v: 0, inst: "violin", label: "제1 바이올린", players: 14 }, { v: 1, inst: "violin", label: "제2 바이올린", players: 12 }, { v: 2, inst: "viola", players: 10 }, { v: 3, inst: "cello", players: 8 }, { v: 3, inst: "contrabass", players: 6, label: "더블베이스(옥타브 아래)" }] },
    orchestra:    { name: "2관 오케스트라", parts: [
      { v: 0, inst: "flute", oct: 1, vel: 0.85 }, { v: 0, inst: "oboe" }, { v: 1, inst: "clarinet" }, { v: 3, inst: "bassoon" },
      { v: 2, inst: "horn", vel: 0.8 }, { v: 0, inst: "trumpet", vel: 0.7 }, { v: 3, inst: "trombone", oct: 1, vel: 0.7 },
      { v: 0, inst: "violin", label: "제1 바이올린", players: 14 }, { v: 1, inst: "violin", label: "제2 바이올린", players: 12 }, { v: 2, inst: "viola", players: 10 },
      { v: 3, inst: "cello", players: 8 }, { v: 3, inst: "contrabass", players: 6 }] },
  };
  EN.ARRANGE_NAMES = Object.fromEntries(Object.entries(EN.ARRANGE).map(([k, a]) => [k, a.name]));
  /**
   * 곡 + 편성 → 파트 목록 [{id, label, inst, notes, line, oct, players, vel, art}]
   *   EN.arrange("chorale", "quartet") · EN.arrange(piece, [{v:0, inst:"flute"}, ...]) · {fit:true}면 음역 밖 음을 옥타브로 접는다.
   */
  EN.arrange = function (piece, arr, o = {}) {
    const P = typeof piece === "string" ? EN.PIECES[piece] : piece;
    const A = typeof arr === "string" ? EN.ARRANGE[arr].parts : arr.parts || arr;
    const seen = {};
    return A.map((a, i) => {
      const line = a.line || P.order[a.v || 0];
      const base = P.lines[line] || [];
      const sh = (a.oct || 0) * 12 + (a.semis || 0);
      let notes = base.map((n) => Object.assign({}, n, { m: n.m + sh }));
      if (o.fit !== false) notes = notes.map((n) => (EN.inRange(a.inst, n.m) ? n : Object.assign({}, n, { m: EN.fold(a.inst, n.m), folded: true })));
      seen[a.inst] = (seen[a.inst] || 0) + 1;
      const id = a.id || a.inst + (seen[a.inst] > 1 ? seen[a.inst] : "");
      return { id, label: a.label || EN.name(a.inst), inst: a.inst, notes, line, oct: a.oct || 0, players: a.players || 1, vel: a.vel != null ? a.vel : 1, art: a.art || "", pan: a.pan, dist: a.dist, gain: a.gain };
    });
  };

  /* ------------------------------------------------------------ player */
  /**
   * 여러 파트를 함께 재생한다(내다보기 스케줄러).
   *   const pl = EN.player({ parts: () => parts, bpm: () => 72, loop: true, mixer: () => mx, legato: 0.98,
   *     onNote(part, note, when), onFrame(beat), onStart, onStop, onEnd, length(박) });
   *   pl.start(fromBeat) · pl.stop() · pl.toggle() · pl.running · pl.beat · pl.refresh()(파트가 바뀌면)
   *   파트: {id, inst, notes:[{t,d,m,vel,art}], vel, art, players, real, mute, oct}
   *   mixer가 있으면 파트마다 채널(id)을 만들어 연결한다(처음 만들 때 악기의 기본 자리로).
   */
  EN.player = function (o = {}) {
    let running = false, timer = 0, raf = 0, anchorT = 0, anchorB = 0, spb = 0.5, events = [], ptr = 0, loopN = 0, L = 0;
    const ui = [];
    const live = new Set();
    function build() {
      const parts = fnv(o.parts) || [];
      events = [];
      parts.forEach((p) => { if (!p || p.mute) return; (p.notes || []).forEach((n) => events.push({ p, n })); });
      events.sort((a, b) => a.n.t - b.n.t);
      L = fnv(o.length) || Math.max(1, ...parts.map((p) => (p && p.notes ? EN.length(p.notes) : 0)));
    }
    const beatAt = (time) => anchorB + (time - anchorT) / spb;
    const timeAt = (beat) => anchorT + (beat - anchorB) * spb;
    function dest(p) {
      const mx = fnv(o.mixer);
      if (mx) return mx.channel(p.id, Object.assign({ inst: p.inst }, p.pan != null ? { pan: p.pan } : {}, p.dist != null ? { dist: p.dist } : {}, p.gain != null ? { gain: p.gain } : {})).input;
      return o.dest || MB.out;
    }
    function tick() {
      const ctx = MB.ctx(); if (!ctx) return;
      const nb = fnv(o.bpm) || 90, nspb = 60 / nb;
      if (Math.abs(nspb - spb) > 1e-6) { const now = ctx.currentTime; anchorB = beatAt(now); anchorT = now; spb = nspb; }
      const horizon = ctx.currentTime + 0.18;
      let guard = 0;
      while (running && guard++ < 400) {
        if (ptr >= events.length) {
          if (o.loop) { loopN++; ptr = 0; if (!events.length) break; continue; }
          const endT = timeAt(loopN * L + L);
          if (endT < ctx.currentTime) { api.stop(true); }
          break;
        }
        const ev = events[ptr], b = loopN * L + ev.n.t, when = timeAt(b);
        if (when > horizon) break;
        ptr++;
        if (when < ctx.currentTime - 0.05) continue;
        const p = ev.p, n = ev.n, art = n.art || p.art || "";
        const legato = fnv(o.legato) || 0.97;
        const v = EN.note(p.inst, n.m, {
          when, dur: n.d * spb * legato, vel: MB.clamp((n.vel != null ? n.vel : 0.6) * (p.vel != null ? p.vel : 1), 0.02, 1), art,
          players: p.players, real: p.real, spread: p.spread, dest: dest(p), vib: p.vib, maxSub: p.maxSub,
        });
        if (v) { live.add(v); setTimeout(() => live.delete(v), (when - ctx.currentTime + n.d * spb + 3) * 1000); }
        if (o.onSchedule) o.onSchedule(p, n, when);
        if (o.onNote) ui.push({ time: when, p, n });
      }
    }
    function frame() {
      raf = 0; if (!running) return;
      const ctx = MB.ctx(), now = ctx.currentTime;
      while (ui.length && ui[0].time <= now) { const u = ui.shift(); try { o.onNote(u.p, u.n, u.time); } catch (e) { console.error(e); } }
      ui.sort((a, b) => a.time - b.time);
      if (o.onFrame) { const b = beatAt(now); try { o.onFrame(L ? MB.mod(b, L) : b, b); } catch (e) { console.error(e); } }
      raf = requestAnimationFrame(frame);
    }
    const api = {
      start(from = 0) {
        const ctx = MB.ctx(); if (!ctx) return;
        if (running) api.stop();
        build();
        spb = 60 / (fnv(o.bpm) || 90);
        anchorT = ctx.currentTime + 0.08; anchorB = from; loopN = 0;
        ptr = events.findIndex((e) => e.n.t >= from - 1e-6); if (ptr < 0) ptr = events.length;
        running = true; ui.length = 0;
        tick(); timer = setInterval(tick, 30); raf = requestAnimationFrame(frame);
        o.onStart && o.onStart();
      },
      stop(ended) {
        if (!running) return;
        running = false; clearInterval(timer); timer = 0; if (raf) cancelAnimationFrame(raf); raf = 0; ui.length = 0;
        const ctx = MB.ctx(), t = ctx ? ctx.currentTime : 0;
        live.forEach((v) => { try { v.release(t, 0.12); } catch (e) {} }); live.clear();
        if (ended === true && o.onEnd) o.onEnd();
        o.onStop && o.onStop();
      },
      toggle(from) { running ? api.stop() : api.start(from); return running; },
      /** 파트가 바뀌었을 때(재생 중에도). 지금 위치 이후의 음부터 새 파트로 */
      refresh() {
        if (!running) { build(); return; }
        const ctx = MB.ctx(); const b = beatAt(ctx.currentTime + 0.18);
        build();
        const local = L ? b - loopN * L : b;
        ptr = events.findIndex((e) => e.n.t >= local - 1e-6); if (ptr < 0) ptr = events.length;
      },
      get running() { return running; },
      get beat() { const ctx = MB.ctx(); return running && ctx ? beatAt(ctx.currentTime) : 0; },
      get length() { return L; },
      get spb() { return spb; },
    };
    return api;
  };
  /** 파트 하나를 한 번 재생(간단 버전) → player */
  EN.playPart = (inst, notes, o = {}) => { const pl = EN.player(Object.assign({ parts: [{ id: o.id || inst, inst, notes, players: o.players, art: o.art, vel: o.vel }] }, o)); pl.start(); return pl; };

  /* ------------------------------------------------------------ masking estimate */
  /**
   * 동시에 울리는 소리들의 간단한 마스킹 추정(정적, 근사).
   *   EN.masking([{id, inst, m, vel, gain}], {top:12}) → { parts:[{id, audible(0–1), partials:[{f, db, masked}]}], comps }
   *   각 배음의 레벨 = 스펙트럼 × 악기 음량 등급 × 벨로시티. Bark 축에서 아래쪽 27 dB/Bark, 위쪽 (24 − 0.23·f/kHz… 근사) 12 dB/Bark로
   *   퍼지는 마스킹 곡선을 쌓고, 다른 소리의 곡선 아래(−6 dB 여유)에 들어간 배음은 가려진 것으로 본다.
   */
  EN.masking = function (sources, o = {}) {
    const comps = [];
    sources.forEach((s) => {
      const I = EN.inst(s.inst);
      const L0 = 20 * Math.log10(Math.pow(s.vel != null ? s.vel : 0.6, 1.5) * Math.sqrt(I.level) * (s.players ? Math.sqrt(s.players) : 1) * (s.gain != null ? s.gain : 1)) + 80;
      EN.spectrum(s.inst, s.m, { vel: s.vel, art: s.art }).slice(0, o.top || 16).forEach((p) => {
        if (p.db < -40) return;
        comps.push({ id: s.id, f: p.f, z: EN.bark(p.f), db: L0 + p.db });
      });
    });
    const thrAt = (z, exceptId) => {
      let e = 0;
      comps.forEach((c) => {
        if (c.id === exceptId) return;
        const dz = z - c.z;
        const att = dz < 0 ? 27 * -dz : 12 * dz;
        e += Math.pow(10, (c.db - 10 - att) / 10);
      });
      return 10 * Math.log10(e || 1e-12);
    };
    comps.forEach((c) => { c.thr = thrAt(c.z, c.id); c.masked = c.db < c.thr + (o.margin || 0); });
    const parts = sources.map((s) => {
      const cs = comps.filter((c) => c.id === s.id);
      const tot = cs.reduce((a, c) => a + Math.pow(10, c.db / 10), 0) || 1;
      const aud = cs.filter((c) => !c.masked).reduce((a, c) => a + Math.pow(10, c.db / 10), 0);
      return { id: s.id, inst: s.inst, audible: aud / tot, partials: cs };
    });
    return { parts, comps };
  };

  /* ------------------------------------------------------------ widgets */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /** <option> 목록 */
  EN.options = (keys, sel) => keys.map((k) => `<option value="${k}"${k === sel ? " selected" : ""}>${esc(EN.name(k))}</option>`).join("");

  /**
   * 파트별 피아노 롤(캔버스). 파트마다 한 줄(레인)이고, 레인 안의 높이는 그 파트의 음역에 맞춘다.
   *   const roll = EN.roll("#cv", {parts, beats, beatsPerBar:4, laneH:34, labels:true, onClick(part)})
   *   roll.set(parts, beats) · roll.at(beat)(재생 위치) · roll.flash(partId) · roll.clear() · roll.redraw()
   *   파트에 hidden:true(흐리게), hl:true(강조) 표시를 줄 수 있다.
   */
  EN.roll = function (sel, o = {}) {
    const cv = $(sel);
    let parts = o.parts || [], beats = o.beats || 0, head = -1;
    const flashes = {};
    const bpb = () => fnv(o.beatsPerBar) || 4;
    const labelW = () => (cv.parentElement.clientWidth < 480 ? 58 : 92);
    const laneH = () => o.laneH || (cv.parentElement.clientWidth < 480 ? 26 : 32);
    const view = MB.canvas(cv, (ctx, w, h) => {
      const P = MB.palette(), lw = labelW(), lh = laneH(), n = parts.length;
      const B = beats || Math.max(4, ...parts.map((p) => EN.length(p.notes || [])));
      const X = (b) => lw + (b / B) * (w - lw - 8);
      ctx.font = (lw < 70 ? "11px " : "12px ") + getComputedStyle(document.body).getPropertyValue("--font");
      // 마디선
      for (let b = 0; b <= B + 1e-6; b += 1) {
        ctx.strokeStyle = b % bpb() === 0 ? P.grid : P.grid + "66"; ctx.lineWidth = b % bpb() === 0 ? 1.2 : 0.6;
        ctx.beginPath(); ctx.moveTo(X(b), 4); ctx.lineTo(X(b), 4 + n * lh); ctx.stroke();
      }
      parts.forEach((p, i) => {
        const y0 = 4 + i * lh, col = EN.color(p.inst);
        const ns = p.notes || [];
        const ms = ns.map((x) => x.m);
        const lo = ms.length ? Math.min(...ms) : 60, hi = ms.length ? Math.max(...ms) : 72;
        const span = Math.max(7, hi - lo), pad = 4;
        const Y = (m) => y0 + pad + (1 - (m - lo) / span) * (lh - 2 * pad - 4);
        ctx.globalAlpha = p.hidden ? 0.25 : 1;
        if (p.hl) { ctx.fillStyle = col + "22"; ctx.fillRect(0, y0, w, lh); }
        ctx.fillStyle = flashes[p.id] && performance.now() - flashes[p.id] < 160 ? col : P.text;
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        const lab = p.label || EN.name(p.inst);
        ctx.fillText(lw < 70 ? (EN.inst(p.inst).short || lab) + (p.label && /2|둘째|제2/.test(p.label) ? "2" : "") : lab, 6, y0 + lh / 2);
        ctx.fillStyle = col;
        ns.forEach((x) => {
          const x0 = X(x.t), x1 = X(x.t + x.d) - 1.5, yy = Y(x.m);
          const on = head >= x.t && head < x.t + x.d;
          ctx.globalAlpha = (p.hidden ? 0.25 : 1) * (on ? 1 : 0.72);
          ctx.fillRect(x0, yy - (on ? 2.5 : 2), Math.max(2, x1 - x0), on ? 5 : 4);
          if (x.folded) { ctx.strokeStyle = P.warn; ctx.lineWidth = 1; ctx.strokeRect(x0 - 0.5, yy - 3, Math.max(2, x1 - x0) + 1, 6); }
        });
        ctx.globalAlpha = 1;
        ctx.strokeStyle = P.grid; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, y0 + lh); ctx.lineTo(w, y0 + lh); ctx.stroke();
      });
      if (head >= 0) { ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(head), 2); ctx.lineTo(X(head), 6 + n * lh); ctx.stroke(); }
    }, { get height() { return 10 + Math.max(1, parts.length) * laneH(); } });
    if (o.onClick) cv.addEventListener("click", (e) => { const r = cv.getBoundingClientRect(); const i = Math.floor((e.clientY - r.top - 4) / laneH()); if (parts[i]) o.onClick(parts[i], i); });
    const reheight = () => view.resize();
    return {
      set(ps, b) { parts = ps || []; if (b != null) beats = b; reheight(); },
      at(b) { head = b; view.redraw(); },
      flash(id) { flashes[id] = performance.now(); },
      clear() { head = -1; view.redraw(); },
      redraw: () => view.redraw(),
      get parts() { return parts; },
    };
  };

  /**
   * 믹서 패널(DOM). 채널마다 이름·뮤트·솔로·음량·좌우·레벨 미터.
   *   const ui = EN.mixerUI("#mx", {channels:[{id,label,inst}], mixer:()=>mx, pan:true, onChange(id, state)})
   *   ui.set(channels) · ui.state(id) · 미터는 재생 중 자동으로 움직인다.
   */
  EN.mixerUI = function (sel, o = {}) {
    const el = $(sel);
    let chans = o.channels || [];
    const st = {};
    el.classList.add("en-mixer");
    function render() {
      el.innerHTML = `<div class="en-strip hd" aria-hidden="true"><span>파트</span><span class="ms">뮤트·솔로</span><span>음량</span>${o.pan !== false ? '<span class="pan">좌우</span>' : ""}<span>레벨</span></div>` + chans.map((c) => {
        const s = st[c.id] || (st[c.id] = { gain: c.gain != null ? c.gain : 1, pan: c.pan != null ? c.pan : EN.inst(c.inst).x, mute: !!c.mute, solo: false });
        return `<div class="en-strip" data-id="${esc(c.id)}" style="--c:${EN.color(c.inst)}">
          <span class="nm"><i></i>${esc(c.label || EN.name(c.inst))}</span>
          <span class="ms"><button class="m${s.mute ? " on" : ""}" title="뮤트" aria-label="뮤트">M</button><button class="s${s.solo ? " on" : ""}" title="솔로" aria-label="솔로">S</button></span>
          <label class="vol"><span class="sr">음량</span><input type="range" min="0" max="150" step="1" value="${Math.round(s.gain * 100)}"></label>
          ${o.pan !== false ? `<label class="pan"><span class="sr">좌우</span><input type="range" min="-100" max="100" step="1" value="${Math.round(s.pan * 100)}"></label>` : ""}
          <span class="meter"><b></b></span>
        </div>`;
      }).join("");
      el.querySelectorAll(".en-strip[data-id]").forEach((row) => {
        const id = row.dataset.id, s = st[id];
        const push = () => { const mx = fnv(o.mixer); if (mx) { const c = chans.find((x) => x.id === id); mx.channel(id, { inst: c.inst }).set(Object.assign({ gain: s.gain, mute: s.mute, solo: s.solo }, o.pan !== false ? { pan: s.pan } : {})); } o.onChange && o.onChange(id, s); };
        row.querySelector(".m").onclick = (e) => { s.mute = !s.mute; e.target.classList.toggle("on", s.mute); push(); };
        row.querySelector(".s").onclick = (e) => { s.solo = !s.solo; e.target.classList.toggle("on", s.solo); push(); };
        const v = row.querySelector(".vol input"); v.oninput = () => { s.gain = v.value / 100; push(); };
        const p = row.querySelector(".pan input"); if (p) p.oninput = () => { s.pan = p.value / 100; push(); };
      });
    }
    render();
    // 미터
    MB.loop(el, () => {
      const mx = fnv(o.mixer); if (!mx) return;
      el.querySelectorAll(".en-strip[data-id]").forEach((row) => {
        const id = row.dataset.id; if (!mx.has(id)) return;
        const db = mx.channel(id).level();
        const w = MB.clamp((db + 60) / 54, 0, 1);
        row.querySelector(".meter b").style.width = (w * 100).toFixed(1) + "%";
      });
    });
    return {
      set(cs) { chans = cs; render(); },
      state: (id) => st[id],
      /** 저장된 상태를 믹서에 다시 적용(믹서를 새로 만든 직후) */
      sync() { const mx = fnv(o.mixer); if (!mx) return; chans.forEach((c) => { const s = st[c.id]; mx.channel(c.id, { inst: c.inst }).set(Object.assign({ gain: s.gain, mute: s.mute, solo: s.solo }, o.pan !== false ? { pan: s.pan } : {})); }); },
      setState(id, p) { Object.assign(st[id] || (st[id] = {}), p); render(); this.sync(); },
    };
  };

  /**
   * 무대 배치도(SVG). 객석에서 본 무대: 아래가 지휘자·객석 쪽, 위가 무대 뒤.
   *   const stg = EN.stage("#st", {seats:[{id, inst, x, y, label}], drag:true, onMove(id,x,y), onClick(id)})
   *   stg.set(seats) · stg.light(id, on) · stg.seats
   *   x: −1(왼쪽) … 1(오른쪽) → 팬, y: 0(앞) … 1(뒤) → 거리
   */
  EN.stage = function (sel, o = {}) {
    const el = $(sel);
    let seats = (o.seats || []).map((s) => Object.assign({}, s));
    const W = 600, H = 300, cx = 300, cy = 286;
    const P = (x, y) => [cx + x * 270 * (0.72 + 0.28 * y), cy - 26 - y * 230];
    const inv = (px, py) => { const y = MB.clamp((cy - 26 - py) / 230, 0, 1); const x = MB.clamp((px - cx) / (270 * (0.72 + 0.28 * y)), -1, 1); return [x, y]; };
    el.classList.add("en-stage");
    function render() {
      // 좁은 화면에서는 viewBox가 크게 줄어들므로 자리 원을 키운다(글자 크기는 CSS 미디어 쿼리)
      const R0 = el.clientWidth && el.clientWidth < 480 ? 21 : 15;
      let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="무대 배치도">`;
      s += `<path d="M78 ${cy - 8} L12 22 Q300 0 588 22 L522 ${cy - 8} Z" class="floor"/>`;
      [0.33, 0.66].forEach((y) => { const [x0, yy] = P(-1, y), [x1] = P(1, y); s += `<path d="M${x0} ${yy} Q${cx} ${yy - 40 * (1 - y)} ${x1} ${yy}" class="row"/>`; });
      s += `<rect x="${cx - 14}" y="${cy - 30}" width="28" height="10" rx="3" class="podium"/><text x="${cx}" y="${cy - 6}" text-anchor="middle" class="lbl dim">지휘자</text>`;
      s += `<text x="40" y="${H - 6}" class="lbl dim">← 객석 왼쪽</text><text x="${W - 40}" y="${H - 6}" text-anchor="end" class="lbl dim">객석 오른쪽 →</text>`;
      // 손가락으로도 잡기 쉽게, 보이는 원보다 넓은 히트 영역을 모든 자리 아래 한 겹에 먼저 깐다(보이는 원끼리는 늘 보이는 쪽이 이긴다)
      seats.forEach((st) => { const [x, y] = P(st.x, st.y); s += `<circle class="seat-ha" data-id="${esc(st.id)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(st.r || R0) + 12}"/>`; });
      seats.forEach((st) => {
        const [x, y] = P(st.x, st.y), col = EN.color(st.inst), r = st.r || R0;
        s += `<g class="seat${st.on ? " on" : ""}${st.off ? " off" : ""}" data-id="${esc(st.id)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" style="--c:${col}">
          <circle r="${r}"/><text y="4" text-anchor="middle">${esc(st.short || EN.inst(st.inst).short)}</text>
          ${st.label ? `<text y="${r + (R0 > 15 ? 17 : 12)}" text-anchor="middle" class="lbl">${esc(st.label)}</text>` : ""}</g>`;
      });
      s += `</svg>`;
      el.innerHTML = s;
    }
    render();
    let drag = null;
    // 터치: 무대 위에서도 페이지는 세로로 스크롤되게 두고(CSS touch-action: pan-y), 자리에서 시작한 끌기만 스크롤을 막는다
    if (o.drag) el.addEventListener("touchstart", (e) => { if (e.target.closest && e.target.closest(".seat, .seat-ha")) e.preventDefault(); }, { passive: false });
    const svgPt = (e) => { const svg = el.querySelector("svg"), r = svg.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return [((t.clientX - r.left) / r.width) * W, ((t.clientY - r.top) / r.height) * H]; };
    el.addEventListener("pointerdown", (e) => {
      const g = e.target.closest(".seat, .seat-ha"); if (!g) return;
      const id = g.dataset.id;
      if (o.onClick) o.onClick(id);
      if (!o.drag) return;
      drag = id; el.setPointerCapture && el.setPointerCapture(e.pointerId); e.preventDefault();
    });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const [px, py] = svgPt(e), [x, y] = inv(px, py);
      const st = seats.find((q) => q.id === drag); st.x = x; st.y = y;
      const g = el.querySelector(`.seat[data-id="${CSS.escape(drag)}"]`), ha = el.querySelector(`.seat-ha[data-id="${CSS.escape(drag)}"]`); const [gx, gy] = P(x, y);
      if (g) g.setAttribute("transform", `translate(${gx.toFixed(1)} ${gy.toFixed(1)})`);
      if (ha) { ha.setAttribute("cx", gx.toFixed(1)); ha.setAttribute("cy", gy.toFixed(1)); }
      o.onMove && o.onMove(drag, x, y);
    });
    const end = () => { if (drag && o.onDrop) o.onDrop(drag); drag = null; };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    return {
      set(list) { seats = list.map((s) => Object.assign({}, s)); render(); },
      light(id, on) { const g = el.querySelector(`.seat[data-id="${CSS.escape(id)}"]`); if (!g) return; g.classList.remove("hit"); if (on !== false) requestAnimationFrame(() => g.classList.add("hit")); },
      get seats() { return seats; },
      render,
    };
  };
  /** 편성의 표준 자리(악기 사전의 x·y) */
  EN.seatsFor = (parts) => {
    const cnt = {};
    return parts.map((p) => {
      const I = EN.inst(p.inst); cnt[p.inst] = (cnt[p.inst] || 0) + 1;
      let x = p.pan != null ? p.pan : I.x, y = p.dist != null ? p.dist : I.y;
      if (p.inst === "violin" && cnt.violin === 2 && p.pan == null) { x = -0.2; y = 0.3; }
      if (cnt[p.inst] > 1 && p.inst !== "violin" && p.pan == null) x += 0.12 * (cnt[p.inst] - 1);
      return { id: p.id, inst: p.inst, x, y, label: p.label && p.label !== I.name ? p.label.replace(/\(.*\)/, "") : "" };
    });
  };

  /**
   * 음역표(SVG). 피아노 건반 축(A0–C8) 위에 악기마다 전체 음역(옅게)·편한 음역(진하게) 막대.
   *   EN.rangeChart("#el", {insts:[...], marks:[{m, label}], written:false, notes:{inst:[midi…]}})
   *   written:true면 조옮김 악기의 '기보 음역'을 점선으로 함께 그린다.
   */
  EN.rangeChart = function (sel, o = {}) {
    const el = $(sel);
    const insts = o.insts || EN.ORCH_ORDER.filter((k) => !EN.inst(k).unpitched);
    const lo = o.lo || 21, hi = o.hi || 108, W = 640, lab = 96, rowH = 18, top = 22;
    const H = top + insts.length * rowH + 26;
    const X = (m) => lab + ((m - lo) / (hi - lo)) * (W - lab - 10);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="악기 음역표">`;
    for (let m = 24; m <= hi; m += 12) s += `<line x1="${X(m)}" y1="${top - 6}" x2="${X(m)}" y2="${H - 22}" class="grid"/><text x="${X(m)}" y="${H - 8}" text-anchor="middle" class="tick">C${m / 12 - 1}</text>`;
    s += `<line x1="${X(60)}" y1="${top - 10}" x2="${X(60)}" y2="${H - 22}" class="c4"/><text x="${X(60)}" y="${top - 12}" text-anchor="middle" class="tick">가운데 C</text>`;
    insts.forEach((k, i) => {
      const I = EN.inst(k), y = top + i * rowH, col = EN.color(k);
      s += `<text x="${lab - 8}" y="${y + 12}" text-anchor="end" class="nm">${esc(I.name)}</text>`;
      s += `<rect x="${X(I.lo)}" y="${y + 4}" width="${Math.max(2, X(I.hi) - X(I.lo))}" height="10" rx="3" fill="${col}" opacity=".28"/>`;
      s += `<rect x="${X(I.comfy[0])}" y="${y + 4}" width="${Math.max(2, X(I.comfy[1]) - X(I.comfy[0]))}" height="10" rx="3" fill="${col}" opacity=".85"/>`;
      if (o.written && I.transpose) s += `<rect x="${X(I.lo - I.transpose)}" y="${y + 2}" width="${Math.max(2, X(I.hi - I.transpose) - X(I.lo - I.transpose))}" height="14" rx="3" fill="none" stroke="${col}" stroke-dasharray="3 3"/>`;
      ((o.notes && o.notes[k]) || []).forEach((m) => { s += `<circle cx="${X(m)}" cy="${y + 9}" r="4" fill="var(--bg-elev)" stroke="${EN.inRange(k, m) ? "var(--text)" : "var(--bad)"}" stroke-width="2"/>`; });
    });
    (o.marks || []).forEach((mk) => { s += `<line x1="${X(mk.m)}" y1="${top - 4}" x2="${X(mk.m)}" y2="${H - 22}" stroke="var(--accent-2)" stroke-width="1.5"/>${mk.label ? `<text x="${X(mk.m) + 3}" y="${top - 2}" class="tick" fill="var(--accent-2)">${esc(mk.label)}</text>` : ""}`; });
    s += `</svg>`;
    el.innerHTML = s;
    el.classList.add("en-range");
    return { X };
  };

  /**
   * 정적 스펙트럼 여러 개를 한 그림에(캔버스 그리기 함수 안에서 호출).
   *   EN.drawSpectra(ctx, box, [{inst, m, vel, art, color, label, gainDb}], {fmin:50, fmax:8000, dbMin:-60, log:true, bark:false, stems:true})
   */
  EN.drawSpectra = function (ctx, box, layers, o = {}) {
    const P = MB.palette(), fmin = o.fmin || 50, fmax = o.fmax || 8000, dbMin = o.dbMin != null ? o.dbMin : -60, dbMax = o.dbMax != null ? o.dbMax : 6;
    const X = o.bark ? (f) => box.x + ((EN.bark(f) - EN.bark(fmin)) / (EN.bark(fmax) - EN.bark(fmin))) * box.w
      : (f) => box.x + (Math.log(f / fmin) / Math.log(fmax / fmin)) * box.w;
    const Y = (d) => box.y + box.h - ((MB.clamp(d, dbMin, dbMax) - dbMin) / (dbMax - dbMin)) * box.h;
    ctx.save();
    ctx.font = "10.5px " + getComputedStyle(document.body).getPropertyValue("--mono");
    ctx.strokeStyle = P.grid; ctx.fillStyle = P.dim; ctx.lineWidth = 1; ctx.textAlign = "center"; ctx.textBaseline = "top";
    [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].filter((f) => f >= fmin && f <= fmax).forEach((f) => { const x = X(f); ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.fillText(f >= 1000 ? f / 1000 + "k" : String(f), x, box.y + box.h + 4); });
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let d = 0; d >= dbMin; d -= 20) { const y = Y(d); ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); ctx.fillText(d + "", box.x - 4, y); }
    layers.forEach((L, li) => {
      const S = L.spectrum || EN.spectrum(L.inst, L.m, { vel: L.vel, art: L.art });
      const col = L.color || EN.color(L.inst), g = L.gainDb || 0;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = o.stems === false ? 2 : 2.2;
      const off = (li - (layers.length - 1) / 2) * (o.offset != null ? o.offset : 2.2);
      if (o.stems === false) {
        ctx.beginPath(); let st = false;
        S.forEach((p) => { if (p.f < fmin || p.f > fmax) return; const x = X(p.f), y = Y(p.db + g); st ? ctx.lineTo(x, y) : ctx.moveTo(x, y); st = true; });
        ctx.stroke();
      } else {
        S.forEach((p) => {
          if (p.f < fmin || p.f > fmax) return;
          const x = X(p.f) + off, y = Y(p.db + g);
          ctx.globalAlpha = p.masked ? 0.3 : 1;
          ctx.beginPath(); ctx.moveTo(x, Y(dbMin)); ctx.lineTo(x, y); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
      }
      if (L.label) { ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillStyle = col; ctx.font = "12px " + getComputedStyle(document.body).getPropertyValue("--font"); ctx.fillText("■ " + L.label, box.x + 6 + li * 0, box.y + 4 + li * 16); }
    });
    ctx.restore();
    return { X, Y };
  };

  /** 악기 고르기 칩(DOM): EN.chips("#el", keys, {multi, sel:[...], onChange(list)}) */
  EN.chips = function (sel, keys, o = {}) {
    const el = $(sel); let cur = new Set(o.sel || (o.multi ? [] : [keys[0]]));
    el.classList.add("en-chips");
    const render = () => { el.innerHTML = keys.map((k) => `<button data-k="${k}" class="${cur.has(k) ? "on" : ""}" style="--c:${EN.color(k)}"><i></i>${esc((o.labels && o.labels[k]) || EN.name(k))}</button>`).join(""); };
    render();
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]"); if (!b) return;
      const k = b.dataset.k;
      if (o.multi) { cur.has(k) ? cur.delete(k) : cur.add(k); } else cur = new Set([k]);
      render(); o.onChange && o.onChange(o.multi ? [...cur] : k);
    });
    return { get: () => (o.multi ? [...cur] : [...cur][0]), set(v) { cur = new Set(Array.isArray(v) ? v : [v]); render(); } };
  };
  MB.onTheme(() => document.querySelectorAll(".en-chips button, .en-strip").forEach((b) => { const k = b.dataset.k; if (k) b.style.setProperty("--c", EN.color(k)); }));
})();
