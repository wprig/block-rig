<?php
/**
 * Plugin Name:       Block Rig Spike
 * Description:       Phase 0 viability spike — Bun.build + Lightning CSS only.
 * Version:           0.0.1
 * Requires at least: 6.7
 * Requires PHP:      8.1
 * Author:            Block Rig
 * License:           GPL-2.0-or-later
 * Text Domain:       block-rig-spike
 *
 * @package block-rig-spike
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the spike block.
 */
function block_rig_spike_register_blocks(): void {
	register_block_type( __DIR__ . '/blocks/price-card' );
}
add_action( 'init', 'block_rig_spike_register_blocks' );