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

## What NOT to do

- Never edit anything under `blocks/*/build/` — generated.
- Never bundle WP/React packages yourself or vendor dist files; import
  `@wordpress/*` and let the externals plugin handle it.
- Never add a Sass file, a `.browserslistrc` override that drops the budget,
  or a new build tool — the pipeline is Bun + Lightning CSS, full stop.
- Don't register blocks in PHP manually; the bootstrap scans `blocks/`.