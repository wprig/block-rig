import { useBlockProps } from '@wordpress/block-editor';
import {
	TextControl,
	ToggleControl,
	PanelBody,
} from '@wordpress/components';

interface PriceCardAttributes {
	plan: string;
	price: string;
	period: string;
	highlight: boolean;
}

interface EditProps {
	attributes: PriceCardAttributes;
	setAttributes: ( attrs: Partial< PriceCardAttributes > ) => void;
}

export default function Edit( {
	attributes,
	setAttributes,
}: EditProps ) {
	const blockProps = useBlockProps( {
		className: attributes.highlight
			? 'br-price-card br-price-card--highlight'
			: 'br-price-card',
	} );

	return (
		<>
			<div { ...blockProps }>
				<span className="br-price-card__plan">{ attributes.plan }</span>
				<span className="br-price-card__price">{ attributes.price }</span>
				<span className="br-price-card__period">{ attributes.period }</span>
				<span className="br-price-card__badge">Bun-built editor preview</span>
			</div>
			<div className="br-price-card__controls">
				<TextControl
					label="Plan"
					value={ attributes.plan }
					onChange={ ( plan ) => setAttributes( { plan } ) }
				/>
				<TextControl
					label="Price"
					value={ attributes.price }
					onChange={ ( price ) => setAttributes( { price } ) }
				/>
				<TextControl
					label="Period"
					value={ attributes.period }
					onChange={ ( period ) => setAttributes( { period } ) }
				/>
				<ToggleControl
					label="Highlight"
					checked={ attributes.highlight }
					onChange={ ( highlight ) => setAttributes( { highlight } ) }
				/>
			</div>
		</>
	);
}