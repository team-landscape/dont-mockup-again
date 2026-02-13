# StoreShot Studio

Store screenshot automation tool for macOS desktop workflows.

- Upload screenshots and map them to slots.
- Apply a main template with per `(device, locale)` overrides.
- Render `(slot x locale x device)` PNG outputs.
- Import translations from BYOY JSON.
- Run translation via BYOK (OpenAI-compatible API) or local LLM CLI.
- Export folder layout + zip + optional fastlane layout.

## Repository Layout

- `apps/desktop`: Tauri + React desktop shell
- `packages/core`: project model, template merge, text layout, validation
- `packages/renderer`: scene renderer (Playwright first, PNG fallback)
- `packages/localization`: BYOY importer + BYOK/LLM localization adapters
- `packages/exporter`: dist/metadata/zip + fastlane-compatible layout
- `packages/uploader`: local fastlane command wrapper
- `examples`: sample project and assets

## Quick Start

```bash
node --import tsx scripts/generate-sample-assets.js
node --import tsx scripts/pipeline.js localize examples/sample.storeshot.json --write
node --import tsx scripts/pipeline.js render examples/sample.storeshot.json dist-render
node --import tsx scripts/pipeline.js export examples/sample.storeshot.json dist-render dist --zip --fastlane
```

Or run one-shot:

```bash
node --import tsx scripts/pipeline.js all examples/sample.storeshot.json dist
```

## Localization Modes

`pipelines.localization.mode` supports:

- `byok`: OpenAI-compatible API with user-provided key via env var
- `llm-cli`: local command adapter (`gemini-cli`, `ollama` wrapper, custom scripts)

BYOK example (`pipelines.localization.byok`):

```json
{
  "baseUrl": "https://api.openai.com/v1",
  "endpointPath": "/chat/completions",
  "model": "gpt-4o-mini",
  "apiKeyEnv": "OPENAI_API_KEY",
  "timeoutSec": 120,
  "promptVersion": "v1",
  "styleGuidePath": "style.md"
}
```

Local LLM CLI example (`pipelines.localization.llmCli`):

Project config example (`pipelines.localization.llmCli`):

```json
{
  "command": "gemini",
  "argsTemplate": [],
  "timeoutSec": 120,
  "promptVersion": "v1",
  "styleGuidePath": "style.md"
}
```

Run localization:

```bash
node --import tsx scripts/pipeline.js localize examples/sample.storeshot.json --write
```

Adapter behavior (both modes):

- Sends translation payload JSON into CLI input (stdin).
- For `gemini`/`gemini-cli`, automatically uses prompt mode and parses JSON output.
- Supports file-placeholder args templates (`{INPUT}`, `{OUTPUT}`, `{LOCALE}`) for custom wrappers.
- Reads JSON output and applies to `copy.keys`.
- Validates placeholder preservation (`{app_name}`, `%@`, `{{count}}`).
- Caches translations by hash of `(sourceText + locale + promptVersion)`.

## Desktop App

`apps/desktop` provides a Tauri + React desktop app with these working tabs:

- Project Wizard
- Screens
- Template
- Localization
- Preview / Validate
- Export / Upload

UI stack:

- `shadcn/ui` style component pattern (`apps/desktop/src/components/ui/*`)
- Radix primitives
- Tailwind CSS (via `@tailwindcss/postcss`)

Implemented behavior:

- Load / Save `.storeshot.json`
- Create a new project template in-app
- Edit slots and copy per locale
- Import BYOY JSON into `copy.keys`
- Run render / validate / export / upload pipelines
- Preview rendered PNGs directly in the app

Run UI only (Vite):

```bash
npm run desktop:dev
```

Build UI bundle:

```bash
npm run desktop:build
```

Run full Tauri app (requires Rust + Tauri toolchain):

```bash
cd apps/desktop
npm run tauri:dev
```

## Sample Files

- `examples/sample.storeshot.json`
- `examples/assets/source/shot1.png`
- `examples/assets/source/shot2.png`
- `examples/assets/source/shot3.png`

## Tests

```bash
npm test
```

Acceptance tests cover:

- `3 slots x 2 locales x 2 devices = 12` renders
- text wrapping/ellipsis stability for long ko-KR copy
- BYOY missing key/locale detection
- placeholder protection checks
- export zip creation
