# BassBook 챕터 작성 가이드

BassBook은 [MusicBook(fundamentals)](../fundamentals/CONTRIBUTING.md)과 같은 엔진·같은 규칙으로 쓴 베이스 교과서다. **이 문서에 없는 규칙과 `MB` API 전체는 `../fundamentals/CONTRIBUTING.md`를 따른다.** 문체·구성의 본보기는 `../fundamentals/chapters/*.html`과 `../guitar/chapters/*.html`이다.

## 기여물의 라이선스

코드는 MIT, 교재 콘텐츠는 CC BY 4.0. 저작권이 남아 있는 곡의 베이스라인·선율·가사·TAB은 넣지 않는다(공유 저작물이나 직접 만든 예만 사용). 장르를 설명할 때는 "모타운식 점8분 패턴"처럼 **기법**을 적고 곡을 베끼지 않는다.

## 구조

빌드 과정 없는 정적 사이트다. `index.html` + `chapters/<slug>.html` + 공통 `css/style.css`(MusicBook 스타일, 베이스 색만 바꿈), `css/bass.css`(베이스 위젯), `js/common.js`(전역 `MB`, 챕터 목록 `CHAPTERS`), `js/bass.js`(전역 `BS`). classic script만 쓴다(ES module 금지).

## 원칙

- **한국어**. 대상은 베이스를 처음 잡거나 기타·피아노에서 넘어온 성인 학습자, 특히 원리를 알고 싶어 하는 공대생·엔지니어. 두 손의 동작과 연습 방법을 구체적으로 안내하되, "왜 그런가"를 물리·수학·음악 이론으로 설명한다(필요한 곳에만 KaTeX). 영어 원어는 `<span class="en">(Walking bass)</span>`처럼 병기.
- 개념 → 그림(SVG) → (수식) → **소리 나는 시뮬레이터** → 연습 방법·실제 예 → 요약/퀴즈 순서. 모든 장은 "듣고 → 보고 → 조작하고 → 실제 베이스로 따라 한다"를 따른다.
- 베이스는 **혼자 들을 때와 밴드에서 들을 때가 다른 악기**다. 가능하면 드럼 그루브(`BS.band`, `BS.GROOVES`)를 함께 울려 킥과의 관계 속에서 듣게 한다. 솔로 재생 버튼과 밴드 재생 버튼을 나란히 두는 구성이 좋다.
- 시뮬레이터는 **가상 베이스(BS)로 소리를 내는** 것을 우선한다. 소리와 지판/TAB/낮은음자리표가 함께 움직이게 한다(`bass.on(cb)`, `fb.flash`, `tab.highlight`, `staff.highlightAt`).
- 소리는 반드시 클릭·키 입력 안에서 처음 시작한다. 루프에는 항상 정지 버튼. 마이크는 사용자가 버튼을 눌렀을 때만 켜고, 끄는 버튼을 둔다.
- 실제 베이스 연습 안내를 `.callout.tip`(연습법)으로 넣는다: 두 손의 모양, 흔한 실수, 템포·횟수 목표. 특히 **안 쓰는 줄 뮤팅**은 반복해서 짚는다.
- 색은 CSS 변수만, 라이트/다크 모두 확인. 폭 360px에서 가로 스크롤 금지(지판·TAB 위젯은 자기 안에서만 가로 스크롤한다). SVG는 `viewBox`만 주고 width/height 생략.
- 모델의 가정·한계를 `.sim-note`에 밝힌다. 예: "베이스 소리는 카플러스–스트롱 현 모델 + 주법별 픽업·앰프 필터 근사. 실제 줄의 비조화성은 들어 있지 않다."
- **저음은 작은 스피커에서 안 들린다.** 노트북·휴대폰 스피커로 읽는 독자를 위해, 저역이 중요한 장에는 "헤드폰을 권합니다" 안내와 한 옥타브 올려 듣는 버튼(또는 하모닉 강조 토글)을 둔다.
- 시뮬레이터 `id`는 `sim-<장 접두사>-<이름>`. 장 접두사: instrument `ins`, tuning `tun`, hands `hnd`, fretboard `fb`, reading `rd`, roots `rt`, chord-tones `ct`, approach `ap`, scales `sc`, groove `gr`, styles `st`, techniques `tq`, tone `tn`, studio `std`. 요소 id도 같은 접두사를 붙여 충돌을 피한다.

