/**
 * El grafo de conceptos, en 3D (default) o 2D, dibujado en SVG sin
 * dependencias.
 *
 * Layout de fuerzas propio en tres dimensiones: repulsión entre todos,
 * resortes por arista (más peso, más cerca), gravedad al centro y atracción
 * al centroide del tema (como constel). En 3D los nodos se proyectan en
 * perspectiva; se orbita arrastrando o con las flechas. Girar solo es
 * opcional (view.autorotate, apagado por defecto: WCAG 2.2.2) y nunca con
 * prefers-reduced-motion. Los rótulos siguen siendo texto SVG
 * enfocable, con los tokens del skin.
 *
 * Presentación, no comportamiento: el spec sólo fija qué se expone
 * (ConceptMap); tamaños, fuerzas y colores son del lado del diseño.
 */
const SVG = 'http://www.w3.org/2000/svg';
const CATEGORIES = 8;
const WIDTH = 800;
const HEIGHT = 500;
/** Radio de la esfera donde se normaliza el layout. */
const RADIUS = 210;
/** Distancia de la cámara (perspectiva). */
const CAMERA = 900;

function svg( tag, attrs ) {
	const el = document.createElementNS( SVG, tag );
	for ( const [ k, v ] of Object.entries( attrs || {} ) ) {
		el.setAttribute( k, v );
	}
	return el;
}

/**
 * Tamaño tipográfico por frecuencia, como constel: 0.6·§§ + 0.4·páginas,
 * normalizados, entre 11 y 31 px (spec: FrequencyScaling).
 *
 * @param {Array} nodes
 * @return {Function}
 */
function sizer( nodes ) {
	const maxExc = Math.max( 1, ...nodes.map( ( n ) => n.excerpts ) );
	const maxPages = Math.max( 1, ...nodes.map( ( n ) => n.pages ) );
	return ( n ) => 11 + 20 * ( 0.6 * n.excerpts / maxExc + 0.4 * n.pages / maxPages );
}

/**
 * Posiciones de equilibrio (mutan x, y, z de cada nodo).
 *
 * @param {Array} nodes
 * @param {Array} links
 * @param {Map<number,number>} themeOf concepto → índice de tema
 * @param {number} dims 2 o 3
 */
