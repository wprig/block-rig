import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';

registerBlockType( 'block-rig/price-card', {
	edit: Edit,
	save: () => null,
} );