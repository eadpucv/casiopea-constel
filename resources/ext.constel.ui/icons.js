/**
 * Íconos Lucide (https://lucide.dev, licencia ISC; lucide-static 1.49.0) como
 * SVG inline, con el trazo (1.75) y el color de token de Stella Nova. Sólo la
 * geometría de los que usa con§tel, tal cual el original (24×24); se pintan
 * con currentColor. Algunos nombres de aquí difieren de los de Lucide, que los
 * renombró: «filter» es `funnel` y «align-left» es `text-align-start`.
 */
const SVG = 'http://www.w3.org/2000/svg';

/** Geometría Lucide (24×24). */
const SHAPES = {
	'zoom-in': [
		[ 'circle', { cx: 11, cy: 11, r: 8 } ],
		[ 'line', { x1: 21, x2: 16.65, y1: 21, y2: 16.65 } ],
		[ 'line', { x1: 11, x2: 11, y1: 8, y2: 14 } ],
		[ 'line', { x1: 8, x2: 14, y1: 11, y2: 11 } ]
	],
	'zoom-out': [
		[ 'circle', { cx: 11, cy: 11, r: 8 } ],
		[ 'line', { x1: 21, x2: 16.65, y1: 21, y2: 16.65 } ],
		[ 'line', { x1: 8, x2: 14, y1: 11, y2: 11 } ]
	],
	maximize: [
		[ 'path', { d: 'M8 3H5a2 2 0 0 0-2 2v3' } ],
		[ 'path', { d: 'M21 8V5a2 2 0 0 0-2-2h-3' } ],
		[ 'path', { d: 'M3 16v3a2 2 0 0 0 2 2h3' } ],
		[ 'path', { d: 'M16 21h3a2 2 0 0 0 2-2v-3' } ]
	],
	minimize: [
		[ 'path', { d: 'M8 3v3a2 2 0 0 1-2 2H3' } ],
		[ 'path', { d: 'M21 8h-3a2 2 0 0 1-2-2V3' } ],
		[ 'path', { d: 'M3 16h3a2 2 0 0 1 2 2v3' } ],
		[ 'path', { d: 'M16 21v-3a2 2 0 0 1 2-2h3' } ]
	],
	download: [
		[ 'path', { d: 'M12 15V3' } ],
		[ 'path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' } ],
		[ 'path', { d: 'm7 10 5 5 5-5' } ]
	],
	plus: [ [ 'path', { d: 'M5 12h14' } ], [ 'path', { d: 'M12 5v14' } ] ],
	x: [ [ 'path', { d: 'M18 6 6 18' } ], [ 'path', { d: 'm6 6 12 12' } ] ],
	eye: [
		[ 'path', { d: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0' } ],
		[ 'circle', { cx: 12, cy: 12, r: 3 } ]
	],
	'rotate-cw': [
		[ 'path', { d: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8' } ],
		[ 'path', { d: 'M21 3v5h-5' } ]
	],
	'rotate-ccw': [
		[ 'path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' } ],
		[ 'path', { d: 'M3 3v5h5' } ]
	],
	'rotate-3d': [
		[ 'path', { d: 'm15.194 13.707 3.814 1.86-1.86 3.814' } ],
		[ 'path', { d: 'M16.47214 7.52786 A 5 10 0 1 0 13 21.79796' } ],
		[ 'path', { d: 'M21.79796 11 A 10 5 0 1 0 19 15.57071' } ]
	],
	'share-2': [
		[ 'circle', { cx: 18, cy: 5, r: 3 } ],
		[ 'circle', { cx: 6, cy: 12, r: 3 } ],
		[ 'circle', { cx: 18, cy: 19, r: 3 } ],
		[ 'line', { x1: 8.59, x2: 15.42, y1: 13.51, y2: 17.49 } ],
		[ 'line', { x1: 15.41, x2: 8.59, y1: 6.51, y2: 10.49 } ]
	],
	waypoints: [
		[ 'path', { d: 'm10.586 5.414-5.172 5.172' } ],
		[ 'path', { d: 'm18.586 13.414-5.172 5.172' } ],
		[ 'path', { d: 'M6 12h12' } ],
		[ 'circle', { cx: 12, cy: 20, r: 2 } ],
		[ 'circle', { cx: 12, cy: 4, r: 2 } ],
		[ 'circle', { cx: 20, cy: 12, r: 2 } ],
		[ 'circle', { cx: 4, cy: 12, r: 2 } ]
	],
	filter: [
		[ 'path', { d: 'M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z' } ]
	],
	'align-left': [
		[ 'path', { d: 'M21 5H3' } ],
		[ 'path', { d: 'M15 12H3' } ],
		[ 'path', { d: 'M17 19H3' } ]
	],
	layers: [
		[ 'path', { d: 'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z' } ],
		[ 'path', { d: 'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12' } ],
		[ 'path', { d: 'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17' } ]
	],
	'file-text': [
		[ 'path', { d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z' } ],
		[ 'path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' } ],
		[ 'path', { d: 'M10 9H8' } ],
		[ 'path', { d: 'M16 13H8' } ],
		[ 'path', { d: 'M16 17H8' } ]
	],
	users: [
		[ 'path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' } ],
		[ 'path', { d: 'M16 3.128a4 4 0 0 1 0 7.744' } ],
		[ 'path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' } ],
		[ 'circle', { cx: 9, cy: 7, r: 4 } ]
	],
	file: [
		[ 'path', { d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z' } ],
		[ 'path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' } ]
	],
	crosshair: [
		[ 'circle', { cx: 12, cy: 12, r: 10 } ],
		[ 'line', { x1: 22, x2: 18, y1: 12, y2: 12 } ],
		[ 'line', { x1: 6, x2: 2, y1: 12, y2: 12 } ],
		[ 'line', { x1: 12, x2: 12, y1: 6, y2: 2 } ],
		[ 'line', { x1: 12, x2: 12, y1: 22, y2: 18 } ]
	],
	tag: [
		[ 'path', { d: 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z' } ],
		[ 'circle', { cx: 7.5, cy: 7.5, r: 0.5, fill: 'currentColor' } ]
	],
	'git-merge': [
		[ 'circle', { cx: 18, cy: 18, r: 3 } ],
		[ 'circle', { cx: 6, cy: 6, r: 3 } ],
		[ 'path', { d: 'M6 21V9a9 9 0 0 0 9 9' } ]
	],
	type: [
		[ 'path', { d: 'M12 4v16' } ],
		[ 'path', { d: 'M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2' } ],
		[ 'path', { d: 'M9 20h6' } ]
	],
	square: [ [ 'rect', { width: 18, height: 18, x: 3, y: 3, rx: 2 } ] ],
	box: [
		[ 'path', { d: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z' } ],
		[ 'path', { d: 'm3.3 7 8.7 5 8.7-5' } ],
		[ 'path', { d: 'M12 22V12' } ]
	],
	'disc-2': [
		[ 'circle', { cx: 12, cy: 12, r: 10 } ],
		[ 'circle', { cx: 12, cy: 12, r: 4 } ],
		[ 'path', { d: 'M12 12h.01' } ]
	],
	'circle-dot': [
		[ 'circle', { cx: 12, cy: 12, r: 1 } ],
		[ 'circle', { cx: 12, cy: 12, r: 10 } ]
	],
	star: [
		[ 'path', { d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z' } ]
	]
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