function layout( nodes, links, themeOf, dims ) {
	const byId = new Map( nodes.map( ( node ) => [ node.id, node ] ) );
	const n = nodes.length;
	const k = Math.sqrt( ( 600 * 600 ) / Math.max( 1, n ) );
	nodes.forEach( ( node, i ) => {
		if ( node.x === undefined ) {
			// Espiral de Fibonacci: el mismo mapa cae igual cada vez.
			const t = ( i + 0.5 ) / Math.max( 1, n );
			const phi = i * 2.399963;
			const r = 30 * Math.sqrt( i + 1 );
			const incl = Math.acos( 1 - 2 * t );
			node.x = r * Math.sin( incl ) * Math.cos( phi );
			node.y = r * Math.sin( incl ) * Math.sin( phi );
			node.z = r * Math.cos( incl );
		}
		if ( dims === 2 ) {
			node.z = 0;
		}
	} );
	let temperature = k * 2;
	for ( let it = 0; it < 300; it++ ) {
		for ( const a of nodes ) {
			a.dx = -a.x * 0.05;
			a.dy = -a.y * 0.05;
			a.dz = -a.z * 0.05;
		}
		for ( let i = 0; i < n; i++ ) {
			const a = nodes[ i ];
			for ( let j = i + 1; j < n; j++ ) {
				const b = nodes[ j ];
				const dx = a.x - b.x;
				const dy = a.y - b.y;
				const dz = a.z - b.z;
				const force = k * k / Math.max( 0.01, dx * dx + dy * dy + dz * dz );
				a.dx += dx * force;
				a.dy += dy * force;
				a.dz += dz * force;
				b.dx -= dx * force;
				b.dy -= dy * force;
				b.dz -= dz * force;
			}
		}
		for ( const l of links ) {
			const a = byId.get( l.source );
			const b = byId.get( l.target );
			const dx = a.x - b.x;
			const dy = a.y - b.y;
			const dz = a.z - b.z;
			const d = Math.max( 0.1, Math.sqrt( dx * dx + dy * dy + dz * dz ) );
			// Misma página atrae menos: no es una decisión explícita del lector.
			const force = d * Math.log2( 1 + l.weight ) / k * ( l.kind === 'co_page' ? 0.35 : 1 );
			a.dx -= dx / d * force;
			a.dy -= dy / d * force;
			a.dz -= dz / d * force;
			b.dx += dx / d * force;
			b.dy += dy / d * force;
			b.dz += dz / d * force;
		}
		if ( themeOf.size ) {
			const centroids = new Map();
			for ( const node of nodes ) {
				const t = themeOf.get( node.id );
				if ( t !== undefined ) {
					const c = centroids.get( t ) || { x: 0, y: 0, z: 0, n: 0 };
					c.x += node.x;
					c.y += node.y;
					c.z += node.z;
					c.n++;
					centroids.set( t, c );
				}
			}
			for ( const node of nodes ) {
				const c = centroids.get( themeOf.get( node.id ) );
				if ( c ) {
					node.dx += ( c.x / c.n - node.x ) * 0.15;
					node.dy += ( c.y / c.n - node.y ) * 0.15;
					node.dz += ( c.z / c.n - node.z ) * 0.15;
				}
			}
		}
		for ( const node of nodes ) {
			const d = Math.max( 0.01, Math.hypot( node.dx, node.dy, node.dz ) );
			const step = Math.min( d, temperature ) / d;
			node.x += node.dx * step;
			node.y += node.dy * step;
			node.z = dims === 2 ? 0 : node.z + node.dz * step;
		}
		temperature *= 0.97;
	}
	// Normalizar a una esfera de radio RADIUS centrada en el origen.
	const cx = nodes.reduce( ( s, v ) => s + v.x, 0 ) / Math.max( 1, n );
	const cy = nodes.reduce( ( s, v ) => s + v.y, 0 ) / Math.max( 1, n );
	const cz = nodes.reduce( ( s, v ) => s + v.z, 0 ) / Math.max( 1, n );
	const dist = ( v ) => Math.hypot( v.x - cx, v.y - cy, v.z - cz );
	const reach = Math.max( 1, ...nodes.map( dist ) );
	for ( const node of nodes ) {
		node.x = ( node.x - cx ) / reach * RADIUS;
		node.y = ( node.y - cy ) / reach * RADIUS;
		node.z = ( node.z - cz ) / reach * RADIUS;
	}
}

/**
 * Dibuja el grafo.
 *
 * @param {HTMLElement} container
 * @param {Object} data {nodes, links}
 * @param {Object} view {mode: '3d'|'2d', threshold, edges, autorotate, themeOf: Map, onSelect}
 * @return {Object} controles: zoomIn, zoomOut, reset, select, setAutorotate, destroy
 */