## head 템플릿

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<title>튜닝과 낮은 음 · BassBook</title>
<meta name="description" content="한 문장 설명(120자 안팎)">
<link rel="stylesheet" href="../css/style.css">
<link rel="stylesheet" href="../css/bass.css">
<script src="../js/common.js"></script>
<script src="../js/bass.js"></script>
<style> /* 이 장 전용 스타일(최소한) */ </style>
<!-- Cloudflare Web Analytics -->
<!-- End Cloudflare Web Analytics -->
<link rel="stylesheet" href="../../shared/css/book-shell.css">
<script defer src="../../shared/js/book-shell.js" data-book="bass"></script>
</head>
<body data-chapter="tuning">
<main class="chapter">
  <header class="chapter-hero">
    <div class="eyebrow">Chapter 02</div>
    <h1>튜닝과 낮은 음</h1>
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
소스에는 `<title>`과 `<meta name="description">`(한 줄)만 쓴다. canonical과 Open Graph 태그는 `tools/build.mjs`가 파일 경로, `<title>`·description, `bass/book.json`의 `meta`(`siteName`, 책 홈의 짧은 소개 `summary`)로 배포물에 생성한다. 수식은 빌드가 `tools/katex.mjs`로 미리 렌더링하고 KaTeX 스타일시트만 붙이므로 KaTeX 태그도 넣지 않는다. 소스 파일을 바로 열면 `common.js`가 CDN에서 KaTeX를 불러와 렌더링한다. 이 태그들이 소스에 남아 있거나, TeX 문법 오류가 있거나, 수식 안에 `<` 바로 뒤에 글자가 오면(`j<k` → `j\lt k`) `npm test`나 빌드가 실패한다. 빌드는 정적 HTML의 수식만 렌더링하므로 스크립트가 수식 문자열을 DOM에 넣지 않는다. 상단바·챕터 서랍·목차·이전/다음·푸터·퀴즈는 `common.js`가 처리한다. 컴포넌트(`.sim`, `.callout`, `.formula`, `.table-wrap`, `.quiz-q`, `.pads`, `.steps-grid` …)는 fundamentals 가이드 그대로.

## 베이스 위젯 (`js/bass.js`, 전역 `BS`)

**줄 번호 규칙**: 배열 인덱스 `s=0`이 **가장 낮은 줄**(4현이면 4번 줄 E), `s=3`이 1번 줄(G). 본문의 "n번 줄" = `줄 수 − s`. 기타(`GT`)와 인덱스 방향이 같지만 줄 수가 튜닝마다 다르다(4·5·6현)는 점이 다르다. 줄 수에 의존하는 코드는 `tuning.length`를 쓴다.

