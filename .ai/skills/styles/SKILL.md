# Skill: Styles

Writing CSS in a Block Rig plugin. The budget is **enforced by lint** —
`bun run lint:css` fails on violations. Full playbook:
[docs/css-authoring.md](../../../docs/css-authoring.md).

## The enforced budget

| Rule | Value |
| --- | --- |
| Specificity | **(0,4,1)** — no IDs, keep selectors shallow |
| Nesting depth | **≤ 3** (the 4th level fails) |
| `!important` | banned |
| Sass `&` concatenation | banned (`selector-nested-pattern`) |
| Custom properties | must be read via `var()` |

## The trap that causes most lint failures

Native CSS nesting **does not concatenate** like Sass:

```css
/* ❌ compiles to the invalid selector `__title.br-notice` */
.br-notice {
	&__title {
		font-weight: 600;
	}
}

/* ✅ full class names inside nested rules */
.br-notice {
	.br-notice__title {
		font-weight: 600;
	}
}

/* ✅ & for pseudo-classes, states, combinators */
.br-notice {
	&:hover,
	&.br-notice--warning,
	& > .br-notice__inner {
		border-color: #b45309;
	}
}
```

Fix pattern: replace every `&__x` / `&-mod` with the full class name; keep
`&:hover`, `&.modifier`, `& > *` as they are.

## Scoping convention

BEM with a per-block prefix, applied on the block root in both editor and
render:

- Root: `.br-<block-slug>` (via `useBlockProps()` / `get_block_wrapper_attributes()`)
- Element: `.br-<block-slug>__name`
- Modifier: `.br-<block-slug>--state`

Specificity over budget? Wrap low-weight ancestors in `:where()`:
`:where(.wp-site-blocks) .br-notice__title` scores (0,1,0) + (0,1,0).

## Custom media (breakpoints)

```css
@custom-media --br-mobile (max-width: 480px);

.br-notice {
	@media (--br-mobile) {
		padding: 0.5rem;
	}
}
```

Requires `drafts: { customMedia: true }` in `scripts/lib/build.ts` — already
there; if a `@custom-media` query ever stops compiling, that flag was removed.

## Preferred techniques (all compile clean)

- Logical properties (`padding-inline`, `inline-size`, `inset-block-start`)
- `:is()` / `:where()` for grouping and specificity control
- `:has()` for parent/state styling
- Container queries (`container-type: inline-size` + `@container`)
- Modern colors (`oklch()`, `rgb(0 0 0 / 0.2)`)

## Files

- `src/style.css` → editor + frontend (handle `style`).
- `src/editorStyle.css` → editor only (add `"editorStyle": "file:./build/editorStyle.css"`
  to block.json yourself).

## WP 7.1 iframe editor rules (enforced)

The editor canvas is a full iframe in WP 7.1 — its `<body>` carries **no**
admin classes. The budget therefore bans these selectors outright
(`selector-disallowed-list`):

```css
/* ❌ matches nothing once the canvas is iframed */
.wp-admin .br-notice { … }
body.block-editor-page .br-notice { … }
#wpadminbar … { … }

/* ✅ scope to the block; editor-only via the wrapper that survives */
.editor-styles-wrapper .br-notice { … }
```

Also implied by the iframe: no admin-chrome offsets (`calc(100vw - 160px)`,
`top: 32px`) — the canvas is the viewport now — and no `!important`
specificity walls (already banned; the iframe removed the leakage they fought,
so they now only fight *theme* styles and drift the preview away from the
front end).

## Debugging a lint failure

Run `bun run lint:css` for file/line/rule; the message names the rule. The
`tests/css-budget.test.ts` suite documents each rule's trigger — read it for
canonical failing examples.