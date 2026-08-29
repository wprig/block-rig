# CSS Authoring (Modern CSS Playbook)

Plain modern CSS compiled by Lightning CSS. **No SCSS, ever.** The
`.stylelintrc` budget is enforced — `bun run lint` fails on violations.

## The budget

| Rule | Value | Why |
| --- | --- | --- |
| `selector-max-specificity` | **(0,4,1)** | No IDs; keep selectors shallow. Lower with `:where()` when needed. |
| `max-nesting-depth` | **3** | 3 levels compile fine; the 4th fails lint. |
| `declaration-no-important` | banned | Specificity wars end here. |
| `selector-nested-pattern` | bans `&`-concatenation | See below — the #1 trap. |

## The #1 trap: `&` does not concatenate

Native CSS nesting is **not Sass**. `&` is a *selector reference*, not a
string substitute:

```css
/* ❌ Sass habit — compiles to the INVALID selector `__plan.br-card` */
.br-card {
	&__plan {
		color: red;
	}
}

/* ✅ Write full class names inside nested rules */
.br-card {
	.br-card__plan {
		color: red;
	}
}

/* ✅ & still works for pseudo-classes, states, and compound selectors */
.br-card {
	&:hover,
	&.br-card--highlight,
	& > .br-card__inner {
		color: blue;
	}
}
```

Lint catches the Sass habit with the message
*"Sass-style `&` concatenation is banned — native CSS nesting does not
concatenate. Write full class names."*

## Scoping convention

Block CSS is scoped by BEM prefix, one class namespace per block:

- Root class: `.br-<block-slug>` (applied via `useBlockProps` in the editor
  and `get_block_wrapper_attributes()` in `render.php`).
- Elements: `.br-<block-slug>__element`
- Modifiers: `.br-<block-slug>--modifier`

```css
.br-notice {
	padding: 1.25rem;

	.br-notice__title {
		font-weight: 600;
	}

	&.br-notice--warning {
		border-color: #b45309;
	}
}
```

## Custom media

`@custom-media` is a Lightning CSS **draft feature** — already enabled in
`scripts/build.ts` (`drafts: { customMedia: true }`). Do not remove it; the
queries silently stop compiling without it:

```css
@custom-media --br-mobile (max-width: 480px);

.br-notice {
	@media (--br-mobile) {
		padding: 0.5rem;
	}
}
```

Compiles to a plain `@media` query for all browser targets.

## What else works (no preprocessing needed)

- Logical properties (`padding-inline`, `inset-block-start`, `inline-size`)
- `:has()`, `:is()`, `:where()` (use `:where()` to keep specificity in budget)
- Container queries (`container-type`, `@container`)
- Modern color syntax (`oklch()`, relative colors, `rgb(0 0 0 / 0.2)`)
- Custom properties — always read via `var()` (lint enforces)

## Editor vs frontend styles

| File | Enqueued | Handle in block.json |
| --- | --- | --- |
| `src/style.css` | editor + frontend | `style` |
| `src/editorStyle.css` | editor only (optional) | add `"editorStyle": "file:./build/editorStyle.css"` |

Keep editor-only affordances (outlines, control panels) in `editorStyle.css`
so frontend bundles stay minimal.