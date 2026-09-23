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
 * En 2D los rótulos chocan y nunca se traslapan: cada uno ocupa su caja de
 * tinta (el alto y ancho reales de las letras) más un margen PAD igual por
 * los cuatro lados, y las cajas que se tocan se separan (separate()).
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
/** Margen de la caja de cada rótulo en 2D: igual por los cuatro lados. */
const PAD = 3;

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
 * @param {Object} [forces] fuerza de cada grado de proximidad (0–1)
 */
function layout( nodes, links, themeOf, dims, forces ) {
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
			// Cada grado de proximidad atrae con su propia fuerza (0–1).
			const force = d * Math.log2( 1 + l.weight ) / k * forceOf( forces, l.kind );
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
 * Caja de tinta de cada rótulo, medida en un canvas con la tipografía real:
 * mitad del ancho y del alto (margen incluido) y el desplazamiento que
 * centra la tinta en el punto del nodo (texto anclado al centro y a la
 * línea de base).
 *
 * @param {Array} nodes
 * @param {Map<number,SVGTextElement>} nodeEls
 * @param {Function} size
 * @return {Map<number,Object>} id → {w, h, ox, oy} a zoom 1
 */
function inkBoxes( nodes, nodeEls, size ) {
	const ctx = document.createElement( 'canvas' ).getContext( '2d' );
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	const boxes = new Map();
	nodes.forEach( ( node ) => {
		const style = getComputedStyle( nodeEls.get( node.id ) );
		ctx.font = `${ style.fontStyle } ${ style.fontWeight } ${ size( node ) }px ${ style.fontFamily }`;
		const m = ctx.measureText( node.label );
		boxes.set( node.id, {
			w: ( m.actualBoundingBoxLeft + m.actualBoundingBoxRight ) / 2 + PAD,
			h: ( m.actualBoundingBoxAscent + m.actualBoundingBoxDescent ) / 2 + PAD,
			ox: ( m.actualBoundingBoxLeft - m.actualBoundingBoxRight ) / 2,
			oy: ( m.actualBoundingBoxAscent - m.actualBoundingBoxDescent ) / 2
		} );
	} );
	return boxes;
}

/**
 * Separa las cajas que se traslapan: cada par se aparta, mitad y mitad, por
 * el eje donde se pisan menos. Si en una zona densa los empujones no bastan,
 * se abre todo el mapa un poco (alejar puntos nunca crea choques nuevos) y se
 * vuelve a intentar, hasta que ninguna caja toque a otra.
 *
 * @param {Array} nodes (mutan x, y)
 * @param {Map<number,Object>} boxes de inkBoxes()
 */
function separate( nodes, boxes ) {
	const n = nodes.length;
	// Sin dirección (mismo punto): una fija según el orden, así el mapa cae
	// igual cada vez.
	const sign = ( d, i, j ) => d > 0 || ( d === 0 && ( i + j ) % 2 === 0 ) ? 1 : -1;
	const pass = () => {
		let moved = false;
		for ( let i = 0; i < n; i++ ) {
			const a = nodes[ i ];
			const ba = boxes.get( a.id );
			for ( let j = i + 1; j < n; j++ ) {
				const b = nodes[ j ];
				const bb = boxes.get( b.id );
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const overX = ba.w + bb.w - Math.abs( dx );
				const overY = ba.h + bb.h - Math.abs( dy );
				if ( overX <= 0 || overY <= 0 ) {
					continue;
				}
				moved = true;
				if ( overX < overY ) {
					const push = ( overX / 2 + 0.01 ) * sign( dx, i, j );
					a.x -= push;
					b.x += push;
				} else {
					const push = ( overY / 2 + 0.01 ) * sign( dy, i, j );
					a.y -= push;
					b.y += push;
				}
			}
		}
		return moved;
	};
	for ( let round = 0; round < 100; round++ ) {
		for ( let it = 0; it < 60; it++ ) {
			if ( !pass() ) {
				return;
			}
		}
		for ( const node of nodes ) {
			node.x *= 1.15;
			node.y *= 1.15;
		}
	}
}

/**
 * Fuerza por omisión de cada grado de proximidad: la misma sección es una
 * decisión explícita del lector; el traslape, un cruce entre lectores; el
 * mismo texto (página), la relación más débil.
 */
// Claves = clases de arista de la API (snake_case).
// eslint-disable-next-line camelcase
const FORCES = { co_excerpt: 1, overlap: 0.6, co_page: 0.35 };

/**
 * Transparencia base de cada grado: las aristas son continuas y se
 * distinguen sólo por su opacidad, que además crece con la fuerza.
 */
// Claves = clases de arista de la API (snake_case).
// eslint-disable-next-line camelcase
const OPACITY = { co_excerpt: 0.85, overlap: 0.6, co_page: 0.4 };

function forceOf( forces, kind ) {
	const f = forces && forces[ kind ];
	return typeof f === 'number' ? f : ( FORCES[ kind ] !== undefined ? FORCES[ kind ] : 1 );
}

/**
 * Dibuja el grafo.
 *
 * @param {HTMLElement} container
 * @param {Object} data {nodes, links}
 * @param {Object} view {mode: '3d'|'2d', threshold, edges, autorotate, fill,
 *  forces: {co_excerpt, overlap, co_page} (0–1; 0 = sin arista ni atracción),
 *  themeOf: Map, onSelect}
 * @return {Object} controles: zoomIn, zoomOut, reset, select, setAutorotate, destroy
 */
function draw( container, data, view ) {
	container.textContent = '';
	const nodes = data.nodes;
	const links = data.links.filter( ( l ) => l.weight >= view.threshold &&
		forceOf( view.forces, l.kind ) > 0 );
	const is3d = view.mode !== '2d';
	nodes.forEach( ( node ) => {
		if ( !is3d ) {
			node.z = 0;
		}
	} );
	layout( nodes, links, view.themeOf, is3d ? 3 : 2, view.forces );

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

	// Lienzo: 8:5 fijo, o (view.fill) del tamaño de la celda que lo contiene.
	// La escala (unidades por píxel) se fija al primer dibujo, con el ancho
	// lógico de siempre: si la celda crece, se gana espacio alrededor, no
	// letras más grandes.
	const measured = view.fill && container.clientWidth && container.clientHeight;
	const unit = measured ? WIDTH / container.clientWidth : 1;
	let W = WIDTH;
	let H = measured ? container.clientHeight * unit : HEIGHT;
	const viewBox = () => `${ -W / 2 } ${ -H / 2 } ${ W } ${ H }`;

	const size = sizer( nodes );
	const root = svg( 'svg', {
		class: 'constel-graph' + ( is3d ? ' constel-graph--3d' : '' ) +
			( view.fill ? ' constel-graph--fill' : '' ),
		viewBox: viewBox(),
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
			// Continua y traslúcida: la opacidad dice el grado y su fuerza.
			const opacity = ( OPACITY[ l.kind ] || 0.6 ) *
				( 0.4 + 0.6 * forceOf( view.forces, l.kind ) );
			line.style.setProperty( '--constel-link-opacity', opacity.toFixed( 2 ) );
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
			// En 2D la línea de base es la alfabética y la tinta se centra
			// con el desplazamiento medido (inkBoxes).
			'dominant-baseline': is3d ? 'middle' : 'alphabetic',
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

	// 2D: rótulos sin traslapes, centrados y encuadrados en el lienzo.
	let boxes = null;
	let fit = 1;
	const settle = () => {
		boxes = inkBoxes( nodes, nodeEls, size );
		separate( nodes, boxes );
		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;
		for ( const node of nodes ) {
			const b = boxes.get( node.id );
			minX = Math.min( minX, node.x - b.w );
			maxX = Math.max( maxX, node.x + b.w );
			minY = Math.min( minY, node.y - b.h );
			maxY = Math.max( maxY, node.y + b.h );
		}
		const midX = ( minX + maxX ) / 2;
		const midY = ( minY + maxY ) / 2;
		for ( const node of nodes ) {
			node.x -= midX;
			node.y -= midY;
		}
		// El zoom escala posiciones y letras por igual: no reabre traslapes.
		fit = Math.min( 1, 0.96 * W / Math.max( 1, maxX - minX ),
			0.96 * H / Math.max( 1, maxY - minY ) );
	};
	if ( !is3d && nodes.length ) {
		settle();
		zoom = fit;
	}

	// Centro del mapa: el origen, o el concepto seleccionado. La rotación y
	// la perspectiva se calculan relativas a él, así el concepto elegido
	// queda al medio y «Girar solo» orbita a su alrededor. Se desliza hacia
	// su destino (salvo con prefers-reduced-motion, que salta).
	const center = { x: 0, y: 0, z: 0 };
	const target = { x: 0, y: 0, z: 0 };
	const settling = () => Math.abs( target.x - center.x ) + Math.abs( target.y - center.y ) +
		Math.abs( target.z - center.z ) > 0.5;

	function render() {
		const cy = Math.cos( yaw );
		const sy = Math.sin( yaw );
		const cp = Math.cos( pitch );
		const sp = Math.sin( pitch );
		for ( const node of nodes ) {
			const nx = node.x - center.x;
			const ny = node.y - center.y;
			const nz = node.z - center.z;
			const x1 = nx * cy + nz * sy;
			const z1 = -nx * sy + nz * cy;
			const y2 = ny * cp - z1 * sp;
			const z2 = ny * sp + z1 * cp;
			const scale = ( is3d ? CAMERA / ( CAMERA - z2 ) : 1 ) * zoom;
			node.px = x1 * scale;
			node.py = y2 * scale;
			node.depth = z2;
			const el = nodeEls.get( node.id );
			const box = boxes && boxes.get( node.id );
			el.setAttribute( 'x', ( node.px + ( box ? box.ox * zoom : 0 ) ).toFixed( 1 ) );
			el.setAttribute( 'y', ( node.py + ( box ? box.oy * zoom : 0 ) ).toFixed( 1 ) );
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
		if ( !document.contains( root ) ) {
			return;
		}
		let again = false;
		if ( settling() ) {
			// Desliza el centro hacia el concepto elegido (o de vuelta al origen).
			center.x += ( target.x - center.x ) * 0.12;
			center.y += ( target.y - center.y ) * 0.12;
			center.z += ( target.z - center.z ) * 0.12;
			if ( !settling() ) {
				Object.assign( center, target );
			}
			again = true;
		}
		const idle = !hovering && !dragging;
		if ( is3d && autorotate && !reduce && idle ) {
			yaw += 0.0025;
			again = true;
		}
		render();
		if ( again ) {
			frame = requestAnimationFrame( tick );
		}
	}
	const resume = () => {
		if ( !frame ) {
			frame = requestAnimationFrame( tick );
		}
	};
	// Lleva el centro del mapa al concepto (o, con null, al origen).
	const aim = ( node ) => {
		target.x = node ? node.x : 0;
		target.y = node ? node.y : 0;
		target.z = node ? node.z : 0;
		if ( reduce ) {
			Object.assign( center, target );
			render();
		} else {
			resume();
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
			const s = W / root.clientWidth;
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
	// La celda cambia de tamaño (ventana, panel): el lienzo la sigue. Sin
	// ResizeObserver, queda con la proporción del primer dibujo.
	// eslint-disable-next-line compat/compat
	const resize = measured && window.ResizeObserver ? new ResizeObserver( () => {
		if ( container.clientWidth && container.clientHeight ) {
			W = container.clientWidth * unit;
			H = container.clientHeight * unit;
			root.setAttribute( 'viewBox', viewBox() );
		}
	} ) : null;
	if ( resize ) {
		resize.observe( container );
	}
	// Si la tipografía web aún no cargaba, las cajas se midieron con la de
	// respaldo: medir de nuevo cuando llegue.
	if ( !is3d && nodes.length && document.fonts && document.fonts.status !== 'loaded' ) {
		document.fonts.ready.then( () => {
			if ( document.contains( root ) ) {
				settle();
				zoom = fit;
				render();
			}
		} );
	}

	return {
		zoomIn: () => setZoom( 1.25 ),
		zoomOut: () => setZoom( 1 / 1.25 ),
		reset: () => {
			yaw = is3d ? 0.6 : 0;
			pitch = is3d ? -0.35 : 0;
			zoom = is3d ? 1 : fit;
			pan = { x: 0, y: 0 };
			stage.removeAttribute( 'transform' );
			// Encuadrar todo: el centro vuelve al origen del mapa.
			aim( null );
			render();
		},
		// El concepto elegido pasa a ser el foco y el centro del mapa.
		select: ( id ) => {
			nodeEls.forEach( ( el, nid ) => el.classList.toggle( 'constel-graph__node--selected', nid === id ) );
			pan = { x: 0, y: 0 };
			stage.removeAttribute( 'transform' );
			aim( byId.get( id ) || null );
		},
		exportSvg: ( meta ) => serialize( root, container, meta ),
		setAutorotate: ( on ) => {
			autorotate = on;
			resume();
		},
		destroy: () => {
			if ( resize ) {
				resize.disconnect();
			}
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

module.exports = { draw, CATEGORIES, FORCES };
