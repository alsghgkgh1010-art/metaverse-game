# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 이 저장소는 무엇인가

초등학교 5~6학년 수업용 교육 게임 2종. **공모전 출품작**이다.

| 산출물 | 장르 | 교과 | 기술 |
|---|---|---|---|
| `우주탐사-RPG.html` | 3D 3인칭 탐험 | 과학 5-1 「태양계와 별」 | three.js r147 인라인 |
| `조선시대-퀴즈맵.html` | 2D 탑다운 방탈출 퀴즈 (젭퀴즈 방식) | 사회 5-2 (한국사) | Canvas 2D, 라이브러리 없음 |

**설계의 근거는 `계획서.md`와 `PRD.md`에 있다. 코드를 쓰기 전에 이 둘을 읽어라.** 특히 `계획서.md`의
"부록: 3D 기술 확정 사항"에는 조사로 확인한 r147 API 함정과 오개념 방지 목록이 들어 있다.

## 절대 제약 (어기면 산출물이 무효다)

1. **단일 HTML 파일.** CSS·JS를 전부 인라인한다. 파일을 쪼개지 않는다.
2. **`file://` 더블클릭으로 실행된다.** 로컬 서버·빌드 도구·npm·프레임워크를 쓰지 않는다.
   → `<script type="module">`, `import`, `fetch()`, `XMLHttpRequest`, `new Worker()` **전부 사용 금지**
   (전부 `file://`에서 CORS로 막힌다)
3. **외부 네트워크 요청 0건.** CDN 스크립트, 웹폰트, 원격 이미지 금지. 학교 방화벽에서 깨진다.
   폰트는 시스템 폰트 스택, 아이콘은 이모지 또는 인라인 SVG, 이미지는 코드로 생성한다.
4. **학생 개인정보를 수집·전송하지 않는다.** 닉네임만, 기기 내 저장만.

## 대상 학년: 초등 5~6학년

**"초등용이니까 유치하게"가 아니다.** 게임의 완성도·그래픽·조작감·톤은 진지하게 유지한다.
낮추는 것은 **문제 난이도, 어휘, 조작 진입장벽**뿐이다.

- 쓰지 않을 말: 통치 체제, 수취 제도, 견제, 감찰, 간쟁, 반포, 이심률, 겉보기 각지름
- 지시문은 한 문장에 한 가지 지시
- 단답형 정답은 초등생이 한글로 정확히 쓸 수 있는 짧은 낱말만
- 3D 게임: 방향키만으로도 플레이 가능해야 한다 (WASD+마우스는 초등생에게 진입장벽)

## three.js 사용 규칙 (3D 게임)

**r147 UMD 빌드를 HTML에 통째로 인라인한다.** 다른 버전을 쓰지 마라.

- r148부터 UMD 빌드와 `examples/js/*`가 제거되어 `file://` 더블클릭 실행이 불가능해진다
- 이 환경에서 cdnjs·jsdelivr·unpkg·threejs.org는 SSL 차단됨. **npm 레지스트리만 접근 가능**

```bash
# three.js r147 UMD 빌드 추출 (검증된 명령)
curl -s https://registry.npmjs.org/three/-/three-0.147.0.tgz | \
  tar -xzO package/build/three.min.js > vendor/three.r147.min.js    # 607,784 bytes

# UMD 애드온 (r148에서 삭제된 것들)
curl -s https://registry.npmjs.org/three/-/three-0.147.0.tgz | \
  tar -xzO package/examples/js/controls/OrbitControls.js > vendor/OrbitControls.r147.js
```

### r147 API — 최신 문서를 보고 쓰면 깨진다

| 최신 three (금지) | r147에서 쓸 것 |
|---|---|
| `renderer.outputColorSpace` | `renderer.outputEncoding = THREE.sRGBEncoding` |
| `THREE.SRGBColorSpace` | `THREE.sRGBEncoding` |
| `texture.colorSpace` | `texture.encoding` |
| `renderer.useLegacyLights` | (없음) `physicallyCorrectLights`를 건드리지 않거나 `false` |
| `THREE.ColorManagement.enabled` | `THREE.ColorManagement.legacyMode = false` |
| `THREE.AgXToneMapping` | `THREE.ACESFilmicToneMapping` |

- 태양을 `PointLight`로 쓸 때 `distance = 0`, `decay = 0`이 아니면 멀리 있는 천체가 새까매진다
- `logarithmicDepthBuffer`를 켜지 마라. 성능이 크게 떨어지고 AA 아티팩트가 생긴다. 씬마다 `near`/`far`를 다시 잡아라

## 데이터 분리 규칙

교사가 코딩 없이 수정할 수 있어야 한다. **파일 최상단에** 다음을 배치한다.

