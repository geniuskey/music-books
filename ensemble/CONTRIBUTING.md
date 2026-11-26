# EnsembleBook 챕터 작성 가이드

EnsembleBook은 [MusicBook(fundamentals)](../fundamentals/CONTRIBUTING.md)과 같은 엔진·같은 규칙으로 쓴 합주 교과서다. **이 문서에 없는 규칙과 `MB` API 전체는 `../fundamentals/CONTRIBUTING.md`를 따른다.** 문체·구성의 본보기는 `chapters/together.html`(1장)과 `../bass/chapters/*.html`이다.

## 기여물의 라이선스

코드는 MIT, 교재 콘텐츠는 CC BY 4.0. 예제 곡은 **공유 저작물**(작곡가 사후 70년이 지난 곡: 파헬벨, 바흐, 하이든, 모차르트, 베토벤, 슈베르트, 드보르자크…)이거나 이 책을 위해 새로 지은 것만 쓴다. 공유 저작물이라도 현대의 특정 편곡·판본을 베끼지 않는다. 화성·편곡을 이 책이 붙였으면 "4성부 화성은 이 책"처럼 밝힌다. 유명한 곡의 관현악법을 설명할 때는 "베토벤 교향곡 5번 1악장 첫머리의 투티 유니즌"처럼 **기법**을 적고, 긴 악보를 옮겨 적지 않는다.

## 구조

빌드 과정 없는 정적 사이트다. `index.html` + `chapters/<slug>.html` + 공통 `css/style.css`(MusicBook 스타일, 남색·금색만 바꿈), `css/ensemble.css`(합주 위젯·악기군 색), `js/common.js`(전역 `MB`, 챕터 목록 `CHAPTERS`), `js/ensemble.js`(전역 `EN`). classic script만 쓴다(ES module 금지).

## 원칙

- **한국어**. 대상은 악기를 하나쯤 다뤄 봤거나 오케스트라 음악을 즐겨 듣는 성인 학습자, 특히 원리를 알고 싶어 하는 공대생·엔지니어. "왜 그렇게 들리는가"를 물리(파동·공명·배음)·심리음향(임계대역·마스킹·묶기)·음악 이론(성부·화성·관현악법)으로 설명한다(필요한 곳에만 KaTeX). 영어 원어는 `<span class="en">(Orchestration)</span>`처럼 병기. 이탈리아어 연주 용어는 원어를 그대로 쓰고 뜻을 붙인다(아르코 arco = 활로).
- 개념 → 그림(SVG) → (수식) → **여러 악기를 함께 울리는 시뮬레이터** → 듣는 법·실제 예 → 요약/퀴즈 순서.
- 이 책의 핵심은 **섞어 듣기**다. 시뮬레이터는 가능하면 두 개 이상의 악기를 함께 울리고, 파트를 켜고 끄거나(`EN.mixerUI`), 악기를 바꾸거나, 자리·홀을 바꿔 **차이를 귀로 비교**하게 한다. "따로 ↔ 함께", "A 편성 ↔ B 편성" 버튼을 나란히 두는 구성이 좋다.
- 소리는 반드시 클릭·키 입력 안에서 처음 시작한다. `EN.mixer()`는 `MB.ctx()`가 필요하므로 **처음 재생할 때 지연 생성**한다(`const getMx = () => mx || (mx = EN.mixer({...}))`). 루프에는 항상 정지 버튼.
- 듣기 안내를 `.callout.tip`(들어 보기·연습법)으로 넣는다: 무엇에 귀를 붙일지, 몇 번 반복할지, 실제 음반에서 어디를 들으면 되는지(곡 이름과 위치만, 녹음 링크 없이).
- 색은 CSS 변수만, 라이트/다크 모두 확인. 악기군 색은 `--en-str`(현) `--en-ww`(목관) `--en-br`(금관) `--en-pc`(타악) `--en-kb`(하프·건반) — 캔버스에서는 `EN.color(inst)`. 폭 360px에서 가로 스크롤 금지(음역표·큰 SVG는 자기 안에서만 가로 스크롤). SVG는 `viewBox`만 주고 width/height 생략.
- 모델의 가정·한계를 `.sim-note`에 밝힌다. 예: "현의 소리는 헬름홀츠 톱니파 × 몸통 공명(포먼트) 근사. 실제 바이올린의 공명은 수십 개이고 악기마다 다르다."
- **스피커 안내**: 저역(더블베이스·튜바·팀파니·큰북)이 중요한 시뮬레이터에는 헤드폰을 권한다.
- **CPU 주의**: 섹션(`players` > 1)은 음 하나에 하위 음성 최대 5개를 만든다. 오케스트라 전체에서는 `maxSub: 3`을 주거나 파트 수를 줄인다. 한 시뮬레이터가 동시에 내는 음은 60개 안쪽으로.
- 시뮬레이터 `id`는 `sim-<장 접두사>-<이름>`. 장 접두사: together `tg`, strings `str`, winds `wd`, brass `br`, percussion `pc`, score `sc`, quartet `qt`, chamber `ch`, orchestra `orc`, blend `bl`, balance `bal`, voicing `vc`, texture `tx`, studio `std`, glossary `gl`. 요소 id도 같은 접두사를 붙여 충돌을 피한다.

