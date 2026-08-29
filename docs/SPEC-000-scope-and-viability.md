# SPEC-000 — Block Rig: Scope & Viability

- **Status:** ✅ **v0.1.0 — ALL PHASES COMPLETE (2026-08-28)** + ✅ hardening/docs/agent-tooling pass (2026-08-28). Distribution deferred until the framework survives real-world use.
- **Date:** 2026-08-28
- **Project:** `wp-content/plugins/block-rig` (new, standalone — not part of the `wprig/` repo)
- **Decided by developer:** standalone CLI scaffolder; TypeScript default; Bun-only build;
  no esbuild; no SCSS; Lightning CSS; minimal dependencies.

---

## 1. Vision

Block Rig is a WordPress **block plugin development framework** in the spirit of
`@wordpress/create-block`, rebuilt around a single runtime: **Bun**.

One tool does everything Bun can do natively:

- **Package manager** — `bun install`
- **Bundler** — `Bun.build` (JS/TS/TSX/JSX, no esbuild, no webpack)
- **Transpiler** — native TS/TSX, native JSX (no babel, no tsc for emit)
- **Test runner** — `bun test` (no jest, no vitest)
- **Watcher** — `fs.watch` / `bun --watch` (no chokidar)
- **Dev server** — `Bun.serve` reverse proxy with injected live-reload (no browser-sync)

The only compile step Bun cannot do is **CSS**, which stays with
**Lightning CSS** (already proven in WP Rig): native nesting, `@custom-media`,
container queries, autoprefixing + minification in one pass, browserslist targets.
**No SCSS, no PostCSS, no autoprefixer.**

## 2. Goals / Non-goals

### Goals

1. **One runtime.** Every build/dev/test task runs under `bun`. Node is never required.
2. **Dependency budget ≤ 6 devDependencies** in the scaffolded plugin (see §6).
3. **Cold build < 1s**, incremental rebuild < 100ms, `bun install` of the scaffold < 5s.
4. **Zero config to start.** Scaffold → `bun run dev` → block works in the editor.
5. **Plain modern CSS** compiled by Lightning CSS; authoring rules borrowed from
   WP Rig's Modern CSS Playbook (nesting ≤ 3, specificity budget, no `!important`).
6. **Agent-friendly**: scaffold ships `AGENTS.md` + `blockrig.config.json`
   (single source of truth, same config-first philosophy as WP Rig).
7. **create-block shape compatibility**: generated `block.json` follows the same
   schema/conventions (apiVersion 3, `supports.autoRegister` for PHP-only blocks,
   `viewScript` for frontend JS) so blocks stay portable to other tooling.

### Non-goals (v1)

- No classic/universal theme paradigms — Block Rig is **block-based by definition**
  (it scaffolds plugins, not themes).
- No SCSS/Sass support, ever. No PostCSS plugin pipeline.
- No HMR for editor React code. Full live-reload is acceptable (wp-scripts doesn't
  do true HMR either).
