# Skill: Troubleshooting

Failure modes and fixes, verified against real runs.

## Build (`bun run build`)

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Bundle failed` + exit 1, no detail | Malformed `block.json` (invalid JSON breaks the JSON import) | Validate the JSON; `bun run build` always fails loudly rather than writing garbage |
| `Error: Bundle failed` with logs | TS/TSX syntax error in `src/` | Read the full log; the build throws on first failing block |
| Block silently missing from build output | Not a directory with `block.json` under `blocks/`, or the dir name mismatches | Check `blocks/<name>/block.json` exists |
| `@custom-media` query stays uncompiled in output | `drafts: { customMedia: true }` removed from `lib/build.ts` | Restore the flag |
| CSS compiles but selectors look wrong (`__x.br-y`) | Sass `&` concatenation in source — Lightning CSS is spec-correct | Rewrite with full class names (see Styles skill); lint bans it too |
| `Cannot find name 'BunPlugin'` (tsc) | Old bun-types or wrong import | Use the namespace form `Bun.BunPlugin` / `Bun.PluginBuilder` |
| `Type 'undefined' is not assignable to type 'Response'` in a fetch handler | `return;` after `server.upgrade()` | Return a `new Response( null, { status: 101 } )` on the upgraded path |

## Dev server (`bun run dev`)

| Symptom | Cause | Fix |
| --- | --- | --- |
| `"" cannot be parsed as a URL` (old copies) | No `proxyTarget` configured | Set `devServer.proxyTarget` in `blockrig.config.json` or pass `--proxy http://my-site.local` |
| 502 "Block Rig proxy error" page | WP site unreachable from the dev process | Check the target URL; is the site running? |
| Page loads but no live reload | Snippet missing (non-HTML response, e.g. an RSS/XML route) or WS blocked | Confirm `__br_reload` appears in the HTML; reload clients auto-reconnect every 1s |
| Edit saved but browser shows old content | Debounce window (25ms) + rebuild — wait a beat, or check the dev log for `rebuilt <block>` | Watcher log line confirms the rebuild; PHP edits need no build |
| Canonical redirect bounces off the proxy | It shouldn't — redirects are followed server-side and absolute URLs are rewritten | If seen, check the rewrite in `dev.ts` (`https://host` + `http://host` splits) |

## Editor / frontend

| Symptom | Cause | Fix |
|---|---|---|
| Block can't be inserted / "invalid block" | Editor bundle failed to register — check browser console for the missing `wp.*` global | A new `@wordpress/*` import may need its script dependency in `block.json`'s script handles, or the global name isn't mapped (see `wpGlobalFor`) |
| Static block renders nothing on frontend | Post content has a bare self-closing comment but no saved markup | Static blocks need serialized `save()` markup inside the comment (wp-cli-created posts must include it manually) |
| Style appears inline, not as a file | WP core inlines small stylesheets (`wp_maybe_inline_styles`) | Cosmetic — core behavior, not a bug |
| WP warning about missing asset file | `viewScript`/`editorStyle` handle in `block.json` without the built file | Add the handle only when `src/view.*` / `src/editorStyle.css` exists and the build ran |

## Zip / CI

| Symptom | Cause | Fix |
| --- | --- | --- |
| `wp plugin install` rejects the zip | Top-level folder must match the plugin slug | The writer prefixes every entry with `<slug>/` — verify you didn't rename the output |
| Zip huge / includes junk | New junk files at plugin root | Add exclusions to `EXCLUDED_FILES`/`EXCLUDED_DIRS` in `scripts/zip.ts` |
| Windows CI fails on `test -f` / `&&` | Missing `shell: bash` | Both shipped workflows pin `shell: bash` for POSIX steps — keep it |

## Rule of thumb

The build **fails loudly on purpose** (exit 1, logged block name) and never
writes partial output silently. When something is "missing" rather than
"broken", suspect asset handles in `block.json` or the bootstrap's
`blocks/*/block.json` discovery before suspecting the pipeline.