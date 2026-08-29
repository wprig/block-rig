/**
 * Block Rig spike — Bun plugin that remaps `@wordpress/*`, `react`,
 * `react-dom` and `react/jsx-runtime` imports to the `wp.*` globals
 * WordPress enqueues, so nothing WP-provided gets bundled.
 *
 * This is the Bun-build port of WP Rig's esbuild onLoad regex transform
 * (wprig/scripts/tasks/buildAllBlocks.js) — real module resolution instead
 * of import-statement rewriting.
 */

interface WpGlobalMap {
	[key: string]: string;
}

const WP_GLOBALS: WpGlobalMap = {
	react: 'window.React',
	'react-dom': 'window.ReactDOM',
};

export function wpGlobalFor( pkg: string ): string | null {
	if ( WP_GLOBALS[ pkg ] ) {
		return WP_GLOBALS[ pkg ];
	}
	if ( pkg.startsWith( '@wordpress/' ) ) {
		const slug = pkg.replace( '@wordpress/', '' ).replace(
			/-([a-z])/g,
			( _, c: string ) => c.toUpperCase()
		);
		return `window.wp.${ slug }`;
	}
	return null;
}

export function wpExternals(): import('bun').BunPlugin {
	return {
		name: 'block-rig-wp-externals',
		setup( build ) {
			build.onResolve(
				{ filter: /^(react|react-dom|react\/.*|@wordpress\/.*)$/ },
				( args ) => ( { path: args.path, namespace: 'wp-global' } )
			);
			build.onLoad(
				{ filter: /.*/, namespace: 'wp-global' },
				( args ) => {
					// Automatic JSX runtime: shim onto @wordpress/element's jsx functions.
					if ( args.path === 'react/jsx-runtime' || args.path === 'react/jsx-dev-runtime' ) {
						return {
							contents:
								'module.exports = { jsx: window.wp.element.jsx, jsxs: window.wp.element.jsxs, Fragment: window.wp.element.Fragment };',
							loader: 'js',
						};
					}
					const global = wpGlobalFor( args.path );
					if ( ! global ) {
						return { errors: [ { text: `Unhandled WP import: ${ args.path }` } ] };
					}
					return {
						contents: `module.exports = ${ global };`,
						loader: 'js',
					};
				}
			);
		},
	};
}