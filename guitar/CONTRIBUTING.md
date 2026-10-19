# GuitarBook 챕터 작성 가이드

GuitarBook은 [MusicBook(fundamentals)](../fundamentals/CONTRIBUTING.md)과 같은 엔진·같은 규칙으로 쓴 기타 교과서다. **이 문서에 없는 규칙과 `MB` API 전체는 `../fundamentals/CONTRIBUTING.md`를 따른다.** 문체·구성의 본보기는 `../fundamentals/chapters/*.html`이다.

## 기여물의 라이선스

코드는 MIT, 교재 콘텐츠는 CC BY 4.0. 저작권이 남아 있는 곡의 선율·가사·TAB은 넣지 않는다(공유 저작물이나 직접 만든 예만 사용).

## 구조

빌드 과정 없는 정적 사이트다. `index.html` + `chapters/<slug>.html` + 공통 `css/style.css`(MusicBook 스타일, 기타 색만 바꿈), `css/guitar.css`(기타 위젯), `js/common.js`(전역 `MB`, 챕터 목록 `CHAPTERS`), `js/guitar.js`(전역 `GT`). classic script만 쓴다(ES module 금지).

## 원칙

- **한국어**. 대상은 기타를 처음 잡거나 막 시작한 성인 학습자, 특히 원리를 알고 싶어 하는 공대생·엔지니어. 손의 동작과 연습 방법을 구체적으로 안내하되, "왜 그런가"를 물리·수학·음악 이론으로 설명한다(필요한 곳에만 KaTeX). 영어 원어는 `<span class="en">(Barre chord)</span>`처럼 병기.
- 개념 → 그림(SVG) → (수식) → **소리 나는 시뮬레이터** → 연습 방법·실제 예 → 요약/퀴즈 순서. 모든 장은 "듣고 → 보고 → 조작하고 → 실제 기타로 따라 한다"를 따른다.
- 시뮬레이터는 **가상 기타(GT)로 소리를 내는** 것을 우선한다. 소리와 지판/다이어그램/TAB이 함께 움직이게 한다(`guitar.on(cb)`, `fb.flash`, `tab.highlight`).
- 소리는 반드시 클릭·키 입력 안에서 처음 시작한다. 루프에는 항상 정지 버튼. 마이크는 사용자가 버튼을 눌렀을 때만 켜고, 끄는 버튼을 둔다.
- 실제 기타 연습 안내를 `.callout.tip`(연습법)으로 넣는다: 손 모양, 흔한 실수, 템포·횟수 목표.
- 색은 CSS 변수만, 라이트/다크 모두 확인. 폭 360px에서 가로 스크롤 금지(지판 위젯은 자기 안에서만 가로 스크롤한다). SVG는 `viewBox`만 주고 width/height 생략.
- 모델의 가정·한계를 `.sim-note`에 밝힌다. 예: "기타 소리는 카플러스–스트롱 현 모델 + 몸통 공진 필터 근사".
- 시뮬레이터 `id`는 `sim-<장 접두사>-<이름>`. 장 접두사: instrument `ins`, tuning `tun`, fretboard `fb`, tab `tab`, open-chords `oc`, strumming `str`, progressions `prg`, barre-caged `cg`, voicings `vc`, scales `sc`, techniques `tq`, fingerstyle `fs`, tone `tn`, jam `jam`. 요소 id도 같은 접두사를 붙여 충돌을 피한다.

## head 템플릿

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<title>튜닝과 음높이 · GuitarBook</title>
<meta name="description" content="한 문장 설명(120자 안팎)">
<link rel="canonical" href="https://music.euiyun.com/guitar/chapters/tuning.html">
<meta property="og:type" content="article">
<meta property="og:site_name" content="GuitarBook">
<meta property="og:title" content="튜닝과 음높이 · GuitarBook">
<meta property="og:description" content="(description과 같게)">
<meta property="og:url" content="https://music.euiyun.com/guitar/chapters/tuning.html">
<meta property="og:locale" content="ko_KR">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<link rel="stylesheet" href="../css/style.css">
<link rel="stylesheet" href="../css/guitar.css">
<script src="../js/common.js"></script>
<script src="../js/guitar.js"></script>
<style> /* 이 장 전용 스타일(최소한) */ </style>
<!-- Cloudflare Web Analytics -->
<!-- End Cloudflare Web Analytics -->
<link rel="stylesheet" href="../../shared/css/book-shell.css">
<script defer src="../../shared/js/book-shell.js" data-book="guitar"></script>
</head>
<body data-chapter="tuning">
<main class="chapter">
  <header class="chapter-hero">
    <div class="eyebrow">Chapter 02</div>
    <h1>튜닝과 음높이</h1>
    <p class="lead">...</p>
    <ul class="objectives"><li>...</li></ul>
  </header>
  <section id="standard"><h2>...</h2> ... </section>
  ...
  <section class="keypoints" id="summary"><h2>핵심 정리</h2><ol><li>...</li></ol></section>
  <section class="quiz-sec" id="quiz"><h2>확인 퀴즈</h2><div class="quiz"> ... </div></section>
