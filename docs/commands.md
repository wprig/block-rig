# Commands

## Framework (this repo)

| Command | What it does |
| --- | --- |
| `bun run create -- <slug> --dir <parent>` | Scaffold a new block plugin |
| `bun test` | Framework CLI e2e suite (6 tests) |
| `bun run bin/create-block-rig.ts <slug> --dir <parent> [--name …] [--namespace …] [--version …] [--type static\|dynamic\|php] [--force]` | Full CLI form |

Once published as `create-block-rig` on npm: `bun create block-rig <slug>`.

## Generated plugin

| Command | What it does |
| --- | --- |
| `bun install` | Install (6 devDeps, ~1s) |
| `bun run build` | Build all blocks (dev: sourcemaps, unminified) |
| `NODE_ENV=production bun run build` | Production build (minified, no maps) |
| `bun run dev` | Dev server: proxy + live-reload + per-block rebuild |
| `bun run dev --proxy http://my-site.local` | Same, target via flag |
| `bun run dev --port 9000` | Same, custom port |
| `bun run block:new <slug> [--type static\|dynamic\|php] [--title "…"]` | Scaffold a block |
| `bun run lint` | tsc typecheck + stylelint CSS budget |
| `bun run lint:types` | tsc only |
| `bun run lint:css` | stylelint only |
| `bun test` | Unit tests (16) |
| `bun run check` | **Pre-flight: lint + test** — run before every submission |
| `bun run zip` | Production build + WP-installable `<slug>.zip` |

## One-time setup

1. Scaffold: `bun run bin/create-block-rig.ts my-blocks --dir /path/to/wp-content/plugins`
2. `cd my-blocks && bun install`
3. Set the dev target in `blockrig.config.json`:
   `"devServer": { "proxyTarget": "http://my-site.local", "port": 8777 }`
4. `bun run build` → activate the plugin in WP → add blocks in the editor.

## CI (shipped, GitHub Actions)

- **Generated plugins**: `.github/workflows/check.yml` — install → check →
  prod build → zip → artifact verified, on ubuntu/macos/windows.
- **This framework**: `.github/workflows/scaffold-smoke.yml` — the same flow
  starting from a fresh scaffold, on all three OSes.