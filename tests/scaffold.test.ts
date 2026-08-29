/**
 * Framework-level CLI e2e suite — scaffolds real plugins into temp dirs and
 * asserts structure, token substitution, and validation behavior.
 */
import { describe, test, expect } from 'bun:test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const FRAMEWORK_ROOT = path.resolve( import.meta.dir, '..' );
const CLI = path.join( FRAMEWORK_ROOT, 'bin', 'create-block-rig.ts' );

interface RunResult {
	code: number;
	stdout: string;
	stderr: string;
}

function runCli( args: string[], cwd?: string ): RunResult {
	const proc = Bun.spawnSync( [ 'bun', CLI, ...args ], { cwd: cwd ?? FRAMEWORK_ROOT } );
	return {
		code: proc.exitCode,
		stdout: proc.stdout.toString(),
		stderr: proc.stderr.toString(),
	};
}

function runPluginScript( script: string, args: string[], pluginDir: string ): RunResult {
	const proc = Bun.spawnSync( [ 'bun', 'run', `scripts/${ script }`, ...args ], { cwd: pluginDir } );
	return {
		code: proc.exitCode,
		stdout: proc.stdout.toString(),
		stderr: proc.stderr.toString(),
	};
}

function tmpdir(): string {
	return fs.mkdtempSync( path.join( os.tmpdir(), 'br-cli-' ) );
}

function read( pluginDir: string, rel: string ): string {
	return fs.readFileSync( path.join( pluginDir, rel ), 'utf8' );
}

/** No un-substituted __TOKEN__ placeholders may survive in generated text files. */
function assertNoTokens( pluginDir: string ): void {
	const magic = new Set( [ 'DIR', 'FILE', 'LINE', 'CLASS', 'FUNCTION', 'METHOD', 'NAMESPACE' ] );
	const tokenRe = /__([A-Z][A-Z_]*?)__/g;
	const violations: string[] = [];
	const walk = ( dir: string, rel = '' ): void => {
		for ( const entry of fs.readdirSync( dir, { withFileTypes: true } ) ) {
			if ( entry.name === 'node_modules' || rel === 'templates/blocks' ) {
				continue;
			}
			const full = path.join( dir, entry.name );
			const relPath = rel ? `${ rel }/${ entry.name }` : entry.name;
			if ( entry.isDirectory() ) {
				walk( full, relPath );
			} else if ( /\.(php|json|ts|tsx|css|md|txt|yml)$/.test( entry.name ) ) {
				const content = fs.readFileSync( full, 'utf8' );
				for ( const match of content.matchAll( tokenRe ) ) {
					if ( ! magic.has( match[ 1 ] ) ) {
						violations.push( `${ relPath }: ${ match[ 0 ] }` );
						break;
					}
				}
			}
		}
	};
	walk( pluginDir );
	expect( violations ).toEqual( [] );
}

