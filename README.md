# MusicBooks · 음악 교과서 서가

음악 분야의 여러 인터랙티브 교과서를 한 저장소에서 관리합니다. 홈은 SemiBooks의 책장·검색·분야 필터·실습·읽는 순서 구성을 따릅니다.

서비스 주소: **https://music.euiyun.com/**

| 책 | 경로 | 상태 |
|---|---|---|
| MusicBook · 음악 기초 | `/fundamentals/` | 공개, 18개 장 |
| GuitarBook · 기타 | `/guitar/` | 공개, 15개 장 |
| PianoBook · 피아노 | `/piano/` | 공개, 15개 장 |
| DrumBook · 드럼 | `/drums/` | 공개, 15개 장 |

GuitarBook(`guitar/`)·PianoBook(`piano/`)·DrumBook(`drums/`)은 이 저장소에서 직접 집필한 책으로, MusicBook(`fundamentals/`)의 엔진(`MB`)과 장 구성 규칙을 그대로 쓰고 악기 전용 엔진을 더했습니다. 기타는 `guitar/js/guitar.js`(`GT`: 가상 기타·지판·코드 다이어그램·TAB), 피아노는 `piano/js/piano.js`(`PN`: 물리 모델 근사 피아노 음원·댐퍼/소스테누토/소프트 페달·건반·큰보표 악보·운지·보이싱·반주 패턴·MIDI 입력), 드럼은 `drums/js/drums.js`(`DR`: 베셀 모드 막·스네어 와이어·금속 부분음 심벌로 합성한 가상 킷, 하이햇 열림과 초크, 플램·드래그·버즈, 드럼 악보·스텝 그리드·킷 그림, 그루브·루디먼트 사전, 스윙·휴머나이즈 스케줄러, 탭 타이밍 채점, MIDI 패드)입니다. 집필 규칙은 [guitar/CONTRIBUTING.md](guitar/CONTRIBUTING.md), [piano/CONTRIBUTING.md](piano/CONTRIBUTING.md), [drums/CONTRIBUTING.md](drums/CONTRIBUTING.md)를 참고하세요.

## 실행과 배포

```bash
npm ci
npm test
npm run build
python3 -m http.server 8000 --directory .book-dist
```

배포물은 `.book-dist/`입니다. GitHub Pages의 Source를 GitHub Actions로 설정하고, 커스텀 도메인 `music.euiyun.com`과 DNS를 연결합니다. `main`에 push하거나 Deploy Book 워크플로를 실행하면 검사·빌드 후 배포합니다. 이 저장소의 CNAME 설정만으로 DNS나 GitHub 설정이 자동 변경되지는 않습니다.

빌드에는 외부 패키지나 원본 저장소가 필요하지 않습니다. 책의 수식·폰트 등 기존 CDN 의존성은 유지합니다. 오디오는 책의 재생 버튼을 눌러 시작합니다.

## 원본 가져오기

`geniuskey/musicbook`의 추적 파일을 `fundamentals/`에 복사했습니다. 원본 본문·오디오 엔진·집필 도구·라이선스를 보존하고, 사이트 주소·테마 키·서가 연결을 새 경로에 맞췄습니다. 원본 Git 이력은 중첩하지 않고 `migration/import-state.json`에 원본 커밋과 파일 해시를 기록합니다. 원본 저장소와 기존 서비스는 변경하지 않습니다.

원본이 같은 상위 폴더의 `musicbook/`에 있을 때:

```bash
npm run import:check
python3 tools/import-books.py --write
npm run catalog
npm run sitemap
npm test
npm run build
```

가져오기 도구는 통합본의 로컬 수정 덮어쓰기와 원본에서 삭제된 파일의 자동 삭제를 거부합니다. 양쪽에서 수정한 파일은 먼저 직접 병합해야 합니다.

## 새 책 추가

책마다 `{slug}/index.html`, `{slug}/chapters/`, `{slug}/book.json`을 두고 `book.json`의 `books` 목록에 등록합니다. 외부 저장소에서 가져오는 책은 `migration/books.json`에 원본과 slug, 표지 정보를 추가합니다. `tools/sync-catalog.py`는 이 목록에서 공개 책을 생성하며, 로컬에서 새로 집필하는 책(`guitar/`, `piano/`, `drums/`)은 생성기의 `LOCAL_BOOKS`에 메타데이터를 추가합니다.

`roadmap.json`은 아직 공개되지 않은 책 목록입니다(현재 비어 있음). 책을 공개할 때 해당 예정 항목을 제거하고 `npm run catalog`와 `npm run sitemap`을 실행합니다. 생성된 `catalog.js`는 직접 편집하지 않습니다.

## 라이선스

코드는 MIT, 교육 콘텐츠는 CC BY 4.0입니다. [라이선스 안내](LICENSE.md)와 각 책의 저작권 표시를 참고하세요.
