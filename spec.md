아래 내용을 그대로 **Codex(또는 로컬 코딩 에이전트)** 에 붙여서 “이 스펙대로 구현해줘”로 쓰면 돼.
(목표는 **Mac 앱 GUI** + **스크린샷 업로드 → AppMockUp 같은 목업 이미지 생성** + **다국어는 BYOY/로컬 LLM CLI** + **Export/선택적 Upload**)

---

## Codex 작업 지시서 (스펙/구현 플랜)

### 0) 프로젝트 이름

**Don't Mockup Again**

---

## 1) 제품 목표

* **Figma API 없이** 사용자가 업로드한 앱 스크린샷으로 스토어용 목업 이미지를 생성한다.
* AppMockUp처럼 **Main Template(마스터)** 를 만들고, **Instance(디바이스×언어)** 가 이를 상속/override 한다.
* 다국어 텍스트는

  1. **BYOY(Bring Your Own translations)**: 사용자가 json/yaml/arb/strings.xml/strings 등 제공
  2. **로컬 LLM CLI**: gemini-cli / codex / cc 등 사용자가 등록한 커맨드를 실행해 생성
* 산출물은 **Export**(폴더/zip)하고, 옵션으로 **fastlane deliver/supply 업로드**까지 지원한다(로컬에 설치된 fastlane 호출).

---

## 2) MVP 범위 (최소 기능)

### MVP-1

1. Mac 앱 GUI
2. 프로젝트 생성(앱명/플랫폼 iOS/Android 선택, locales 선택)
3. 스크린샷 여러 장 업로드 → “슬롯(1..N)”로 정렬(드래그로 재정렬)
4. 템플릿 편집(최소)

   * 배경(단색/그라디언트)
   * 상단 타이틀/서브타이틀 텍스트 박스(폰트/사이즈/정렬/줄바꿈)
   * 스크린샷 삽입(센터/오프셋/스케일)
   * 간단한 “디바이스 프레임” 오버레이(초기엔 기본 rounded frame 또는 사용자 프레임 이미지 업로드로 대체)
5. 렌더링: (device×locale×slot) → PNG 생성
6. 번역: BYOY(JSON) 지원 + LLM CLI(커맨드 등록/실행/결과 리뷰) 중 1개는 MVP-1에 포함
7. Export: 결과물 폴더 + zip

### MVP-2

* Validator(스토어 규격 기반 룰: 파일포맷/alpha/해상도 범위/개수 등)
* fastlane 업로드 옵션(iOS deliver, Android supply)
* 번역 placeholder 보호/용어집/금칙어 적용 + diff 리뷰 UX

---

## 3) 기술 스택 제안 (Codex가 선택해서 구현)

**최우선: 구현 속도/이미지 렌더 품질/텍스트 레이아웃 안정성**

### 옵션 A (추천): Tauri(Desktop) + React UI + Node 렌더러(Playwright)

* UI: React(+Tailwind)
* Backend: Tauri(Rust)에서 로컬 커맨드 실행, 파일 I/O, 프로젝트 저장
* 렌더링: Node(TypeScript) + Playwright(헤드리스 크로미움)로 HTML/CSS 기반 템플릿을 “정확한 픽셀 해상도”로 PNG 출력

  * 텍스트 줄바꿈/폰트 처리 용이, 레이아웃 엔진 안정적
* 장점: 템플릿 편집 UI ↔ 렌더 결과가 일관됨

### 옵션 B: SwiftUI 네이티브 + CoreGraphics 렌더

* 장점: 완전 네이티브
* 단점: 텍스트/레이아웃/폰트/줄바꿈/템플릿 시스템 구현이 더 빡셈

> Codex는 **옵션 A**로 진행(빠르게 완성)하되, 구조는 “렌더 엔진/번역 엔진/업로드 엔진” 분리해서 추후 네이티브 렌더로 교체 가능하게.

---

## 4) 아키텍처 (모듈 분리)

