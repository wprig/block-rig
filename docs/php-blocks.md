# PHP Blocks (no React)

Block Rig's `php` block type (and the PHP half of every dynamic block) needs
**no React at all**. The plugin bootstrap auto-registers any
`blocks/*/block.json`, so a PHP block is just: `block.json` + `render.php`
(+ optional CSS). This document is the PHP-first authoring guide.

## When to go PHP-only

Choose `--type php` when the block needs **no custom editor UI**:

- Content whose attributes are comfortably edited through the block editor's
  native UI (placeholder text, toggles, colors, media via the standard
  Inspector).
- Wrapper/markup blocks where the value is the server-side render
  (`render.php`), not a bespoke React editing experience.
- Anything you want to ship with **zero JS**: no `editorScript`, no build
  surface, fastest possible asset story.

If you need custom Inspector controls, live preview logic, or rich editing
affordances, use a **dynamic** block instead (React editor + PHP render) —
that's the `dynamic` type, and it's the same PHP render contract.

## Anatomy (`bun run block:new my-block --type php`)

```
blocks/my-block/
├── block.json        # apiVersion 3, supports.autoRegister: true — no editorScript
├── render.php        # server-side render, runs on editor canvas + frontend
└── src/style.css     # compiled to build/style.css, enqueued via "style"
```

`block.json` essentials:

```json
{
	"apiVersion": 3,
	"name": "my-plugin/my-block",
	"attributes": {
		"message":   { "type": "string", "default": "Hello" },
		"tone":      { "type": "string", "enum": [ "default", "accent" ] },
		"emphasize": { "type": "boolean", "default": false }
	},
	"supports": { "html": false, "autoRegister": true },
	"style": "file:./build/style.css",
	"render": "file:./render.php"
}
```

`supports.autoRegister: true` is both a build signal (no JS entry expected —
`build.ts` skips JS for these blocks) and the modern core convention that the
markup is fully PHP-rendered.

## render.php contract

WordPress includes `render.php` with three variables in scope: `$attributes`,
`$content` (inner blocks, empty for leaf blocks), and `$block`. The contract:

- **Always escape on output** — `esc_html()` for text, `esc_attr()` for
  attributes, `esc_url()` for URLs. Attribute *types* are enforced by the
  editor, but treat server input as untrusted anyway (a REST/API request can
  write arbitrary attribute JSON).
- Use `get_block_wrapper_attributes()` for the root element so core block
  classes, alignment, and any `additionalCssClasses` apply — and so the CSS
  scoping convention (`.br-<slug>`) has something to hook onto.
- `render.php` runs **inside the editor too** (that's how the iframed canvas
  previews the block) — so it must not depend on frontend-only state
  (e.g. `is_admin()` checks or body classes that only exist on the frontend).
- i18n: `esc_html__( '…', 'my-plugin' )` — domain = plugin slug.
- Never write to the DB, never enqueue scripts ad hoc from `render.php`;
  enqueue frontend JS via `viewScript` in `block.json` instead.

## Composability

PHP blocks compose like any block:

- `render.php` may echo inner blocks: `echo $content;` when
  `supports.innerBlocks` is declared (guard with `! empty( $content )`).
- Register block **variations** or **styles** in a small PHP include from the
  plugin bootstrap if the block needs them — keep it data-driven.
- The bootstrap registers every `blocks/*/block.json` automatically; adding a
  PHP block is literally `bun run block:new <slug> --type php` (or dropping a
  hand-written directory in place) + `bun run build` (to compile its CSS).

## Testing PHP blocks

`render.php` is plain, framework-free PHP — test it with any PHPUnit setup:
include the file, provide `$attributes`, assert output. The `php` type's
value is that this surface stays tiny: attributes in, escaped HTML out.

Keep the default dependency budget untouched — PHP testing tooling
(composer/PHPUnit) is deliberately **opt-in**, not part of the scaffold.