# MusicBook 챕터 작성 가이드

## 기여물의 라이선스

기여하는 코드는 MIT, 교재 콘텐츠는 CC BY 4.0으로 제공하는 데 동의해야 합니다. HTML 안에 코드와 콘텐츠가 함께 있어도 각 부분에 해당하는 라이선스를 적용합니다. 적용 범위는 [라이선스 안내](LICENSE.md)를 참고하세요. 제3자 자료(악보, 음원, 표)를 추가할 때는 재사용·배포가 허용되는지 확인하고 출처와 해당 라이선스를 명시하세요. 저작권이 남아 있는 곡의 선율·가사는 넣지 않습니다(공유 저작물이나 직접 만든 예만 사용).

빌드 과정 없는 정적 사이트다. `index.html` + `chapters/<slug>.html` + 공통 `css/style.css`, `js/common.js`.
로컬 실행: `python3 -m http.server 8000` → http://localhost:8000 (file://로 열어도 동작하게 classic script만 사용한다. ES module 금지.)

## 원칙
- **한국어**, 대상은 엔지니어와 공대생(삼각함수·로그·복소수·기초 신호처리를 안다고 가정). 취미 교재지만 "감"이 아니라 **소리를 신호로, 음계를 집합으로, 화성을 그래프로, 리듬을 이산 시계열로** 다루는 공학 교과서다. 영어 원어는 `<span class="en">(Overtone)</span>`처럼 병기.
- 개념 → 직관 그림(SVG) → 수식(KaTeX) → **소리 나는 시뮬레이터** → 실제 수치 예 → 요약/퀴즈 순서.
- 모든 장은 "듣고 → 보고 → 조작하고 → 설명한다"를 따른다. 그래프만 그리는 시뮬레이터보다 **소리를 내는** 시뮬레이터를 우선한다. 소리가 나는 동안 파형/스펙트럼/건반이 함께 움직이게 한다.
- 소리는 반드시 사용자의 클릭·키 입력 안에서 처음 시작한다(브라우저 자동재생 정책). 페이지를 열자마자 소리를 내지 않는다. 계속 울리는 소리(드론·루프)에는 항상 정지 버튼을 둔다.
- 귀 보호: 마스터 리미터가 있지만, 사인파 드론은 `gain` 0.25 이하, 고음(>8 kHz) 실험은 0.1 이하로 시작한다. 청력 테스트류에는 "볼륨을 낮추고 시작" 안내를 넣는다.
- 소리·음악 계산은 직접 구현하지 말고 `MB` 헬퍼(아래)를 쓴다. 장 고유의 모델(예: 플롬프–레벨트 곡선, 유클리드 리듬, 마르코프 체인)은 해당 장의 페이지 스크립트에 둔다.
- 외부 라이브러리는 KaTeX만. 이미지·음원 파일 대신 인라인 SVG/canvas와 실시간 합성을 쓴다.
- 색은 하드코딩하지 말고 CSS 변수(`var(--accent)` 등)나 `MB.palette()`를 쓴다. 라이트/다크 둘 다 읽혀야 한다.
- 모바일(폭 360px)에서 가로 스크롤이 생기면 안 된다. SVG는 `viewBox`만 주고 width/height 속성 생략. 넓은 그리드(시퀀서)는 자기 안에서만 가로 스크롤.
- 모델의 가정·한계를 시뮬레이터 가까이(`.sim-note`)에 밝힌다. 예: "피아노 소리는 배음 12개 가산 합성 근사".

## head 템플릿
```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<title>배음과 음색 · MusicBook</title>
<meta name="description" content="한 문장 설명(120자 안팎)">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<link rel="stylesheet" href="../css/style.css">
<script src="../js/common.js"></script>
<style> /* 이 장 전용 스타일(최소한) */ </style>
<!-- Cloudflare Web Analytics -->
<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "3d6151a0abc94ede89285d462527fa80"}'></script>
<!-- End Cloudflare Web Analytics -->
</head>
<body data-chapter="harmonics">
<main class="chapter">
  <header class="chapter-hero">
    <div class="eyebrow">Chapter 02</div>
    <h1>배음과 음색</h1>
    <p class="lead">...</p>
    <ul class="objectives"><li>...</li></ul>
  </header>

  <section id="intro"><h2>제목</h2> ... </section>   <!-- h2 번호와 우측 목차는 자동 생성 -->
  ...
  <section class="keypoints" id="summary"><h2>핵심 정리</h2><ol><li>...</li></ol></section>
  <section class="quiz-sec" id="quiz"><h2>확인 퀴즈</h2><div class="quiz"> ... </div></section>
</main>
<script> /* 페이지 스크립트: 시뮬레이터마다 (function(){ ... })(); 로 감싼다 */ </script>
</body>
</html>
```
상단바(소리 켜기/끄기 포함), 챕터 서랍, 목차, 이전/다음, 푸터, 테마 토글, 퀴즈 동작, KaTeX 렌더는 `common.js`가 자동 처리한다.
새 챕터는 `common.js`의 `CHAPTERS`에 등록한 뒤 `python3 tools/seo.py`를 실행한다(canonical·OG·JSON-LD와 `sitemap.xml` 생성, 직접 쓰지 않는다).