- 퀴즈맵: `설정`(오답 허용 여부, 진행 방식) → `문제은행`(20문항 배열) → 맵 데이터
- 맵은 문자열 배열로 표현해 눈으로 보고 고칠 수 있게 한다
  (`#` 벽 / `.` 바닥 / `Q` 문제 / `P` 포탈 / `@` 시작)
- 이 구간을 `// ===== 여기만 고치면 다른 과목으로 바꿀 수 있습니다 =====` 주석으로 감싼다
- three.js 소스는 `<!-- ===== three.js r147 (수정 금지) 시작/끝 ===== -->` 주석으로 감싸 편집 시 건너뛴다

## localStorage 주의

`file://`로 열면 모든 로컬 HTML이 **같은 출처(`null`)를 공유한다.** 두 게임이 서로의 저장값을 덮어쓰지
않도록 키 접두사를 분리한다 (`joseon.v1.*`, `space.v1.*`). 시크릿 모드에서는 접근 자체가 예외를
던지므로 **모든 읽기/쓰기를 try/catch로 감싸고, 저장이 실패해도 게임은 정상 진행되게 한다.**

## 내용 정확성 (역사 문항)

조사로 검증된 **출제 금지 소재**가 있다. 사료가 불명확하거나 학설이 갈리는 것들이다.

- 거북선의 척수, 철갑선 여부
- 남한산성 농성 일수 (자료마다 45/47/59일)
- 측우기의 발명자 특정
- 사화 각각의 원인, 붕당 분화 계보 (중·고등 범위)

표현 주의: 상평통보를 "조선 최초의 화폐"라 쓰지 않는다. 노비를 "노예"로 설명하지 않는다.
붕당을 부정 일변도로 서술하지 않는다(당파성론은 식민사관 잔재).

**초등 원칙**: 틀린 것을 가르치지 않되, 초등 교과서와 정면 충돌하는 문항은 출제하지 않는다.

## 오개념 방지 (이 프로젝트의 차별화 지점)

게임 메커닉이 오개념을 심을 수 있다. 대표적인 위험:

- 저중력 점프 → "달·우주에는 중력이 없다". 착지할 때마다 "달도 잡아당기고 있어요"를 확인시킨다
- 태양계 지도의 크기·거리 과장 → 왜곡 배지를 **끌 수 없게** 상시 표시한다
- 목성형 행성을 구로 그림 → "착륙 불가" 배지. 실제 착륙지는 달·화성·유로파(모두 고체)뿐
- 위성 수를 고정 숫자로 표기 → 반드시 기준일을 병기한다 (토성 2023년 146개 → 2026년 285개)

## 배포 전 검사

```bash
# file:// 안전성 — 전부 0건이어야 한다
grep -c 'type="module"\|[^\\]import \|fetch(\|XMLHttpRequest\|new Worker(' 우주탐사-RPG.html
grep -c 'https\?://' 조선시대-퀴즈맵.html          # 주석 외 0건

# 인라인 스크립트 안에 </script> 가 있으면 파싱이 깨진다 → <\/script> 로 이스케이프
grep -c '</script' 우주탐사-RPG.html                # <script> 블록 종료 개수와 일치해야 함

# r147 API 감사 — 전부 0건이어야 한다
grep -c 'outputColorSpace\|SRGBColorSpace\|useLegacyLights\|AgXToneMapping' 우주탐사-RPG.html
```

실행 확인은 파일을 **다른 폴더로 복사한 뒤** 더블클릭한다(단일 파일 조건 검증).
네트워크를 끊고 개발자도구 Network 탭에서 요청 0건을 확인한다.

## 접근성·교실 환경 기준

- 본문 18px 이상 (프로젝터 뒷자리에서 읽혀야 한다)
- 터치 타겟 44px 이상 (태블릿)
- 색만으로 정보를 구분하지 않는다. 명도 대비 WCAG AA 이상
- `prefers-reduced-motion` 존중
- 내장 그래픽 노트북에서 30fps 이상. 미달 시 그림자·지형 세분화를 단계적으로 하향

## 커밋

산출물이 **실제로 열려서 작동하는 것을 확인한 뒤에만** 커밋한다. 원격 저장소는 요청이 있을 때만 연결한다.

## 응답 언어

한국어. 코드 주석·UI 문구도 한국어가 기본이다.

---

## 참고

홈 디렉터리에 OpenAI Codex(`~/.codex`)와 Gemini CLI(`~/.gemini`) 설정이 있습니다.
거기 있는 MCP 서버·슬래시 명령·서브에이전트·스킬·지침을 Claude Code로 가져오려면
`/import` 를 입력해 무엇을 가져올 수 있는지 목록을 확인한 뒤,
`/import --yes=<digest>` 로 적용하세요. (digest 값은 스캔 결과에 표시됩니다.)