function draw( container, data, view ) {
	container.textContent = '';
	const nodes = data.nodes;
	const links = data.links.filter( ( l ) => l.weight >= view.threshold );
	const is3d = view.mode !== '2d';
	nodes.forEach( ( node ) => {
		if ( !is3d ) {
			node.z = 0;
		}
	} );
	layout( nodes, links, view.themeOf, is3d ? 3 : 2 );

	// ── Cámara ────────────────────────────────────────────────────────────
	const reduce = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
	let yaw = is3d ? 0.6 : 0;
	let pitch = is3d ? -0.35 : 0;
	let zoom = 1;
	let hovering = false;
	let dragging = null;
	let frame = null;
	let lastSort = 0;
	let autorotate = !!view.autorotate;

	const size = sizer( nodes );
	const root = svg( 'svg', {
		class: 'constel-graph' + ( is3d ? ' constel-graph--3d' : '' ),
		viewBox: `${ -WIDTH / 2 } ${ -HEIGHT / 2 } ${ WIDTH } ${ HEIGHT }`,
		role: 'group',
		tabindex: '0',
		'aria-label': mw.msg( is3d ? 'constellation-graph-label-3d' : 'constellation-graph-label', nodes.length )
	} );
	const stage = svg( 'g' );
	root.appendChild( stage );

	const byId = new Map( nodes.map( ( n ) => [ n.id, n ] ) );
	const neighbours = new Map( nodes.map( ( n ) => [ n.id, new Set() ] ) );
	const linkEls = [];
	const linkLayer = svg( 'g', { class: 'constel-graph__links' } );
	if ( view.edges ) {
		links.forEach( ( l ) => {
			neighbours.get( l.source ).add( l.target );
			neighbours.get( l.target ).add( l.source );
			// Clases: constel-graph__link--co_excerpt, --overlap, --co_page
			const line = svg( 'line', {
				class: 'constel-graph__link constel-graph__link--' + l.kind,
				'stroke-width': l.kind === 'co_page' ?
					1 :
					Math.min( 5, 1 + Math.log2( 1 + l.weight ) ),
				'vector-effect': 'non-scaling-stroke'
			} );
			linkEls.push( { el: line, a: byId.get( l.source ), b: byId.get( l.target ) } );
			linkLayer.appendChild( line );
		} );
	}
	stage.appendChild( linkLayer );

	const nodeLayer = svg( 'g', { class: 'constel-graph__nodes' } );
	const nodeEls = new Map();
	nodes.forEach( ( node ) => {
		const theme = view.themeOf.get( node.id );
		const classes = [ 'constel-graph__node' ];
		if ( node.mine ) {
			classes.push( 'constel-graph__node--mine' );
		}
		if ( theme !== undefined ) {
			// Clases: constel-graph__node--cat-0 … constel-graph__node--cat-7
			classes.push( 'constel-graph__node--cat-' + ( theme % CATEGORIES ) );
		}
		const text = svg( 'text', {
			class: classes.join( ' ' ),
			'text-anchor': 'middle',
			'dominant-baseline': 'middle',
			tabindex: '0',
			role: 'button',
			'aria-label': mw.msg( 'constellation-node-label', node.label, node.excerpts, node.pages )
		} );
		text.textContent = node.label;
		const activate = () => view.onSelect( node );
		text.addEventListener( 'click', activate );
		text.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' || e.key === ' ' ) {
				e.preventDefault();
				activate();
			}
		} );
		const focus = ( on ) => {
			hovering = on;
			root.classList.toggle( 'constel-graph--focus', on );
			nodeEls.forEach( ( el, id ) => el.classList.toggle(
				'constel-graph__node--near', on && ( id === node.id || neighbours.get( node.id ).has( id ) )
			) );
			linkEls.forEach( ( l ) => l.el.classList.toggle(
				'constel-graph__link--near', on && ( l.a.id === node.id || l.b.id === node.id )
			) );
		};
		text.addEventListener( 'mouseenter', () => focus( true ) );
		text.addEventListener( 'mouseleave', () => focus( false ) );
		text.addEventListener( 'focus', () => focus( true ) );
		text.addEventListener( 'blur', () => focus( false ) );
		nodeLayer.appendChild( text );
		nodeEls.set( node.id, text );
	} );
	stage.appendChild( nodeLayer );
	container.appendChild( root );

	function render() {
		const cy = Math.cos( yaw );
		const sy = Math.sin( yaw );
		const cp = Math.cos( pitch );
		const sp = Math.sin( pitch );
		for ( const node of nodes ) {
			const x1 = node.x * cy + node.z * sy;
			const z1 = -node.x * sy + node.z * cy;
			const y2 = node.y * cp - z1 * sp;
			const z2 = node.y * sp + z1 * cp;
			const scale = ( is3d ? CAMERA / ( CAMERA - z2 ) : 1 ) * zoom;
			node.px = x1 * scale;
			node.py = y2 * scale;
			node.depth = z2;
			const el = nodeEls.get( node.id );
			el.setAttribute( 'x', node.px.toFixed( 1 ) );
			el.setAttribute( 'y', node.py.toFixed( 1 ) );
			el.setAttribute( 'font-size', ( size( node ) * ( is3d ? scale : zoom ) ).toFixed( 1 ) );
			if ( is3d ) {
				// Lo lejano se atenúa: da profundidad sin perder legibilidad.
				el.style.opacity = ( 0.45 + 0.55 * ( z2 + RADIUS ) / ( 2 * RADIUS ) ).toFixed( 2 );
			}
		}
		for ( const l of linkEls ) {
			l.el.setAttribute( 'x1', l.a.px.toFixed( 1 ) );
			l.el.setAttribute( 'y1', l.a.py.toFixed( 1 ) );
			l.el.setAttribute( 'x2', l.b.px.toFixed( 1 ) );
			l.el.setAttribute( 'y2', l.b.py.toFixed( 1 ) );
		}
		// Orden de pintado por profundidad (lo cercano encima), sin exagerar.
		const now = performance.now();
		if ( is3d && now - lastSort > 120 ) {
			lastSort = now;
			nodes.slice().sort( ( a, b ) => a.depth - b.depth )
				.forEach( ( node ) => nodeLayer.appendChild( nodeEls.get( node.id ) ) );
		}
	}

	function tick() {
		frame = null;
		const idle = !hovering && !dragging && document.contains( root );
		if ( is3d && autorotate && !reduce && idle ) {
			yaw += 0.0025;
			render();
			frame = requestAnimationFrame( tick );
		}
	}
	const resume = () => {
		if ( !frame ) {
			frame = requestAnimationFrame( tick );
		}
	};

	// Arrastrar: orbitar en 3D, panear en 2D.
	let pan = { x: 0, y: 0 };
	root.addEventListener( 'pointerdown', ( e ) => {
		if ( e.target === root || e.target.tagName === 'line' ) {
			dragging = { x: e.clientX, y: e.clientY, yaw, pitch, pan: Object.assign( {}, pan ) };
			root.setPointerCapture( e.pointerId );
		}
	} );
	root.addEventListener( 'pointermove', ( e ) => {
		if ( !dragging ) {
			return;
		}
		const dx = e.clientX - dragging.x;
		const dy = e.clientY - dragging.y;
		if ( is3d ) {
			yaw = dragging.yaw + dx * 0.008;
			pitch = Math.max( -1.4, Math.min( 1.4, dragging.pitch + dy * 0.008 ) );
		} else {
			const s = WIDTH / root.clientWidth;
			pan = { x: dragging.pan.x + dx * s, y: dragging.pan.y + dy * s };
			stage.setAttribute( 'transform', `translate(${ pan.x } ${ pan.y })` );
		}
		render();
	} );
	root.addEventListener( 'pointerup', () => {
		dragging = null;
		resume();
	} );
	root.addEventListener( 'pointerleave', () => {
		hovering = false;
		resume();
	} );
	root.addEventListener( 'pointerenter', () => {
		// Con el puntero encima se detiene la rotación: así se puede apuntar.
		hovering = true;
	} );
	const setZoom = ( factor ) => {
		zoom = Math.max( 0.3, Math.min( 4, zoom * factor ) );
		render();
	};
	root.addEventListener( 'wheel', ( e ) => {
		if ( e.ctrlKey ) {
			e.preventDefault();
			setZoom( e.deltaY > 0 ? 1 / 1.15 : 1.15 );
		}
	}, { passive: false } );
	// Teclado: flechas orbitan (3D) o panean (2D) con el foco en el grafo.
	root.addEventListener( 'keydown', ( e ) => {
		const arrows = {
			ArrowLeft: [ -1, 0 ], ArrowRight: [ 1, 0 ], ArrowUp: [ 0, -1 ], ArrowDown: [ 0, 1 ]
		};
		const step = arrows[ e.key ];
		if ( !step || e.target !== root ) {
			return;
		}
		e.preventDefault();
		if ( is3d ) {
			yaw += step[ 0 ] * 0.12;
			pitch = Math.max( -1.4, Math.min( 1.4, pitch + step[ 1 ] * 0.12 ) );
		} else {
			pan = { x: pan.x - step[ 0 ] * 30, y: pan.y - step[ 1 ] * 30 };
			stage.setAttribute( 'transform', `translate(${ pan.x } ${ pan.y })` );
		}
		render();
	} );

	render();
	resume();

	return {
		zoomIn: () => setZoom( 1.25 ),
		zoomOut: () => setZoom( 1 / 1.25 ),
		reset: () => {
			yaw = is3d ? 0.6 : 0;
			pitch = is3d ? -0.35 : 0;
			zoom = 1;
			pan = { x: 0, y: 0 };
			stage.removeAttribute( 'transform' );
			render();
		},
		select: ( id ) => nodeEls.forEach( ( el, nid ) => el.classList.toggle( 'constel-graph__node--selected', nid === id ) ),
		exportSvg: ( meta ) => serialize( root, container, meta ),
		setAutorotate: ( on ) => {
			autorotate = on;
			resume();
		},
		destroy: () => {
			if ( frame ) {
				cancelAnimationFrame( frame );
			}
		}
	};
}