## 컴포넌트
```html
<figure class="diagram"><svg viewBox="0 0 800 300">...</svg><figcaption><b>그림 2-1.</b> 설명</figcaption></figure>
```
SVG 안 유틸 클래스: `.t .t-dim .t-mono .t-acc`(텍스트), `.s-line .s-axis .s-acc`(선), `.f-surface .f-elev .f-acc .f-acc-soft .f-acc2-soft`(면).

```html
<div class="sim" id="sim-additive">
  <div class="sim-head"><span class="sim-tag">SIMULATOR</span><h3>제목</h3></div>
  <div class="sim-body side">                                    <!-- side: 넓은 화면에서 컨트롤을 오른쪽에 -->
    <div class="sim-view"><canvas id="cv-add"></canvas><div class="mb-kb" id="kb-add"></div></div>
    <div class="sim-controls">
      <label class="ctrl"><span>기본 주파수 <output id="f0-out"></output></span><input type="range" id="f0" min="55" max="880" value="220"></label>
      <div class="ctrl"><span>파형</span><div class="seg" id="wave"><button data-value="saw" class="on">톱니</button><button data-value="square">사각</button></div></div>
      <label class="ctrl"><span>악기</span><select id="inst">...</select></label>
      <label class="check"><input type="checkbox" id="opt"> 옵션</label>
      <div class="btn-row"><button class="btn primary" id="play">▶ 재생</button><button class="btn" id="stop">■ 정지</button></div>
    </div>
  </div>
  <div class="sim-readout">
    <div class="stat"><span class="k">기본 주파수</span><span class="v" id="o-f0">—</span></div>
  </div>
  <div class="sim-note">해볼 것: ... · 모델: ...</div>
</div>
```
- 시뮬레이터 `id`는 `sim-` 접두사로 시작하고, 한 번 정하면 바꾸지 않는다(포털 실험 검색의 앵커).
- 소리를 내는 시뮬레이터에는 `<div class="sim-note">`에 연주 방법(클릭, <kbd>A</kbd>–<kbd>K</kbd> 키)을 적는다.
- 그 밖의 레이아웃: `.pads > button.pad`(코드 패드: `<b>C</b><small>I</small>`, 기능 색 `.t .s .d`), `.slots > .slot`(진행 칸), `.steps-grid > .row > .lab + .cells(style="--n:16") > button.cell(.beat .on .now .alt)`(스텝 그리드), `.staff-wrap`(오선보 컨테이너), `.big-readout`(큰 숫자), `.sim-msg.ok/.bad`(피드백 줄).

콜아웃: `<div class="callout">`, `.tip`, `.warn`, `.deep`(심화). 수식: `<div class="formula">$$...$$<div class="where">여기서 ...</div></div>`, 인라인 `\( ... \)`.
표: `<div class="table-wrap"><table>...</table></div>`. 퀴즈:
```html
<div class="quiz-q"><p>질문?</p><div class="opts">
  <button class="opt">보기</button><button class="opt" data-correct>정답</button>
</div><div class="quiz-exp">해설</div></div>
```

## JS 헬퍼 (`js/common.js`, 전역 `MB`)

