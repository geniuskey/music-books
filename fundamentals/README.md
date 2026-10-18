# MusicBook — 인터랙티브 음악 교과서

음, 화음, 리듬을 소리로 배우기. 엔지니어와 공대생을 위한 한국어 음악 학습 사이트입니다.
취미로 음악을 배우되, 감이 아니라 **소리를 신호로, 음계를 집합으로, 화성을 그래프로, 리듬을 이산 시계열로** 다룹니다.
모든 소리는 브라우저의 Web Audio API로 실시간 합성되며, 음원 파일 없이 동작합니다.

CameraBook · AnalogBook 등과 같은 [시리즈](https://books.euiyun.com/)입니다.

## 실행
빌드 과정이 없는 정적 사이트입니다.

```bash
python3 -m http.server 8000   # → http://localhost:8000
```
`index.html`을 브라우저로 바로 열어도 동작합니다. KaTeX와 웹 폰트는 CDN에서 불러오며, 없으면 수식이 원문으로, 글꼴이 시스템 글꼴로 표시됩니다.
소리는 페이지에서 처음 클릭하거나 키를 누를 때 시작됩니다(브라우저 자동재생 정책). 상단 스피커 버튼으로 전체 소리를 끌 수 있습니다.

## 구성
| 장 | 파일 | 주제 |
|---|---|---|
| 01 | chapters/sound.html | 압력파, 주파수·진폭·위상, dB SPL, 맥놀이와 간섭, 가청 범위 |
| 02 | chapters/harmonics.html | 푸리에 급수, 16배음 가산 합성, 깁스 현상, 잃어버린 기본음, 위상, 포먼트와 모음 합성 |
| 03 | chapters/instruments.html | 현·관의 정상파, 카플러스–스트롱, 피아노 비조화성, 막과 막대의 비조화 모드 |
| 04 | chapters/synthesis.html | ADSR, 감산 합성과 공진 필터, FM·AM·링 변조, LFO, 유니즌 |
| 05 | chapters/tuning.html | 피타고라스 콤마, 순정률·중전음률·평균율, 왜 12음인가(N-평균율), 콤마 펌프 |
| 06 | chapters/consonance.html | 음정과 정수비, 맥놀이와 거칠기, 플롬프–레벨트·세타레스 불협화 곡선, 청음 |
| 07 | chapters/scales.html | 12비트 피치 클래스 집합, 선법의 밝기, 5도권, 최대 균등성, 대칭 음계 |
| 08 | chapters/chords.html | 3·7화음, 텐션, 전위·보이싱, 화음 이름 붙이기, 집합류(포르테 번호) |
| 09 | chapters/progressions.html | **코드 진행 놀이터**, 화성 기능 그래프, 종지, 보이스 리딩, 블루스 |
| 10 | chapters/reharm.html | 세컨더리 도미넌트, 토네츠·네오리만, 트라이톤 대리, 차용 화음, 네거티브 하모니 |
| 11 | chapters/rhythm.html | 메트로놈·탭 템포, 박자와 그루핑, 스윙 비율, 폴리리듬, 당김음 점수 |
| 12 | chapters/sequencer.html | **8트랙 리듬 시퀀서**, 룩어헤드 스케줄링, 유클리드 리듬, 드럼 합성, 휴머나이즈 |
| 13 | chapters/melody.html | 피아노 롤, 동기 변형, 마르코프 선율, 1/f 선율, 조성 찾기, 카논 |
| 14 | chapters/psychoacoustics.html | 등청감 곡선, 마스킹, 셰퍼드 톤, ITD/ILD, 음높이 JND |
| 15 | chapters/dsp.html | 에일리어싱, 양자화와 디더, FFT 창, 스펙트로그램, EQ·딜레이·컴프레서·리버브 |
| 16 | chapters/midi.html | MIDI 바이트, 피치 벤드 14비트, VLQ·PPQ, SMF(.mid) 만들기, Web MIDI |
| 17 | chapters/studio.html | 코드·베이스·드럼·선율 루프 스테이션, WAV 내보내기 |
| 18 | chapters/glossary.html | 소리 나는 용어집, 청음 퀴즈, 종합 퀴즈 |

공통 코드: `css/style.css`(디자인 토큰, 라이트/다크, 건반·스텝 그리드·패드 컴포넌트), `js/common.js`(전역 `MB`: 레이아웃, 차트·캔버스 헬퍼, 오디오 엔진(악기·드럼 합성·룩어헤드 스케줄러), 음악 이론(음계·화음·다이아토닉·보이스 리딩·조율), DSP(FFT·바이쿼드), 피아노 건반·오선보 위젯).
챕터 작성 규칙과 `MB` API는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

```bash
python3 tools/seo.py        # canonical/OG/JSON-LD 태그와 sitemap.xml 갱신
node tools/check.mjs        # Playwright로 전 페이지 콘솔 오류·360px 가로 스크롤·시뮬레이터 조작 점검
npm ci && npm run build     # 배포물(.book-dist/) 생성 — @euiyun/book
```

시뮬레이터의 악기 소리와 수치는 원리를 보여 주기 위한 교육용 근사 모델입니다(예: 피아노는 배음 12개 가산 합성, 드럼은 TR-808 방식의 해석적 합성). 각 시뮬레이터 아래에 모델의 가정을 적었습니다.

## 배포
`main`에 푸시하면 GitHub Actions(`.github/workflows/pages.yml`)가 `@euiyun/book`으로 `.book-dist/`를 만들어 GitHub Pages에 배포합니다. `CNAME`은 `musicbook.euiyun.com`입니다.

## 용어집과 본문 뜻풀이

용어 정의는 `js/glossary-data.js`의 `window.BOOK_GLOSSARY`에 저장합니다. 용어집과 본문 뜻풀이가 같은 데이터를 사용하며, 본문에서 용어에 마우스를 올리거나 키보드로 포커스하거나 모바일에서 탭하면 정의를 확인할 수 있습니다. 공통 동작과 스타일은 `js/glossary-tooltips.js`, `css/glossary-tooltips.css`입니다. 데이터 형식은 시리즈 공통 v1이며, 각 항목은 `ko`(이름), `en`(영문명), `abbr`(약어), `def`(정의), `chapters`(관련 장 목록)를 갖습니다. 이름이 반복되면 한 번만 표시하고, 묶음 항목은 가리킨 이름을 제목에 표시하며 구분에 필요한 비교 설명을 함께 제공합니다.

## 라이선스

코드는 [MIT](LICENSE-MIT), 교재 콘텐츠는 [CC BY 4.0](LICENSE-CC-BY-4.0)으로 제공됩니다. 적용 범위와 재사용 조건은 [라이선스 안내](LICENSE.md)를 참고하세요.
