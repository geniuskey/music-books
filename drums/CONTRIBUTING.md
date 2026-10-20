# DrumBook 챕터 작성 가이드

DrumBook은 [MusicBook(fundamentals)](../fundamentals/CONTRIBUTING.md)·[GuitarBook](../guitar/CONTRIBUTING.md)·[PianoBook](../piano/CONTRIBUTING.md)과 같은 엔진·같은 규칙으로 쓴 드럼 교과서다. **이 문서에 없는 규칙과 `MB` API 전체는 `../fundamentals/CONTRIBUTING.md`를 따른다.** 문체·구성의 본보기는 `../piano/chapters/*.html`(악기 교재)과 `../fundamentals/chapters/*.html`이다.

## 기여물의 라이선스

코드는 MIT, 교재 콘텐츠는 CC BY 4.0. 저작권이 남아 있는 곡의 선율·가사·녹음을 넣지 않고, 특정 곡의 드럼 파트를 "○○의 비트"라고 이름 붙여 옮기지 않는다. 장르의 일반적인 그루브(8비트, 셔플, 원 드롭, 보사노바, 클라베 등)와 직접 만든 예만 쓴다. 공유 저작물(민요·행진곡 등)의 짧은 리듬 발췌는 괜찮다.

## 구조

빌드 과정 없는 정적 사이트다. `index.html` + `chapters/<slug>.html` + 공통 `css/style.css`(MusicBook 스타일, 드럼 색만 바꿈), `css/drums.css`(악보·그리드·킷 위젯), `js/common.js`(전역 `MB`, 챕터 목록 `CHAPTERS`), `js/drums.js`(전역 `DR`). classic script만 쓴다(ES module 금지).

## 원칙

- **한국어**. 대상은 드럼을 처음 배우거나 다시 시작한 성인 학습자, 특히 원리를 알고 싶어 하는 공대생·엔지니어. 몸의 동작과 연습 방법을 구체적으로 안내하되, "왜 그런가"를 물리·수학·리듬 이론으로 설명한다(필요한 곳에만 KaTeX). 영어 원어는 `<span class="en">(Backbeat)</span>`처럼 병기.
- 오른손잡이 표준 세팅(오른발 킥, 왼발 하이햇, 오른손 하이햇·라이드)을 기준으로 쓰고, 왼손잡이는 좌우를 뒤집으면 된다고 한 번 밝힌다.
- 개념 → 그림(SVG) → (수식) → **소리 나는 시뮬레이터** → 연습 방법·실제 예 → 요약/퀴즈 순서. 모든 장은 "듣고 → 보고 → 두드려 보고 → 실제 드럼(또는 연습 패드·무릎)으로 따라 한다"를 따른다.
- 시뮬레이터는 **가상 드럼 킷(DR)으로 소리를 내는** 것을 우선한다. 소리와 악보·그리드·킷 그림이 함께 움직이게 한다(`DR.playEvents`에 `staff`·`grid`를 넘기면 자동, `DR.kitView`는 같은 킷이 치면 자동으로 번쩍인다).
- 소리는 반드시 클릭·키 입력 안에서 처음 시작한다. 루프에는 항상 정지 버튼. 마이크·MIDI는 사용자가 버튼을 눌렀을 때만 켜고, 끄는 버튼을 둔다.
- 실제 연습 안내를 `.callout.tip`(연습법)으로 넣는다: 몸의 자세, 흔한 실수, 템포(BPM)·반복 횟수 목표. 드럼이 없는 독자를 위해 연습 패드·무릎·책상으로 하는 방법도 적는다.
- 귀 보호: 실제 드럼은 100 dB를 넘는다는 점, 연습 시 귀마개를 권하는 안내를 1장·12장에 둔다.
- 색은 CSS 변수만, 라이트/다크 모두 확인. 폭 360px에서 가로 스크롤 금지. SVG는 `viewBox`만 주고 width/height 생략. 16칸이 넘는 그리드는 `perLine:16`(기본값)으로 줄을 나눈다. 악보는 한 줄에 2마디(기본값)까지.
- 모델의 가정·한계를 `.sim-note`에 밝힌다. 예: "드럼 소리는 원형 막의 베셀 모드 12개 + 스네어 와이어 잡음으로 만든 근사 모델".
- 시뮬레이터 `id`는 `sim-<장 접두사>-<이름>`. 장 접두사: instrument `ins`, setup `set`, counting `cnt`, reading `rd`, rudiments `rud`, beat `bt`, sixteenth `sx`, fills `fl`, shuffle `sh`, styles `sty`, odd `odd`, sound `snd`, timing `tm`, studio `std`, glossary `gl`. 요소 id·장 전용 CSS 클래스도 같은 접두사를 붙여 충돌을 피한다.