## head 템플릿

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<title>현악 4중주 · EnsembleBook</title>
<meta name="description" content="한 문장 설명(120자 안팎)">
<link rel="stylesheet" href="../css/style.css">
<link rel="stylesheet" href="../css/ensemble.css">
<script src="../js/common.js"></script>
<script src="../js/ensemble.js"></script>
<style> /* 이 장 전용 스타일(최소한) */ </style>
<!-- Cloudflare Web Analytics -->
<!-- End Cloudflare Web Analytics -->
<link rel="stylesheet" href="../../shared/css/book-shell.css">
<script defer src="../../shared/js/book-shell.js" data-book="ensemble"></script>
</head>
<body data-chapter="quartet">
<main class="chapter">
  <header class="chapter-hero">
    <div class="eyebrow">Chapter 07</div>
    <h1>현악 4중주</h1>
    <p class="lead">...</p>
    <ul class="objectives"><li>...</li></ul>
  </header>
  <section id="voices"><h2>...</h2> ... </section>
  ...
  <section class="keypoints" id="summary"><h2>핵심 정리</h2><ol><li>...</li></ol></section>
  <section class="quiz-sec" id="quiz"><h2>확인 퀴즈</h2><div class="quiz"> ... </div></section>
</main>
<script> /* 시뮬레이터마다 (function(){ ... })(); */ </script>
</body>
</html>
```
소스에는 `<title>`과 `<meta name="description">`(한 줄)만 쓴다. canonical과 Open Graph 태그는 `tools/build.mjs`가 파일 경로, `<title>`·description, `ensemble/book.json`의 `meta`로 배포물에 생성한다. 수식은 빌드가 미리 렌더링하므로 KaTeX 태그도 넣지 않는다. 이 태그들이 소스에 남아 있거나, TeX 문법 오류가 있거나, 수식 안에 `<` 바로 뒤에 글자가 오면(`j<k` → `j\lt k`) `npm test`나 빌드가 실패한다. **스크립트가 수식 문자열(`\(`, `\[`, `$$`)을 DOM에 넣지 않는다.** 상단바·챕터 서랍·목차·이전/다음·푸터·퀴즈는 `common.js`가 처리한다. 컴포넌트(`.sim`, `.sim-body.side`, `.sim-view`, `.sim-controls`, `.ctrl`, `.seg`, `.check`, `.btn-row`, `.sim-readout .stat`, `.sim-note`, `.sim-msg`, `.callout.tip|warn|deep`, `.formula .where`, `figure.diagram`, `.table-wrap`, `.quiz-q .opts .opt[data-correct] .quiz-exp`)는 fundamentals 가이드 그대로.

## 합주 엔진 (`js/ensemble.js`, 전역 `EN`)

### 악기 사전
- `EN.INSTR[key]` → `{name, en, short, family, model, lo, hi, comfy:[lo,hi], clef, transpose, x, y, level, section, formants, vib:[Hz, 센트], attack}`. **lo·hi·comfy는 실음 MIDI**, `transpose`는 실음 = 기보 + transpose(B♭ 클라리넷·트럼펫 −2, F 호른·잉글리시 호른 −7, 더블베이스 −12, 피콜로·첼레스타 +12, 글로켄슈필 +24). `x`(−1 왼쪽…1 오른쪽)·`y`(0 앞…1 뒤)는 객석에서 본 표준 무대 자리, `level`은 같은 셈여림에서의 상대 음압(바이올린 한 대 = 1, 트럼펫 1.9, 플루트 0.6…), `section`은 2관 편성의 표준 인원.
- 키: 현 `violin viola cello contrabass`, 목관 `flute piccolo oboe englishHorn clarinet bassoon`, 금관 `horn trumpet trombone tuba`, 타악 `timpani glockenspiel cymbals bassDrum snare triangle`(뒤 넷은 `unpitched`), 하프·건반 `harp celesta piano`. `EN.KEYS`, `EN.ORCH_ORDER`(총보 순서).
- `EN.FAMILIES[fam]` → `{name, en, color}`. `EN.color(inst)`, `EN.familyColor(fam)` 현재 테마의 색 문자열. `EN.name(inst)`.
- `EN.written(inst, 실음)`, `EN.sounding(inst, 기보음)`, `EN.inRange`, `EN.inComfy`, `EN.fold(inst, m)`(음역 안으로 옥타브 접기).
- 셈여림 `EN.DYN`(`ppp`…`fff` → 0.12…1), `EN.DYN_NAMES`, `EN.dynOf(vel)`. 주법 이름 `EN.ARTS`.

### 음색 모델과 소리
- `EN.spectrum(inst, midi, {vel, art})` → `[{k, f, a(최댓값 1), db}]`. **소리와 그림이 같은 함수**에서 나온다(배음 진폭으로 PeriodicWave를 만든다). 모델: 현 = 활 위치 빗살을 가진 톱니파 × 몸통 포먼트, 플루트 = 빠르게 줄어드는 배음 + 숨소리, 클라리넷 = 샬뤼모 음역의 홀수 배음 + 톤홀 차단 주파수, 오보에·바순 = 원뿔관 전 배음 × 강한 포먼트, 금관 = 셈여림이 클수록 기울기가 완만해지는(밝아지는) 배음 × 벨 포먼트, 팀파니·글로켄슈필 = 비조화 모드. `EN.harmonicAmps`는 정규화 전 값.
- `EN.centroid(inst, m, {vel})` 스펙트럼 무게 중심(Hz), `EN.bark(f)`, `EN.erb(f)`, `EN.sumDb([dB…])` 비상관 합.
- `EN.note(inst, midi, {dur, vel(숫자 또는 "mf"), art, players, spread(센트), real, vib(배수), vibDelay, when, dest, pan, detune, level, raw, maxSub, ctx})` → voice(`release(t)`). `dur:null`이면 계속 울린다. `art`: 현 `arco legato stacc spicc pizz trem mute pont tasto harm`, 관 `stacc flutter`, 금관 `mute stopped`, 팀파니·작은북 `roll`. `players`>1이면 섹션(연주자마다 음높이·비브라토·출발이 다름), `real:true`면 인원만큼 음량도 커진다(기본은 같은 음량으로 두께만). 악기의 `level` 등급이 자동으로 반영된다(`raw:true`면 끔). `MB.play(m, {inst:"oboe", en:{art}})`로도 된다.
- `EN.chord(inst, [midi…], opts)`. 정지는 `MB.stopAll()` 또는 voice의 `release()`.

### 공간과 믹서
- `EN.HALLS` 키 `dry studio chamber concert cathedral` → `{name, rt60, pre, size, desc}`. `EN.impulse(ctx, hall)` 합성 스테레오 임펄스 응답(캐시, **에너지 Σh² = 1로 정규화** — 컨볼버가 세기를 바꾸지 않는다). `EN.sabine(V, A)` = 0.161·V/A.
- `EN.mixer({hall, wet, width, gain, trim, dest})` → `{channel(id, {inst, gain, pan, dist, mute, solo, send}), setHall, setWet, setWidth, mute(id, v), solo(id, v), clearSolo, level(), analyser, out, trim, channels(), has(id)}`. 채널은 `input`(악기를 연결), `set({...})`, `level()`(RMS dBFS), `analyser`, `state`. 처음 만들 때 악기 사전의 무대 자리가 기본 pan·dist다. 거리(dist)는 직접음 감쇠·고역 감소·지연·잔향 비율 증가로 반영된다.
  - 잔향 비율 `wet`은 직접음 대비 잔향의 크기다: 잔향 이득 = `wet × 2.1 × (RT60/2)^0.35`. 콘서트홀·wet 0.32·거리 0.3에서 잔향 대 직접음 비 ≈ −4 dB, wet 0.8이면 ≈ +4 dB. 2관 편성 전체가 마스터 리미터 앞에서 −4 dBFS 안팎에 머물도록 `trim`(기본 0.7)이 고정 여유를 둔다. `gain`(=`out`)은 객석 거리 같은 실험용 전체 음량이다.
  - `setHall`은 두 컨볼버 사이를 짧게 크로스페이드하고, `setWet`은 컨볼버를 건드리지 않는다. `ConvolverNode.buffer`를 다시 넣으면 잔향이 처음부터 다시 쌓이며 소리가 끊기므로, 장 스크립트에서도 재생 중에 버퍼를 갈아 끼우지 않는다.

### 악보와 곡
- `EN.parse("mf C5:1 D5:.5 E5 | [C4 E4 G4]:2 r:1 G4:1' >A4 @pizz C4 @arco")` → `[{t, d, m, vel, art}]`(박 단위). 길이를 생략하면 앞 음의 길이, `r` 쉼표, `[ ]` 화음, `'` 스타카토, `>` 악센트, 셈여림 토큰, `@주법`.
- `EN.length(notes)`, `EN.shift(notes, 반음)`, `EN.delay(notes, 박)`, `EN.repeat(notes, 횟수, 길이)`.
- `EN.progression("C | Am | F G7 | C", 박/마디)` → `[{t, d, sym}]`, `EN.parseChord(sym)` → `{root, pcs, third, bass}`.
- `EN.harmonize(melody, chords, {inner:"chord"|"beat", bassRhythm:"chord"|"beat", ranges:{A,T,B}})` → `{S, A, T, B}` 4성부(3음 누락·병행 5도/8도·성부 간격을 비용으로 고른다).
- `EN.PIECES` 키 `canon`(파헬벨, 4성부 캐논: V1 V2 V3 B) `ode`(베토벤 〈환희의 송가〉 + 이 책의 화성) `chorale`(이 책의 코랄) `fanfare`(이 책의 금관 팡파르, B♭) `pastorale`(이 책의 목가, 3/4) → `{title, by, key, bpm, meter, beats, order:[성부 키 4개], names, roles, lines:{키: 음표}, chords}`. `EN.PIECE_NAMES`.
- `EN.ARRANGE` 키 `quartet windQuintet brassQuintet pianoTrio reedTrio stringOrch orchestra` → `{name, parts:[{v(성부 번호 0–3), inst, oct, label, players, vel, art}]}`. 같은 성부를 두 악기에 주면 겹치기(더블링).
- `EN.arrange(piece, arrangement, {fit:true})` → 파트 `[{id, label, inst, notes, line, oct, players, vel, art}]`. 음역 밖 음은 옥타브로 접고 `folded:true`를 붙인다(롤에 주황 테두리).

### 재생기
- `EN.player({parts:()=>[...], bpm:()=>n, loop, mixer:()=>mx, length:()=>박, legato, onNote(part, note, when), onFrame(beat), onSchedule, onStart, onStop, onEnd})` → `{start(fromBeat), stop(), toggle(), refresh(), running, beat, length}`. 옵션은 값이나 함수. 파트: `{id, inst, notes, vel(배수), art, players, real, spread, vib, mute, maxSub, pan, dist, gain}`. mixer가 있으면 파트 id마다 채널을 만들어 연결한다. 파트를 바꾸면 `refresh()`(재생 중에도 된다).
- `EN.playPart(inst, notes, opts)` 한 파트 바로 재생.

### 분석
- `EN.masking([{id, inst, m, vel, players, gain}], {top, margin})` → `{parts:[{id, audible(0–1), partials:[{f, z, db, thr, masked}]}], comps}`. Bark 축의 비대칭 퍼짐 함수(아래 27 dB/Bark, 위 12 dB/Bark)로 다른 소리의 마스킹 곡선을 쌓아, 그 아래에 들어간 배음을 가려진 것으로 본다(정적 근사).

### 위젯
- `EN.roll(canvasSel, {parts, beats, beatsPerBar, laneH, onClick(part)})` 파트별 피아노 롤 → `{set(parts, beats), at(beat), flash(id), clear(), redraw()}`. 파트에 `hidden:true`(흐리게), `hl:true`(강조).
- `EN.mixerUI(sel, {channels:parts, mixer:()=>mx, pan:true, onChange(id, state)})` → `{set(channels), state(id), sync(), setState(id, p)}`. 믹서를 새로 만든 뒤에는 `sync()`.
- `EN.stage(sel, {seats, drag, onMove(id,x,y), onDrop(id), onClick(id)})` 객석에서 본 무대 → `{set(seats), light(id), seats, render()}`. 자리 `{id, inst, x, y, label, on, off}`. `EN.seatsFor(parts)` 표준 자리.
- `EN.rangeChart(sel, {insts, marks:[{m,label}], written, notes:{inst:[midi]}, lo, hi})` 음역표(SVG).
- `EN.drawSpectra(ctx, box, [{inst, m, vel, art, color, label, gainDb, spectrum}], {fmin, fmax, dbMin, dbMax, bark, stems, offset})` 캔버스 그리기 함수 안에서 여러 스펙트럼을 함께.
- `EN.chips(sel, keys, {multi, sel, labels, onChange})` 악기 칩, `EN.options(keys, sel)` `<option>` 목록.
- CSS: `.en-legend span[style="--c:…"]`, `.en-big`, `.en-pick button(.on)`.

같은 기능을 장마다 다시 만들지 않는다. 장 고유의 모델(예: 관의 공명 모드 그림, 홀의 반사 경로, 마스킹 곡선의 시각화)만 페이지 스크립트에 둔다.

## 소리 엔진 메모 (이 저장소의 `MB`에서 고친 점)

- `MB.adsr(param, t0, env).release(t, rr)`는 릴리스 상태까지 추적한다. 이미 줄고 있는 음을 다시 release해도(정지 버튼·`MB.stopAll()`·같은 줄의 새 음) 레벨이 튀어 오르지 않고, 어택 도중에 release하면 램프를 끊지 않고 이어 받는다(짧은 음이 무음 뒤 딸깍 소리로 바뀌지 않는다).
- 일정 레벨로 시작하는 음원(버퍼 재생 등)의 voice에는 `MB.releaser(gainParam, level[, t0, attack])`를 쓰고 `rel.release(t, rr)`(→ 끝 시각)로 끈다. voice의 release에서 `setValueAtTime(처음 레벨, t)`로 되돌리는 코드를 새로 쓰지 않는다.
- 재생 중에 `ConvolverNode.buffer`를 다시 넣거나 소리가 흐르는 연결을 `disconnect()`하면 끊김·딸깍 소리가 난다. 컨볼버는 두 개를 크로스페이드하고, 배선을 바꿀 때는 출력을 수십 ms 줄였다가 다시 잇는다.
- 레벨: 한 시뮬레이터가 마스터 리미터(문턱 −6 dBFS) 앞에서 0 dBFS를 크게 넘지 않게 한다. Web Audio 컴프레서는 자동 메이크업 이득(이 설정에서 +2.6 dB)이 있어 입력이 +13 dBFS를 넘으면 출력이 0 dBFS를 넘는다.

## 검사
```bash
npm test                                   # 수식 렌더러·링크·소스 규칙
node tools/browser-check.cjs ensemble/      # 콘솔 오류·360px 가로 넘침 (Playwright)
```
