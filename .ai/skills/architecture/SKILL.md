# Skill: Architecture

How Block Rig is put together — read before changing the pipeline.

## Scope

Framework (this repo) and generated plugins. Generated plugins embed copies
of the build scripts; keep the two in sync by editing **templates only** and
verifying with a fresh scaffold.

## Source of truth map

| Concern | File |
| --- | --- |
| CLI scaffolder + template engine | `bin/create-block-rig.ts` |
| Everything a user gets | `templates/plugin/**` |
| Block templates (shipped into plugins) | `templates/plugin/templates/blocks/{dynamic,static,php}` |
| Build engine (per-block API) | `templates/plugin/scripts/lib/build.ts.tmpl` |
| WP externals remap | `templates/plugin/scripts/lib/wp-externals.ts.tmpl` |
| Config loader + schema | `templates/plugin/scripts/lib/config.ts.tmpl`, `blockrig.config.json.tmpl` |
| Dev server (proxy + WS reload + watcher) | `templates/plugin/scripts/dev.ts.tmpl` |
| Zip packaging (hand-rolled container) | `templates/plugin/scripts/zip.ts.tmpl` |
| Plugin bootstrap (block auto-registration) | `templates/plugin/__SLUG__.php.tmpl` |
| Framework CLI e2e tests | `tests/scaffold.test.ts` |

## Invariants (do not break)

1. **One runtime.** Bun ≥ 1.2 everywhere. No Node-only APIs, no `zip`/`rsync`
   shell-outs. `node:zlib` and friends are fine (Bun implements them).
2. **Self-contained plugins.** Generated plugins must never import from the
   framework; `block:new` works with this repo deleted.
3. **Nothing WP-provided is bundled.** The externals plugin handles
   `@wordpress/*`, `react`, `react-dom`, `react/jsx-runtime`. Bundles stay
   1–4kB.
4. **`drafts: { customMedia: true }` stays.** Without it, `@custom-media`
   silently stops expanding.
5. **`jsx: { runtime: 'automatic' }` (object form).** The string form works
   at runtime but fails strict tsc against @types/bun.
6. **Dependency budget ≤ 6 devDeps.** Prove Bun built-ins can't do it first.
7. **The bootstrap auto-registers** any `blocks/*/block.json` — no manual PHP
   registration, no hardcoded block lists.

## Template engine mechanics

- `copyRendered()` walks a template tree, renders tokens in **contents and
  filenames**, strips `.tmpl`.
- Token regex `__([A-Z][A-Z_]*?)__` is non-greedy for a reason — see the
  `__FUNC___init` case in `AGENTS.md` pillar 3.
- Block templates are rendered twice by design: plugin tokens (namespace,
  textdomain) at scaffold time, block tokens (name/title) at `block:new`
  time.

## Verification loop for framework changes

```bash
bun test                                            # CLI e2e, token leakage
bun run bin/create-block-rig.ts smoke --dir /tmp/smoke && cd /tmp/smoke/smoke
bun install && bun run check && bun run zip         # full plugin gate
```

For dev-server changes, additionally verify against a live WP site:
`bun run dev --proxy http://<site>` — curl the proxy for the injected
`/__br_reload` snippet, touch a block file, confirm rebuild + broadcast
+ latency.