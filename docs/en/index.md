---
icon: lucide/rocket
---

# Intro

[RolePlay Catalogue Client](https://github.com/Firefox2100/roleplay-catalogue-client) is a desktop application for creating and editing [SillyTavern Character Card V3](https://docs.sillytavern.app/) resources, with built-in AI co-author assistance.

## Project Description

This application provides a structured, field-by-field visual editor for SillyTavern character cards and lorebooks. Data is stored authoritatively on a remote RolePlay Catalogue service; local drafts are disposable. Rust owns all network calls, credentials, and file I/O; React never sees raw secrets. Draft saves use optimistic concurrency (`If-Match` / ETag) with a three-way merge conflicts dialog.

## Core Features

- **Visual editing** across multiple detailed pages for each resource type.
- **Comprehensive resource support** — character cards, lorebooks, standalone releases. Chat presets, WorldSE worlds, and more are planned.
- **World overview planner** — local setting description, tone, themes, cast mode, and creative constraints.
- **Lorebook editor** — activation tester, regex validation, priority ordering, recursive-scanning simulation, and per-entry diagnostics.
- **Linked lorebooks** — connect character cards to standalone lorebook resources and pinned releases.
- **Extension composer** — regex scripts, Tavern Helper scripts, and runtime variables with inline testing.
- **MVU composer** — typed variable model that generates coordinated scripts, lorebook entries, and regex artefacts.
- **Cover and assets manager** — upload catalogue covers, select from your image library, embed data URIs for V3 assets.
- **AI co-author drawer** — conversation history, structured proposals, single-field or whole-draft context.
- **Deterministic overview diagnostics** — completion percentage, token estimates, structural errors and warnings.
- **Internationalisation** — English (UK) and Simplified Chinese interface; resource content language drives LLM prompts.
- **Dark / light / system theme** support with respect for `prefers-color-scheme`.
