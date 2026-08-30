# Implementation Guide: `lazy-embed` Web Component in a Gutenberg Block

> **For the implementing agent.** This is a step-by-step task brief. Follow the
> steps in order; do not skip Step 1 (it's the highest-risk step). Companion
> docs: `docs/gutenberg-block-integration-plan.md` (rationale/architecture) and
> the component readme (full props reference).

## What you're integrating

`lazy-embed` is a Stencil-built web component that shows a lightweight preview
image and only loads the actual video iframe (YouTube/Vimeo/generic) when the
user activates it. Package: **`@robcruiz/lazy-embed`** (latest ≥ 1.1.1).

Key facts you must respect:

- It is a **custom element** (`<lazy-embed>`) with **shadow DOM**. Theme CSS
  does not leak in; you cannot style its internals from block CSS.
- The custom element must be **defined exactly once per page**. Importing the
  registration module twice throws `customElements.define` errors.
- Attributes are **kebab-case** in markup (`preview-image`, `aspect-ratio`,
  `video-title`, `youtube-nocookie`, `load-on-visible`). Booleans must be
  serialized as the strings `"true"` / `"false"` — never JSX `true`.
- The component is reactive: changing the `src` attribute re-parses the URL and
  resets to preview state. This makes live editing in the block editor work
  without remounting the element.

## Step 0 — Install

In the block system's plugin root:

```shell
npm install @robcruiz/lazy-embed
```

The module to import for registration (self-contained, single file, ~40KB,
auto-defines the element on import):

```js
import '@robcruiz/lazy-embed/dist/components/index.js';
```

Types (optional, for TS autocomplete on the element):

```js
import type { LazyEmbed } from '@robcruiz/lazy-embed/dist/components/index.js';
```

## Step 1 — Wire up the component asset (do this FIRST, with a scratch block)

This is the riskiest step in any custom block system: getting a script loaded
in **both** the editor iframe and the front end. Prove it works before building
the real block.

1. Register the script with the system's normal asset-registration mechanism
   (`wp_register_script` with a handle like `lazy-embed-component`).
2. Register a minimal throwaway block that renders, in both `Edit` and
   `save`/`render_callback`:
   ```html
   <lazy-embed
     src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
     video-title="Test video"
   ></lazy-embed>
   ```
   (`preview-image` can be omitted — the component auto-derives a YouTube
   thumbnail.)
3. Verify:
   - [ ] Editor: preview image + play button render inside the block preview.
   - [ ] Front end: play button loads the iframe on click.
   - [ ] Browser console has **no** `customElements` duplicate-definition
         errors after inserting the block twice.

If the system bundles each block's JS separately, put the component import in
the **view/front-end entry only** (not per-block bundles) to guarantee single
definition, and additionally register it for the editor preview.

## Step 2 — Create the real block: `block.json`

```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "your-namespace/lazy-embed",
  "title": "Lazy Embed",
  "category": "embed",
  "icon": "video-alt3",
  "description": "Performance-friendly video embed with a lightweight preview.",
  "supports": {
    "align": ["wide", "full"],
    "html": false
  },
  "attributes": { "..." : "see Step 3" },
  "editorScript": "file:./index.js",
  "viewScript": "file:./view.js",
  "render": "file:./render.php",
  "save": false
}
```

This guide assumes a **dynamic block** (`save: false` + `render.php`). If the
block system's convention is a static `save()` function instead, the same
markup applies — see the note in Step 5.

## Step 3 — Attributes

Mirror component props 1:1, camelCase in block attributes:

| Attribute | Type | Default | Notes |
|---|---|---|---|
| `src` | string | `''` | YouTube, Vimeo, or generic iframe URL |
| `previewImage` | string | `''` | Optional; auto-derived for YouTube |
| `alt` | string | `'Video preview'` | |
| `videoTitle` | string | `''` | Feeds the iframe `title` (a11y) |
| `aspectRatio` | string | `'16:9'` | Options: `16:9`, `4:3`, `1:1` |
| `autoplay` | boolean | `true` | Component default is true |
| `youtubeNocookie` | boolean | `false` | Privacy mode |
| `params` | string | `''` | Extra query params, e.g. `start=30` |

Deliberately **not** exposed in the UI (page-builder patterns, not editor
concerns): `play-on-visible`, `load-on-visible`, `load-on-parent-open`,
`load-on-click-selector`, `width`, `height`.

## Step 4 — `Edit` component

Render a real `<lazy-embed>` in the preview (it works in the editor DOM) plus
InspectorControls:

```jsx
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import {
  PanelBody, TextControl, SelectControl, ToggleControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

// ensure the element is defined in the editor too
import '@robcruiz/lazy-embed/dist/components/index.js';

const RATIO_OPTIONS = [
  { label: '16:9', value: '16:9' },
  { label: '4:3', value: '4:3' },
  { label: '1:1', value: '1:1' },
];

export default function Edit({ attributes, setAttributes }) {
  const { src, videoTitle, aspectRatio, autoplay, youtubeNocookie, previewImage } = attributes;
  const blockProps = useBlockProps();

  return (
    <>
      <InspectorControls>
        <PanelBody title={__('Video Settings')}>
          <TextControl
            label={__('Video URL')}
            value={src}
            onChange={(v) => setAttributes({ src: v })}
          />
          <TextControl
            label={__('Video title (accessibility)')}
            value={videoTitle}
            onChange={(v) => setAttributes({ videoTitle: v })}
          />
          <SelectControl
            label={__('Aspect ratio')}
            value={aspectRatio}
            options={RATIO_OPTIONS}
            onChange={(v) => setAttributes({ aspectRatio: v })}
          />
          <ToggleControl
            label={__('Autoplay on load')}
            checked={autoplay}
            onChange={(v) => setAttributes({ autoplay: v })}
          />
          <ToggleControl
            label={__('Privacy mode (youtube-nocookie)')}
            checked={youtubeNocookie}
            onChange={(v) => setAttributes({ youtubeNocookie: v })}
          />
          <TextControl
            label={__('Custom preview image URL')}
            value={previewImage}
            onChange={(v) => setAttributes({ previewImage: v })}
            help={__('Leave empty to auto-use the YouTube thumbnail.')}
          />
        </PanelBody>
      </InspectorControls>

      <div {...blockProps}>
        {src ? (
          <lazy-embed
            src={src}
            preview-image={previewImage}
            video-title={videoTitle}
            aspect-ratio={aspectRatio}
            autoplay={autoplay ? 'true' : 'false'}
            youtube-nocookie={youtubeNocookie ? 'true' : 'false'}
          />
        ) : (
          <p className="lazy-embed-placeholder">
            {__('Paste a video URL in the block settings to add a lazy embed.')}
          </p>
        )}
      </div>
    </>
  );
}
```

Note the patterns: kebab-case attribute names, boolean→string serialization,
empty-`src` placeholder state. Editing `src` live-updates the preview because
the component watches its own attributes.

## Step 5 — Front-end render (PHP, `render.php`)

```php
<?php
/**
 * @var array $attributes Block attributes.
 */

$src     = isset( $attributes['src'] ) ? $attributes['src'] : '';
$allowed = isset( $attributes['youtubeNocookie'] ) && $attributes['youtubeNocookie'];

if ( empty( $src ) ) {
	return '';
}

$attr_string = function ( string $value ): string {
	return esc_attr( (string) $value );
};

?>
<div <?php echo get_block_wrapper_attributes(); // phpcs:ignore ?>>
	<lazy-embed
		src="<?php echo esc_url( $src ); ?>"
		preview-image="<?php echo $attr_string( $attributes['previewImage'] ?? '' ); ?>"
		alt="<?php echo $attr_string( $attributes['alt'] ?? 'Video preview' ); ?>"
		video-title="<?php echo $attr_string( $attributes['videoTitle'] ?? '' ); ?>"
		aspect-ratio="<?php echo $attr_string( $attributes['aspectRatio'] ?? '16:9' ); ?>"
		autoplay="<?php echo empty( $attributes['autoplay'] ) || 'true' === $attributes['autoplay'] ? 'true' : 'false'; ?>"
		youtube-nocookie="<?php echo $allowed ? 'true' : 'false'; ?>"
		params="<?php echo $attr_string( $attributes['params'] ?? '' ); ?>"
	></lazy-embed>
</div>
```

If the block system uses a **static `save()`** instead, emit the identical
markup from JSX in `save.js` (same kebab-case/boolean rules), set
`"save": true`-style config per the system's convention, and be aware that
changing serialization after launch breaks block validation — finalize the
markup shape before shipping.

## Step 6 — KSES / capability safety

Non-admin users cannot save unknown HTML tags. Either rely on the dynamic
render (attributes are stored as block JSON — usually fine), or add an explicit
filter if static markup is stored:

```php
add_filter( 'wp_kses_allowed_html', function ( $tags, $context ) {
	if ( 'post' !== $context ) {
		return $tags;
	}
	$tags['lazy-embed'] = [
		'src'             => true,
		'preview-image'   => true,
		'alt'             => true,
		'video-title'     => true,
		'aspect-ratio'    => true,
		'height'          => true,
		'autoplay'        => true,
		'youtube-nocookie' => true,
		'params'          => true,
	];
	return $tags;
}, 10, 2 );
```

## Step 7 — QA checklist (all must pass before handoff back)

- [ ] Two blocks on one page: no `customElements.define` error.
- [ ] Editing `src` in the sidebar updates the preview without re-selecting
      the block.
- [ ] Front end: click loads iframe; Tab to button, press Enter, iframe loads.
- [ ] `autoplay` off → rendered iframe URL has no `autoplay=1` (inspect by
      loading the URL only after click; check the iframe `src` attribute).
- [ ] Privacy mode toggles the embed host to `youtube-nocookie.com`.
- [ ] Invalid URL (`src="not-a-url"`) shows the disabled placeholder, never a
      broken iframe.
- [ ] Aspect ratio 4:3 / 1:1 render at correct ratios on the front end.
- [ ] No 404s / console errors in editor or front end.

## Known follow-ups (do NOT do in v1)

- Styling hooks (CSS custom properties for the play button) — needs a
  component-side change first; don't hack shadow DOM from the block.
- Exposing the trigger props (`load-on-parent-open` etc.) as block options.
- Vimeo thumbnail prefill (component currently only auto-derives YouTube).