/**
 * Un color CSS cualquiera (oklab(), light-dark() ya resuelto, color-mix…)
 * a rgb()/rgba(), que entienden también los editores de SVG (Inkscape,
 * Illustrator): se pinta en un canvas de un píxel y se lee.
 *
 * @param {string} color
 * @return {string}
 */
function toRgb( color ) {
	const ctx = toRgb.ctx || ( toRgb.ctx = document.createElement( 'canvas' ).getContext( '2d', { willReadFrequently: true } ) );
	ctx.clearRect( 0, 0, 1, 1 );
	ctx.fillStyle = '#000';
	ctx.fillStyle = color;
	ctx.fillRect( 0, 0, 1, 1 );
	const [ r, g, b, a ] = ctx.getImageData( 0, 0, 1, 1 ).data;
	return a === 255 ? `rgb(${ r }, ${ g }, ${ b })` : `rgba(${ r }, ${ g }, ${ b }, ${ ( a / 255 ).toFixed( 3 ) })`;
}

/**
 * SVG autónomo del grafo: los colores y tipografías vienen de tokens del
 * skin (custom properties), que fuera de la página no existen; se copian ya
 * resueltos a atributos de cada elemento.
 *
 * @param {SVGElement} root el grafo dibujado
 * @param {HTMLElement} container para el color de fondo
 * @param {Object} meta {title, description}
 * @return {string}
 */
