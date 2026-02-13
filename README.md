# StoreShot Studio

Store screenshot automation toolkit with a desktop UI (Tauri + React) and reusable pipeline modules.

It helps you generate store-ready screenshot assets from one project definition:

- Manage slots/screens per project
- Apply shared template layout across devices/locales
- Run localization via BYOY JSON or local LLM CLI
- Render `(device x locale x slot)` PNG outputs
- Export folder layout, metadata CSV, and zip bundles
- Optionally run fastlane upload lanes from local machine

## Key Features

- Desktop workflow for Screens, Localization, Preview, Export
- Pipeline-first architecture (`core`, `renderer`, `localization`, `exporter`, `uploader`)
- Local-only execution (no mandatory SaaS backend)
- Placeholder-safe localization (`{app_name}`, `%@`, `{{count}}`)
- Fast iteration with sample project and test coverage

## Repository Structure

- `apps/desktop`: Tauri desktop app (React frontend + Rust shell)
- `packages/core`: project model, validation, text layout, persistence helpers
- `packages/renderer`: screenshot rendering (Playwright-first + fallback renderer)
- `packages/localization`: BYOY import + LLM CLI localization adapter
- `packages/exporter`: output packaging (`dist`, zip, fastlane-compatible layout)
- `packages/uploader`: local fastlane wrapper
- `scripts/pipeline.js`: pipeline command entrypoint
- `scripts/generate-sample-assets.js`: generates example source screenshots
- `examples/sample.storeshot.json`: sample StoreShot project
- `tests/*.test.js`: acceptance and localization CLI tests

## Tech Stack

- Runtime: Node.js (ESM workspace)
- Desktop: Tauri v2 + Rust
- UI: React 18 + Vite + Tailwind CSS
- Testing: Node test runner (`node --test`) via `tsx`
- Optional upload: fastlane (local install)

## Prerequisites

- Node.js 20+
- npm 10+
- For desktop app:
  - Rust toolchain (`rustup` + `cargo`)
  - Tauri host requirements for your OS
- Optional:
  - `gemini` (or another local LLM CLI) for localization mode
  - `fastlane` for upload lanes

## Installation

```bash
npm install
```

This installs root dependencies and workspace packages.

## Quick Start (Pipeline CLI)

Generate sample source screenshots:

```bash
node --import tsx scripts/generate-sample-assets.js
```

Run full pipeline in one shot:

```bash
node --import tsx scripts/pipeline.js all examples/sample.storeshot.json dist
```

Or run step-by-step:

```bash
node --import tsx scripts/pipeline.js localize examples/sample.storeshot.json --write
node --import tsx scripts/pipeline.js render examples/sample.storeshot.json dist-render
node --import tsx scripts/pipeline.js export examples/sample.storeshot.json dist-render dist --zip --fastlane
```

## Localization Modes

`pipelines.localization.mode` is normalized to `llm-cli` in current implementation.

`pipelines.localization.llmCli` example:

```json
{
  "command": "gemini",
  "argsTemplate": [],
  "timeoutSec": 120,
  "promptVersion": "v1",
  "prompt": "You are an expert ASO localization copywriter...",
  "cachePath": ".cache/translation-cache.json"
}
```

Behavior highlights:

- Sends structured JSON payload via stdin
- Parses JSON result and maps back to `copy.keys`
- Retries legacy Gemini-style args with prompt mode when needed
- Enforces placeholder preservation and consistency checks
- Supports translation cache keyed by source/prompt context

## Desktop App

From root:

```bash
npm run desktop:dev
```

Build desktop frontend bundle:

```bash
npm run desktop:build
```

Run full Tauri desktop app:

```bash
npm --prefix apps/desktop run tauri:dev
```

Build Tauri desktop app:

```bash
npm --prefix apps/desktop run tauri:build
```

### Desktop Runtime Notes

The Rust shell exposes local commands used by the UI:

- pipeline execution (`run_pipeline`)
- project file read/write
- PNG listing and image base64 I/O
- output/project picker dialogs
- system font listing

## Project File

Primary project artifact: `*.storeshot.json`

See:

- `examples/sample.storeshot.json` for full structure
- `packages/core/src` for model and validation logic

Core domains in file:

- `project`: platforms, locales, devices, slots
- `template`: main layout and per-slot overrides
- `copy`: localized text keyed by slot fields
- `pipelines`: localization/export/upload configs

## Testing

Run full test suite:

```bash
npm test
```

Current coverage includes:

- render matrix expectation (`3 slots x 2 locales x 2 devices = 12`)
- long-text wrapping/ellipsis behavior
- BYOY missing key/locale detection
- placeholder mismatch protection
- exporter zip output generation
- LLM CLI fallback/retry compatibility behavior

## Common Workflows

Create/update project via desktop app:

1. Open app (`tauri:dev`)
2. Load `examples/sample.storeshot.json` or create new
3. Edit slots/template/copy
4. Run Localization / Preview / Export

Batch render in CI-like flow:

1. `pipeline.js localize --write`
2. `pipeline.js render`
3. `pipeline.js export --zip`

## Troubleshooting

- `tauri:dev` fails:
  - Check Rust toolchain and Tauri host dependencies
- LLM localization not running:
  - Verify CLI command is installed and available in PATH
- Upload step fails:
  - Confirm local fastlane install and lane names
- Missing rendered images in preview:
  - Re-run `render` step and verify render output directory

## GitHub Pages (Optional)

If you maintain static project docs in `docs/`, publish with GitHub Pages Actions workflow.

Current landing source path:

- `docs/index.html`

## License

No license file is currently included in this repository.
