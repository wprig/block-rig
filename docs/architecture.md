# Architecture

Block Rig is a **Bun-only** WordPress block-plugin framework. One runtime
(bundler, transpiler, watcher, test runner, dev server) replaces the usual
esbuild/webpack + chokidar + browser-sync + jest stack. The only external
build tool is **Lightning CSS** (a native binary, no SCSS, no PostCSS).

## The three layers

```
create-block-rig (this repo)
├── bin/create-block-rig.ts     CLI scaffolder — renders templates/plugin/
├── templates/plugin/           the entire generated plugin, as template files
│   └── templates/blocks/       block templates (shipped INTO generated plugins)
└── docs/, .ai/, tests/         framework docs, agent skills, CLI e2e tests
```

A **generated plugin** is self-contained: it carries its own build scripts and
its own block templates, so `bun run block:new` works with no framework
installed. Nothing at runtime ever depends on this repo.

## Template engine

`bin/create-block-rig.ts` + `scripts/scaffold.ts` (generated) share one
convention: copy a template tree, render `__TOKEN__` placeholders in file
contents **and filenames** (`.tmpl` suffix stripped).

Tokens: `SLUG`, `FUNC` (slug with `_`), `PLUGIN_NAME`, `NAMESPACE`,
`TEXT_DOMAIN`, `VERSION`, `YEAR` (plugin) + `BLOCK_NAME`, `BLOCK_TITLE`,
`BLOCK_PREFIX` (`br-<name>`), `BLOCK_MESSAGE_CLASS` (block).

> The token regex is **non-greedy** (`__([A-Z][A-Z_]*?)__`) because
> underscore-adjacent tokens like `__FUNC___init` are otherwise ambiguous.
> Never introduce tokens adjacent to literal underscores — add a dedicated
> token instead (see `BLOCK_MESSAGE_CLASS`).

## Build pipeline (scripts/lib/build.ts)

Per block directory (any dir under `blocks/` containing `block.json`):

1. **JS** — `Bun.build`: `target: 'browser'`, `format: 'iife'`,
   `jsx: { runtime: 'automatic' }`. Entries:
   - `src/index.{tsx,ts,js}` → `build/index.js` (editor entry; skipped for
     PHP-only blocks)
   - `src/view.{tsx,ts,js}` → `build/view.js` (frontend entry, optional —
     pair with `"viewScript": "file:./build/view.js"` in block.json)
   - Skipped entirely when `block.json` has `supports.autoRegister: true`.
2. **CSS** — `lightningcss.transform()`: nesting, `drafts.customMedia`
   (mandatory — custom media silently stays unexpanded without it),
   browserslist targets, minify in prod, sourcemaps in dev.
   - `src/style.css` → `build/style.css`
   - `src/editorStyle.css` → `build/editorStyle.css` (optional)
3. **PHP-only blocks** get CSS compilation only — no JS surface.

### The `wp.*` externals plugin (scripts/lib/wp-externals.ts)

Editor code imports `@wordpress/*`, `react`, `react-dom` and the automatic
JSX runtime normally. A Bun plugin with `onResolve` (namespace redirect) +
`onLoad` (module shim) remaps them to the `window.wp.*` globals WordPress
enqueues:

| Import | Resolves to |
| --- | --- |
| `react` | `window.React` |
| `react/jsx-runtime` | `{ jsx, jsxs, Fragment }` from `window.wp.element` |
| `@wordpress/block-editor` | `window.wp.blockEditor` (kebab→camelCase rule) |

Nothing WP-provided is ever bundled — bundles are typically 1–4kB.
`Bun.build` **throws** on unresolvable imports (it does not return
`success: false` for resolution errors) — the build CLI catches and reports.

## Dev loop (scripts/dev.ts)

One `Bun.serve` process, zero dependencies:

1. **Reverse proxy** to the configured WP site: canonical `Host` header,
   server-side redirect following, hop headers stripped, absolute canonical
   URLs rewritten to proxy-relative so browsing stays on the proxy origin.
2. **Live reload**: native WebSocket at `/__br_reload` + a ~350-byte injected
   client (before `</body>`); auto-reconnects every second.
3. **Per-block watcher**: `fs.watch(recursive)` over `blocks/` + root
   PHP/JSON files, 25ms debounce, rebuilds **only the touched block**, then
   broadcasts `reload`. PHP edits need no build — they reload directly.

## Zip packaging (scripts/zip.ts)

Production build, then a **hand-written zip container** (local file headers,
central directory, EOCD; CRC32 table; `node:zlib` deflate with STORE
fallback). This is deliberate: no `zip` CLI dependency, so packaging works on
Windows runners too. Excludes `node_modules`, `.git`, existing zips.

## Quality gates

- `bun test` — 16 template tests + 6 framework CLI e2e tests (scaffolds real
  plugins into temp dirs, asserts structure and that **no `__TOKEN__`
  placeholder survives** into generated files).
- `bun run lint` — `tsc --noEmit` (strict) + stylelint budget (see
  [css-authoring.md](css-authoring.md)).
- `bun run check` — lint + test, the single pre-flight command.

## Known limitations (deliberate, v0.1)

- No HMR — full live-reload only (parity with wp-scripts).
- No Node.js support — Bun ≥ 1.2 is the floor, everywhere.
- Static blocks render from saved markup; a post created via wp-cli needs the
  serialized inner HTML (normal WordPress behavior).
- WordPress "inline small stylesheets" behavior may inline block CSS handles
  instead of serving them as files — cosmetic, core behavior.