/* Copyright (c) 2026 geniuskey and MusicBooks contributors. MIT (code), CC BY 4.0 (text). */
/* GuitarBook engine: Karplus-Strong strings, fretboard, chord diagrams, rhythm tools, tuner. */
(function () {
  "use strict";

  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const SOLFEGE = ["도", "도#", "레", "레#", "미", "파", "파#", "솔", "솔#", "라", "라#", "시"];
  // Index 0 is the low E (6th string). Chord arrays use the same order.
  const OPEN = [40, 45, 50, 55, 59, 64];
  const STRING_NAMES = ["6번 E", "5번 A", "4번 D", "3번 G", "2번 B", "1번 E"];
  const SCALES = {
    "메이저 펜타토닉": [0, 2, 4, 7, 9],
    "마이너 펜타토닉": [0, 3, 5, 7, 10],
    "블루스": [0, 3, 5, 6, 7, 10],
    "메이저 스케일": [0, 2, 4, 5, 7, 9, 11],
    "내추럴 마이너": [0, 2, 3, 5, 7, 8, 10],
  };
  // frets: -1 muted, 0 open. base: first fret shown in the diagram. barre: [fret, fromString, toString]
  const CHORDS = {
    C: { frets: [-1, 3, 2, 0, 1, 0] },
    Cmaj7: { frets: [-1, 3, 2, 0, 0, 0] },
    C7: { frets: [-1, 3, 2, 3, 1, 0] },
    D: { frets: [-1, -1, 0, 2, 3, 2] },
    Dm: { frets: [-1, -1, 0, 2, 3, 1] },
    Dm7: { frets: [-1, -1, 0, 2, 1, 1] },
    D7: { frets: [-1, -1, 0, 2, 1, 2] },
    E: { frets: [0, 2, 2, 1, 0, 0] },
    Em: { frets: [0, 2, 2, 0, 0, 0] },
    Em7: { frets: [0, 2, 0, 0, 0, 0] },
    E7: { frets: [0, 2, 0, 1, 0, 0] },
    F: { frets: [1, 3, 3, 2, 1, 1], barre: [1, 0, 5] },
    G: { frets: [3, 2, 0, 0, 0, 3] },
    G7: { frets: [3, 2, 0, 0, 0, 1] },
    A: { frets: [-1, 0, 2, 2, 2, 0] },
    Am: { frets: [-1, 0, 2, 2, 1, 0] },
    Am7: { frets: [-1, 0, 2, 0, 1, 0] },
    A7: { frets: [-1, 0, 2, 0, 2, 0] },
    Asus2: { frets: [-1, 0, 2, 2, 0, 0] },
    Asus4: { frets: [-1, 0, 2, 2, 3, 0] },
    Bm: { frets: [-1, 2, 4, 4, 3, 2], base: 2, barre: [2, 1, 5] },
    B7: { frets: [-1, 2, 1, 2, 0, 2] },
  };
  const STRUM_PRESETS = {
    "기본 8비트": "D-DU-UDU",
    "셔플": "D-DU-DU-",
    "발라드": "D-D-D-D-",
    "레게": "-U-U-U-U",
  };
  const FINGER_PRESETS = {
    "베이스 + 고음": "0 4 5 4 0 4 5 4",
    "상행 아르페지오": "0 1 2 3 4 5 4 3",
    "교차 패턴": "0 4 1 4 0 4 2 4",
    "비우기": "- - - - - - - -",
  };
  const SVG_NS = "http://www.w3.org/2000/svg";

  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const nameOf = (m) => NOTES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const shuffle = (a) => a.slice().sort(() => Math.random() - 0.5);

  function parseChord(name) {
    const m = /^([A-G]#?)(.*)$/.exec(name);
    return m ? { root: NOTES.indexOf(m[1]), suffix: m[2] } : null;
  }
  function transpose(name, semis) {
    const p = parseChord(name);
    return NOTES[(p.root + semis + 1200) % 12] + p.suffix;
  }

  /* ---------- audio ---------- */
  let ctx = null;
  let bus = null;
  function audio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      bus = ctx.createGain();
      bus.gain.value = 0.7;
      bus.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  // Karplus-Strong: a noise burst circulating through a delay line with averaging filter.
  function pluckBuffer(c, freq, seconds) {
    const n = Math.floor(c.sampleRate * seconds);
    const period = Math.max(2, Math.round(c.sampleRate / freq));
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
    const buf = c.createBuffer(1, n, c.sampleRate);
    const out = buf.getChannelData(0);
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const next = idx + 1 === period ? 0 : idx + 1;
      out[i] = ring[idx];
      ring[idx] = 0.498 * (ring[idx] + ring[next]);
      idx = next;
    }
    return buf;
  }
  function pluck(midi, when, gain = 0.5) {
    const c = audio();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = pluckBuffer(c, hz(midi), 1.8);
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(bus);
    src.start(when ?? c.currentTime);
  }
  function strum(frets, when, down = true) {
    const c = audio();
    if (!c) return;
    const t0 = when ?? c.currentTime;
    const order = frets.map((_, s) => s).filter((s) => frets[s] >= 0);
    if (!down) order.reverse();
    order.forEach((s, k) => pluck(OPEN[s] + frets[s], t0 + k * 0.022, 0.45));
  }
  function arpeggio(frets, when) {
    const c = audio();
    if (!c) return;
    const t0 = when ?? c.currentTime;
    frets.map((f, s) => (f >= 0 ? OPEN[s] + f : null)).filter((m) => m !== null)
      .forEach((m, k) => pluck(m, t0 + k * 0.2, 0.5));
  }
  function tone(freq, seconds = 2) {
    const c = audio();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = freq;
    o.connect(g);
    g.connect(bus);
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    o.start(t);
    o.stop(t + seconds + 0.05);
  }
  function click(when, accent) {
    const c = audio();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = accent ? 1500 : 1000;
    o.connect(g);
    g.connect(bus);
    g.gain.setValueAtTime(accent ? 0.5 : 0.3, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    o.start(when);
    o.stop(when + 0.06);
  }
  // Lookahead scheduler: audio time is exact, UI highlights are timed with setTimeout.
  function scheduler(stepOf, onStep) {
    let running = false;
    let next = 0;
    let n = 0;
    let timer = 0;
    const timers = new Set();
    function pump() {
      const c = audio();
      if (!c) return;
      while (running && next < c.currentTime + 0.12) {
        onStep(n, next);
        next += stepOf();
        n++;
      }
    }
    return {
      start() {
        const c = audio();
        if (!c || running) return;
        running = true;
        next = c.currentTime + 0.06;
        n = 0;
        pump();
        timer = setInterval(pump, 25);
      },
      stop() {
        running = false;
        clearInterval(timer);
        timers.forEach(clearTimeout);
        timers.clear();
      },
      later(when, fn) {
        const c = audio();
        if (!c || !running) return;
        const id = setTimeout(() => {
          timers.delete(id);
          fn();
        }, Math.max(0, (when - c.currentTime) * 1000));
        timers.add(id);
      },
    };
  }

  /* ---------- shared markup helpers ---------- */
  function select(key, label, options, value) {
    const opts = options
      .map(([v, t]) => `<option value="${v}"${String(v) === String(value) ? " selected" : ""}>${t}</option>`)
      .join("");
    return `<label class="ctrl"><span>${label}</span><select data-k="${key}">${opts}</select></label>`;
  }
  function chordNames() {
    return Object.keys(CHORDS).map((n) => [n, n]);
  }

  /* ---------- fretboard ---------- */
  function fretboard(root) {
    const maxFret = Number(root.dataset.frets) || 12;
    const quiz = root.dataset.mode === "quiz";
    const st = {
      scale: root.dataset.scale || "메이저 펜타토닉",
      key: Number(root.dataset.root) || 0,
      labels: "name",
      target: Math.floor(Math.random() * 12),
      score: 0,
      total: 0,
      tried: false,
      marked: null,
      note: "",
    };
    const X0 = 64;
    const FW = 60;
    const Y0 = 30;
    const GAP = 38;
    const W = X0 + maxFret * FW + 24;
    const H = Y0 + 5.5 * GAP + 30;
    const xOf = (f) => (f === 0 ? X0 - 22 : X0 + (f - 0.5) * FW);
    const yOf = (s) => Y0 + (5 - s) * GAP;
    const label = (p) => (st.labels === "solfege" ? SOLFEGE[p] : NOTES[p]);

    root.classList.add("wd", "fb");
    const controls = [];
    if (!quiz) {
      controls.push(select("scale", "음계", Object.keys(SCALES).map((n) => [n, n]), st.scale));
      controls.push(select("key", "으뜸음", NOTES.map((n, i) => [i, n]), st.key));
    }
    controls.push(select("labels", "표기", [["name", "음이름"], ["solfege", "도레미"]], st.labels));
    root.innerHTML = `
      <div class="wd-head"><span class="wd-tag">${quiz ? "지판 퀴즈" : "지판 탐험"}</span><span class="fb-score"></span></div>
      <div class="ctrl-row">${controls.join("")}</div>
      <p class="fb-prompt"></p>
      <div class="fb-stage"></div>
      <p class="fb-readout" aria-live="polite"></p>`;

    function svg() {
      const inScale = quiz ? null : new Set(SCALES[st.scale].map((i) => (i + st.key) % 12));
      let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="기타 지판">`;
      g += `<rect class="fb-wood" x="${X0}" y="${Y0 - GAP / 2}" width="${maxFret * FW}" height="${GAP * 6}" rx="4"/>`;
      g += `<rect class="fb-nut" x="${X0 - 3}" y="${Y0 - GAP / 2}" width="5" height="${GAP * 6}"/>`;
      for (let f = 1; f <= maxFret; f++) {
        g += `<line class="fb-fret" x1="${X0 + f * FW}" x2="${X0 + f * FW}" y1="${Y0 - GAP / 2}" y2="${Y0 + 5.5 * GAP}"/>`;
        g += `<text class="fb-fnum" x="${xOf(f)}" y="${H - 6}" text-anchor="middle">${f}</text>`;
      }
      [3, 5, 7, 9, 15, 17, 19, 21].forEach((f) => {
        if (f <= maxFret) g += `<circle class="fb-marker" cx="${xOf(f)}" cy="${Y0 + 2.5 * GAP}" r="6"/>`;
      });
      [12, 24].forEach((f) => {
        if (f <= maxFret) {
          g += `<circle class="fb-marker" cx="${xOf(f)}" cy="${Y0 + 1.5 * GAP}" r="6"/>`;
          g += `<circle class="fb-marker" cx="${xOf(f)}" cy="${Y0 + 3.5 * GAP}" r="6"/>`;
        }
      });
      for (let s = 0; s < 6; s++) {
        const y = yOf(s);
        g += `<line class="fb-string" x1="${X0 - 44}" x2="${X0 + maxFret * FW}" y1="${y}" y2="${y}" stroke-width="${(2.6 - s * 0.3).toFixed(2)}"/>`;
        g += `<text class="fb-open-label" x="${X0 - 22}" y="${y - 12}" text-anchor="middle">${NOTES[OPEN[s] % 12]}</text>`;
      }
      for (let s = 0; s < 6; s++) {
        for (let f = 0; f <= maxFret; f++) {
          const p = (OPEN[s] + f) % 12;
          const cls = quiz
            ? st.marked && st.marked.s === s && st.marked.f === f ? (st.marked.ok ? " ok" : " bad") : null
            : inScale.has(p) ? (p === st.key ? " root" : "") : null;
          if (cls === null) continue;
          g += `<circle class="fb-dot${cls}" cx="${xOf(f)}" cy="${yOf(s)}" r="12"/>`;
          g += `<text class="fb-lbl" x="${xOf(f)}" y="${yOf(s) + 4}">${label(p)}</text>`;
        }
      }
      for (let s = 0; s < 6; s++) {
        for (let f = 0; f <= maxFret; f++) {
          const x = f === 0 ? X0 - 44 : X0 + (f - 1) * FW;
          const w = f === 0 ? 44 : FW;
          g += `<rect class="hit" data-s="${s}" data-f="${f}" x="${x}" y="${yOf(s) - GAP / 2}" width="${w}" height="${GAP}" fill="transparent"/>`;
        }
      }
      return g + "</svg>";
    }

    function draw() {
      root.querySelector(".fb-stage").innerHTML = svg();
      root.querySelector(".fb-prompt").textContent = quiz
        ? `찾을 음: ${label(st.target)}`
        : `${st.scale} · ${NOTES[st.key]} 으뜸음`;
      root.querySelector(".fb-readout").textContent = st.note;
      root.querySelector(".fb-score").textContent = quiz ? `${st.score} / ${st.total}` : "";
    }
    function nextQuestion() {
      st.target = Math.floor(Math.random() * 12);
      st.marked = null;
      st.tried = false;
      st.note = "";
      draw();
    }

    root.addEventListener("change", (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      if (k === "key") st.key = Number(e.target.value);
      else st[k] = e.target.value;
      draw();
    });
    root.querySelector(".fb-stage").addEventListener("click", (e) => {
      const hit = e.target.closest(".hit");
      if (!hit) return;
      const s = Number(hit.dataset.s);
      const f = Number(hit.dataset.f);
      const m = OPEN[s] + f;
      pluck(m);
      if (!quiz) {
        st.note = `${STRING_NAMES[s]} · ${f}프렛 · ${nameOf(m)} (${hz(m).toFixed(1)} Hz)`;
        draw();
        return;
      }
      if (!st.tried) {
        st.tried = true;
        st.total++;
      }
      if (m % 12 === st.target) {
        st.score++;
        st.marked = { s, f, ok: true };
        st.note = `정답! ${nameOf(m)}입니다.`;
        draw();
        setTimeout(nextQuestion, 900);
      } else {
        st.marked = { s, f, ok: false };
        st.note = `${nameOf(m)}은(는) 아닙니다. 다시 찾아보세요.`;
        draw();
      }
    });
    draw();
  }

  /* ---------- chord diagrams ---------- */
  function chordSVG(name) {
    const c = CHORDS[name];
    if (!c) return `<p class="wd-hint">${name}</p>`;
    const base = c.base || 1;
    const top = 40;
    const row = 26;
    const x0 = 22;
    const sg = 16;
    const x = (s) => x0 + s * sg;
    const y = (fret) => top + (fret - base + 0.5) * row;
    let g = `<svg class="cd-svg" viewBox="0 0 120 ${top + 4 * row + 16}" role="img" aria-label="${name} 코드 다이어그램">`;
    for (let r = 0; r <= 4; r++) {
      const w = r === 0 && base === 1 ? 4 : 1.2;
      g += `<line class="cd-fret" x1="${x(0)}" x2="${x(5)}" y1="${top + r * row}" y2="${top + r * row}" stroke-width="${w}"/>`;
    }
    for (let s = 0; s < 6; s++) {
      g += `<line class="cd-string" x1="${x(s)}" x2="${x(s)}" y1="${top}" y2="${top + 4 * row}"/>`;
    }
    if (base > 1) g += `<text class="cd-base" x="6" y="${top + row * 0.6}">${base}</text>`;
    c.frets.forEach((f, s) => {
      if (f < 0) g += `<text class="cd-mark" x="${x(s)}" y="${top - 10}">×</text>`;
      else if (f === 0) g += `<circle class="cd-open" cx="${x(s)}" cy="${top - 12}" r="4"/>`;
      else g += `<circle class="cd-dot" cx="${x(s)}" cy="${y(f)}" r="6"/>`;
    });
    if (c.barre) {
      const [f, a, b] = c.barre;
      g += `<rect class="cd-barre" x="${x(a) - 6}" y="${y(f) - 6}" width="${x(b) - x(a) + 12}" height="12" rx="6"/>`;
    }
    return g + "</svg>";
  }
  function chord(root) {
    const name = root.dataset.chord;
    const c = CHORDS[name];
    root.classList.add("wd", "cd-card");
    root.innerHTML = `
      <div class="cd-title">${name}</div>
      ${chordSVG(name)}
      <div class="btn-row">
        <button class="btn" data-act="down">↓ 다운</button>
        <button class="btn" data-act="up">↑ 업</button>
        <button class="btn" data-act="arp">아르페지오</button>
      </div>`;
    root.addEventListener("click", (e) => {
      const act = e.target.dataset.act;
      if (!act || !c || !audio()) return;
      if (act === "arp") arpeggio(c.frets);
      else strum(c.frets, undefined, act === "down");
    });
  }

  function chordQuiz(root) {
    const pool = (root.dataset.pool || "C,Am,F,G,Em,Dm,E,A,D,G7,C7,Em7").split(",");
    let answer = "";
    let score = 0;
    let total = 0;
    let locked = false;
    root.classList.add("wd");
    root.innerHTML = `
      <div class="wd-head"><span class="wd-tag">코드 퀴즈</span><span class="cq-score"></span></div>
      <div class="cq-stage"></div>
      <div class="cq-choices"></div>
      <div class="btn-row">
        <button class="btn" data-act="play" hidden>소리 듣기</button>
        <button class="btn primary" data-act="next" hidden>다음 문제</button>
      </div>
      <p class="wd-hint cq-msg" aria-live="polite"></p>`;
    const $ = (s) => root.querySelector(s);
    function ask() {
      answer = pool[Math.floor(Math.random() * pool.length)];
      const others = shuffle(pool.filter((c) => c !== answer)).slice(0, 3);
      locked = false;
      $(".cq-stage").innerHTML = chordSVG(answer);
      $(".cq-choices").innerHTML = shuffle([answer, ...others])
        .map((c) => `<button class="btn cq-choice" data-c="${c}">${c}</button>`)
        .join("");
      $(".cq-msg").textContent = "다이어그램을 보고 코드를 고르세요.";
      $('[data-act="next"]').hidden = true;
      $('[data-act="play"]').hidden = true;
      $(".cq-score").textContent = `${score} / ${total}`;
    }
    root.addEventListener("click", (e) => {
      const choice = e.target.closest(".cq-choice");
      if (choice && !locked) {
        locked = true;
        total++;
        const ok = choice.dataset.c === answer;
        if (ok) score++;
        choice.classList.add(ok ? "ok" : "bad");
        if (!ok) {
          root.querySelectorAll(".cq-choice").forEach((b) => {
            if (b.dataset.c === answer) b.classList.add("ok");
          });
        }
        $(".cq-msg").textContent = ok ? "정답입니다." : `오답입니다. 정답은 ${answer}입니다.`;
        $(".cq-score").textContent = `${score} / ${total}`;
        $('[data-act="next"]').hidden = false;
        $('[data-act="play"]').hidden = false;
        return;
      }
      const act = e.target.dataset.act;
      if (act === "next") ask();
      if (act === "play" && CHORDS[answer]) strum(CHORDS[answer].frets);
    });
    ask();
  }

  /* ---------- strumming and progressions ---------- */
  function strumPlayer(root) {
    const chords = (root.dataset.chords || "Am,C,G,Em").split(",");
    let bpm = Number(root.dataset.bpm) || 92;
    let pat = (root.dataset.pattern || "D-DU-UDU").split("");
    const counts = ["1", "&", "2", "&", "3", "&", "4", "&"];
    root.classList.add("wd");
    root.innerHTML = `
      <div class="wd-head"><span class="wd-tag">스트로크 연습</span></div>
      <div class="ctrl-row">
        ${select("chord", "코드", chords.map((c) => [c, c]), chords[0])}
        ${select("preset", "패턴", Object.keys(STRUM_PRESETS).map((n) => [STRUM_PRESETS[n], n]), root.dataset.pattern || "D-DU-UDU")}
        <label class="ctrl"><span>BPM <output data-out="bpm">${bpm}</output></span><input type="range" min="50" max="160" value="${bpm}" data-k="bpm"></label>
      </div>
      <div class="sg-count">${counts.map((c) => `<span>${c}</span>`).join("")}</div>
      <div class="sg-cells">${pat.map((v, i) => `<button class="sg-cell" data-i="${i}" data-v="${v}">${v}</button>`).join("")}</div>
      <div class="btn-row">
        <button class="btn primary" data-act="play">▶ 재생</button>
        <span class="wd-hint">칸을 누르면 D(다운)·U(업)·−(쉼)이 바뀝니다.</span>
      </div>`;
    const cells = () => root.querySelectorAll(".sg-cell");
    const chordSel = root.querySelector('[data-k="chord"]');
    const presetSel = root.querySelector('[data-k="preset"]');
    const play = root.querySelector('[data-act="play"]');
    function redraw() {
      cells().forEach((c, i) => {
        c.dataset.v = pat[i];
        c.textContent = pat[i];
      });
    }
    function mark(k) {
      cells().forEach((c, i) => c.classList.toggle("now", i === k));
    }
    const sch = scheduler(() => 30 / bpm, (i, t) => {
      const k = i % 8;
      if (k % 2 === 0) click(t, k === 0);
      const frets = CHORDS[chordSel.value] && CHORDS[chordSel.value].frets;
      if (frets && pat[k] !== "-") strum(frets, t, pat[k] === "D");
      sch.later(t, () => mark(k));
    });
    function setPlaying(on) {
      play.textContent = on ? "■ 정지" : "▶ 재생";
      if (!on) mark(-1);
    }
    play.addEventListener("click", () => {
      if (sch.running) {
        sch.stop();
        setPlaying(false);
      } else if (audio()) {
        sch.start();
        setPlaying(true);
      }
    });
    root.addEventListener("click", (e) => {
      const cell = e.target.closest(".sg-cell");
      if (!cell) return;
      const i = Number(cell.dataset.i);
      pat[i] = { D: "U", U: "-", "-": "D" }[pat[i]];
      redraw();
    });
    root.addEventListener("change", (e) => {
      if (e.target.dataset.k === "preset") {
        pat = e.target.value.split("");
        redraw();
      }
      if (e.target.dataset.k === "bpm") {
        bpm = Number(e.target.value);
        root.querySelector('[data-out="bpm"]').textContent = bpm;
      }
    });
    redraw();
  }

  function progression(root) {
    const chords = (root.dataset.chords || "C,G,Am,F").split(",");
    let bpm = Number(root.dataset.bpm) || 96;
    root.classList.add("wd");
    root.innerHTML = `
      <div class="wd-head"><span class="wd-tag">코드 진행</span></div>
      <div class="prog-chips">${chords.map((c, i) => `<button class="chip" data-chip="${i}">${c}</button>`).join("")}</div>
      <div class="ctrl-row">
        <label class="ctrl"><span>BPM <output data-out="bpm">${bpm}</output></span><input type="range" min="60" max="150" value="${bpm}" data-k="bpm"></label>
        <label class="check"><input type="checkbox" data-k="loop"${root.dataset.loop === "false" ? "" : " checked"}> 반복</label>
      </div>
      <div class="btn-row">
        <button class="btn primary" data-act="play">▶ 재생</button>
        <span class="wd-hint">한 코드는 4박입니다. 칩을 누르면 그 코드가 울립니다.</span>
      </div>`;
    const chips = () => root.querySelectorAll(".chip");
    const play = root.querySelector('[data-act="play"]');
    const loop = () => root.querySelector('[data-k="loop"]').checked;
    function mark(i) {
      chips().forEach((c, k) => c.classList.toggle("now", k === i));
    }
    const sch = scheduler(() => 60 / bpm, (n, t) => {
      const bar = Math.floor(n / 4);
      if (!loop() && bar >= chords.length) {
        sch.stop();
        mark(-1);
        play.textContent = "▶ 재생";
        return;
      }
      const bi = bar % chords.length;
      const beat = n % 4;
      click(t, beat === 0);
      const c = CHORDS[chords[bi]];
      if (c) strum(c.frets, t, true);
      if (beat === 0) sch.later(t, () => mark(bi));
    });
    play.addEventListener("click", () => {
      if (sch.running) {
        sch.stop();
        mark(-1);
        play.textContent = "▶ 재생";
      } else if (audio()) {
        sch.start();
        play.textContent = "■ 정지";
      }
    });
    root.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      const c = chip && CHORDS[chords[Number(chip.dataset.chip)]];
      if (c && audio()) strum(c.frets);
    });
    root.addEventListener("change", (e) => {
      if (e.target.dataset.k !== "bpm") return;
      bpm = Number(e.target.value);
      root.querySelector('[data-out="bpm"]').textContent = bpm;
    });
  }

  /* ---------- fingerstyle grid ---------- */
  function pattern(root) {
    let chordName = root.dataset.chord || "C";
    let bpm = Number(root.dataset.bpm) || 100;
    let steps = [];
    let now = -1;
    root.classList.add("wd");
    root.innerHTML = `
      <div class="wd-head"><span class="wd-tag">핑거스타일 그리드</span></div>
      <div class="ctrl-row">
        ${select("chord", "코드", chordNames(), chordName)}
        ${select("preset", "예제", Object.keys(FINGER_PRESETS).map((n) => [FINGER_PRESETS[n], n]), FINGER_PRESETS["베이스 + 고음"])}
        <label class="ctrl"><span>BPM <output data-out="bpm">${bpm}</output></span><input type="range" min="60" max="160" value="${bpm}" data-k="bpm"></label>
      </div>
      <div class="pt-scroll"><div class="pt-grid" data-grid></div></div>
      <div class="btn-row">
        <button class="btn primary" data-act="play">▶ 재생</button>
        <span class="wd-hint">칸을 눌러 줄을 켜고 끕니다. 한 칸은 8분음표입니다.</span>
      </div>`;
    const grid = root.querySelector("[data-grid]");
    const play = root.querySelector('[data-act="play"]');
    function load(str) {
      steps = str.split(" ").map((t) => new Set(t === "-" ? [] : [Number(t)]));
    }
    function draw() {
      let h = "";
      for (let s = 5; s >= 0; s--) {
        h += `<span class="pt-label">${STRING_NAMES[s]}</span>`;
        for (let i = 0; i < 8; i++) {
          const on = steps[i].has(s) ? " on" : "";
          const cur = i === now ? " now" : "";
          h += `<button class="pt-cell${on}${cur}" data-s="${s}" data-i="${i}" aria-label="${STRING_NAMES[s]} ${i + 1}번째 칸"></button>`;
        }
      }
      grid.innerHTML = h;
    }
    load(root.querySelector('[data-k="preset"]').value);
    const sch = scheduler(() => 30 / bpm, (n, t) => {
      const i = n % 8;
      const frets = CHORDS[chordName] && CHORDS[chordName].frets;
      if (frets) {
        [...steps[i]].filter((s) => frets[s] >= 0).forEach((s) => pluck(OPEN[s] + frets[s], t, 0.5));
      }
      sch.later(t, () => {
        now = i;
        draw();
      });
    });
    play.addEventListener("click", () => {
      if (sch.running) {
        sch.stop();
        now = -1;
        draw();
        play.textContent = "▶ 재생";
      } else if (audio()) {
        sch.start();
        play.textContent = "■ 정지";
      }
    });
    root.addEventListener("click", (e) => {
      const cell = e.target.closest(".pt-cell");
      if (!cell) return;
      const set = steps[Number(cell.dataset.i)];
      const s = Number(cell.dataset.s);
      if (set.has(s)) set.delete(s);
      else set.add(s);
      draw();
    });
    root.addEventListener("change", (e) => {
      const k = e.target.dataset.k;
      if (k === "chord") chordName = e.target.value;
      if (k === "preset") load(e.target.value);
      if (k === "bpm") {
        bpm = Number(e.target.value);
        root.querySelector('[data-out="bpm"]').textContent = bpm;
      }
      if (k !== "bpm") draw();
    });
    draw();
  }

  /* ---------- tuner ---------- */
  // Autocorrelation over lags for 60–1200 Hz. Returns Hz or -1 when the signal is too quiet.
  function detectPitch(buf, sr) {
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    if (Math.sqrt(rms / buf.length) < 0.01) return -1;
    const minLag = Math.floor(sr / 1200);
    const maxLag = Math.floor(sr / 60);
    let best = -1;
    let bestCorr = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i + lag < buf.length; i++) corr += buf[i] * buf[i + lag];
      if (corr > bestCorr) {
        bestCorr = corr;
        best = lag;
      }
    }
    return best > 0 ? sr / best : -1;
  }
  function tuner(root) {
    root.classList.add("wd");
    root.innerHTML = `
      <div class="wd-head"><span class="wd-tag">튜너</span></div>
      <p class="wd-hint">기준음 버튼을 누르면 해당 줄의 목표 음이 울립니다. 기타의 같은 줄을 맞춰 보세요.</p>
      <div class="btn-row">${OPEN.map((m, s) => `<button class="btn" data-midi="${m}">${STRING_NAMES[s]} · ${nameOf(m)}</button>`).join("")}</div>
      <div class="tn-read"><span class="tn-note">–</span><span class="tn-hz">마이크 꺼짐</span><span class="tn-cents"></span></div>
      <div class="tn-meter"><span class="tn-needle"></span></div>
      <div class="btn-row">
        <button class="btn primary" data-act="mic">🎤 마이크로 측정</button>
        <span class="wd-hint">브라우저 마이크 권한이 필요합니다. 자동 상관 방식이라 몇 센트 정도 오차가 있을 수 있습니다.</span>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let stream = null;
    let raf = 0;
    function show(f) {
      if (f < 0) {
        $(".tn-note").textContent = "–";
        $(".tn-hz").textContent = "소리를 기다리는 중";
        $(".tn-cents").textContent = "";
        return;
      }
      const m = 69 + 12 * Math.log2(f / 440);
      const near = Math.round(m);
      const cents = Math.round((m - near) * 100);
      $(".tn-note").textContent = nameOf(near);
      $(".tn-hz").textContent = `${f.toFixed(1)} Hz`;
      $(".tn-cents").textContent = `${cents > 0 ? "+" : ""}${cents} 센트`;
      const needle = $(".tn-needle");
      needle.style.left = `${50 + Math.max(-50, Math.min(50, cents))}%`;
      needle.classList.toggle("ok", Math.abs(cents) < 5);
    }
    function stopMic() {
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      $('[data-act="mic"]').textContent = "🎤 마이크로 측정";
      $(".tn-hz").textContent = "마이크 꺼짐";
      $(".tn-note").textContent = "–";
      $(".tn-cents").textContent = "";
    }
    async function startMic() {
      const c = audio();
      if (!c || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        $(".tn-hz").textContent = "이 브라우저는 마이크를 지원하지 않습니다";
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        $(".tn-hz").textContent = "마이크 권한이 없습니다";
        return;
      }
      const src = c.createMediaStreamSource(stream);
      const an = c.createAnalyser();
      an.fftSize = 2048;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      let last = 0;
      const loop = (ts) => {
        raf = requestAnimationFrame(loop);
        if (ts - last < 80) return;
        last = ts;
        an.getFloatTimeDomainData(buf);
        show(detectPitch(buf, c.sampleRate));
      };
      raf = requestAnimationFrame(loop);
      $('[data-act="mic"]').textContent = "■ 측정 끄기";
    }
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-midi]");
      if (btn) {
        if (audio()) tone(hz(Number(btn.dataset.midi)));
        return;
      }
      if (e.target.dataset.act !== "mic") return;
      if (stream) stopMic();
      else startMic();
    });
  }

  /* ---------- capo ---------- */
  function capoTool(root) {
    let sounding = root.dataset.chord || "G";
    let capo = Number(root.dataset.capo) || 2;
    root.classList.add("wd");
    root.innerHTML = `
      <div class="wd-head"><span class="wd-tag">카포 계산기</span></div>
      <div class="ctrl-row">
        ${select("chord", "듣고 싶은 코드", chordNames(), sounding)}
        <label class="ctrl"><span>카포 <output data-out="capo">${capo}</output>프렛</span><input type="range" min="0" max="7" value="${capo}" data-k="capo"></label>
      </div>
      <div class="capo-result">
        <div class="capo-shape"></div>
        <div class="capo-text"></div>
      </div>
      <div class="btn-row"><button class="btn primary" data-act="play">▶ 소리 듣기</button></div>`;
    const $ = (s) => root.querySelector(s);
    function update() {
      const shape = transpose(sounding, -capo);
      const ok = Boolean(CHORDS[shape]);
      $(".capo-shape").innerHTML = ok ? chordSVG(shape) : "";
      $(".capo-text").innerHTML = ok
        ? `카포 ${capo}프렛에 <b>${shape}</b> 모양을 누르면 <b>${sounding}</b>로 들립니다.`
        : `${shape} 모양은 이 도구의 라이브러리에 없습니다. 다른 카포 위치를 시도해 보세요.`;
      $('[data-out="capo"]').textContent = capo;
      $('[data-act="play"]').disabled = !ok;
    }
    root.addEventListener("change", (e) => {
      if (e.target.dataset.k === "chord") sounding = e.target.value;
      if (e.target.dataset.k === "capo") capo = Number(e.target.value);
      update();
    });
    root.addEventListener("click", (e) => {
      if (e.target.dataset.act !== "play" || !audio()) return;
      const shape = CHORDS[transpose(sounding, -capo)];
      if (shape) strum(shape.frets.map((f) => (f < 0 ? -1 : f + capo)));
    });
    update();
  }

  /* ---------- shell: theme, drawer, progress ---------- */
  function shell() {
    const html = document.documentElement;
    const modes = ["auto", "light", "dark"];
    const labels = { auto: "자동", light: "밝게", dark: "어둡게" };
    const themeBtn = document.getElementById("gb-theme");
    let mode = "auto";
    try {
      mode = localStorage.getItem("gb-theme") || "auto";
    } catch (err) {
      mode = "auto";
    }
    function apply() {
      if (mode === "auto") html.removeAttribute("data-theme");
      else html.setAttribute("data-theme", mode);
      if (themeBtn) themeBtn.textContent = `테마 · ${labels[mode]}`;
    }
    apply();
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        mode = modes[(modes.indexOf(mode) + 1) % modes.length];
        apply();
        try {
          localStorage.setItem("gb-theme", mode);
        } catch (err) {
          // Private windows can block storage; the theme still changes for this page.
        }
      });
    }
    const body = document.body;
    const menu = document.getElementById("gb-menu");
    if (menu) menu.addEventListener("click", () => body.classList.toggle("drawer-open"));
    const backdrop = document.getElementById("gb-backdrop");
    if (backdrop) backdrop.addEventListener("click", () => body.classList.remove("drawer-open"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") body.classList.remove("drawer-open");
    });
    const bar = document.querySelector(".gb-progress");
    if (bar) {
      const update = () => {
        const max = html.scrollHeight - html.clientHeight;
        bar.style.width = max > 0 ? `${(html.scrollTop / max) * 100}%` : "0";
      };
      window.addEventListener("scroll", update, { passive: true });
      update();
    }
  }

  const WIDGETS = {
    fretboard,
    chord,
    "chord-quiz": chordQuiz,
    strum: strumPlayer,
    progression,
    pattern,
    tuner,
    capo: capoTool,
  };
  function init() {
    shell();
    document.querySelectorAll("[data-widget]").forEach((el) => {
      const build = WIDGETS[el.dataset.widget];
      if (build) build(el);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
