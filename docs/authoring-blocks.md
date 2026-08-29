# Authoring Blocks

Every block lives in its own directory under `blocks/` with a `block.json` at
its root. The plugin bootstrap registers any such directory automatically —
**no manual PHP registration, ever**. After creating or changing a block, run
`bun run build` (or let `bun run dev` do it incrementally).

## The three types

| Type | Scaffold command | Files |
| --- | --- | --- |
| **Dynamic** | `bun run block:new my-block --type dynamic` | `block.json`, `src/index.tsx`, `src/edit.tsx`, `render.php`, `src/style.css` |
| **Static** | `… --type static` | `block.json`, `src/index.tsx`, `src/edit.tsx`, `src/save.tsx`, `src/style.css` |
| **PHP-only** | `… --type php` | `block.json` (`supports.autoRegister`), `render.php`, `src/style.css` |

- **Dynamic**: PHP renders the frontend (`render` key + `render.php`); the
  editor entry's `save` returns `null`.
- **Static**: the editor's `save()` output is serialized into post content
  and served as-is on the frontend. Note: a post created via wp-cli must
  include the serialized inner markup — a bare self-closing block comment
  renders nothing (normal WordPress behavior).
- **PHP-only**: no JS at all. `supports.autoRegister: true` tells the build
  (and reviewers) there is no editor bundle; attributes are edited via the
  block's sidebar or used as-is.

## Entry files (built output)

| Source | Output | block.json handle |
| --- | --- | --- |
| `src/index.{tsx,ts,js}` | `build/index.js` | `editorScript` |
| `src/view.{tsx,ts,js}` (optional) | `build/view.js` | `viewScript` |
| `src/style.css` | `build/style.css` | `style` |
| `src/editorStyle.css` (optional) | `build/editorStyle.css` | `editorStyle` |

Add `view`/`editorStyle` handles to `block.json` only when the file exists —
WordPress warns on missing asset files.

## Editor entry pattern

`src/index.tsx` registers metadata straight from `block.json` (Bun bundles
the JSON import natively):

```tsx
import { registerBlockType } from '@wordpress/blocks';
import metadata from '../block.json';
import Edit from './edit';

registerBlockType( metadata, {
	edit: Edit,
	save: () => null, // dynamic blocks
} );
```

`src/edit.tsx` is standard React + `@wordpress/*` imports — they resolve to
the `window.wp.*` globals at build time (nothing WP-provided is bundled):

```tsx
import { useBlockProps } from '@wordpress/block-editor';
import { TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

export default function Edit( { attributes, setAttributes } ) {
	const blockProps = useBlockProps( { className: 'br-my-block' } );
	// blockProps MUST be spread on the outermost element so WP can manage it.
}
```

Conventions:

- Apply `useBlockProps()` on the outermost editor element (and
  `useBlockProps.save()` in static `save()`).
- Translate UI strings with `__( '…', '<text-domain>' )`; the domain is the
  plugin slug and is pre-wired in `block.json`.
- Frontend-only behavior goes in `src/view.ts` (runs on the page, not in the
  editor) — add the `viewScript` handle yourself.

## Attributes

Declared in `block.json` under `attributes`; typed in TSX with an
`Attributes` interface mirroring it. `attributes` + `setAttributes` flow
through the edit/save components. Keep attribute names camelCase; they
serialize into the block comment as JSON.

## The WP 7.1 iframe editor (important)

The post editor canvas is a **full iframe** in WP 7.1 — every theme, regardless
of `apiVersion`. Editor JS runs in the *admin* document; your block's DOM
lives in the *iframe* document. `apiVersion: 3` (scaffolded by default) is
the "iframe-ready" signal — but it does nothing by itself. The rules:

1. **Never touch bare `window.` or `document.` in editor code.** They see the
   *admin* document, not the canvas. Derive them from your own element via
   `useRefEffect` — context-agnostic, works iframed or not:

   ```tsx
   import { useRefEffect } from '@wordpress/compose';

   const ref = useRefEffect( ( element ) => {
       const view = element.ownerDocument.defaultView; // canvas window
       const doc = element.ownerDocument;              // canvas document
       view.addEventListener( 'resize', update );
       return () => view.removeEventListener( 'resize', update );
   }, [] );
   ```

   This is **lint-enforced**: `bun run lint:iframe` flags bare
   `window.`/`document.` in `index.*`/`edit.*` and runs as part of
   `bun run lint` / `check` (view scripts are exempt — they run in the page).
2. Editor styles must load **into** the canvas — which is why Block Rig only
   ever loads them via `block.json` (`editorStyle`). Never use
   `enqueue_block_editor_assets` for canvas-affecting CSS; it loads in the
   admin page and silently stops applying when iframed.
3. In CSS, never key on admin chrome (`.wp-admin`, `#wpadminbar`,
   `.block-editor-page`) — the canvas body has none of it. The lint budget
   bans these selectors. `.editor-styles-wrapper` still wraps canvas content
   and remains the one legitimate editor-only scope.
4. Third-party DOM libraries: pass **elements** (from `useRefEffect`), not
   selectors — a library that does `document.querySelectorAll` internally
   will query the admin document and silently find nothing.

See the Styles skill / [css-authoring.md](css-authoring.md) for the CSS side
and the Troubleshooting skill for testing in both iframed and non-iframed
states.

## What NOT to do

- Never edit anything under `blocks/*/build/` — generated.
- Never bundle WP/React packages yourself or vendor dist files; import
  `@wordpress/*` and let the externals plugin handle it.
- Never add a Sass file, a `.browserslistrc` override that drops the budget,
  or a new build tool — the pipeline is Bun + Lightning CSS, full stop.
- Don't register blocks in PHP manually; the bootstrap scans `blocks/`.