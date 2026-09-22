/**
 * Íconos Feather (https://feathericons.com, MIT) como SVG inline: los mismos
 * que usa Stella Nova, con su trazo (1.75) y color de token. Sólo la
 * geometría de los que usa con§tel; se pintan con currentColor.
 */
const SVG = 'http://www.w3.org/2000/svg';

/** Geometría Feather (24×24), tal cual el original. */
const SHAPES = {
	'zoom-in': [ [ 'circle', { cx: 11, cy: 11, r: 8 } ], [ 'line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 } ],
		[ 'line', { x1: 11, y1: 8, x2: 11, y2: 14 } ], [ 'line', { x1: 8, y1: 11, x2: 14, y2: 11 } ] ],
	'zoom-out': [ [ 'circle', { cx: 11, cy: 11, r: 8 } ], [ 'line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 } ],
		[ 'line', { x1: 8, y1: 11, x2: 14, y2: 11 } ] ],
	maximize: [ [ 'path', { d: 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3' } ] ],
	download: [ [ 'path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' } ],
		[ 'polyline', { points: '7 10 12 15 17 10' } ], [ 'line', { x1: 12, y1: 15, x2: 12, y2: 3 } ] ],
	x: [ [ 'line', { x1: 18, y1: 6, x2: 6, y2: 18 } ], [ 'line', { x1: 6, y1: 6, x2: 18, y2: 18 } ] ]
};

/**
 * @param {string} name clave de SHAPES
 * @return {SVGElement} decorativo (aria-hidden): el nombre accesible va en el botón
 */
function icon( name ) {
	const svg = document.createElementNS( SVG, 'svg' );
	svg.setAttribute( 'viewBox', '0 0 24 24' );
	svg.setAttribute( 'class', 'constel-i' );
	svg.setAttribute( 'aria-hidden', 'true' );
	svg.setAttribute( 'focusable', 'false' );
	for ( const [ tag, attrs ] of SHAPES[ name ] ) {
		const shape = document.createElementNS( SVG, tag );
		for ( const [ k, v ] of Object.entries( attrs ) ) {
			shape.setAttribute( k, String( v ) );
		}
		svg.appendChild( shape );
	}
	return svg;
}

/**
 * Botón sólo-ícono con nombre accesible (aria-label + title).
 *
 * @param {string} name ícono
 * @param {string} label nombre accesible
 * @param {string} [className]
 * @return {HTMLButtonElement}
 */
function iconButton( name, label, className ) {
	const button = document.createElement( 'button' );
	button.type = 'button';
	button.className = className || 'constel-button constel-button--icon';
	button.setAttribute( 'aria-label', label );
	button.title = label;
	button.append( icon( name ) );
	return button;
}

module.exports = { icon, iconButton };