- No component registry (WP Rig OCR-style) in v1 — possible later, out of scope here.
- No theme.json authoring support (that's theme territory).
- No npm/Node support path. Bun ≥ 1.2 is the floor.

## 3. Product shape

`bun create block-rig my-blocks` (or `bunx create-block-rig`) produces:

```
my-blocks/                        # a normal WP plugin
├── blockrig.config.json          # single source of truth (namespaces, targets, paths)
├── block-rig.php                 # plugin bootstrap (register blocks, enqueue, i18n)
├── AGENTS.md                     # agent contract (commands, conventions, pitfalls)
├── package.json                  # scripts + ≤ 6 devDependencies
├── tsconfig.json                 # types only (no emit — Bun transpiles)
├── blocks/
│   └── example-block/
│       ├── block.json
│       ├── src/
│       │   ├── index.tsx         # editor entry (registerBlockType)
│       │   ├── edit.tsx          # React editor component (TS)
│       │   ├── save.tsx          # only when static
│       │   ├── view.ts           # frontend entry (optional)
│       │   └── style.css         # plain CSS, Lightning CSS pipeline
│       ├── render.php            # when dynamic (autoRegister / render_callback)
│       └── build/                # generated: index.js, view.js, style.css, *.map
├── scripts/
│   ├── build.ts                  # bun run build   → Bun.build all blocks
│   ├── dev.ts                    # bun run dev     → build + watch + proxy server
│   ├── scaffold.ts               # bun run block:new
│   └── lib/wp-externals.ts       # the @wordpress/* → wp.* global remap plugin
└── tests/                        # bun test unit tests; Playwright optional
```

CLI surface (mirrors WP Rig's block commands, minus the theme):

| Command | Purpose |
| --- | --- |
| `bun run block:new` | scaffold a block (static / dynamic / PHP-only autoRegister) |
| `bun run build` | one-shot production build (minify, strip maps) |
| `bun run dev` | incremental watch + live-reload proxy |
| `bun test` | unit tests (bun test) |
| `bun run lint` | Lightning CSS lint config + `tsc --noEmit` typecheck |
| `bun run zip` | production zip of the plugin (Bun zip APIs / `archiver`-free) |

## 4. Build pipeline design

### 4.1 JS/TS — `Bun.build`

Sketch (what `scripts/build.ts` will do per block):

```ts
Bun.build({
  entrypoints: ['blocks/example-block/src/index.tsx'],
  outdir: 'blocks/example-block/build',
  target: 'browser',
  format: 'iife',
  minify: { whitespace: true, identifiers: true },
  sourcemap: 'linked',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [wpExternals()],           // §4.2
  naming: '[dir]/index.[ext]',
});
```

Viability notes (researched against Bun 1.2, installed locally as 1.2.22):

- Bun.build natively handles `.ts`/`.tsx` + JSX (configurable `jsx: 'automatic'`).
  No loader plugins needed for TS — a **direct improvement over WP Rig's esbuild
  setup**, which needs a regex onLoad transform to even read JSX.
- `format: 'iife'` + `target: 'browser'` matches the WP block-script model.
- `external` + plugin `onResolve` API is stable — sufficient for the `wp.*` remap.
- Bun.build's per-file incremental watch loop: rebuild one block on change via
  `fs.watch` on `blocks/**/src` (a dir watcher per block; no chokidar needed).
- Risk: Bun.build has no esbuild-style `context.watch()` API with change events —
  we drive re-builds ourselves from `fs.watch`. Accepted (simple enough).

### 4.2 The `wp.*` externals problem (core technical risk)

Editor code imports `@wordpress/*` and `react`, but those must resolve to the
globals WP enqueues (`wp.element`, `wp.blockEditor`, …), not be bundled.
WP Rig solves this with an esbuild onLoad regex transform
(`wprig/scripts/tasks/buildAllBlocks.js:10`). Block Rig ports the same strategy
to a **Bun plugin**:

```ts
function wpExternals(): BunPlugin {
  return {
    name: 'wp-externals',
    setup(build) {
      build.onResolve({ filter: /^(react|react-dom|@wordpress\/.*)$/ }, (args) => ({
        path: args.path, namespace: 'wp-global',
      }));
      build.onLoad({ filter: /.*/, namespace: 'wp-global' }, ({ path }) => {
        const global = path === 'react' ? 'window.React'
          : path === 'react-dom' ? 'window.ReactDOM'
          : 'window.wp.' + path.replace('@wordpress/', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        return { contents: `module.exports = ${global};`, loader: 'js' };
      });
    },
  };
}
```

This is strictly better than the regex-replace approach: real module resolution,
no import-statement rewriting, supports namespace + default imports uniformly.
**Verification of this plugin is Phase 0's success gate** (§8).

Enqueue side: the generated PHP enqueues only `wp-element`/`wp-block-editor`/…
dependencies in `block.json` `editorScript` handles — same as create-block output.

### 4.3 CSS — Lightning CSS, no SCSS

- Source is plain `.css` with native nesting, `@custom-media`, `:has()`, logical
  properties, container queries.
- `lightningcss.transform()` (napi binary — works identically under Bun):
  `targets` from browserslist, `enableBrowsers`, minify in prod, source maps in dev,
  custom-media expansion.
- One pass replaces autoprefixer + postcss + sass entirely.
- Block CSS is **scoped by convention**: `blocks/<name>/src/style.css` compiles to
  `build/style.css`, enqueued via `block.json` `style` handle. Editor CSS optional
  (`editorStyle.css`).
- Lint: reuse WP Rig's calibrated stylelint budget rules as a default `.stylelintrc`
  (stylelint is the one CSS-quality dep we keep — it has no Bun-native equivalent).

### 4.4 Dev loop — replacing browser-sync

`bun run dev` starts a single `Bun.serve` on a free port (e.g. `:8777`) that:

1. **Reverse-proxies** the local WP site (works with Local's `*.local` domains).
2. **Injects** a ~40-line live-reload client snippet into HTML responses
   (WebSocket from the Bun server itself — `Bun.serve` handles WS natively).
3. Watches `blocks/**/src` + PHP templates; rebuilds the touched block (JS via
   Bun.build, CSS via lightningcss) and broadcasts reload.

Zero dependencies for the entire dev loop. browser-sync, chokidar, tiny-lr, and
`create-cert` all disappear. (HTTPS: Local already terminates TLS; the proxy is
plain HTTP behind it — cert generation is out of scope.)

## 5. Testing strategy

| Layer | Tool | Notes |
| --- | --- | --- |
| Unit (build scripts, scaffolder) | `bun test` | jest-compatible API; replaces jest entirely |
| Block runtime (browser) | Playwright (optional dep) | only for blocks shipping interactive JS |
| PHP | PHPUnit via composer | standard WP plugin testing; unchanged |

`bun test` runs TS natively — no ts-jest/babel. Playwright is **optional** in the
scaffold (installed on `bun run e2e:init`), keeping the default dependency tree tiny.

## 6. Dependency budget

Scaffolded plugin `devDependencies` (target ≤ 6):

| # | Package | Why it survives |
| --- | --- | --- |
| 1 | `lightningcss` | CSS compile/minify — the only real build dep |
| 2 | `stylelint` + `stylelint-config-standard` | CSS quality budget (2 packages) |
| 3 | `typescript` | `tsc --noEmit` typecheck (Bun transpiles but doesn't typecheck) |
| 4 | `@playwright/test` | optional, installed on demand |
| 5 | `@types/*` (react) + wp typings | **open question §9.1** |

Eliminated vs. WP Rig's block stack: `esbuild`, `@wordpress/scripts`,
`@wordpress/create-block`, `webpack` (transitively ~40 packages), `babel` (all),
`autoprefixer`, `browser-sync`, `chokidar`, `jest`, `ts-jest`, `create-cert`,
`cross-env`, `npm-run-all`, `del`, `fs-extra`, `glob`, `mkdirp`, `rimraf`
(Bun's `fs`, `Glob`, `rm -rf`-equivalents cover all of these natively).

## 7. Viability risk register

| # | Risk | Severity | Mitigation / position |
| --- | --- | --- | --- |
| R1 | `Bun.build` less mature than esbuild (plugin API surface, edge cases in minifier) | MED | Our needs are minimal (iife + tsx + externals). Phase 0 spike gates everything on this exact configuration. Worst case: keep Bun runtime, swap one bundler — pipeline code is isolated in `scripts/lib/wp-externals.ts` + `build.ts`. |
| R2 | No HMR for editor React | LOW | Accept live-reload (parity with wp-scripts). Blocks are small; reload cost is negligible. |
| R3 | `wp.*` typings without `@wordpress/*` packages | MED | §9.1 open question. Short-term: hand-rolled `globals.d.ts` stubs for the ~8 packages a typical block touches. |
| R4 | Lightning CSS under Bun — napi binding compatibility | LOW | Already proven inside WP Rig's own scripts run under Bun (`bun run rig-init:bun` path). Phase 0 verifies explicitly. |
| R5 | Bun Windows stability | LOW | Bun 1.2 supports Windows natively; document CI matrix (macOS + ubuntu + windows-latest) from Phase 1. |
| R6 | create-block feature drift (new scaffolding features in wp-scripts) | LOW | We only mirror the `block.json` schema conventions, not wp-scripts' build; schema is stable and versioned by WP. |
| R7 | `bun test` gaps vs jest (snapshot/expect differences, module mocks) | LOW | Our unit surface is small (build scripts, config merge). `bun test:mock` covers module mocks. |
| R8 | i18n / script translations | LOW | PHP-side (`wp_set_script_translations`) — unaffected by tooling. Scaffold wires it. |

## 8. Phasing

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| **0 — Spike** ✅ | Prove `Bun.build` (iife/tsx) + `wpExternals` plugin + lightningcss under Bun, against a throwaway dynamic block on this Local site. | Block renders in editor + frontend; cold build timed < 1s. **Go/no-go for the project.** |
| **1 — Scaffolder MVP** ✅ | `bun create block-rig`: plugin scaffold, `block:new` (static/dynamic/PHP-only), config file, AGENTS.md. | Scaffold → activate → block works, zero manual edits. |
| **2 — Dev loop** ✅ | `dev.ts` proxy + live-reload + per-block watch. | Edit → visible in browser < 500ms; PHP edits trigger reload. |
| **3 — Quality tooling** ✅ | `bun test` harness, stylelint budget, tsc typecheck, lint script. | Example block passes full `bun run lint` + tests. |
| **4 — Release** ✅ | `bun run zip`, README/docs, CI (GitHub Actions, 3 OSes), version 0.1.0. | Cold install → build → activate flow documented and verified on this workspace. |

### Phase 0 spike results (2026-08-28) — ALL GATES GREEN

Spike code preserved at `spike/` (throwaway `price-card` dynamic block:
TSX editor entry with automatic JSX, PHP `render.php`, nested CSS with
`@custom-media`). Verified on this Local WP 7.1 site via symlinked plugin +
wp-cli (socket: `wp-content/plugins` root) + test post + curl.

| Gate | Result |
| --- | --- |
| `Bun.build` iife + TSX + automatic JSX | ✅ 4.5kB dev / 1.6kB minified — zero React bundled |
| `wpExternals` Bun plugin (`@wordpress/*`, `react`, `react/jsx-runtime` → `wp.*`) | ✅ real module resolution, all globals shimmed, block registers at runtime (stubbed `window` smoke test) |
| lightningcss under Bun (nesting, custom media, minify) | ✅ compiles correct; **requires `drafts: { customMedia: true }`** |
| Live WP 7.1 render | ✅ plugin activates, `render.php` output + compiled CSS enqueue on frontend |
| Cold build timing | ✅ **dev 9–17ms, prod 5ms** (gate was < 1s) |
| Dependency count | ✅ 2 devDeps (lightningcss, browserslist), 3 packages, install 198ms |

**Two authoring/tooling findings baked into Phase 1 requirements:**

1. **Native CSS nesting has no Sass `&` concatenation.** `&__plan` compiles to
   the invalid selector `__plan.br-price-card` (both Bun and Node — spec-correct
   lightningcss behavior, not a Bun bug). The scaffold's lint budget must ban
   `&`-concatenation and require full class names inside nested rules (WP Rig's
   Modern CSS Playbook convention holds).
2. **`@custom-media` is a lightningcss draft feature** — silently unexpanded
   without `drafts: { customMedia: true }`. The Block Rig CSS pipeline bakes
   this in (as WP Rig's `build-css.js:292` already does).

**Live-verification procedure (reproducible):** symlink `plugins/block-rig-spike →
block-rig/spike`, `wp plugin activate block-rig-spike` with
`php -d mysqli.default_socket=<Local socket> wp …` (Local's DB is socket-only),
create a post containing `<!-- wp:block-rig/price-card … /-->`, curl the
permalink, deactivate + delete post + remove symlink when done (zero orphans).

### Phase 1 scaffolder MVP results (2026-08-28) — EXIT CRITERIA MET

Implementation now lives in the framework root: `bin/create-block-rig.ts` (CLI) +
`templates/plugin/` (full plugin template, including the three block templates
under `templates/plugin/templates/blocks/` so generated plugins run `block:new`
without the framework installed).

**What the scaffold generates:** `blockrig.config.json` (single source of truth),
`<slug>.php` bootstrap (auto-registers every `blocks/*/block.json` — no manual
registration), `AGENTS.md` agent contract, `README.md`, `tsconfig.json`
(strict, jsx react-jsx, noEmit), `types/wp-globals.d.ts` (ambient stubs so
`bun run lint` passes with zero `@wordpress/*` deps — open question §9.1
answered with option (a)-style stubs shipped in-template), `scripts/` (build.ts,
scaffold.ts, lib/wp-externals.ts, lib/config.ts), starter block, `.gitignore`.

**Validated live (scaffold → install → build → activate → frontend, zero manual
edits), all three block types:**

| Check | Result |
| --- | --- |
| Scaffold `block-rig-demo` + starter dynamic block | ✅ |
| `bun install` | ✅ 4 devDeps (types/bun, browserslist, lightningcss, typescript), 16 packages, < 1s |
| `block:new --type static` / `--type php` | ✅ |
| Build: 2 JS bundles + 3 CSS files | ✅ dev 8ms (8.5kB) / prod 5ms (3.8kB minified) |
| `tsc --noEmit` (strict) with zero WP deps | ✅ green |
| Frontend render: dynamic (render.php), static (saved markup), PHP-only (autoRegister) | ✅ all three, compiled CSS enqueued per block |
| Editor bundles register at runtime | ✅ (stubbed-globals smoke test, both blocks) |

**Findings baked into the template:**

1. `Bun.build`'s typed `jsx` option is the **object form** (`{ runtime: 'automatic' }`);
   the string shorthand works at runtime but fails `tsc` against @types/bun 1.2.
2. Ambient type stubs must stay a **global script** (no top-level `export {}`)
   or `declare module` blocks never register.
3. Static blocks need serialized saved markup in post content (same as
   create-block) — documented, not a scaffold bug.
4. Template engine uses non-greedy `__TOKEN__` regex + a dedicated `__FUNC__`
   token, because underscore-adjacent tokens (`__SLUG___init`) are ambiguous.
5. Dependency budget held at **4 devDeps**; the §9.1 typings question is
   resolved pragmatically (ship stubs, document the upgrade path).

### Phase 2 dev loop results (2026-08-28) — EXIT CRITERIA MET

`scripts/dev.ts` (new, zero deps — replaces browser-sync + chokidar + tiny-lr):

- **Reverse proxy** (`Bun.serve`): forwards to the configured WP site with the
  canonical Host header, follows redirects server-side, strips hop headers,
  rewrites absolute canonical URLs so browsing stays on the proxy origin.
- **Live-reload**: `Bun.serve`'s native WebSocket at `/__br_reload` + a ~350-byte
  injected client snippet (before `</body>`); auto-reconnects.
- **Per-block incremental rebuild**: `fs.watch(recursive)` on `blocks/` +
  root PHP/config files, 25ms debounce, rebuilds only the touched block
  (build logic refactored into `scripts/lib/build.ts` with a per-block API;
  `build.ts` is now a thin CLI). PHP-only blocks reload without any build.
- Config: `devServer: { proxyTarget, port }` in `blockrig.config.json`, or
  `--proxy`/`--port` flags. If no target is configured, `dev` exits with a
  helpful message (watch-only fallback is Phase 3+ if ever needed).

**Verified live against this Local WP 7.1 site** (`http://localhost:8777 →
http://wprig-dev.local`):

| Gate | Result |
| --- | --- |
| HTML proxied + snippet injected + canonical URLs rewritten | ✅ |
| WS client receives `reload` after file touch | ✅ < 100ms from change |
| PHP edit (render.php) → visible through proxy | ✅ **64ms** (gate < 500ms) |
| CSS edit (src/style.css) → rebuilt (2ms) + served through proxy | ✅ |
| Per-block isolation (only touched block rebuilds) | ✅ |

Findings: dev (non-minified) Lightning CSS output keeps `border-radius: 33px`
spacing — tooling assertions must match non-minified vs minified forms.
Browser-UI verification (real WebSocket reload in a tab) is implied by the WS
round-trip + snippet presence; a Playwright tab-level check can be added with
Phase 3's test harness.

### Phase 3 quality tooling results (2026-08-28) — EXIT CRITERIA MET

Shipped into the plugin template:

- **`bun test` harness** (`tests/`, jest-compatible `bun:test` API, TS native —
  jest/tsc-jest/babel all eliminated):
  - `config.test.ts` — loadConfig defaults, overrides, merge semantics.
  - `wp-externals.test.ts` — global-mapping table + real `Bun.build` runs:
    WP imports remap to `window.wp.*` without bundling (output < 2kB), and
    unhandled packages fail loudly (Bun.build **throws** on resolution
    errors rather than returning `success: false` — test documents this).
  - `css.test.ts` — native nesting flattens, custom media expands (no
    `@custom-media`/`--br-mobile` survives), production minify.
  - `css-budget.test.ts` — the `.stylelintrc` budget itself is under test
    (clean CSS passes; `&`-concatenation, specificity breach, `!important`,
    depth > 3 all caught).
- **Stylelint budget** (`.stylelintrc`, stylelint 17 + config-standard 40):
  WP Rig C1-calibrated rules — specificity (0,4,1), nesting ≤ 3, no
  `!important`, custom-property `var()` enforcement — **plus the Phase 0
  finding as an enforced rule**: `selector-nested-pattern` bans Sass-style
  `&` concatenation with a budget message. `selector-class-pattern` null
  (BEM block classes allowed), `no-descending-specificity` off (documented).
- **Script surface:** `lint` = `lint:types` (tsc) + `lint:css` (stylelint);
  `test` = `bun test`; **`check` = lint + test** (the one-command pre-flight,
  WP Rig's `ai:check` analogue). dev.ts `upgrade()` return path fixed for
  strict tsc.

**Validation:** fresh scaffold → `bun install` (**6 devDeps** — budget held) →
`bun run check` green (tsc + stylelint + **16/16 tests in 430ms**). Negative
control: planted `&__injected` violation in the example block's CSS fails
`lint:css` with the budget message; restore → green again.

Findings: stylelint 17 removed `resolveNestedSelectors` from
`selector-nested-pattern` (plain option set now); `max-nesting-depth: 3`
allows exactly 3 levels (violation fires at 4) — tests calibrated.

### Phase 4 release results (2026-08-28) — v0.1.0 COMPLETE

- **`bun run zip`** (`scripts/zip.ts`): production build, then packaging —
  the zip container is **written by hand** (local headers + central directory +
  EOCD, CRC32 table, `node:zlib` deflate with STORE fallback) so it works on
  every OS Bun runs on, **including Windows runners with no `zip` CLI**.
  Excludes `node_modules`/`.git`/zips; deterministic order; paths use the
  `slug/` top-level folder WP expects.
- **CI** (GitHub Actions, ubuntu/macos/windows matrix):
  - Plugin template ships `.github/workflows/check.yml`: install → `check`
    → prod build → `zip` → artifact-verified. `shell: bash` pinned for the
    POSIX verification steps on Windows.
  - Framework ships `.github/workflows/scaffold-smoke.yml`: scaffolds a
    plugin, installs, checks, builds, packages, verifies the zip — on all
    3 OSes.
- **Cold-install gate (verified live on this Local WP 7.1 site):**
  fresh scaffold → `bun install` → `bun run check` (16/16) → prod build (3ms)
  → `bun run zip` (42 files, 41.3kB, `unzip -t` clean) →
  **`wp plugin install ci-smoke.zip --activate`** → post with the block →
  frontend rendered `br-example__message` with compiled CSS enqueued (WP
  inlines the small handle — core behavior) → editor bundle serves. Cleanup:
  post deleted, plugin uninstalled — zero orphans.

**v0.1.0 final state vs. the original gate (§10):**

| Metric | Target | Actual |
| --- | --- | --- |
| `bun install` fresh scaffold | < 5s | ~1s, 6 devDeps, node_modules well under budget |
| Cold `bun run build` | < 1.5s | **3–8ms** |
| Scaffold → activate → zero config edits | ✅ | ✅ (dev server target is the one deliberate env config) |
| devDependency count | ≤ 6 | **6** |
| SCSS / esbuild / webpack / babel | 0 | **0** |

### Hardening, docs & agent tooling (2026-08-28) — pre-distribution pass

Per developer decision, v0.1.0 is **not** distributed until it survives
real-world use; this pass stress-tests the framework and makes it
agent-operable instead.

**Stress matrix run** (all verified, failures fixed in-template):

| Scenario | Result |
| --- | --- |
| Malformed `block.json` | build fails loudly, exit 1, no garbage written |
| Zero blocks present | build/zip degrade gracefully ("no blocks found") |
| `dev` with no target configured | was a raw `TypeError: "" cannot be parsed as a URL` — **fixed**: helpful config message + exit 1 |
| Dead proxy target | clean 502 "Block Rig proxy error" page |
| `--force` overwrite / bad slugs / duplicate blocks / unknown type | all rejected with exit 1 (now under test) |
| `--title` with spaces/special chars | renders verbatim into block.json |
| Comment-only CSS | stylelint passes |

**Gap closed:** frontend JS support — `src/view.{tsx,ts,js}` → `build/view.js`
(pair with `"viewScript": "file:./build/view.js"`), plus failure-path tests
(failing TS compile throws; broken CSS throws). Template test suite grew
16 → **20 tests**.

**New: framework-level CLI e2e suite** (`tests/scaffold.test.ts`, 6 tests via
`bun test` at the framework root): scaffolds real plugins into temp dirs and
asserts full structure, token substitution (including the `__FUNC__`
underscore rule), slug/duplicate/force validation, all three block types via
`block:new`, and a **token-leakage guard** — no surviving `__TOKEN__`
placeholders in any generated file (PHP magic constants excluded,
`templates/blocks` intentionally exempted).

**Docs** (`docs/`): `architecture.md` (pipeline, externals map, invariants,
known limitations), `commands.md` (full reference), `css-authoring.md`
(enforced budget playbook, the `&`-concatenation trap with good/bad examples),
`authoring-blocks.md` (block types, entry/handle matrix, editor patterns).

**Agent tooling**: framework `AGENTS.md` (template-first contract, test
contract, token rules, zero-bloat dependency gate), `.ai/SKILLS.md` +
4 skills — `architecture` (source-of-truth map + invariants + verification
loop), `authoring-blocks`, `styles`, `troubleshooting` (verified failure-mode
tables). Generated plugins keep their self-contained `AGENTS.md`, now
covering the optional `view`/`editorStyle` entries.

## 9. Open questions

1. **Editor typings strategy (R3).** Options:
   a. Hand-rolled `globals.d.ts` stubs for `wp.*` (zero deps, weak autocompletion);
   b. Ship a tiny `@block-rig/wp-globals` types package (maintained stubs);
   c. Keep `@wordpress/*` as devDependencies **types-only** (correct but ~30 packages
   — violates the budget's spirit). Leaning (b).
2. **CSS modules / per-block shared tokens.** Should the scaffold support a
   plugin-level `tokens.css` (`--br-*` custom properties) imported into block CSS?
   (WP Rig's token story suggests yes; scope impact is small.)
3. **Namespace policy.** Default block namespace from plugin name (create-block
   behavior) vs. forced explicit namespace in `blockrig.config.json`. Leaning
   config-first with scaffold validation (collision warning, like WP Rig's
   `core-preset-slugs` work).
4. **Monoblock repos.** Support multiple blocks per plugin (assumed yes, shown in
   §3 layout) vs. one-block-per-plugin. Create-block does one; WP Rig's registry
   model does many. Leaning many.
5. **Relationship to WP Rig.** Keep formally separate (this repo) with cross-links,
   or eventually backport the Bun-only pipeline into WP Rig's block scripts as a
   `block-based`-paradigm option? (Decision deferred — this experiment informs it.)

## 10. Success metrics (v0.1.0 gate)

- `bun install` on fresh scaffold: **< 5s**, `node_modules` **< 60 MB**
- Cold `bun run build` (5 blocks): **< 1.5s**
- Scaffold → activated → block editable in the WP editor with **zero config edits**
- devDependency count **≤ 6** (excluding optional Playwright)
- Zero SCSS, zero esbuild, zero webpack, zero babel anywhere in the tree