### 이론
- `BS.TUNINGS` 키 `standard dropD halfDown five fiveHigh six piccolo` → `{name, notes:[MIDI]}`. `BS.STANDARD = [28,33,38,43]`(E1 A1 D2 G2). 튜닝 인자는 키 이름이나 배열 모두 허용. `BS.tuningNotes(t)`.
- `BS.stringNumber(s, tuning)`, `BS.stringLabel(s, tuning)` → `"4번 줄(E)"`.
- `BS.midiAt(s, f, tuning)`, `BS.positionsOf(midi, {tuning, maxFret})` → `[{s,f}]`, `BS.fretPos(n, L=864)` 너트에서 n번 프렛까지 mm, `BS.SCALE_MM = 864`(34″ 롱 스케일).
- `BS.bestPosition(midi, {tuning, hand(검지 프렛), open, maxFret, prefer(줄)})` 한 손가락 한 프렛 범위를 우선하는 자리. `BS.fingerLine(midis, {tuning, hand, open})` → 손 이동이 적은 자리 배열.
- `BS.intervalLabel(semis)` → `"R" "♭3" "5"…`, `BS.IV_LABELS`.
- `BS.parseChord("C/E")` → `{root, q, bass, flat, sym}`, `BS.parseProgression("C Am | F G", 4)` → `[{root,q,bass,beats,sym}]`(`|`가 있으면 마디 단위).
- `BS.bassNote(pc, {lo:28, near})` 피치 클래스를 베이스 음역의 MIDI로. `BS.scalePositions(rootPc, steps, {tuning, from, to})` → `[{s,f,midi,pc,deg,iv,label}]`. `BS.shape(s0, f0, intervals, {tuning})` 근음 자리 기준 음정 모양.

### 베이스라인 생성
- `BS.LINE_STYLES` 키 `root1 root4 root8 rootFifth country octave arp arp7 approach walk motown rock` → 한국어 이름.
- `BS.line(chords, style, {lo:28, seed})` → `[{t(박), d, m(MIDI), vel, chord(인덱스), role:"R"|"3"|"5"|"7"|"8"|"A"(어프로치)|"P"}]`.
- `BS.withTab(notes, {tuning, hand})` 음표에 `s`·`f`를 붙인다(손 이동 최소). TAB·지판 위젯에 넘기기 전에 거친다.

### 소리
- `BS.bass({tone, tuning, dest})` 가상 베이스. 줄마다 한 음(같은 줄의 새 음이 앞 음을 멈춘다).
  - `b.pluck(s, f, {when, vel, tone, dur, bend(센트), bendAt, bendTime, pos, bright, decay, ring})` → voice(`voice.bend(cents, t, glide)`, `voice.release(t, rr)`).
  - `b.note(midi, {hand, open, ...})` MIDI 음을 손 위치에서 가장 가까운 자리로. `b.dead(s, {when, vel})` 데드 노트. `b.damp(when, strings?)`, `b.stop()`.
  - `b.on(cb)` 소리 나는 순간 `cb({type:"pluck"|"dead", s, f, midi, tone, when})`. `b.tone/tuning/dest`는 바꿀 수 있고, `b.strings`는 줄 수, `b.midi(s,f)`.
  - `BS.default()` 공용 베이스. 정지는 `b.stop()` 또는 `MB.stopAll()`.
- 음색 `BS.TONES` 키: `finger pick slap pop muted flat upright raw`(`BS.TONE_NAMES`). 직접 `MB.play(m, {inst:"ebass", dur:null, bs:{tone, bright, decay, pos, ring}})`도 된다.
- `BS.dead(when, {f, vel, dest})` 음정 없는 고스트 타격.
- `BS.scheduler(events, {bpm:()=>n, length(박), loop, swing:()=>0..0.33, onEvent(ev, when, spb, loopNo), onUI(ev), onEnd, onStart, onStop})` → `{start, stop, toggle, running, setEvents, beat}`. 이벤트는 `{t(박), ...}`. 화면은 `onUI`에서 바꾼다.
- `BS.playTab(notes, {bpm, bass, loop, tab, groove, swing, onNote(i,n), onEnd, onStop})` TAB 음표를 기법까지 반영해 재생(드럼 그루브를 함께 깔 수 있다).
- `BS.detectPitch(float32, sampleRate, {fmin:35, fmax:500})` → `{freq, clarity, rms}` | null (YIN). **41 Hz를 잡으려면 버퍼가 `2·sr/fmin` 샘플 이상**이어야 한다(`analyser.fftSize ≥ 4096`). 마이크는 `MB.mic()` → `{analyser, stop()}`.

