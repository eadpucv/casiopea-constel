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
	x: [ [ 'line', { x1: 18, y1: 6, x2: 6, y2: 18 } ], [ 'line', { x1: 6, y1: 6, x2: 18, y2: 18 } ] ],
	eye: [ [ 'path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' } ], [ 'circle', { cx: 12, cy: 12, r: 3 } ] ],
	'rotate-cw': [ [ 'polyline', { points: '23 4 23 10 17 10' } ],
		[ 'path', { d: 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10' } ] ],
	'share-2': [ [ 'circle', { cx: 18, cy: 5, r: 3 } ], [ 'circle', { cx: 6, cy: 12, r: 3 } ],
		[ 'circle', { cx: 18, cy: 19, r: 3 } ], [ 'line', { x1: 8.59, y1: 13.51, x2: 15.42, y2: 17.49 } ],
		[ 'line', { x1: 15.41, y1: 6.51, x2: 8.59, y2: 10.49 } ] ],
	filter: [ [ 'polygon', { points: '22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3' } ] ],
	'align-left': [ [ 'line', { x1: 17, y1: 10, x2: 3, y2: 10 } ], [ 'line', { x1: 21, y1: 6, x2: 3, y2: 6 } ],
		[ 'line', { x1: 21, y1: 14, x2: 3, y2: 14 } ], [ 'line', { x1: 17, y1: 18, x2: 3, y2: 18 } ] ],
	layers: [ [ 'polygon', { points: '12 2 2 7 12 12 22 7 12 2' } ], [ 'polyline', { points: '2 17 12 22 22 17' } ],
		[ 'polyline', { points: '2 12 12 17 22 12' } ] ],
	'file-text': [ [ 'path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' } ],
		[ 'polyline', { points: '14 2 14 8 20 8' } ], [ 'line', { x1: 16, y1: 13, x2: 8, y2: 13 } ],
		[ 'line', { x1: 16, y1: 17, x2: 8, y2: 17 } ], [ 'polyline', { points: '10 9 9 9 8 9' } ] ],
	users: [ [ 'path', { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' } ], [ 'circle', { cx: 9, cy: 7, r: 4 } ],
		[ 'path', { d: 'M23 21v-2a4 4 0 0 0-3-3.87' } ], [ 'path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' } ] ],
	file: [ [ 'path', { d: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z' } ],
		[ 'polyline', { points: '13 2 13 9 20 9' } ] ],
	tag: [ [ 'path', { d: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z' } ],
		[ 'line', { x1: 7, y1: 7, x2: 7.01, y2: 7 } ] ]
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