function serialize( root, container, meta ) {
	const clone = root.cloneNode( true );
	clone.setAttribute( 'xmlns', SVG );
	clone.removeAttribute( 'tabindex' );
	clone.removeAttribute( 'class' );
	const box = root.getBoundingClientRect();
	clone.setAttribute( 'width', String( Math.round( box.width ) ) );
	clone.setAttribute( 'height', String( Math.round( box.height ) ) );

	const originals = root.querySelectorAll( 'text, line' );
	Array.from( clone.querySelectorAll( 'text, line' ) ).forEach( ( node, i ) => {
		const cs = getComputedStyle( originals[ i ] );
		if ( node.tagName === 'text' ) {
			node.setAttribute( 'fill', toRgb( cs.fill ) );
			node.setAttribute( 'font-family', cs.fontFamily );
			node.removeAttribute( 'tabindex' );
			node.removeAttribute( 'role' );
		} else {
			node.setAttribute( 'stroke', toRgb( cs.stroke ) );
			node.setAttribute( 'stroke-opacity', cs.strokeOpacity );
			if ( cs.strokeDasharray !== 'none' ) {
				node.setAttribute( 'stroke-dasharray', cs.strokeDasharray );
			}
		}
		node.setAttribute( 'opacity', cs.opacity );
		node.removeAttribute( 'class' );
		node.removeAttribute( 'style' );
	} );

	// Fondo y metadatos (accesibles también fuera de la wiki).
	const vb = root.viewBox.baseVal;
	const bg = document.createElementNS( SVG, 'rect' );
	bg.setAttribute( 'x', vb.x );
	bg.setAttribute( 'y', vb.y );
	bg.setAttribute( 'width', vb.width );
	bg.setAttribute( 'height', vb.height );
	bg.setAttribute( 'fill', toRgb( getComputedStyle( container ).backgroundColor ) );
	const title = document.createElementNS( SVG, 'title' );
	title.textContent = meta.title;
	const desc = document.createElementNS( SVG, 'desc' );
	desc.textContent = [ meta.description, new Date().toISOString().slice( 0, 10 ) ]
		.filter( Boolean ).join( ' · ' );
	clone.prepend( title, desc, bg );
	return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString( clone );
}

module.exports = { draw, CATEGORIES };
