#!/usr/bin/env bun
/**
 * create-block-rig — scaffold a self-contained WordPress block plugin
 * built entirely by Bun (no esbuild, no webpack, no SCSS).
 *
 * Usage:
 *   bun run bin/create-block-rig.ts <plugin-slug> [options]
 *
 * Options:
 *   --dir <path>       Parent directory for the new plugin (default: cwd)
 *   --name <text>      Human-readable plugin name (default: slug → Title Case)
 *   --namespace <ns>   Block namespace (default: plugin slug)
 *   --version <ver>    Plugin version (default: 0.1.0)
 *   --type <type>      Starter block type: dynamic | static | php (default: dynamic)
 *   --force            Overwrite an existing directory
 */
import path from 'node:path';
import fs from 'node:fs';

const FRAMEWORK_ROOT = path.resolve( import.meta.dir, '..' );
const PLUGIN_TEMPLATE = path.join( FRAMEWORK_ROOT, 'templates', 'plugin' );
// Block templates ship inside the plugin template so generated plugins can run
// `block:new` without the framework installed.
const BLOCK_TEMPLATES = path.join( PLUGIN_TEMPLATE, 'templates', 'blocks' );

const SLUG_RE = /^[a-z][a-z0-9-]*$/;

interface PluginTokens {
	SLUG: string;
	FUNC: string;
	PLUGIN_NAME: string;
	NAMESPACE: string;
	TEXT_DOMAIN: string;
	VERSION: string;
	YEAR: string;
}

function parseArgs( argv: string[] ): { slug: string; opts: Record< string, string | boolean > } | null {
	const args = argv.slice( 2 );
	const opts: Record< string, string | boolean > = {};
	const positional: string[] = [];

	for ( let i = 0; i < args.length; i++ ) {
		const arg = args[ i ];
		if ( arg.startsWith( '--' ) ) {
			const flag = arg.slice( 2 );
			const next = args[ i + 1 ];
			if ( next && ! next.startsWith( '--' ) ) {
				opts[ flag ] = next;
				i++;
			} else {
				opts[ flag ] = true;
			}
		} else {
			positional.push( arg );
		}
	}

	return { slug: positional[ 0 ] ?? '', opts };
}

const titleCase = ( slug: string ) =>
	slug
		.split( '-' )
		.map( ( w ) => w.charAt( 0 ).toUpperCase() + w.slice( 1 ) )
		.join( ' ' );

function render( content: string, tokens: Record< string, string > ): string {
	// Non-greedy so tokens followed by a literal underscore (e.g. __FUNC___init)
	// resolve to FUNC + "_init" instead of swallowing the separator.
	return content.replace( /__([A-Z][A-Z_]*?)__/g, ( match, key: string ) =>
		key in tokens ? tokens[ key ] : match
	);
}

async function copyRendered( src: string, dest: string, tokens: Record< string, string > ): Promise<number> {
	let count = 0;
	for ( const entry of fs.readdirSync( src, { withFileTypes: true } ) ) {
		const s = path.join( src, entry.name );
		const d = path.join( dest, render( entry.name, tokens ).replace( /\.tmpl$/, '' ) );
		if ( entry.isDirectory() ) {
			fs.mkdirSync( d, { recursive: true } );
			count += await copyRendered( s, d, tokens );
		} else {
			const isText = /\.(tmpl|json|php|ts|tsx|css|md|txt)$/.test( entry.name );
			if ( isText ) {
				const out = render( await Bun.file( s ).text(), tokens );
				await Bun.write( d, out );
			} else {
				await Bun.write( d, Bun.file( s ) );
			}
			count++;
		}
	}
	return count;
}

async function scaffoldBlock(
	pluginDir: string,
	blockName: string,
	type: string,
	base: Record< string, string >
): Promise<void> {
	if ( ! SLUG_RE.test( blockName ) ) {
		throw new Error( `Invalid block slug "${ blockName }" (lowercase kebab-case required).` );
	}
	const src = path.join( BLOCK_TEMPLATES, type );
	if ( ! fs.existsSync( src ) ) {
		throw new Error( `Unknown block type "${ type }" (expected static | dynamic | php).` );
	}
	const dest = path.join( pluginDir, 'blocks', blockName );
	if ( fs.existsSync( dest ) ) {
		throw new Error( `Block already exists: ${ dest }` );
	}
	fs.mkdirSync( dest, { recursive: true } );
	const tokens = {
		...base,
		BLOCK_NAME: blockName,
		BLOCK_TITLE: base[ 'BLOCK_TITLE' ] ?? titleCase( blockName ),
		BLOCK_PREFIX: `br-${ blockName }`,
		BLOCK_MESSAGE_CLASS: `br-${ blockName }__message`,
	};
	await copyRendered( src, dest, tokens );
}

async function main(): Promise< void > {
	const parsed = parseArgs( Bun.argv );
	if ( ! parsed || ! parsed.slug ) {
		console.error(
			'Usage: bun run bin/create-block-rig.ts <plugin-slug> [--dir <path>] [--name <text>] [--namespace <ns>] [--type static|dynamic|php]'
		);
		process.exit( 1 );
	}

	const { slug, opts } = parsed;
	if ( ! SLUG_RE.test( slug ) ) {
		console.error( `Invalid plugin slug "${ slug }" — lowercase kebab-case required.` );
		process.exit( 1 );
	}

	const parentDir = opts.dir ? path.resolve( String( opts.dir ) ) : process.cwd();
	const target = path.join( parentDir, slug );

	if ( fs.existsSync( target ) ) {
		if ( opts.force ) {
			fs.rmSync( target, { recursive: true } );
		} else {
			console.error( `Directory already exists: ${ target } (use --force to overwrite).` );
			process.exit( 1 );
		}
	}

	const tokens: PluginTokens = {
		SLUG: slug,
		FUNC: slug.replace( /-/g, '_' ),
		PLUGIN_NAME: String( opts.name ?? titleCase( slug ) ),
		NAMESPACE: String( opts.namespace ?? slug ),
		TEXT_DOMAIN: slug,
		VERSION: String( opts.version ?? '0.1.0' ),
		YEAR: String( new Date().getFullYear() ),
	};

	fs.mkdirSync( target, { recursive: true } );
	await copyRendered( PLUGIN_TEMPLATE, target, tokens );
	await scaffoldBlock( target, 'example', String( opts.type ?? 'dynamic' ), tokens );

	console.log( `✔ Scaffolded plugin: ${ target }` );
	console.log( '' );
	console.log( 'Next steps:' );
	console.log( `  cd ${ slug }` );
	console.log( '  bun install' );
	console.log( '  bun run build' );
	console.log( '  → activate the plugin in WordPress and add the "Example Block"' );
}

main().catch( ( e: Error ) => {
	console.error( e.message );
	process.exit( 1 );
} );