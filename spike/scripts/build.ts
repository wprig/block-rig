/**
 * Block Rig spike build — pure Bun.build + Lightning CSS. No esbuild, no
 * webpack, no babel, no SCSS, no PostCSS.
 *
 * Usage: bun run scripts/build.ts [--watch]
 */
import path from 'node:path';
import fs from 'node:fs';
import browserslist from 'browserslist';
import { transform, browserslistToTargets } from 'lightningcss';
import { wpExternals } from './lib/wp-externals';

const root = path.resolve( import.meta.dir, '..' );
const blocksDir = path.join( root, 'blocks' );
const isWatch = process.argv.includes( '--watch' );
const isProd = process.env.NODE_ENV === 'production';

const blocks = fs
	.readdirSync( blocksDir )
	.filter( ( d ) => fs.statSync( path.join( blocksDir, d ) ).isDirectory() );

/** Compile a block's style.css with Lightning CSS (nesting + custom media + minify). */
async function buildCss( block: string ): Promise<number> {
	const src = path.join( blocksDir, block, 'src', 'style.css' );
	if ( ! fs.existsSync( src ) ) {
		return 0;
	}
	const out = path.join( blocksDir, block, 'build', 'style.css' );
	const css = await Bun.file( src ).text();
	const result = transform( {
		filename: src,
		code: Buffer.from( css ),
		minify: isProd,
		sourceMap: ! isProd,
		drafts: { customMedia: true },
		targets: browserslistToTargets(
			browserslist( '> 0.5%, last 2 versions, Firefox ESR, not dead' )
		),
	} );
	await Bun.write( out, result.code );
	if ( result.map ) {
		await Bun.write( `${ out }.map`, result.map );
	}
	return result.code.length;
}

/** Bundle a block's editor entry with Bun.build (TSX/JSX natively). */
async function buildJs( block: string ): Promise<number> {
	const entry = path.join( blocksDir, block, 'src', 'index.tsx' );
	if ( ! fs.existsSync( entry ) ) {
		return 0;
	}
	const result = await Bun.build( {
		entrypoints: [ entry ],
		outdir: path.join( blocksDir, block, 'build' ),
		target: 'browser',
		format: 'iife',
		minify: isProd,
		sourcemap: isProd ? 'none' : 'linked',
		jsx: 'automatic',
		define: { 'process.env.NODE_ENV': isProd ? '"production"' : '"development"' },
		plugins: [ wpExternals() ],
		naming: 'index.[ext]',
	} );
	if ( ! result.success ) {
		throw new Error( result.logs.map( String ).join( '\n' ) );
	}
	return result.outputs[ 0 ].size;
}

const t0 = performance.now();
let totalBytes = 0;
let didWork = false;

for ( const block of blocks ) {
	try {
		const js = await buildJs( block );
		const css = await buildCss( block );
		didWork = didWork || js > 0 || css > 0;
		totalBytes += js + css;
		console.log(
			`[block-rig] ${ block }: ${ js ? `index.js ${( js / 1024 ).toFixed( 1 )}kB` : 'no js' }, ${ css ? `style.css ${( css / 1024 ).toFixed( 1 )}kB` : 'no css' }`
		);
	} catch ( e ) {
		console.error( `[block-rig] ${ block } build failed:`, ( e as Error ).message );
		if ( ! isWatch ) {
			process.exit( 1 );
		}
	}
}

const ms = Math.round( performance.now() - t0 );
console.log(
	`[block-rig] ${ blocks.length } block(s) built in ${ ms }ms (${ ( totalBytes / 1024 ).toFixed( 1 ) }kB total${ isProd ? ', minified' : ', dev sourcemaps' })`
);

if ( isWatch ) {
	// Minimal watch: rebuild all on change (incremental per-block watch is Phase 2).
	const watcher = fs.watch( blocksDir, { recursive: true }, async () => {
		for ( const block of blocks ) {
			try {
				await buildJs( block );
				await buildCss( block );
			} catch ( e ) {
				console.error( `[block-rig] rebuild failed:`, ( e as Error ).message );
			}
		}
	} );
	process.on( 'SIGINT', () => {
		watcher.close();
		process.exit( 0 );
	} );
	console.log( '[block-rig] watching for changes…' );
}

void didWork;