## head 템플릿

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<title>첫 번째 록 비트 · DrumBook</title>
<meta name="description" content="한 문장 설명(120자 안팎)">
<link rel="canonical" href="https://music.euiyun.com/drums/chapters/beat.html">
<meta property="og:type" content="article">
<meta property="og:site_name" content="DrumBook">
<meta property="og:title" content="첫 번째 록 비트 · DrumBook">
<meta property="og:description" content="(description과 같게)">
<meta property="og:url" content="https://music.euiyun.com/drums/chapters/beat.html">
<meta property="og:locale" content="ko_KR">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<link rel="stylesheet" href="../css/style.css">
<link rel="stylesheet" href="../css/drums.css">
<script src="../js/common.js"></script>
<script src="../js/drums.js"></script>
<style> /* 이 장 전용 스타일(최소한, 접두사 붙여서) */ </style>
<!-- Cloudflare Web Analytics -->
<!-- End Cloudflare Web Analytics -->
<link rel="stylesheet" href="../../shared/css/book-shell.css">
<script defer src="../../shared/js/book-shell.js" data-book="drums"></script>
</head>
<body data-chapter="beat">
<main class="chapter">
  <header class="chapter-hero">
    <div class="eyebrow">Chapter 06</div>
    <h1>첫 번째 록 비트</h1>
    <p class="lead">...</p>
    <ul class="objectives"><li>...</li></ul>
  </header>
  <section id="layers"><h2>...</h2> ... </section>
  ...
  <section class="keypoints" id="summary"><h2>핵심 정리</h2><ol><li>...</li></ol></section>
  <section class="quiz-sec" id="quiz"><h2>확인 퀴즈</h2><div class="quiz"> ... </div></section>
