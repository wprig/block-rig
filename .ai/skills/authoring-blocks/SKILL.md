# Skill: Authoring Blocks

For agents working **inside a generated Block Rig plugin**. Related docs:
[authoring-blocks.md](../../../docs/authoring-blocks.md) ·
[php-blocks.md](../../../docs/php-blocks.md) — the essentials below are
self-sufficient.

## Decision tree

1. Does the frontend render from **attributes + PHP**? → **dynamic** type
   (`render.php` + `save: () => null`).
2. Is the frontend just the editor's saved markup? → **static** type
   (`save.tsx`, no `render.php`).
3. No editor UI at all? → **php** type (`supports.autoRegister: true`, no
   JS build).

Scaffold, never hand-roll: `bun run block:new <slug> --type <type>`.
Slug must be lowercase kebab-case; the CSS prefix becomes `br-<slug>`.

## Block.json essentials (apiVersion 3)

```json
{
	"apiVersion": 3,
	"name": "<namespace>/<slug>",
	"attributes": { "message": { "type": "string", "default": "…" } },
	"supports": { "html": false },
	"textdomain": "<plugin-slug>",
	"editorScript": "file:./build/index.js",
	"style": "file:./build/style.css",
	"render": "file:./render.php"
}
```

- `render` only for dynamic/php. For static, omit it (and ship `save.tsx`).
- Optional handles: `"viewScript": "file:./build/view.js"` (frontend JS from
  `src/view.ts`) and `"editorStyle": "file:./build/editorStyle.css"`. Add the
  handle **only if the built file exists** — WP warns on missing assets.
- php-type blocks set `"supports": { "autoRegister": true }` and ship no
  `editorScript`.

## Editor code pattern

```tsx
// src/index.tsx — metadata comes straight from block.json (Bun bundles JSON)
import { registerBlockType } from '@wordpress/blocks';
import metadata from '../block.json';
import Edit from './edit';

registerBlockType( metadata, { edit: Edit, save: () => null } );
```

```tsx
// src/edit.tsx
import { useBlockProps } from '@wordpress/block-editor';
import { TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

export default function Edit( { attributes, setAttributes } ) {
	const blockProps = useBlockProps( { className: 'br-my-block' } );
	return (
		<>
			<div { ...blockProps }>
				<span className="br-my-block__message">{ attributes.message }</span>
			</div>
			<TextControl
				label={ __( 'Message', 'my-plugin' ) }
				value={ attributes.message }
				onChange={ ( message ) => setAttributes( { message } ) }
			/>
		</>
	);
}
```

Checklist:

- `useBlockProps()` spread on the outermost editor element;
  `useBlockProps.save()` in static `save()`.
- Imports of `@wordpress/*` / `react` resolve to WP globals at build time —
  never vendor or self-bundle those packages.
- i18n domain = plugin slug (pre-wired in `block.json`).
- CSS lives in `src/style.css`, scoped `.br-<slug>` (see the Styles skill).

## Workflow

```bash
bun run block:new my-block --type dynamic
bun run build            # or bun run dev and edit live
bun run check            # before submitting: lint (tsc + stylelint + iframe guard) + tests
```

Do not edit `blocks/*/build/` (generated) or register blocks in PHP manually
(the bootstrap scans `blocks/*/block.json`).