describe( 'create-block-rig CLI', () => {
	test( 'scaffolds a complete plugin with correct token substitution', () => {
		const dir = tmpdir();
		const result = runCli( [ 'my-plugins', '--dir', dir, '--name', 'My Plugins' ] );
		expect( result.code ).toBe( 0 );
		const plugin = path.join( dir, 'my-plugins' );

		for ( const rel of [
			'my-plugins.php',
			'blockrig.config.json',
			'package.json',
			'tsconfig.json',
			'.stylelintrc',
			'AGENTS.md',
			'README.md',
			'scripts/build.ts',
			'scripts/dev.ts',
			'scripts/zip.ts',
			'scripts/scaffold.ts',
			'scripts/lib/build.ts',
			'scripts/lib/config.ts',
			'scripts/lib/wp-externals.ts',
			'blocks/example/block.json',
			'blocks/example/render.php',
			'templates/blocks/dynamic/block.json',
			'templates/blocks/static/block.json',
			'templates/blocks/php/block.json',
			'tests/config.test.ts',
			'tests/css-budget.test.ts',
			'.github/workflows/check.yml',
		] ) {
			expect( fs.existsSync( path.join( plugin, rel ) ) ).toBe( true );
		}

		const bootstrap = read( plugin, 'my-plugins.php' );
		expect( bootstrap ).toContain( 'function my_plugins_register_blocks' );
		expect( bootstrap ).toMatch( /load_plugin_textdomain\(\s*'my-plugins'/ );

		const config = JSON.parse( read( plugin, 'blockrig.config.json' ) );
		expect( config.pluginSlug ).toBe( 'my-plugins' );
		expect( config.namespace ).toBe( 'my-plugins' );
		expect( config.pluginName ).toBe( 'My Plugins' );

		const blockJson = JSON.parse( read( plugin, 'blocks/example/block.json' ) );
		expect( blockJson.name ).toBe( 'my-plugins/example' );
		expect( blockJson.render ).toBe( 'file:./render.php' );

		assertNoTokens( plugin );
	} );

	test( 'rejects invalid plugin slugs', () => {
		for ( const slug of [ 'Bad-Slug', '1starts-digit', 'under_score', 'has space' ] ) {
			const result = runCli( [ slug, '--dir', tmpdir() ] );
			expect( result.code ).toBe( 1 );
		}
	} );

	test( 'refuses to overwrite without --force, succeeds with it', () => {
		const dir = tmpdir();
		expect( runCli( [ 'dup', '--dir', dir ] ).code ).toBe( 0 );
		expect( runCli( [ 'dup', '--dir', dir ] ).code ).toBe( 1 );
		expect( runCli( [ 'dup', '--dir', dir, '--force' ] ).code ).toBe( 0 );
	} );

	test( 'scaffolds all three block types via block:new', () => {
		const dir = tmpdir();
		runCli( [ 'blk', '--dir', dir ] );
		const plugin = path.join( dir, 'blk' );

		for ( const [ name, type ] of [
			[ 'one-static', 'static' ],
			[ 'one-php', 'php' ],
		] ) {
			const result = runPluginScript( 'scaffold.ts', [ name, '--type', type ], plugin );
			expect( result.code ).toBe( 0 );
		}

		expect( JSON.parse( read( plugin, 'blocks/one-static/block.json' ) ).render ).toBeUndefined();
		expect( JSON.parse( read( plugin, 'blocks/one-php/block.json' ) ).supports.autoRegister ).toBe( true );
		expect( fs.existsSync( path.join( plugin, 'blocks/one-static/src/save.tsx' ) ) ).toBe( true );
		expect( fs.existsSync( path.join( plugin, 'blocks/one-php/src/index.tsx' ) ) ).toBe( false );
		expect( fs.existsSync( path.join( plugin, 'blocks/one-php/src/style.css' ) ) ).toBe( true );
		assertNoTokens( plugin );
	} );

	test( 'block:new validates slugs and rejects duplicates', () => {
		const dir = tmpdir();
		runCli( [ 'blk', '--dir', dir ] );
		const plugin = path.join( dir, 'blk' );

		expect( runPluginScript( 'scaffold.ts', [], plugin ).code ).toBe( 1 );
		expect( runPluginScript( 'scaffold.ts', [ 'Bad_Slug' ], plugin ).code ).toBe( 1 );
		expect( runPluginScript( 'scaffold.ts', [ 'ok-block', '--type', 'nope' ], plugin ).code ).toBe( 1 );
		expect( runPluginScript( 'scaffold.ts', [ 'ok-block', '--type', 'static' ], plugin ).code ).toBe( 0 );
		expect( runPluginScript( 'scaffold.ts', [ 'ok-block', '--type', 'static' ], plugin ).code ).toBe( 1 );
	} );

	test( '--type php starter produces a plugin with no JS build surface', () => {
		const dir = tmpdir();
		runCli( [ 'phpstarter', '--dir', dir, '--type', 'php' ] );
		const plugin = path.join( dir, 'phpstarter' );
		const blockJson = JSON.parse( read( plugin, 'blocks/example/block.json' ) );
		expect( blockJson.editorScript ).toBeUndefined();
		expect( blockJson.supports.autoRegister ).toBe( true );
	} );
} );