* `ui/` : Mac 앱 UI
* `core/` : 프로젝트 모델/검증/템플릿 정의/출력 구조
* `renderer/` : 템플릿 → PNG 렌더 (Playwright)
* `localization/`

  * `byoy/` : 외부 번역 파일 import/매핑
  * `llm-cli/` : 로컬 LLM CLI 실행 어댑터
* `exporter/` : 폴더/zip/fastlane 구조 생성
* `uploader/` : (옵션) fastlane 호출 래퍼

---

## 5) 데이터 모델 (프로젝트 파일 포맷)

프로젝트는 하나의 파일로 저장: `*.storeshot.json`

```json
{
  "schemaVersion": 1,
  "project": {
    "name": "Jedero Store Assets",
    "bundleId": "com.example.app",
    "packageName": "com.example.app",
    "platforms": ["ios", "android"],
    "locales": ["en-US", "ko-KR", "ja-JP"],
    "devices": [
      { "id": "ios_phone", "width": 1290, "height": 2796, "pixelRatio": 1 },
      { "id": "android_phone", "width": 1080, "height": 1920, "pixelRatio": 1 }
    ],
    "slots": [
      { "id": "slot1", "order": 1, "sourceImagePath": "assets/source/shot1.png" },
      { "id": "slot2", "order": 2, "sourceImagePath": "assets/source/shot2.png" }
    ]
  },
  "template": {
    "main": {
      "background": { "type": "solid", "value": "#0B0F14" },
      "frame": { "type": "simpleRounded", "enabled": true, "inset": 80, "radius": 80 },
      "text": {
        "title": { "x": 80, "y": 120, "w": 1130, "h": 220, "font": "SF Pro", "size": 88, "weight": 700, "align": "left" },
        "subtitle": { "x": 80, "y": 330, "w": 1130, "h": 160, "font": "SF Pro", "size": 48, "weight": 500, "align": "left" }
      },
      "shotPlacement": { "x": 120, "y": 560, "w": 1050, "h": 2200, "fit": "cover", "cornerRadius": 60 }
    },
    "instances": [
      {
        "deviceId": "ios_phone",
        "locale": "ko-KR",
        "overrides": { "text": { "title": { "size": 84 } } }
      }
    ]
  },
  "copy": {
    "keys": {
      "slot1.title": { "en-US": "Clean in 5 minutes", "ko-KR": "하루 5분이면 충분" },
      "slot1.subtitle": { "en-US": "Stay on track daily", "ko-KR": "매일 가볍게 유지해요" }
    }
  },
  "pipelines": {
    "localization": {
      "mode": "llm-cli",
      "llmCli": {
        "command": "gemini-cli",
        "argsTemplate": ["translate", "--in", "{INPUT}", "--out", "{OUTPUT}", "--to", "{LOCALE}"],
        "timeoutSec": 120,
        "glossaryPath": "glossary.csv",
        "styleGuidePath": "style.md"
      }
    },
    "export": {
      "outputDir": "dist",
      "formats": ["png"],
      "zip": true
    },
    "upload": {
      "enabled": false,
      "fastlane": {
        "iosLane": "ios metadata",
        "androidLane": "android metadata"
      }
    }
  }
}
```

---

## 6) 렌더링 엔진 요구사항 (Playwright 기반 권장)

* 입력: `.storeshot.json` + 원본 스크린샷 이미지 + 템플릿
* 출력: 각 (slot × locale × device) PNG
* 구현 방식:

  1. 프로젝트/템플릿을 HTML/CSS로 렌더 가능한 “씬”으로 변환
  2. Playwright로 지정 해상도 viewport 설정
  3. 폰트 로딩(로컬 폰트/프로젝트 폰트 번들)
  4. screenshot API로 PNG 저장
* 텍스트 줄바꿈:

  * 박스(w,h) 안에서 자동 줄바꿈 + overflow 처리(ellipsis 옵션)
  * locale별로 글자 길이 차이 대응(오버라이드 제공)

---

