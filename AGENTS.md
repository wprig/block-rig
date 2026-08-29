# Block Rig — AI Agents Guide

Welcome, AI Agent! This repository **is the framework**: the `create-block-rig`
CLI + the templates that generate WordPress block plugins. You are working
**on** the framework, not using it to build a specific product.

## Core pillars

### 1. Templates are the product
Everything a user gets lives in `templates/plugin/`. When changing behavior:
- Edit `templates/plugin/**` (or `templates/plugin/templates/blocks/**` for
  block templates) — **never** a generated plugin.
- Generated plugins are self-contained: they must keep working with this repo
  deleted. Nothing may import from the framework at runtime.
- After template changes, verify by scaffolding fresh:
  `bun run bin/create-block-rig.ts smoke --dir /tmp && cd /tmp/smoke && bun install && bun run check`

### 2. Test contract
- Framework: `bun test` (CLI e2e — structure, token substitution, **no
  surviving `__TOKEN__` placeholders**, validation failures).
- Generated plugins: 16 tests + lint via `bun run check` — CI runs this on
  ubuntu/macos/windows (`.github/workflows/`).
- Run `bun test` here before submitting; the token-leakage assertions catch
  most template regressions.

### 3. Token engine rules
- Tokens: `__SLUG__`, `__FUNC__`, `__PLUGIN_NAME__`, `__NAMESPACE__`,
  `__TEXT_DOMAIN__`, `__VERSION__`, `__YEAR__`, `__BLOCK_NAME__`,
  `__BLOCK_TITLE__`, `__BLOCK_PREFIX__`, `__BLOCK_MESSAGE_CLASS__`.
- The regex is non-greedy; **never place a token immediately before a literal
  underscore** — add a dedicated token instead (see `BLOCK_MESSAGE_CLASS`).
- Beware collisions with PHP magic constants (`__DIR__`, `__FILE__`,
  `__NAMESPACE__`).

### 4. Config first
`blockrig.config.json` is the single source of truth in generated plugins.
New build behavior must read from it (via `scripts/lib/config.ts`), ship a
default, and be overridable.

### 5. Zero-bloat is a feature
Every dependency needs justification against the ≤ 6 devDeps budget.
Before adding a dep, prove Bun's built-ins (fs.watch, Bun.serve, bun:test,
node:zlib, node:crypto) can't do it.

## Command shortlist

| Command | What it does |
| --- | --- |
| `bun test` | CLI e2e suite |
| `bun run create -- <slug> --dir <parent>` | Scaffold a plugin (same as the bin) |
| `bun run bin/create-block-rig.ts <slug> --dir <parent>` | Full CLI form |

Full reference: [docs/commands.md](docs/commands.md).

## Skill directory

See [.ai/SKILLS.md](.ai/SKILLS.md) — architecture, authoring blocks, styles,
troubleshooting. The skills describe **both** sides: framework work here and
generated-plugin work (which is what end users' agents will face). PHP-first
block authoring: [docs/php-blocks.md](docs/php-blocks.md).