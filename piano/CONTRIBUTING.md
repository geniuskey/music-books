# PianoBook 챕터 작성 가이드

PianoBook은 [MusicBook(fundamentals)](../fundamentals/CONTRIBUTING.md)·[GuitarBook](../guitar/CONTRIBUTING.md)과 같은 엔진·같은 규칙으로 쓴 피아노 교과서다. **이 문서에 없는 규칙과 `MB` API 전체는 `../fundamentals/CONTRIBUTING.md`를 따른다.** 문체·구성의 본보기는 `../guitar/chapters/*.html`(악기 교재)과 `../fundamentals/chapters/*.html`이다.

## 기여물의 라이선스

코드는 MIT, 교재 콘텐츠는 CC BY 4.0. 저작권이 남아 있는 곡의 선율·가사·악보는 넣지 않는다. 공유 저작물(바흐·모차르트·베토벤·쇼팽·민요·찬송가 등 작곡가 사후 70년이 지난 곡과 전래 동요)의 짧은 발췌나 직접 만든 예만 쓴다. 공유 저작물이라도 현대 편곡·교재 고유의 운지를 그대로 옮기지 않는다.

## 구조

빌드 과정 없는 정적 사이트다. `index.html` + `chapters/<slug>.html` + 공통 `css/style.css`(MusicBook 스타일, 피아노 색만 바꿈), `css/piano.css`(건반·악보 위젯), `js/common.js`(전역 `MB`, 챕터 목록 `CHAPTERS`), `js/piano.js`(전역 `PN`). classic script만 쓴다(ES module 금지).

## 원칙

- **한국어**. 대상은 피아노를 처음 배우거나 다시 시작한 성인 학습자, 특히 원리를 알고 싶어 하는 공대생·엔지니어. 손의 동작과 연습 방법을 구체적으로 안내하되, "왜 그런가"를 물리·수학·음악 이론으로 설명한다(필요한 곳에만 KaTeX). 영어·이탈리아어 원어는 `<span class="en">(Damper pedal)</span>`처럼 병기.
- 음 이름은 영문 표기(C D E …, 옥타브 번호는 과학적 음높이 표기 C4 = 가온 다)를 기본으로 하고, 처음 나올 때 우리말(다 라 마 바 사 가 나)·계이름(도 레 미)을 함께 소개한다.
- 개념 → 그림(SVG) → (수식) → **소리 나는 시뮬레이터** → 연습 방법·실제 예 → 요약/퀴즈 순서. 모든 장은 "듣고 → 보고 → 눌러 보고 → 실제 피아노로 따라 한다"를 따른다.
- 시뮬레이터는 **가상 피아노(PN)로 소리를 내는** 것을 우선한다. 소리와 건반·악보가 함께 움직이게 한다(건반 위젯은 자기 피아노 소리를 자동으로 눌림 표시, 악보는 `staff.highlight(i)`).
- 소리는 반드시 클릭·키 입력 안에서 처음 시작한다. 루프에는 항상 정지 버튼. 마이크·MIDI는 사용자가 버튼을 눌렀을 때만 켜고, 끄는 버튼을 둔다.
- 실제 피아노 연습 안내를 `.callout.tip`(연습법)으로 넣는다: 손 모양, 흔한 실수, 템포·횟수 목표.
- 색은 CSS 변수만, 라이트/다크 모두 확인. 폭 360px에서 가로 스크롤 금지(건반 위젯은 자기 안에서만 가로 스크롤한다). SVG는 `viewBox`만 주고 width/height 생략.
- 모델의 가정·한계를 `.sim-note`에 밝힌다. 예: "피아노 소리는 비조화 배음 + 2단 감쇠 + 유니즌 맥놀이로 만든 근사 모델".
- 시뮬레이터 `id`는 `sim-<장 접두사>-<이름>`. 장 접두사: instrument `ins`, keyboard `kb`, touch `tc`, reading `rd`, rhythm `rh`, scales `sc`, chords `ch`, accompaniment `ac`, progressions `prg`, voicings `vc`, pedal `pd`, technique `tq`, styles `sty`, studio `std`. 요소 id·장 전용 CSS 클래스도 같은 접두사를 붙여 충돌을 피한다.