</main>
<script> /* 시뮬레이터마다 (function(){ ... })(); */ </script>
</body>
</html>
```
canonical은 필수다(`npm test`가 검사). 상단바·챕터 서랍·목차·이전/다음·푸터·퀴즈·KaTeX는 `common.js`가 처리한다. 컴포넌트(`.sim`, `.sim-head`, `.sim-body.side`, `.sim-view`, `.sim-controls`, `.ctrl`, `.seg`, `.btn-row`, `.btn.primary`, `.sim-readout .stat`, `.sim-note`, `.sim-msg`, `.callout.tip|.note|.warn`, `.formula .where`, `.table-wrap`, `.quiz-q`(`.opt[data-correct]`, `.quiz-exp`), `figure.diagram` + SVG 유틸 클래스 `.t .t-dim .t-mono .t-acc .s-line .s-axis .s-acc .f-surface .f-elev .f-acc .f-acc-soft .f-acc2-soft`)와 `MB.range/MB.seg/MB.check/MB.stat/MB.canvas/MB.loop/MB.color/MB.palette` 사용법은 fundamentals 가이드와 `../piano/chapters/rhythm.html`의 실제 쓰임을 그대로 따른다. 퀴즈 마크업은 `../piano/chapters/rhythm.html` 끝부분을 그대로 본뜬다.

## 드럼 엔진 (`js/drums.js`, 전역 `DR`)

**시간 단위**: 이벤트의 `t`는 언제나 **4분음표 = 1박**, BPM도 4분음표 기준이다. 4/4 한 마디 = 4박, 6/8·12/8은 점4분음표 하나가 1.5박(6/8 한 마디 = 3박, 12/8 = 6박), 7/8 한 마디 = 3.5박. 셋잇단은 1/3박 간격.

### 조각(piece)과 이벤트
- 조각 이름: `kick snare rim(림샷) xstick(크로스 스틱) hat(닫힘) hatHalf hatOpen hatFoot(페달 '칙') ride bell(라이드 벨) crash tom1 tom2 floor cowbell clave shaker clap`. `DR.PIECES[p]` → `{ko, short("HH"), en, step(보표 위치), head, limb("hand"|"foot"), gm, pan, level, group}`. `DR.KIT`(표준 킷 순서), `DR.isFoot(p)`, `DR.pieceOf("HH")` → `"hat"`(약어: `HH HO HX HF SN RS XS BD K T1 T2 FT RD RB CR CB CL SH CP`).
- **이벤트** `{t(박), p(조각), v(벨로시티 0–1, 기본 0.75), hand:"R"|"L", flam, drag, buzz(박), acc, ghost, open(0–1, hat 전용), pedal(0–1, 하이햇 페달만 바꿀 때 p 없이), dt(ms, 이 음만 앞뒤로)}`.
- `DR.VEL` = `{ghost:0.28, soft:0.5, normal:0.75, accent:1}`. 악보는 `v ≥ 0.9`(또는 `acc`)를 액센트 `>`로, `v ≤ 0.4`(또는 `ghost`)를 괄호 친 고스트 노트로 그린다.
- `DR.GM` (GM 드럼 번호 → 조각).

### 패턴 문자열
- `DR.parse(spec, {div:4, t0:0})` → 이벤트 배열(정렬됨). spec은 여러 줄 문자열 `"HH x.x.x.x.\nSN ..x...x.\nBD x...x..."` 또는 객체 `{hat:"x.x.", snare:"..x."}`. `div` = 한 박의 칸 수(8분 2, 셋잇단 3, 16분 4, 16분 셋잇단 6, 32분 8). `|`와 공백은 무시(마디·박 구분용으로 써도 됨).
- 칸 문자: `.`/`-` 쉼 · `x` 보통 · `X` 액센트 · `g` 고스트 · `o`/`O` 열린 하이햇 · `h` 반열림 · `f`/`F` 플램 · `d` 드래그 · `z` 버즈 · `b`/`B` 라이드 벨 · `1`–`9` 벨로시티 n/9.
- 줄 이름 `ST`: 스티킹 `"RLRL…"`을 같은 칸의 손 이벤트에 `hand`로 붙인다.
- `DR.toSpec(events, {div, length, rows})` → `{hat:"x.x.", …}`, `DR.concat([evA, 4], [evB, 4])` → 이어 붙인 이벤트, `DR.sort(evs)`.

### 사전
- `DR.GROOVES[key]` → `{name, genre, bpm, div, bars, swing, swingUnit, spec, desc}`. 키: `rock8 rock8b ballad rock16 pop16 halftime disco house funk linear shuffle halfShuffle jazz shuffle128 reggae boombap dnb punk train metal bossa afro128`. `DR.groove(key, {t0})` → 이벤트, `DR.grooveLength(key)` → 박.
- `DR.CLAVE[key]` → `{name, div, spec}` (`son32 son23 rumba32 bossa bell68 tresillo`, 한 줄 패턴: `DR.parse({clave: DR.CLAVE.son32.spec}, {div:4})`).
- `DR.RUDIMENTS[key]` → `{pas(PAS 번호), ko, en, div, sticking, group}`. 키: `single single4 single7 buzz triple double five six seven paradiddle double_pd triple_pd pdd flam flam_accent flam_tap flamacue flam_pd pataflafla swiss drag drag_tap lesson25 ratamacue`. `DR.RUDIMENT_GROUPS`.
  - 스티킹 토큰: `R`/`L`, 뒤에 `^` 액센트, 앞에 소문자 꾸밈음(`lR` 플램, `llR` 드래그), 뒤에 `z` 버즈, `-` 쉼. `DR.parseSticking(s)` → `[{hand, acc, grace, buzz, rest}]`.
  - `DR.rudiment(key | {sticking, div}, {reps, piece:"snare", t0, accent:0.95, tap:0.5, orchestrate:{R:"floor", L:"snare"}})` → 이벤트(`evs.beats` = 길이).
- `DR.counts(div, beats)` → `["1","e","&","a","2",…]`, `DR.SYLLABLES`(div → 음절: 2 `& `, 3 `trip let`, 4 `e & a`, 6 `la li & la li`).
- `DR.euclid(k, n, rot)` → `[1,0,0,1,…]`, `DR.polyrhythm(a, b, length)` → `{a:[t…], b:[t…], lcm}`, `DR.swingTime(t, ratio, unit)`, `DR.msPerBeat(bpm)`, `DR.msPerStep(bpm, div)`, `DR.TEMPI`(빠르기말), `DR.beamGroups([7,8])` → `[1,1,1.5]`.

### 소리
- `DR.kit({dest, room(0–1, 기본 0.14), stereo, params:{snare:{tune, decay, snares, pos, muffle}, kick:{beater:"felt"|"plastic"}}, levels:{hat:0.8}, mute:{kick:true}})` 가상 킷.
  - `kit.hit(p, vel=0.75, when, {hand, open, flam, drag, buzz(초), tune, decay, pos, snares, muffle, src})` → 실제 친 오디오 시각. `when`을 생략하면 지금(플램·드래그는 꾸밈음 몫만큼 늦게).
  - `kit.flam(p, vel, when, {gap(초, 기본 0.025), hand, graceVel})`, `kit.drag(...)`, `kit.buzz(p, vel, when, dur초)`.
  - 하이햇: `kit.hatPedal(open 0–1, when, chick)`(0 = 밟아 닫음). 조각 `"hat"`은 지금 페달 상태로 친다(0.25 미만 닫힘, 0.7 초과 열림, 사이는 반열림). 하이햇 묶음은 새로 칠 때마다 앞의 열린 소리를 초크한다. `kit.hatOpen`(지금 상태).
  - 하이햇 페달 변화는 예약 시각 기준으로 기록되므로 미리 예약된 `"hat"` 타격도 그 시각의 상태로 난다. 뮤트·음량을 `hat`으로 주면 열림·반열림에도 적용된다. `kit.choke("crash", when)`, `kit.set(p, {tune(반음), decay(배수), snares(0–1), pos(0 중심–1 가장자리), muffle(0–1)})`, `kit.setRoom(v)`, `kit.levels[p]`, `kit.mute = {p:true}`, `kit.stop()`.
  - `kit.on(cb)`/`kit.off(cb)` → `cb({type:"hit", p, sound, v, when, hand, src, grace} | {type:"pedal", value, when})`. `when`은 오디오 시각이므로 화면은 `DR.at(when, fn)`으로 맞춘다. `src`: `"seq"`(스케줄러) `"key"` `"pointer"` `"midi"` `"tap"` `"grid"` `"api"`.
  - `DR.default()` 공용 킷. 정지 버튼은 `kit.stop()` 또는 `MB.stopAll()`(모든 킷도 멈춘다).
- 음색 모델: `DR.model(p, vel, prm)` → 북: `{f0, pos, tau0, modes:[{f, a, tau, mode}], glide, tg, dur}`, 심벌: `{f0, f1, n, peak, tau, dur}`(그림·표용). `DR.samples(p, {vel, tune, decay, snares, pos, muffle, variant, sr})` → `Float32Array`(동기, 캐시) — 파형·스펙트럼(`MB.spectrum`)·포락선 그림에 쓴다. `DR.warm(pieces)` 버퍼 미리 만들기(클릭 뒤에만). `DR.velGain(v)`, `DR.layerOf(v)`.
- 막의 물리: `DR.MODES`(`[{m, n, j, ratio, name:"(0,1)"}]` 16개), `DR.besselJ(m, x)`, `DR.modeAmp(m, n, r)` 치는 자리 r에서 그 모드의 들뜸, `DR.modeShape(md, r, θ)`, `DR.membraneFreq(T, σ, a)`, `DR.realRatio(ratio, k)` 공기 하중 근사.
- `DR.click(when, accent(true | false | "sub"), {voice:"beep"|"wood"|"cowbell", vel})` 메트로놈 클릭.

### 재생·스케줄
- `DR.playEvents(events, {bpm(수 또는 함수), kit, loop, length(박), beatsPerBar, click, clickOn:()=>bool, clickSub, clickVoice, swing(0.5–0.75 또는 함수), swingUnit(0.5 = 8분, 0.25 = 16분), humanize:{ms, vel} | ms, offsets:{snare: −10}(ms) | (ev)=>ms, mute:{p:true} | (p, ev, loopNo)=>bool, staff, grid, onHit(ev, i, when, loopNo), onMuted(ev, i, when)(뮤트된 음의 예약 시각, 채점용), onNote(ev, i), onBeat(beat), onLoop(n), onEnd, onStop(natural)})` → scheduler(`start stop toggle running beat loopNo t0(시작 오디오 시각) setEvents(새 이벤트 배열: 재생 중 패턴 바꾸기)`). `staff`를 주면 같은 시각의 음표를 강조하고 재생선을 움직인다(이벤트 순서 `i` = 배열 인덱스이므로 **악보와 재생에 같은 배열**을 넘긴다). `grid`를 주면 지금 칸을 표시한다. `bpm`·`swing`·`mute`를 함수로 주면 재생 중 바꿔도 바로 반영된다.
- `DR.scheduler(events, {bpm, length, loop, onEvent(ev, when, spb, loopNo), onUI(ev), onLoop, onEnd, onStop, onStart})` 박 단위 범용 스케줄러(이벤트 `{t, …}` 아무거나).
- `DR.metronome({bpm, beats, sub, accent, voice, subOn, gap:[울림 마디, 쉼 마디], onBeat(beat, bar, when, sounding, sub)})` → scheduler(+`rebuild()`). `gap`은 "갭 클릭" 연습.
- `DR.toggleButton("#btn", () => DR.playEvents(...), ["▶ 재생", "■ 정지"])` 재생/정지 토글. `DR.stopButton("#btn", extra)`.

### 입력·측정
- 컴퓨터 키보드(`DR.KEYS`): `F`/`J` 스네어 왼손/오른손, `D`/`K` 하이햇, `Space`/`X`/`B` 킥, `Z` 하이햇 페달, `E` 열린 하이햇, `G H L` 탐, `I` 라이드, `O` 벨, `U`/`Q` 크래시, `S` 크로스 스틱, `V` 림샷. `Shift`를 누르면 세게. 키 입력은 가장 최근에 누른(또는 화면 가운데에 있는) `kitView`·`pads`·`keyTarget`으로 간다. 안내 문구는 `DR.KEY_HINT`(HTML).
- `DR.keyTarget(el, (p, vel, hand, src) => …)` 장에서 만든 위젯을 키 입력 대상으로 등록.
- `DR.tapper(kit, {onTap({when, p, v, hand, src})})` → `{taps, clear(), stop()}` 사람이 친 타격(src `key pointer midi tap`)만 모은다. 장에서 만든 큰 탭 버튼은 `kit.hit(p, v, null, {src:"tap"})`로 치면 된다.
- `DR.score(expected초[], taps, {window:0.15})` → `{pairs:[{exp, tap, dev(ms)}], mean, sd, absMean, hits, misses, extra}`. 기대 시각은 `playEvents`의 `onHit(ev, i, when)`의 `when`이나 `DR.metronome`의 `onBeat(..., when)`으로 모은다.
- `DR.recorder(kit)` → `{start(at), stop(), notes, recording, toEvents(bpm, div, strength)}` 녹음과 퀀타이즈.
- `DR.midiIn(cb)`(Promise `{names, stop()}`; cb `{type:"hit", p, v, note}`·`{type:"hat", value}`·`{type:"cc"}`), `DR.connectMidi(kit, extra)`. 지원하지 않는 브라우저에서는 예외 → 안내 문구.

### 위젯
- `DR.staff(sel, events, {time:[4,4], bars, barsPerLine(기본 2), width(viewBox, 760), groups, voices:2 | 1, sticking, counts:true | "all", countDiv, rests, barNumbers, endBar:"end"|"repeat"|"single", showTime, compact, onClick(i, ev)})` → `{highlight(i | [i…] | -1), at(beat | null), mark(i, cls), unmark(cls), setEvents(events, opts), setOptions(opts), events, layout, el}`. 타악기 보표: 손(위 기둥)·발(아래 기둥) 두 성부, 박마다 빔, 셋잇단 숫자, x 머리 심벌, 열린 하이햇 `o`, 플램·드래그 꾸밈음, 버즈 `z`, 스티킹·카운트 줄. 보표 위치: 크래시 A5(덧줄), 하이햇 G5, 라이드 F5(윗줄), 하이 탐 E5, 미드 탐 D5, 스네어 C5, 플로어 탐 A4, 킥 F4, 하이햇 페달 D4(아래).
- `DR.grid(sel, {rows:["hat","snare","kick"], div:4, beats:4, spec, cycle:{hat:[".","x","X","o"]}, perLine:16, labels:"short"|"ko", counts:true, kit, play:true, onChange(events, spec)})` → `{events(), spec(), set(spec), setRows(rows), setDiv(div, beats), clear(), now(i), nowBeat(t), div, beats, rows, el}` 스텝 시퀀서.
- `DR.kitView(sel, {kit, pieces, labels, keys, play, onHit(p, vel, hand, src)})` 위에서 본 킷 → `{flash(p), hit(p, vel, hand, src), el, kit}`. 스네어 가장자리 = 림샷, 라이드 가운데 = 벨, 하이햇 페달 = 열림/닫힘 토글.
- `DR.pads(sel, {kit, pieces, keys, labels:"ko"|"short", vel, onHit})` 패드 버튼 줄 → `{flash, hit, el}`.
- `DR.timeline(canvas, {rows, beats, div, events, taps:[{t(박), p, cls}], aspect})` → `{set({events, taps, beats, now}), now(beat | null), draw()}` 기대 이벤트(점)와 실제 탭(막대).
- CSS: `.dr-big`(큰 글자), `.dr-hint`(`<kbd>`), `.dr-lamps`(박 램프 `<i class="a on sub off">`), `.dr-tap`(큰 탭 버튼 `.ok .warn .bad .hit`), `.dr-cv`(캔버스 폭 100%), `.dr-chips`(작은 선택 버튼 `.on`).

같은 기능을 장마다 다시 만들지 않는다. 장 고유의 모델(예: 스틱 리바운드 물리, 막 모드 애니메이션, 필 생성기)만 페이지 스크립트에 둔다. 엔진에 없는 기능이 꼭 필요하면 페이지 스크립트에 작게 만들고, 엔진 수정은 따로 제안한다.

## 검사
```bash
npm test                                   # 메타·링크·canonical
node tools/browser-check.cjs drums/        # 콘솔 오류·360px 가로 넘침 (Playwright)
```