## 7) 번역 엔진 요구사항

### 7.1 BYOY 모드

* 지원 입력(최소): JSON
* 키-로케일 매핑:

  * `{ "slot1.title": { "en-US": "...", "ko-KR": "..." } }` 형태
* UI에서 “필드/키” 매핑 및 누락 검사

### 7.2 LLM CLI 모드

* 사용자가 등록한 커맨드를 `spawn`으로 실행
* 표준 입출력 규격:

  * INPUT: JSON (keys + source locale + target locale + style/glossary)
  * OUTPUT: JSON (translated strings)
* 필수 보호:

  * placeholder 보호: `{app_name}`, `%@`, `{{count}}` 등은 변형 금지
  * 금칙어/문자수 제한(옵션)
* 결과 리뷰:

  * diff UI(원문/번역문/승인/수정)
* 캐시:

  * (sourceText + locale + promptVersion) 해시로 캐싱

---

## 8) Validator (룰 엔진)

* 룰을 코드에 하드코딩하지 말고 “preset JSON”으로 분리:

  * 이미지 포맷/알파채널 허용/해상도 범위/최소 개수 등
* MVP 룰 예시:

  * Android: PNG에 alpha가 있으면 실패(또는 자동 flatten 옵션)
  * 최소 스크린샷 개수, 최대 개수
  * 해상도 범위 체크

---

## 9) Exporter 요구사항

* 기본 export:

  * `dist/{platform}/{device}/{locale}/{slot}.png`
  * `dist/metadata/{platform}/{locale}/...txt`
* 옵션: fastlane 구조로 export

  * iOS: `fastlane/metadata/<locale>/*.txt`, `fastlane/screenshots/<locale>/*.png`
  * Android: `fastlane/metadata/<locale>/title.txt`, `short_description.txt`, `full_description.txt`, `images/phoneScreenshots/*.png`
* zip 생성 옵션

---

## 10) Uploader (옵션)

* “로컬 fastlane 설치”를 전제
* UI에서 “Upload” 누르면:

  * export fastlane 구조 생성 → `fastlane <lane>` 실행 → 로그를 UI에 스트리밍
* 실패 시:

  * 로그 + 실패 원인(validator/fastlane) 구분 표시

---

## 11) UI 화면 요구사항 (최소)

1. Project Wizard: 앱명/플랫폼/로케일/디바이스 프리셋 선택
2. Screens: 스크린샷 import, 슬롯 순서 편집
3. Template: 배경/텍스트/프레임/배치 편집 + 실시간 프리뷰
4. Localization:

   * BYOY import 또는 LLM CLI 설정(커맨드/argsTemplate/timeout)
   * Generate + Review + Approve
5. Preview/Validate:

   * locale/device/slot 전환
   * validate 결과 리스트
6. Export/Upload:

   * 경로 선택, zip 여부
   * 업로드 옵션(토글)

---

## 12) 리포지토리/코드 산출물 요구사항

* Monorepo 구조 예:

  * `apps/desktop` (Tauri+React)
  * `packages/core`
  * `packages/renderer`
  * `packages/localization`
  * `packages/exporter`
* `README.md`에:

  * 설치/실행
  * LLM CLI 어댑터 설정 예시
  * 샘플 프로젝트 파일
* 샘플 assets 포함:

  * `examples/sample.storeshot.json`
  * `examples/assets/source/*.png`

---

## 13) Acceptance Tests (필수)

* 스샷 3장 + locales 2개 + devices 2개 → 총 12장 렌더 결과가 생성된다.
* ko-KR에서 텍스트가 길어도 텍스트 박스 규칙(줄바꿈/ellipsis)이 깨지지 않는다.
* BYOY JSON import 시 누락 키/누락 로케일이 validate에서 잡힌다.
* LLM CLI 모드에서 placeholder가 유지된다.
* Export zip 생성이 된다.
* (옵션) fastlane 업로드 실행 커맨드가 정상 호출되고 로그가 UI에 표시된다.