## head 템플릿

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<title>건반과 음 이름 · PianoBook</title>
<meta name="description" content="한 문장 설명(120자 안팎)">
<link rel="stylesheet" href="../css/style.css">
<link rel="stylesheet" href="../css/piano.css">
<script src="../js/common.js"></script>
<script src="../js/piano.js"></script>
<style> /* 이 장 전용 스타일(최소한, 접두사 붙여서) */ </style>
<!-- Cloudflare Web Analytics -->
<!-- End Cloudflare Web Analytics -->
<link rel="stylesheet" href="../../shared/css/book-shell.css">
<script defer src="../../shared/js/book-shell.js" data-book="piano"></script>
</head>
<body data-chapter="keyboard">
<main class="chapter">
  <header class="chapter-hero">
    <div class="eyebrow">Chapter 02</div>
    <h1>건반과 음 이름</h1>
    <p class="lead">...</p>
    <ul class="objectives"><li>...</li></ul>
  </header>
  <section id="layout"><h2>...</h2> ... </section>
  ...
  <section class="keypoints" id="summary"><h2>핵심 정리</h2><ol><li>...</li></ol></section>
  <section class="quiz-sec" id="quiz"><h2>확인 퀴즈</h2><div class="quiz"> ... </div></section>
</main>
<script> /* 시뮬레이터마다 (function(){ ... })(); */ </script>
</body>
</html>
```
소스에는 `<title>`과 `<meta name="description">`(한 줄)만 쓴다. canonical과 Open Graph 태그는 `tools/build.mjs`가 파일 경로, `<title>`·description, `piano/book.json`의 `meta`(`siteName`, 책 홈의 짧은 소개 `summary`)로 배포물에 생성한다. 수식은 빌드가 `tools/katex.mjs`로 미리 렌더링하고 KaTeX 스타일시트만 붙이므로 KaTeX 태그도 넣지 않는다. 소스 파일을 바로 열면 `common.js`가 CDN에서 KaTeX를 불러와 렌더링한다. 이 태그들이 소스에 남아 있거나, TeX 문법 오류가 있거나, 수식 안에 `<` 바로 뒤에 글자가 오면(`j<k` → `j\lt k`) `npm test`나 빌드가 실패한다. 빌드는 정적 HTML의 수식만 렌더링하므로 스크립트가 수식 문자열을 DOM에 넣지 않는다. 상단바·챕터 서랍·목차·이전/다음·푸터·퀴즈는 `common.js`가 처리한다. 컴포넌트(`.sim`, `.sim-head`, `.sim-body.side`, `.sim-view`, `.sim-controls`, `.ctrl`, `.seg`, `.btn-row`, `.btn.primary`, `.sim-readout .stat`, `.sim-note`, `.callout.tip|.note|.warn`, `.formula .where`, `.table-wrap`, `.quiz-q`(`.opt[data-correct]`, `.quiz-exp`), `.pads`, `.steps-grid` …)와 `MB.range/MB.seg/MB.check/MB.stat/MB.canvas/MB.loop` 사용법은 fundamentals 가이드 그대로.

## 피아노 엔진 (`js/piano.js`, 전역 `PN`)

음 번호는 MIDI: 가온 다 C4 = 60, A4 = 69(440 Hz), 88건반 A0 = 21 ~ C8 = 108. 음 이름 문자열은 `MB.parseNote("F#4")`·`MB.noteName(m, flat)`.

### 건반·음 이름·조표
- `PN.isBlack(m)`, `PN.isWhite(m)`, `PN.WHITE_PCS`, `PN.snapWhite(m, dir)`, `PN.keyNumber(m)`(1–88), `PN.freq(m, a4)`, `PN.LOWEST/HIGHEST/MIDDLE_C`.
- `PN.LETTERS`(C..B), `PN.KO_LETTERS`(C→다 …), `PN.SOLFEGE`, `PN.IV_LABELS`/`PN.intervalLabel(semis)` → `"R" "♭3" "5"…`.
- 조표 수 `k`(−7..7, 올림 +, 내림 −): `PN.keyFifths(keyPc, minor, prefer)`, `PN.keyAccidentals(k)` → `{C:0, F:1, …}`, `PN.MAJOR_BY_FIFTHS[k]`, `PN.MINOR_BY_FIFTHS[k]`, `PN.SHARP_ORDER`, `PN.FLAT_ORDER`.
- `PN.spell(m, k, "E♭")` → `{letter, acc, oct, step, name:"E♭4", short, ko:"내림 마", solfege}`. 조표 음은 그대로, 흰 건반 음은 ♮, 그 밖은 올림조 ♯·내림조 ♭(다장조는 C♯ E♭ F♯ G♯ B♭). `PN.name(m, k, ko)`.
- 보표 위치 `step = 옥타브·7 + 글자 번호`(C4 = 28, 높은음자리표 아랫줄 E4 = 30, 윗줄 F5 = 38, 낮은음자리표 아랫줄 G2 = 18, 윗줄 A3 = 26): `PN.stepToMidi(step, k)`, `PN.STEP`.

### 소리
- `PN.piano({dest, soft, stereo, pn})` 가상 피아노(건반마다 한 음, 같은 건반을 다시 치면 앞 음을 짧게 끊고 새로 친다).
  - `p.noteOn(m, vel=0.7, when)` → voice, `p.noteOff(m, when)`, `p.play(m, {when, dur, vel})`, `p.chord([m…], {when, dur, vel, roll(초)})`.
  - 페달: `p.pedal(true | false | 0..1, when)`(0.3–0.6 = 하프 페달), `p.sostenuto(bool, when)`, `p.soft = true`(우나 코르다: 부드럽고 작게). `p.sustain`, `p.held`, `p.sounding`, `p.stop()`.
  - `p.on(cb)` → `cb({type:"on"|"off"|"pedal"|"sostenuto", m, vel, when, value})`. `when`은 오디오 시각이므로 화면은 `PN.at(when, fn)`으로 맞춘다.
  - 페달 판정은 noteOff를 **부르는 순간**의 페달 상태로 한다. 미리 예약하는 재생은 `PN.playEvents`의 페달 이벤트를 쓴다.
  - `PN.default()` 공용 피아노. 정지 버튼은 `p.stop()` 또는 `MB.stopAll()`.
- 음색 모델: `PN.noteModel(m, layer, o)` → `{f0, B, tau1, partials:[{n, f, a, tau}], dur}`(그림·표용), `PN.buffer(ctx, m, layer, o)` 합성 버퍼(캐시). `layer` 0·1·2 = 여리게·보통·세게(`PN.layerOf(vel)`), `PN.velGain(vel)`. 매개변수 `pn:{B(비조화 배율), decay(배율), strike(타현 위치), bright, unison(센트), soft, layer}`는 `PN.piano({pn})`나 `MB.play(m, {inst:"grand", pn})`에 준다. `MB.play(m, {inst:"grand", dur, vel})`도 된다(`MB.render` 오프라인 렌더 포함).
- 물리 도우미: `PN.inharmonicity(m)` 비조화 계수 B, `PN.partialFreq(f0, n, B)` = n·f0·√(1+Bn²), `PN.stretchCents(m)` 레일스백 곡선 근사, `PN.dampTime(m)`, `PN.NO_DAMPER`(90 이상은 댐퍼 없음).
- 셈여림: `PN.DYNAMICS`(`{sym, vel, name}` ppp…fff), `PN.dynVel("mf")`.
- `PN.click(when, accent)` 메트로놈 클릭. `PN.warm(midis)` 버퍼 미리 만들기(클릭 뒤에만).

### 재생·스케줄
- `PN.scheduler(events, {bpm:()=>n, length(박), loop, onEvent(ev, when, spb, loopNo), onUI(ev), onEnd, onStop, onStart})` → `{start, stop, toggle, running, setEvents, beat}`. 이벤트는 `{t(박), ...}`. 화면은 `onUI`에서 바꾼다.
- `PN.playEvents(events, {bpm, piano, loop, length, legato, click, clickOn:()=>bool, beatsPerBar, staff, onNote(ev,i), onSchedule, onTick, onEnd, onStop, swing})` → scheduler. 이벤트 `{t, d, m | ms:[…], vel, hand, roll, legato}` 또는 페달 `{t, pedal:true|false|0.5}`. `staff`를 주면 이벤트 순서 `i`(= 배열 인덱스)로 악보를 강조한다. 건반 표시는 같은 `piano`를 쓰는 건반 위젯이 자동으로 따라간다(`PN.keyboard(sel, {piano})`).
- `PN.recorder(piano)` → `{start(), stop() → [{t(초), d, m, vel}], toBeats(bpm, grid), notes, pedals, elapsed, recording}`.
- `PN.midiIn(cb)`(Promise, `{names, stop()}`; cb `{type:"on"|"off"|"pedal"|"cc", m, vel, value}`), `PN.connectMidi(piano, extra)`. 지원하지 않는 브라우저에서는 예외 → 안내 문구를 보여 준다.

### 이론
- 스케일 운지: `PN.SCALE_FINGERS.major[keyPc]`·`.harmonicMinor[keyPc]` → `{rh:"12312345", lh:"54321321"}`(한 옥타브 상행 8음), `PN.scaleFingering(keyPc, "major"|"harmonicMinor"|MB.SCALES 키, "R"|"L", {octaves, start, down})` → `[{m, finger, deg}]`.
- `PN.autoFinger(midis, "R"|"L")` 동적 계획법 자동 운지(선율 한 줄) → 손가락 배열.
- 코드: `PN.parseChord("F#m7b5" | "Bb7/D")` → `{root, quality(MB.CHORDS 키), bass, flat, sym, iv}`.
- `PN.voicing(chord, "close"|"open"|"shell"|"rootlessA"|"rootlessB"|"drop2", {center, bass, low, inversion, prev})` → `{lh:[], rh:[], all:[], chord}`.
- 반주: `PN.ACCOMP`(키 `block pulse root5 alberti arp ballad waltz stride bossa boogie charleston` → `{name, beats}`), `PN.accomp(chord, pattern, {beats, t0, bass, center, prev, vel})` → `{events, rh, lh, chord}`, `PN.progEvents(["C","Am",{name:"F", beats:2}…], pattern, {beats, bass, center, lead})` → `{events, chords:[{t,name}], length}`(오른손 보이스 리딩).
- `PN.parseNotes("C4/1 D4/.5 [C4 E4 G4]/2 r/1 E4/1~ E4/1", {hand, t0})` → 음표 배열(`/`는 박 길이, `r` 쉼표, `~` 붙임줄).

### 위젯
- `PN.keyboard(sel, {from:48, to:72, labels:"none"|"names"|"octave"|"solfege"|"ko"|"white"|"degrees"|"midi"|"c", root, flat, play:true, vel, piano, qwerty:true, spacePedal, onDown(m, vel, src), onUp(m, src), follow:true, height, minKey, compact})` 건반. 컨테이너는 `<div id="..."></div>`.
  - 포인터로 누르고 미끄러지면 글리산도. `vel`을 주지 않으면 건반 앞쪽을 누를수록 세다. 컴퓨터 키보드 `A W S E D F T G Y H U J K O L P ;`가 한 옥타브 반(가장 최근에 만지거나 화면 가운데에 있는 건반으로), `Z`/`X` 옥타브 이동, `spacePedal`이면 스페이스 = 댐퍼 페달.
  - `kb.mark(list, cls)`(list는 MIDI 또는 `{m, label, cls}`), `kb.set(list, cls)`, `kb.clear(cls?)`, `kb.unmark(m)`, `kb.has(m)`, `kb.flash(m, ms, cls)`, `kb.down(m)`/`kb.up(m)`(눌림 표시만), `kb.press(m, vel)`/`kb.release(m)`(소리 포함), `kb.setRange(from, to)`, `kb.setLabels(mode, root)`, `kb.setFlat(bool)`, `kb.shiftOctave(±1)`, `kb.piano`, `kb.range`.
  - 점 cls: `mark`(주색) `alt`(보조색) `root`(빨강) `ok` `bad` `ghost`(테두리) `dim` `finger`(손가락 번호 원). `onDown`이 `false`를 돌려주면 소리를 내지 않는다(퀴즈용).
- `PN.staff(sel, notes, {clef:"treble"|"bass"|"grand", key(k), time:[4,4], bars, barsPerLine, width(viewBox 폭, 기본 760), chords:[{t,name}], marks:[{t, text, staff, where:"above"|"below"|"between"}], pedal:[{t0,t1}], names:true|"ko"|"solfege", rests:true, split:60, fingering:true, beam:true, onClick(i, note), onPick({step, m, staff, t}), compact, minBeat, showTime, endBar, above, below})` 악보.
  - 음표 `{t(박), d(박: 4 2 1 .5 .25, 점음표 3 1.5 .75), m | ms:[…], hand:"R"|"L"(큰보표에서 보표 결정; 없으면 split 기준), staff, spell:"E♭"|[…], finger(숫자 | 배열), fingerBelow, tie, stem:"up"|"down", cls("ok" "bad" "ghost" "alt"), label, rest:true}`. 빈 박은 쉼표가 자동으로 채워진다. 같은 박 안의 8분·16분음표는 자동으로 빔을 묶는다.
  - `st.highlight(i | [i…] | -1)`, `st.at(beat | null)` 재생선, `st.mark(i, cls)`, `st.unmark(cls)`, `st.clear()`, `st.setNotes(notes, opts)`, `st.setOptions(opts)`, `st.notes`, `st.layout`.
  - 마디를 넘는 음표는 쪼개 주지 않는다. 음표는 마디 안에 넣고 넘어가는 음은 붙임줄(tie)로 이어 쓴다.
- `PN.roll(canvas, {from, to, beats, aspect, notes:[{t, d, m, hand, vel, color}]})` 피아노 롤 → `{set(notes, {from, to, beats}), now(beat|null), draw()}`.
- CSS: `.pn-chords`(코드 버튼 격자, `<button>C<small>C–E–G</small></button>`, `.on`), `.pn-big`(큰 글자), `.pn-hint`(`<kbd>` 키 안내), `.pn-steps`(스텝 격자 `style="--n:8"`, 버튼 `.beat .on .now`).

같은 기능을 장마다 다시 만들지 않는다. 장 고유의 모델(예: 해머 액션 애니메이션, 향판 공명, 셈여림 곡선)만 페이지 스크립트에 둔다. 엔진에 없는 기능이 꼭 필요하면 페이지 스크립트에 작게 만들고, 엔진 수정은 따로 제안한다.

## 검사
```bash
npm test                                   # 수식 렌더러·링크·소스 규칙
node tools/browser-check.cjs piano/        # 콘솔 오류·360px 가로 넘침 (Playwright)
```
