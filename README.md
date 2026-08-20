# RolePlay Catalogue Client

[![License: GPL v3](https://www.gnu.org/graphics/gplv3-88x31.png)](https://www.gnu.org/licenses/gpl-3.0.en.html)

A visual editor and LLM-assisted writing client for [SillyTavern](https://docs.sillytavern.app) and other resources managed by the RolePlay Catalogue service. For the Roleplay Catalogue service itself, see [Roleplay Catalogue](https://github.com/Firefox2100/roleplay-catalogue).

## Description

This desktop application provides a structured, field-by-field editing experience for roleplay resources. It stores data authoritatively on a remote catalogue service while caching drafts and application settings locally. An integrated co-author assistant calls OpenAI, Anthropic, Ollama, or any OpenAI-compatible provider to propose edits that you review and accept before saving.

**Key principles:**

- Built as a client of the remote service; it does not host or serve content itself. Some features rely on the remote services to handle, like legacy version conversion, storage, and synchronisation.
- The catalogue service is the single source of truth; local drafts are disposable.
- Rust owns all network calls, credentials, and file I/O; React never sees raw secrets. This allows better and safer cross-platform support and future integration with other clients, including web-based ones.
- Draft saves use optimistic concurrency (`If-Match` / ETag) with a three-way merge conflicts dialog.
- Author-assisting tooling are designed to help writing and editing, or in more autonomous workflows, generating the content directly. The user is always in control of what is saved to the catalogue.

## Features

- **Visual editing** across multiple detailed fields and pages for each resource type.
- **Comprehensive resource support** — character cards, lorebooks, and standalone releases. More resources including chat completion presets, WorldSE worlds, etc. are planned and will be implemented.
- **World overview planner** — local setting description, tone, themes, cast mode, and creative constraints.
- **Lorebook editor** with activation tester, regex validation, priority ordering, and recursive-scanning simulation.
- **Linked lorebooks** — connect character cards to standalone lorebook resources and pinned releases.
- **Extension composer** — regex scripts, Tavern Helper scripts, and runtime variables with inline testing.
- **MVU composer** — typed variable model that generates coordinated scripts, lorebook entries, and regex artefacts.
- **Cover and assets manager** — upload catalogue covers, select from your image library, embed data URIs for V3 assets.
- **AI co-author drawer** — conversation history, structured proposals, single-field or whole-draft context.
- **Deterministic overview diagnostics** — completion %, token estimates, structural errors and warnings.
- **Internationalisation** — English (UK) and Simplified Chinese interface; resource content language drives LLM prompts.
- **Dark / light / system theme** support with respect for `prefers-color-scheme`.

## Getting Started

### Requirements

If deployed from source, the following are required to build and run the application:

- **Node.js** 18+ and **npm** (or **pnpm**)
- **Rust** 1.76+ (with `rustup`)
- **Tauri CLI** — `npm install -g @tauri-apps/cli`
- **Linux**: `libwebkit2gtk-4.1`, `libssl3`, `rustc`, `cargo`, `clang`, `make`
- **Windows**: Visual Studio Build Tools 2022 (Desktop development with C++)
- **macOS**: Xcode Command Line Tools

If using the pre-compiled release, the only requirement is a supported operating system architecture (Linux x86_64, Windows x86_64, macOS x86_64 or arm64).

### From source

```bash
# Install frontend dependencies
npm install

# Run the development server (hot-reload enabled)
npm run tauri dev

# Build for production
npm run tauri build
```

The compiled binary will be placed in `src-tauri/target/release/bundle/` (Linux: AppImage, Debian, Flatpak; Windows: NSIS, MSIX; macOS: dmg, pkg).

### Using a compiled release

Download a release from the project's distribution channel, install or extract the binary, then launch it. On first open:

1. Open **Settings** (gear icon in the navigation drawer).
2. Set the **Catalogue** base URL and API key.
3. (Optional) Configure an **LLM provider** for the co-author assistant.
4. Click **Save settings**.

After configuration you will see the resource picker and can create or select a character card or lorebook to edit.

## Project Structure

```
├── src/                     # React frontend
│   ├── App.tsx              # Shell, routing, state wiring
│   ├── types.ts             # TypeScript interfaces
│   ├── backend.ts           # Tauri invoke wrappers
│   ├── i18n.ts              # en-GB / zh-CN translations
│   ├── threeWayMerge.ts     # Optimistic concurrency merge
│   └── *.tsx                # Editor pages
├── src-tauri/
│   ├── src/lib.rs           # All Tauri commands (catalogue, LLM, SQLite)
│   ├── Cargo.toml           # Rust dependencies
│   └── capabilities/        # Tauri permission schemas
├── plans/                   # Design & findings documents
└── docs/                    # Additional documentation
```

## Licence

GNU General Public License v3.0 — see [LICENSE](LICENSE).