</main>
<script> /* 시뮬레이터마다 (function(){ ... })(); */ </script>
</body>
</html>
```
canonical은 필수다(`npm test`가 검사). 상단바·챕터 서랍·목차·이전/다음·푸터·퀴즈·KaTeX는 `common.js`가 처리한다. 컴포넌트(`.sim`, `.callout`, `.formula`, `.table-wrap`, `.quiz-q`, `.pads`, `.steps-grid` …)는 fundamentals 가이드 그대로.

## 기타 위젯 (`js/guitar.js`, 전역 `GT`)

**줄 번호 규칙**: 배열 인덱스 `s=0`이 6번 줄(저음 E), `s=5`가 1번 줄(고음 E). 본문의 "n번 줄" = `6 − s`. 코드 모양 문자열도 저음 줄부터: `"x32010"` = C.

### 이론
- `GT.TUNINGS` 키 `standard halfDown dropD dadgad openG openD openE` → `{name, notes:[6개 MIDI]}`. `GT.STANDARD = [40,45,50,55,59,64]`. 튜닝 인자는 키 이름이나 배열 모두 허용.
- `GT.midiAt(s, f, tuning, capo)`, `GT.positionsOf(midi, {tuning, capo, maxFret})` → `[{s,f}]`, `GT.fretPos(n, L=648)` 너트에서 n번 프렛까지 mm, `GT.SCALE_MM`.
- `GT.intervalLabel(semis)` → `"R" "♭3" "5"…`, `GT.IV_LABELS`.
- `GT.parseShape("x32010" | "x,10,12,12,12,10" | [..])` → `[-1,3,2,0,1,0]`, `GT.shapeString(shape)`, `GT.shapeNotes(shape, {tuning, capo})` → 울리는 MIDI(저음→고음), `GT.identify(shape)` → `MB.detectChord` 결과.
- `GT.CHORDS` 사전(키: `C A G E D Am Em Dm F Fs Bm Bb B F#m Cm Gm G4 A7 B7 C7 D7 E7 G7 Am7 Em7 Dm7 Cmaj7 Fmaj7 Amaj7 Dmaj7 Gmaj7 Asus2 Asus4 Dsus2 Dsus4 Esus4 Cadd9 E5 A5 G5`), `GT.chord("Am")` → `{name, shape, fingers, barre, note}`.
- `GT.movable(rootPc, quality, "E"|"A")` 바레 코드 → `{name, shape, fingers, barre, base}`. quality: `maj min dom7 min7 maj7 sus4 pow`(+A형 `sus2`).
- `GT.caged(rootPc)` → 장3화음의 C·A·G·E·D 다섯 모양 `[{form, shape, base, top}]`(프렛 낮은 순). `GT.CAGED_ORDER`.
- `GT.scalePositions(rootPc, steps, {from, to, tuning, capo})` → `[{s,f,midi,pc,deg,iv,label}]`. `steps`는 `MB.SCALES.x.steps`.
- `GT.npsShape(rootPc, steps, {nps:2|3, start(도수 인덱스), minFret})` 한 줄에 n음씩 이어지는 모양. `GT.pentaBox(rootPc, 1..5)` 마이너 펜타토닉 박스.

### 소리
- `GT.guitar({tone, tuning, capo, dest})` 가상 기타. 줄마다 한 음(같은 줄의 새 음이 앞 음을 멈춘다).
  - `g.pluck(s, f, {when, vel, tone, dur, bend(센트), bendAt, bendTime, pos, bright, decay, ring(울림 버퍼 길이 초)})` → voice(`voice.bend(cents, t, glide)`, `voice.release(t)`). f는 카포 기준.
  - `g.strum(shape, {dir:"D"|"U", when, vel, spread(줄 간격 초), strings:[s…](일부 줄만), mute(팜뮤트), dur})`, `g.chuck({when})` 뮤트 칙, `g.damp(when, strings?)`, `g.stop()`.
  - `g.on(cb)` 소리 나는 순간 `cb({type:"pluck"|"strum"|"chuck", s, f, midi, when})`. `g.tone/tuning/capo/dest`는 바꿀 수 있다. `g.midi(s,f)`.
  - `GT.default()` 공용 기타. 정지 버튼은 `g.stop()` 또는 `MB.stopAll()`.