### 화면
- `MB.canvas(el, (ctx,w,h)=>{}, {aspect:0.5, height, minHeight, maxHeight})` → `{ctx,w,h,canvas,redraw()}` HiDPI, 리사이즈·테마 변경 시 자동 redraw(배경 `--canvas-bg`).
- `MB.chart(ctx, box|null, {x:[a,b], y:[a,b], logX, logY, xLabel, yLabel, series:[{data:[[x,y]],color,width,dash,fill}], vlines, hlines, points, bands, xFmt, yFmt, xTicks, yTicks})` → `{X,Y,box}`.
- `MB.loop(el, (dt,t)=>{})` 화면에 보일 때만 도는 rAF 루프 `{start,stop,toggle,running}`. `MB.throttle(fn)`.
- `MB.range(id, fmt, onInput)` → getter `get()`, `get.set(v)`. `MB.steps(id, list, fmt, initial, onInput)` 이산 눈금 슬라이더. `MB.seg(id, onChange)` → getter. `MB.check(id, onChange)`. `MB.stat(id, html)`.
- `MB.palette()` → `{bg,text,dim,faint,grid,axis,border,surface,elev,accent,accent2,ok,warn,bad,red,green,blue,series[]}`, `MB.color('accent')`, `MB.onTheme(cb)`, `MB.isDark()`.
- `MB.clamp/lerp/map/smooth`, `MB.mod(n,m)`(양수 나머지), `MB.rng(seed)`(시드 난수, `.range(a,b)`, `.pick(arr)`), `MB.randn()`, `MB.fmt(x, digits)`, `MB.signed(x,d)`, `MB.nearest(list, v)`.
- 그리기: `MB.drawWave(ctx, box, data, {color,width,yScale,from,count,axis})`, `MB.drawBars(ctx, box, amps, {color,colors,max,labels,labelFn})`(배음 막대), `MB.drawSpectrum(ctx, box, dbArray, binHz, {fmin,fmax,dbMin,dbMax,log,color,fill,grid})` → `{X,Y}`.
- `MB.liveView(sel, {mode:"wave"|"spectrum"|"both", fmin, fmax, dbMin, dbMax, span(초), yScale, analyser, aspect})` 마스터 출력의 실시간 오실로스코프/스펙트럼(보일 때만 갱신).
- `MB.keyboard(sel, {lo:48, hi:72, labels:"c"|"all"|"none", flat, inst:"piano"|()=>name, play:true, onDown(m), onUp(m), freqFn(m), keys:true})` → `{press(m), release(m), mark(ms,cls), clear(cls), set(ms,cls), flash(m,ms), label(m,text), releaseAll()}`. 강조 클래스 `mark`(보라) `alt`(청록) `root`(진한 보라) `on`(누름). `onDown`이 `false`를 돌려주면 소리를 내지 않고, `MB.play(..., {dur:null})`로 만든 voice를 돌려주면 그 음을 쓰고 건반을 놓을 때 끈다(사용자 음색·조율 연주용). 컴퓨터 키보드 <kbd>A W S E D F T G Y H U J K O L P ;</kbd>가 화면에 보이는 건반(최근에 만진 것 우선)을 연주한다. 컨테이너는 `<div class="mb-kb" id="..."></div>`(`.short` 클래스로 낮게).
- `MB.staff(sel, chords, {flat, highlight:i, labels:[], subs:[], width, trebleOnly})` 큰보표 SVG. `chords`는 `[[60,64,67], {notes:[...], label:"C", sub:"I"}]`. C4(60) 이상은 높은음자리표, 아래는 낮은음자리표.
- `MB.circlePos(pc, cx, cy, r, "chromatic"|"fifths")` → `[x,y]` (위쪽이 C).
- `MB.playButton(id, onStart, onStop, ["▶ 재생","■ 정지"])` 토글 버튼 → `{set(bool), on}`.

### 음악 이론
- `MB.mtof(m, a4=440)`, `MB.ftom(f)`, `MB.cents(ratio)`, `MB.fromCents(c)`, `MB.A4`.
- `MB.noteName(m, flat=false, octave=true)` → "C4", "F♯3". `MB.pcName(pc, flat)`, `MB.parseNote("Eb4")` → 63, `MB.SHARP_NAMES/FLAT_NAMES/SOLFEGE`, `MB.prefersFlats(keyPc, minor)`.
- `MB.INTERVALS[0..12]` `{s, short:"P5", name:"완전 5도", en, ratio:[3,2]}`, `MB.intervalName(semis)`.
- `MB.SCALES` 키: `major dorian phrygian lydian mixolydian minor locrian harmonicMinor melodicMinor majorPent minorPent blues wholeTone dimHW chromatic` → `{name, steps:[...]}`. `MB.scaleNote(rootMidi, steps, degree)`(음수·옥타브 넘김 허용).
- `MB.pcsToMask(pcs)`, `MB.maskToPcs(mask)`, `MB.intervalVector(pcs)` → [ic1..ic6].
- `MB.CHORDS` 키: `maj min dim aug sus2 sus4 maj6 min6 dom7 maj7 min7 mMaj7 hdim7 dim7 aug7 sus47 add9 dom9 maj9 min9 dom7b9 dom7s9 dom11 min11 maj7s11 dom13 pow` → `{name, sym, iv}`. `MB.chord(rootMidi, quality, inversion)` → MIDI 배열. `MB.chordSymbol(rootPc, quality, flat, bassPc)`. `MB.detectChord(notes, flat)` → `[{root, quality, sym, score, missing, extra}]`.
- `MB.diatonic(keyPc, scale="major", sevenths=false)` → `[{degree, root(pc), quality, roman:"ii7"}]`. `MB.ROMAN`.
- `MB.voiceLead(prevMidis, targetPcs, [lo,hi])` 최소 이동 보이싱.
- `MB.TUNINGS` 키 `equal pythagorean just meantone werckmeister` → `{name, cents[12]}`(근음 기준 절대 센트). `MB.tunedFreq(m, tuning, keyPc)`.

