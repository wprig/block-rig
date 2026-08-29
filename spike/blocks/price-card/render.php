<?php
/**
 * Server-side render for the price-card block.
 *
 * @package block-rig-spike
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Inner block content (empty for this block).
 * @var WP_Block $block      Block instance.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$plan     = isset( $attributes['plan'] ) ? $attributes['plan'] : '';
$price    = isset( $attributes['price'] ) ? $attributes['price'] : '';
$period   = isset( $attributes['period'] ) ? $attributes['period'] : 'month';
$highlight = ! empty( $attributes['highlight'] );

$classes = array( 'br-price-card' );
if ( $highlight ) {
	$classes[] = 'br-price-card--highlight';
}

?>
<div class="<?php echo esc_attr( implode( ' ', $classes ) ); ?>">
	<span class="br-price-card__plan"><?php echo esc_html( $plan ); ?></span>
	<span class="br-price-card__price"><?php echo esc_html( $price ); ?></span>
	<span class="br-price-card__period"><?php echo esc_html( $period ); ?></span>
	<span class="br-price-card__badge">Block Rig spike</span>
</div>