- 음색 `GT.TONES` 키: `steel nylon electric muted raw`(`GT.TONE_NAMES`). 직접 `MB.play(m, {inst:"guitar", dur:null, gt:{tone, bright, decay, pos}})`도 된다(`MB.render`의 오프라인 렌더에도 사용 가능).
- `GT.chuck(when, {vel, dest})` 타격 잡음.
- `GT.scheduler(events, {bpm:()=>n, length(박), loop, onEvent(ev, when, spb, barNo), onUI(ev), onEnd, onStop})` → `{start, stop, toggle, running, setEvents}`. 이벤트는 `{t(박), ...}`. 화면은 `onUI`에서 바꾼다.
- `GT.STRUM_PATTERNS`(키 `quarter eighth folk pop reggae chuck funk16 ballad16` → `{name, slots}`), 슬롯 문자 `D U X -`. `GT.strumEvents(slots, beats=4)` → `[{t, slot, dir, chuck, accent}]`.
- `GT.playTab(notes, {bpm, guitar, loop, tab, onNote(i,n), onEnd})` TAB 음표를 기술 기호까지 반영해 재생 → scheduler.
- `GT.detectPitch(float32, sampleRate, {fmin, fmax})` → `{freq, clarity, rms}` | null (YIN). 마이크는 `MB.mic()` → `{analyser, stop()}`; `analyser.getFloatTimeDomainData(buf)`.

### 위젯
- `GT.fretboard(sel, {frets:12, from:0, labels:"none"|"notes"|"intervals"|"frets"|"octave", root, tuning, capo, flat, play:true, tone, even, onClick(s,f,midi), labelAll, guitar})` 가로 지판(1번 줄이 위, 너트가 왼쪽). 컨테이너는 `<div id="..."></div>`.
  - `fb.mark([{s,f,label,cls}], cls)`, `fb.set(list, cls)`, `fb.clear(cls?)`, `fb.unmark(s,f)`, `fb.has(s,f)`, `fb.flash(s,f,ms)`(줄 떨림 포함), `fb.showShape(shape, {fingers, root, label:"fingers"|"notes"|"intervals", cls, keep})`, `fb.showScale(rootPc, steps, {from, to, label:"notes"|"none", keep})`, `fb.setLabels(mode, root)`, `fb.setTuning(t)`, `fb.setCapo(c)`, `fb.setRange(from, frets)`, `fb.guitar`(내장 기타), `fb.pos(s,f)`.
  - 점 cls: `mark`(주색) `alt`(보조색) `root`(빨강) `open`(테두리) `ghost` `dim` `ok` `bad` `x`(×). `onClick`이 `false`를 돌려주면 소리를 내지 않는다.
- `GT.chordDiagram(el|null, shape, {name, fingers, barre, base, labels:"fingers"|"notes"|"intervals"|"none", root, tuning, capo, highlight:[s…], interactive, onPick(s,f), rows})` 세로 다이어그램. `el`이 null이면 SVG 문자열을 돌려준다. 코드 카드 격자: `<div class="gt-chords"><button>${svg}<small>설명</small></button>…</div>`(`.on` 강조).
- `GT.tab(sel, notes, {beatsPerBar:4, chords:[{t,name}], rhythm:true, barsPerLine})` TAB 악보 → `{highlight(i), at(beat), clear(), setNotes(notes, chords), notes}`. 음표 `{t(박), d(박), s, f, tech:"h"|"p"|"/"|"\\"|"b"|"r"|"~"|"x"|"harm"|"pm", bend(반음)}`.
- `GT.parseAsciiTab(text, {step:0.5})` 텍스트 TAB(1번 줄부터 6줄) → 음표.
- CSS: `.gt-strum`(스트럼 슬롯 격자, `style="--n:8"`, 버튼 `.beat .d .u .x .now`), `.gt-big`(큰 숫자).

같은 기능을 장마다 다시 만들지 않는다. 장 고유의 모델(예: 픽업 빗살 필터, 디스토션 곡선, 벤딩 장력)만 페이지 스크립트에 둔다.

## 검사
```bash
npm test                                   # 메타·링크·canonical
node tools/browser-check.cjs guitar/       # 콘솔 오류·360px 가로 넘침 (Playwright)
```