### 오디오
- `MB.ctx()` AudioContext(첫 호출 시 생성·resume; **클릭 핸들러 안에서** 부른다). `MB.now()`. `MB.out`(마스터 입력 GainNode), `MB.analyser`. `MB.stopAll()` 모든 음 정지. `MB.isMuted()/setMuted()`.
- `MB.play(note, {inst, dur=0.5, vel=0.8, when, dest, freq, env:{a,d,s,r}, pan, detune, ks:{decay,bright,pos}})` → voice `{release(t?)}`. `note`는 MIDI 번호·"C#4"·`{freq}`. `dur:null`이면 계속 울리고 `release()`로 끈다. `freq`로 주파수를 직접(조율 실험). `amps:[...]`(·`phases`, `gain`)를 주면 그 배음 구조로 가산 합성한 소리를 낸다.
  악기(`MB.INSTRUMENTS`, 한국어 이름 `MB.INSTRUMENT_NAMES`): `piano epiano organ pluck pad strings bass lead bell sine triangle square saw`.
- `MB.playChord(notes, {strum, ...play옵션})`, `MB.playNotes([{m, t(박), d(박), vel}], {bpm, inst, legato})` → `{stop(), t0, spb}`.
- `MB.drum(name, when, {vel, tune(반음), decay(배수)})` 이름: `kick snare clap rim hat openhat shaker tomL tomM tomH cowbell crash ride` (`MB.DRUM_NAMES`).
- `MB.Clock({bpm:()=>, div:4(박당 스텝), swing:()=>0.5..0.75, length:16, onStep(step, time, stepDur), onUI(step), onStart, onStop})` → `{start(from), stop(), toggle(), running}`. `onStep`에서 `when=time`으로 소리를 **예약**하고, 화면은 `onUI`에서 바꾼다(소리가 실제로 날 때 호출).
- `MB.drone({freq, amps, phases, type, gain})` → `{set({freq, amps, type, gain, glide}), release(), stop()}` 실시간으로 바꿀 수 있는 지속음.
- `MB.wave(amps, phases)` PeriodicWave, `MB.harmonicsOf("saw"|"square"|"triangle"|"sine", n)`, `MB.adsr(param, t0, {a,d,s,r,peak})` → `{level(t), release(t)}`.
- `MB.ksBuffer(ctx, f, {dur, decay, bright, pos})` 카플러스–스트롱 버퍼, `MB.noiseBuffer()`.
- `MB.render(seconds, (ctx, dest)=>{...})` → Promise<Float32Array> (OfflineAudioContext; `MB.play(n, {ctx, dest})`, `MB.drum(n, t, {ctx, dest})`도 그대로 쓸 수 있다). `MB.playBuffer(float32, sr, {loop, gain})` → `{release()}`.
- `MB.mic()` → Promise<{analyser, stop()}> (마이크; 실패 시 안내 문구를 보여 준다).

### DSP
- `MB.fft(re, im, inverse)` 제자리 radix-2. `MB.WINDOWS`(rect hann hamming blackman). `MB.spectrum(samples, win, n)` → dB 배열(사인 진폭 A → 20log10 A).
- `MB.biquad(type, f0, Q, gainDb, fs)` → `{b,a}`(RBJ), `MB.freqResponse(coefs|[...], f, fs)` → dB. `MB.db(g)`, `MB.undb(d)`.

같은 공식을 장마다 다시 쓰지 않는다.

주의: Web Audio `BiquadFilterNode`의 lowpass/highpass `Q`는 선형 Q가 아니라 **dB**(공진 피크 높이)다. 선형 Q를 쓰려면 `20·log10(Q)`로 바꿔 넣는다(bandpass/peaking/notch의 Q는 선형).

## 검사
```bash
python3 tools/seo.py      # 메타·sitemap 갱신
node tools/check.mjs      # (Playwright) 모든 페이지를 열어 콘솔 오류·가로 스크롤·시뮬레이터 수를 점검
```
