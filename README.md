# Block Rig

> A zero-bloat, Bun-native block development framework for WordPress.
> Status: **v0.1.0 — all phases complete** (spike → scaffolder → dev loop →
> quality tooling → release). Full record:
> [`docs/SPEC-000-scope-and-viability.md`](docs/SPEC-000-scope-and-viability.md).

## One-liner

`bun create block-rig` scaffolds a self-contained WordPress plugin with blocks —
built entirely by **Bun**, styled with **plain CSS compiled by Lightning CSS**,
with **no esbuild, no webpack, no wp-scripts, no SCSS**, and the smallest
dependency tree we can get away with.

## Numbers

| | |
| --- | --- |
| devDependencies (scaffolded plugin) | **6** |
| Cold production build | **~3ms** |
| Edit → visible (dev loop) | **~64ms** |
| Unit tests (`bun test`) | 16, ~430ms |
| SCSS / esbuild / webpack / babel | **0** |

## Try it (framework repo, local)

```bash
cd plugins/block-rig
bun run bin/create-block-rig.ts my-blocks --dir /path/to/wp-content/plugins
cd my-blocks && bun install && bun run build
```

Once published as the `create-block-rig` package: `bun create block-rig my-blocks`.

## Why

WP Rig proved the model (config-first, modern CSS, agent-friendly scaffolding),
but carries ~80 devDependencies and a dual-engine build (Bun-compatible scripts +
esbuild + browser-sync + jest). Block Rig is the experiment: how much of that
can one runtime replace?

| Concern | WP Rig today | Block Rig target |
| --- | --- | --- |
| JS bundler | esbuild (+ regex `wp.*` remap) | `Bun.build` (built-in TS/TSX/JSX) |
| CSS | Lightning CSS (no SCSS) | Lightning CSS (no SCSS) — unchanged |
| Dev server / reload | browser-sync | `Bun.serve` reverse proxy + injected live-reload |
| Watcher | chokidar | Bun's native `fs.watch` / `--watch` |
| JS tests | jest | `bun test` |
| Scaffold engine | @wordpress/create-block (invoked via npx) | Own template engine (plain Bun scripts) |
| Package manager | npm (Bun optional) | Bun required |

## Product shape (decided)

- **Standalone CLI scaffolder** — `bun create block-rig` generates a plugin that
  owns its own build. No required companion theme, no runtime framework plugin.
- **TypeScript default** for editor code. Bun transpiles TS/TSX natively.

## Repository layout

```
block-rig/
├── AGENTS.md                  # agent contract for working ON the framework
├── .ai/SKILLS.md              # skill directory (architecture, blocks, styles, troubleshooting)
├── bin/create-block-rig.ts    # the CLI scaffolder
├── templates/plugin/          # full plugin template (+ block templates inside)
├── tests/                     # framework CLI e2e suite (bun test)
├── .github/workflows/         # scaffold-smoke CI (3 OSes)
├── docs/
│   ├── SPEC-000-scope-and-viability.md
│   ├── architecture.md        # pipeline + invariants
│   ├── commands.md            # full command reference
│   ├── css-authoring.md       # enforced CSS budget playbook
│   └── authoring-blocks.md    # block types, entries, block.json reference
└── spike/                     # Phase 0 artifact (throwaway Bun.build proof)
```

## Open questions

Tracked in the spec's [Open Questions](docs/SPEC-000-scope-and-viability.md#open-questions)
section. Highest-impact one: how to provide editor-side `wp.*` typings without
pulling in the full `@wordpress/*` dependency tree.