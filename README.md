# Don't Mockup Again

Don't Mockup Again is a local-first toolkit for generating App Store / Play Store screenshot sets from a single project definition (`.dma.json`).

You can run it in two ways:
- Desktop app (`Tauri + React`) for interactive workflows
- Pipeline CLI for automation and CI-like batch runs

## What It Does

- Define slots/screens once and reuse them across locales/devices
- Apply shared templates with per-instance overrides
- Localize screenshot copy with a local LLM CLI flow
- Render `(platform x device x locale x slot)` PNG output
- Export metadata, fastlane-compatible layout, and zip bundles
- Optionally run fastlane upload lanes locally

## Upcoming Milestones (Tiered)

Roadmap items below are planned priorities, not committed release dates.

### Tier 1: Design & Rendering Foundation

- [ ] Figma MCP support for importing design assets/workflows into screenshot projects
- [ ] Device frame support (store-style frame overlays per device preset)
- [ ] Broader screen size coverage (more iOS/Android presets, tablets, and additional form factors)

### Tier 2: Store Integration (MCP)

- [ ] App Store Connect MCP support for metadata and screenshot delivery workflows
- [ ] Google Play Console MCP support for metadata and screenshot delivery workflows

### Tier 3: End-to-End Publishing Ops

- [ ] Unified cross-store publishing flow (single runbook for iOS + Android)
- [ ] Pre-publish validation gates per store requirements (asset/spec checks before upload)

## Tech Stack

- Node.js workspace (ESM)
- Desktop: Tauri v2, Rust, React 18, Vite, Tailwind CSS
- Rendering: Playwright-first with fallback renderer
- Tests: Node test runner (`node --test`) via `tsx`
- Optional upload: fastlane

## Repository Layout

- `apps/desktop`: desktop UI + Tauri shell
- `packages/core`: project loading/saving, validation, render job composition, text layout
- `packages/renderer`: scene rendering to PNG
- `packages/localization`: localization engine + CLI adapter
- `packages/exporter`: export packaging, metadata generation, zip output
- `packages/uploader`: fastlane lane execution wrapper
- `scripts/pipeline.js`: pipeline CLI entrypoint
- `scripts/generate-sample-assets.js`: generates sample source screenshots
- `examples/sample.dma.json`: sample project definition
- `tests/*.test.js`: acceptance and localization tests

## Prerequisites

- Node.js 20+
- npm 10+
- For desktop app:
  - Rust toolchain (`rustup`, `cargo`)
  - Tauri host dependencies for your OS
- Optional:
  - local LLM CLI (default example: `gemini`)
  - `fastlane` (for upload workflows)

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Generate sample source images (required for `examples/sample.dma.json`):

```bash
node --import tsx scripts/generate-sample-assets.js
```

3. Validate sample project:

```bash
node --import tsx scripts/pipeline.js validate examples/sample.dma.json
```

4. Run full render+export pipeline:

```bash
node --import tsx scripts/pipeline.js all examples/sample.dma.json dist
```

5. Launch desktop app:

```bash
npm --prefix apps/desktop run tauri:dev
```

## Pipeline CLI

Usage:

```bash
node --import tsx scripts/pipeline.js render <projectPath> [renderDir]
node --import tsx scripts/pipeline.js localize <projectPath> [--write] [--source=<locale>] [--targets=<l1,l2>]
node --import tsx scripts/pipeline.js validate <projectPath>
node --import tsx scripts/pipeline.js export <projectPath> <renderDir> [outputDir] [--zip] [--fastlane] [--metadata-csv]
node --import tsx scripts/pipeline.js upload <exportDir> [iosLane] [androidLane]
node --import tsx scripts/pipeline.js all <projectPath> [workDir]
```

Common examples:

```bash
node --import tsx scripts/pipeline.js localize examples/sample.dma.json --write
node --import tsx scripts/pipeline.js render examples/sample.dma.json dist-render
node --import tsx scripts/pipeline.js export examples/sample.dma.json dist-render dist --zip --fastlane --metadata-csv
node --import tsx scripts/pipeline.js upload dist/20260101-120000 "ios metadata" "android metadata"
```

## Desktop Development

From repository root:

```bash
npm run desktop:dev
npm run desktop:build
npm --prefix apps/desktop run tauri:dev
npm --prefix apps/desktop run tauri:build
```

Desktop runtime exposes local commands used by UI for:
- pipeline execution
- project read/write
- image listing and base64 I/O
- file/directory pickers
- system font listing

## Project File (`.dma.json`)

Top-level domains:
- `project`: platforms, locales, devices, slots
- `template`: shared main template + per-instance overrides
- `copy`: localized strings by key/locale
- `pipelines`: localization/export/upload config

See `examples/sample.dma.json` for a full reference.

## Localization Behavior

Current engine normalizes localization mode to `llm-cli`.

`pipelines.localization.llmCli` example:

```json
{
  "command": "gemini",
  "argsTemplate": [],
  "timeoutSec": 120,
  "promptVersion": "v1",
  "prompt": "You are an expert ASO localization copywriter...",
  "cachePath": ".dma/cache/translation-cache.json"
}
```

Behavior highlights:
- Structured JSON sent via stdin
- Parsed JSON response mapped to `copy.keys`
- Placeholder safety checks (`{app_name}`, `%@`, `{{count}}`)
- Retry path for legacy Gemini-style args

## Output and Export Notes

- `render` writes device/locale/slot PNG outputs
- `export` writes to a timestamped subfolder under the provided output base
- Optional metadata outputs:
  - text files under `metadata/<platform>/<locale>/`
  - `metadata.csv` when `--metadata-csv` is enabled
- Optional zip output when `--zip` is enabled
- Optional fastlane folder layout when `--fastlane` is enabled

## Testing

Run full test suite:

```bash
npm test
```

Current tests cover:
- render matrix expectations
- long-text layout behavior
- copy coverage validation
- placeholder mismatch protection
- zip export generation
- localization CLI fallback/retry behavior

## CI/CD

- `CI` workflow: install, test, desktop frontend build
- `Release Desktop App` workflow:
  - builds macOS `.dmg`
  - applies ad-hoc signing (`APPLE_SIGNING_IDENTITY="-"`)
  - publishes versioned + `latest` release assets
- `Deploy GitHub Pages` workflow publishes `docs/`

## Troubleshooting

- `tauri:dev` fails:
  - verify Rust toolchain and Tauri host prerequisites
- macOS blocks app launch (“damaged”/untrusted):
  - right-click app -> `Open` once, or
  - `xattr -dr com.apple.quarantine "/Applications/Don't Mockup Again.app"`
- localization does not run:
  - verify configured CLI exists in `PATH`
- upload fails:
  - verify local fastlane install and lane names

## License

Copyright (c) 2026 Team Landscape. All rights reserved.

This project and its source code are proprietary to Team Landscape.
No permission is granted to use, copy, modify, or distribute this software without prior written authorization from Team Landscape.