### 밴드 (드럼 + 베이스 + 건반)
- `BS.GROOVES` 키 `none click rock8 pop four disco funk16 halftime motown reggae shuffle swing bossa tumbao hiphop` → `{name, steps, parts}`. 파트 문자열 `x`(보통) `X`(강세) `g`(고스트) `.`(쉼). `BS.GROOVE_NAMES`.
- `BS.drumEvents(groove, bars, beatsPerBar)` → `[{t, drum, vel, kind:"drum"}]`. `BS.kickBeats(groove)` 킥 위치(박), `BS.isTriplet(groove)` 12칸(셋잇단) 그루브인지.
- `BS.band({bpm, progression, style, groove, keys, bass, swing, notes, lo, seed, bassInst, drumLevel, keysLevel, legato, onNote, onBeat, onChord, onStart, onStop})` — 모든 옵션은 값이나 **함수** 모두 가능하다. `band.start() stop() toggle() refresh()`, `band.notes`, `band.chords`, `band.length`, `band.bass`. 설정이 바뀌면 `refresh()`를 부른다(재생 중에도 된다).
  - 베이스 음표의 `tech`: `"dead"` 데드 노트, `"slap"`·`"pop"` 주법, `"h"`·`"p"` 레가토, `"/"` 슬라이드(앞 음에서 이어짐).

### 위젯
- `BS.fretboard(sel, {frets:12, from:0, labels:"none"|"notes"|"intervals"|"frets"|"octave", root, tuning, flat, play:true, tone, even, onClick(s,f,midi), labelAll, bass})` 가로 지판(가장 가는 줄이 위, 너트가 왼쪽). 컨테이너는 `<div id="..."></div>`.
  - `fb.mark([{s,f,label,cls}], cls)`, `fb.set(list, cls)`, `fb.clear(cls?)`, `fb.unmark(s,f)`, `fb.has(s,f)`, `fb.flash(s,f,ms)`(줄 떨림 포함), `fb.showScale(rootPc, steps, {from, to, label, keep})`, `fb.setLabels(mode, root)`, `fb.setTuning(t)`, `fb.setRange(from, frets)`, `fb.bass`(내장 베이스), `fb.pos(s,f)`.
  - 점 cls: `mark`(주색) `alt`(보조색) `root`(빨강) `open`(테두리) `ghost` `dim` `ok` `bad` `x`(×). `onClick`이 `false`를 돌려주면 소리를 내지 않는다.
- `BS.tab(sel, notes, {beatsPerBar:4, chords:[{t,name}], rhythm:true, tuning, barsPerLine, beatWidth})` TAB 악보 → `{highlight(i), highlightAt(t), at(beat), clear(), setNotes(notes, chords), notes}`. 음표 `{t(박), d(박), s, f, tech:"h"|"p"|"/"|"\\"|"dead"|"slap"|"pop"|"harm"|"pm"|"~"}`.
- `BS.staff(sel, notes, {beatsPerBar:4, chords, flat, labels, concert:false})` 낮은음자리표 보표 → `{highlightAt(t), at(beat), clear(), setNotes(notes, chords)}`. 음표 `{t, d, m(MIDI 실음) | rest:true}`. **베이스 악보 관례대로 실음보다 한 옥타브 위에 적는다**(`concert:true`면 실음 그대로).
- `BS.parseAsciiTab(text, {step:0.5})` 텍스트 TAB(가는 줄부터 G|D|A|E) → 음표. 기법 문자 `h p / \ x T P`.
- CSS: `.bs-steps`(스텝 격자), `.bs-big`(큰 숫자).

같은 기능을 장마다 다시 만들지 않는다. 장 고유의 모델(예: 픽업 빗살 필터, 장력 계산, 컴프레서 곡선)만 페이지 스크립트에 둔다.

## 검사
```bash
npm test                                 # 수식 렌더러·링크·소스 규칙
node tools/browser-check.cjs bass/        # 콘솔 오류·360px 가로 넘침 (Playwright)
```
