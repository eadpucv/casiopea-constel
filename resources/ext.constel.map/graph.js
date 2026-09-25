/**
 * El grafo de conceptos, en 2D (default) o 3D, dibujado en SVG sin
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
 * Además, en 2D cada concepto se puede arrastrar (o mover con Alt+flechas)
 * con la simulación en vivo: sus aristas tiran de los vecinos y las cajas
 * chocan y se empujan mientras se mueve. Queda fijado donde se suelta
 * (node.pin) y el layout lo respeta al recalcularse, hasta volver al orden
 * automático.
 *
 * Navegación y letra, homologadas con el mapa de vera: la letra se acota en
 * pantalla (FONT_MIN_PX–FONT_MAX_PX) y al acercar crece más lento que el
 * mapa; arrastrar el fondo desplaza (2D) u orbita (3D), la rueda acerca
 * hacia el cursor, el trackpad desplaza y el pellizco acerca. Nada de eso
 * selecciona texto.
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
/** Gravedad al centro del layout (ver layout()). */
const GRAVITY = 1.5;
/** 2D: largo ideal de una arista, en anchos medios de rótulo. */
const EDGE_IN_LABELS = 1.3;
/** Margen de la caja de cada rótulo en 2D: igual por los cuatro lados. */
const PAD = 3;
/**
 * Arranque tibio del layout (al mover una fuerza): temperatura inicial, en
 * múltiplos de k (la de frío es 2), y pasos (los de frío, 300). Basta para
 * reacomodar un cambio chico sin reordenar el mapa, y cuesta poco como para
 * rehacerlo a cada cuadro mientras se arrastra el control.
 */
const WARM_TEMPERATURE = 0.2;
const WARM_STEPS = 120;
/** Fracción del camino que recorre cada cuadro al deslizarse a su lugar nuevo. */
const GLIDE = 0.25;
/**
 * Cuánto mide una letra en pantalla, pase lo que pase con el zoom (px).
 * Como el mapa de vera: por debajo del suelo un rótulo es una mancha y por
 * encima del techo tapa a sus vecinos. Vera usa 11–31 con una sola letra de
 * mundo; aquí la frecuencia ya reparte 11–31 a zoom 1, así que el techo sube
 * para que acercar no aplane esa jerarquía de golpe.
 */
const FONT_MIN_PX = 11;
const FONT_MAX_PX = 40;
/**
 * Con qué exponente sigue la letra al zoom al acercar: acercar separa más de
 * lo que agranda (×4 de zoom, ×2 de letra), y nada se vuelve a pisar.
 */
const FONT_GROWTH = 0.5;
/** Temblor tolerado antes de que pulsar sea arrastrar (px), como en vera. */
const TAP_SLOP = 6;
/** Techo del zoom (el suelo depende del encuadre, ver draw()). */
const ZOOM_MAX = 8;

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
 * @param {number} [unit] 2D: a cuánto equivale el largo ideal de una arista
 *  (en unidades del lienzo). Sin él, el mapa se normaliza a una esfera de
 *  radio RADIUS; con él, la escala no depende de las fuerzas y bajar una
 *  fuerza abre de verdad a sus conceptos respecto de sus rótulos.
 * @param {boolean} [warm] arranque tibio: se parte del equilibrio anterior
 *  (en 3D, el de antes de normalizar: node.lx, ly, lz) con poca temperatura
 *  y menos pasos (WARM_*), así un cambio chico de fuerzas mueve poco el mapa
 *  y se puede recalcular mientras se arrastra un control.
 */
function layout( nodes, links, themeOf, dims, forces, unit, warm ) {
	const byId = new Map( nodes.map( ( node ) => [ node.id, node ] ) );
	const n = nodes.length;
	const k = Math.sqrt( ( 600 * 600 ) / Math.max( 1, n ) );
	const scale = dims === 2 && unit ? unit / k : 0;
	nodes.forEach( ( node, i ) => {
		if ( warm && dims === 3 && node.lx !== undefined ) {
			node.x = node.lx;
			node.y = node.ly;
			node.z = node.lz;
		} else if ( node.x !== undefined && scale ) {
			// Semilla: la posición anterior, de vuelta a unidades del layout.
			node.x /= scale;
			node.y /= scale;
		}
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
			if ( node.pin ) {
				node.x = node.pin.x / ( scale || 1 );
				node.y = node.pin.y / ( scale || 1 );
			}
		}
	} );
	// En 2D, los fijados a mano no se mueven: el resto se acomoda a ellos.
	const held = ( node ) => dims === 2 && !!node.pin;
	let temperature = k * ( warm ? WARM_TEMPERATURE : 2 );
	const steps = warm ? WARM_STEPS : 300;
	for ( let it = 0; it < steps; it++ ) {
		for ( const a of nodes ) {
			// Gravedad al centro: con la repulsión k²/d, el mapa ocupa un
			// área del orden de n·k² (la de Fruchterman-Reingold).
			a.dx = -a.x * GRAVITY;
			a.dy = -a.y * GRAVITY;
			a.dz = -a.z * GRAVITY;
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
			// Resorte de Fruchterman-Reingold (d²/k frente a la repulsión k²/d):
			// cada grado de proximidad atrae con su propia fuerza (0–1), así
			// que bajarla abre de verdad a sus conceptos.
			const force = d * d * Math.log2( 1 + l.weight ) / k * forceOf( forces, l.kind );
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
			if ( held( node ) ) {
				continue;
			}
			const d = Math.max( 0.01, Math.hypot( node.dx, node.dy, node.dz ) );
			const step = Math.min( d, temperature ) / d;
			node.x += node.dx * step;
			node.y += node.dy * step;
			node.z = dims === 2 ? 0 : node.z + node.dz * step;
		}
		temperature *= 0.97;
	}
	if ( scale ) {
		// 2D: escala fija (el centrado y el encuadre los hace draw()).
		for ( const node of nodes ) {
			node.x *= scale;
			node.y *= scale;
		}
		return;
	}
	// El equilibrio en bruto: semilla del próximo arranque tibio en 3D.
	for ( const node of nodes ) {
		node.lx = node.x;
		node.ly = node.y;
		node.lz = node.z;
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
 * @return {Map<number,Object>} id → {s, w, h, ox, oy} a zoom 1 (s: la letra
 *  con que se midió; el desplazamiento de la tinta es proporcional a ella)
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
			s: size( node ),
			w: ( m.actualBoundingBoxLeft + m.actualBoundingBoxRight ) / 2 + PAD,
			h: ( m.actualBoundingBoxAscent + m.actualBoundingBoxDescent ) / 2 + PAD,
			ox: ( m.actualBoundingBoxLeft - m.actualBoundingBoxRight ) / 2,
			oy: ( m.actualBoundingBoxAscent - m.actualBoundingBoxDescent ) / 2
		} );
	} );
	return boxes;
}

/**
 * Una pasada de choques entre cajas: cada par que se pisa se aparta por el
 * eje donde se pisa menos, en la fracción `k` del traslape. Un concepto fijo
 * (node.pin, o `hold`, el que se arrastra) no se aparta: el otro se mueve
 * entero; `hold` tiene prioridad incluso sobre otro fijado.
 *
 * @param {Array} nodes (mutan x, y)
 * @param {Map<number,Object>} boxes de inkBoxes()
 * @param {Object|null} hold
 * @param {number} k 1 = separar del todo; menos, un empujón blando
 * @return {boolean} si alguna caja se movió
 */
function collide( nodes, boxes, hold, k ) {
	const n = nodes.length;
	// Sin dirección (mismo punto): una fija según el orden, así el mapa cae
	// igual cada vez.
	const sign = ( d, i, j ) => d > 0 || ( d === 0 && ( i + j ) % 2 === 0 ) ? 1 : -1;
	// Cuánto le toca moverse a cada uno del par (suman 1).
	const share = ( a, b ) => {
		const ma = a === hold ? 0 : a.pin ? 0.1 : 1;
		const mb = b === hold ? 0 : b.pin ? 0.1 : 1;
		return ma + mb ? [ ma / ( ma + mb ), mb / ( ma + mb ) ] : [ 0.5, 0.5 ];
	};
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
			const [ sa, sb ] = share( a, b );
			if ( overX < overY ) {
				const push = ( overX + 0.02 ) * k * sign( dx, i, j );
				a.x -= push * sa;
				b.x += push * sb;
			} else {
				const push = ( overY + 0.02 ) * k * sign( dy, i, j );
				a.y -= push * sa;
				b.y += push * sb;
			}
		}
	}
	return moved;
}

/**
 * Separa las cajas que se traslapan (collide() hasta que no quede choque).
 * Si en una zona densa los empujones no bastan, se abre todo el mapa un poco
 * (alejar puntos nunca crea choques nuevos) y se vuelve a intentar, hasta que
 * ninguna caja toque a otra.
 *
 * @param {Array} nodes (mutan x, y)
 * @param {Map<number,Object>} boxes de inkBoxes()
 * @param {Object} [hold] nodo que no se mueve
 */
function separate( nodes, boxes, hold ) {
	for ( let round = 0; round < 100; round++ ) {
		for ( let it = 0; it < 60; it++ ) {
			if ( !collide( nodes, boxes, hold || null, 1 ) ) {
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

/** Flechas del teclado → dirección (x, y). */
const ARROWS = {
	ArrowLeft: [ -1, 0 ], ArrowRight: [ 1, 0 ], ArrowUp: [ 0, -1 ], ArrowDown: [ 0, 1 ]
};

function forceOf( forces, kind ) {
	const f = forces && forces[ kind ];
	return typeof f === 'number' ? f : ( FORCES[ kind ] !== undefined ? FORCES[ kind ] : 1 );
}

/**
 * Dibuja el grafo.
 *
 * @param {HTMLElement} container
 * @param {Object} data {nodes, links}
 * @param {Object} view {mode: '3d'|'2d', edges, autorotate, fill,
 *  forces: {co_excerpt, overlap, co_page} (0–1; 0 = sin arista ni atracción),
 *  themeOf: Map, onSelect}
 * @return {Object} controles: zoomIn, zoomOut, reset, select, setForces,
 *  setAutorotate, destroy
 */
function draw( container, data, view ) {
	container.textContent = '';
	const nodes = data.nodes;
	// Las aristas que atraen: las de un grado con fuerza (setForces las rehace).
	const active = () => data.links.filter( ( l ) => forceOf( view.forces, l.kind ) > 0 );
	let links = active();
	const is3d = view.mode !== '2d';
	nodes.forEach( ( node ) => {
		if ( !is3d ) {
			node.z = 0;
		}
	} );
	if ( is3d ) {
		layout( nodes, links, view.themeOf, 3, view.forces );
	}

	// ── Cámara ────────────────────────────────────────────────────────────
	const reduce = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
	let yaw = is3d ? 0.6 : 0;
	let pitch = is3d ? -0.35 : 0;
	let zoom = 1;
	let hovering = false;
	// Píxeles de pantalla por unidad del lienzo (getScreenCTM): la letra se
	// acota en pantalla y los arrastres se convierten con él.
	let ppu = 1;
	// Punteros sobre el lienzo (fuera de un concepto que se arrastra): uno
	// desplaza u orbita, dos pellizcan.
	const pointers = new Map();
	// Tras un arrastre del mapa, el clic que llega al soltar no elige.
	let swallowUntil = 0;
	// 2D: el concepto que se arrastra, y el recién soltado (su clic no elige).
	let grab = null;
	let moved = null;
	let frame = null;
	let lastSort = 0;
	let autorotate = !!view.autorotate;
	// Fuerzas en vivo (setForces): si los conceptos se deslizan a su lugar
	// nuevo, a qué zoom (null: el de quien mira) y el concepto elegido.
	let gliding = false;
	let zoomGoal = null;
	let selected = null;

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
		// Todas las aristas se crean; las de un grado en 0 quedan fuera del
		// lienzo (styleLinks), así una fuerza puede volver sin redibujar.
		data.links.forEach( ( l ) => {
			// Clases: constel-graph__link--co_excerpt, --overlap, --co_page
			const line = svg( 'line', {
				class: 'constel-graph__link constel-graph__link--' + l.kind,
				'stroke-width': l.kind === 'co_page' ?
					1 :
					Math.min( 5, 1 + Math.log2( 1 + l.weight ) ),
				'vector-effect': 'non-scaling-stroke'
			} );
			linkEls.push( {
				el: line, kind: l.kind, a: byId.get( l.source ), b: byId.get( l.target )
			} );
		} );
	}
	// Vecinos, visibilidad y opacidad de cada arista, según las fuerzas.
	const styleLinks = () => {
		neighbours.forEach( ( set ) => set.clear() );
		for ( const l of linkEls ) {
			const force = forceOf( view.forces, l.kind );
			if ( force <= 0 ) {
				l.el.remove();
				continue;
			}
			neighbours.get( l.a.id ).add( l.b.id );
			neighbours.get( l.b.id ).add( l.a.id );
			// Continua y traslúcida: la opacidad dice el grado y su fuerza.
			const opacity = ( OPACITY[ l.kind ] || 0.6 ) * ( 0.4 + 0.6 * force );
			l.el.style.setProperty( '--constel-link-opacity', opacity.toFixed( 2 ) );
			if ( !l.el.parentNode ) {
				linkLayer.appendChild( l.el );
			}
		}
	};
	styleLinks();
	stage.appendChild( linkLayer );

	const nodeLayer = svg( 'g', { class: 'constel-graph__nodes' } );
	const nodeEls = new Map();
	nodes.forEach( ( node ) => {
		const theme = view.themeOf.get( node.id );
		const classes = [ 'constel-graph__node' ];
		if ( node.mine ) {
			classes.push( 'constel-graph__node--mine' );
		}
		if ( !is3d && node.pin ) {
			classes.push( 'constel-graph__node--pinned' );
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
		text.addEventListener( 'click', ( e ) => {
			// Soltar después de arrastrar (el concepto, o el mapa) no es elegir.
			if ( moved === node || performance.now() < swallowUntil ) {
				moved = null;
				e.stopPropagation();
				return;
			}
			activate();
		} );
		text.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' || e.key === ' ' ) {
				e.preventDefault();
				activate();
			} else if ( !is3d && e.altKey && ARROWS[ e.key ] ) {
				// Alternativa de teclado al arrastre (WCAG 2.5.7): el mismo
				// empujón, con la simulación reaccionando.
				e.preventDefault();
				hold( node );
				node.x += ARROWS[ e.key ][ 0 ] * 12 / zoom;
				node.y += ARROWS[ e.key ][ 1 ] * 12 / zoom;
				release( node );
			}
		} );
		if ( !is3d ) {
			text.addEventListener( 'pointerdown', ( e ) => {
				// Con otro dedo ya en el lienzo, esto es parte de un pellizco.
				if ( e.button !== 0 || pointers.size ) {
					return;
				}
				e.preventDefault();
				grab = { node, x: e.clientX, y: e.clientY, nx: node.x, ny: node.y, far: false };
				text.setPointerCapture( e.pointerId );
			} );
			text.addEventListener( 'pointermove', ( e ) => {
				if ( !grab || grab.node !== node ) {
					return;
				}
				const s = 1 / ( ppu * zoom );
				const dx = ( e.clientX - grab.x ) * s;
				const dy = ( e.clientY - grab.y ) * s;
				const far = Math.hypot( e.clientX - grab.x, e.clientY - grab.y );
				if ( !grab.far && far < TAP_SLOP ) {
					return;
				}
				if ( !grab.far ) {
					grab.far = true;
					root.classList.add( 'constel-graph--dragging' );
					hold( node );
				}
				node.x = grab.nx + dx;
				node.y = grab.ny + dy;
				if ( reduce ) {
					render();
				} else {
					resume();
				}
			} );
			const letGo = () => {
				if ( !grab || grab.node !== node ) {
					return;
				}
				root.classList.remove( 'constel-graph--dragging' );
				if ( grab.far ) {
					moved = node;
					release( node );
				}
				grab = null;
			};
			text.addEventListener( 'pointerup', letGo );
			text.addEventListener( 'pointercancel', letGo );
		}
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
	const measurePpu = () => {
		const m = root.getScreenCTM();
		if ( m && m.a > 0 ) {
			ppu = m.a;
		}
	};
	measurePpu();

	// 2D: el layout se hace a la escala de los rótulos (ya medibles en la
	// página): una arista ideal mide EDGE_IN_LABELS anchos medios de rótulo.
	let edgeLength = 0;
	if ( !is3d && nodes.length ) {
		const measured0 = inkBoxes( nodes, nodeEls, size );
		let wide = 0;
		measured0.forEach( ( b ) => {
			wide += 2 * b.w;
		} );
		edgeLength = EDGE_IN_LABELS * wide / measured0.size;
		layout( nodes, links, view.themeOf, 2, view.forces, edgeLength );
	}

	// 2D: rótulos sin traslapes, centrados y encuadrados en el lienzo.
	let boxes = null;
	// Zoom del encuadre: desde él la letra crece más lento que el mapa (grow).
	let fit = 1;
	// Centra el mapa en el origen y dice qué zoom lo encuadra con estas cajas.
	const frameAll = () => {
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
			// Los fijados siguen en su lugar relativo, en el marco nuevo.
			if ( node.pin ) {
				node.pin = { x: node.x, y: node.y };
			}
		}
		return Math.min( 1, 0.96 * W / Math.max( 1, maxX - minX ),
			0.96 * H / Math.max( 1, maxY - minY ) );
	};
	// Las cajas se separan al tamaño con que se dibujarán en el encuadre: si
	// a ese zoom una letra cae bajo el suelo (FONT_MIN_PX), se dibuja en el
	// suelo, y su caja se reserva de ese tamaño. Se repite hasta que el
	// encuadre no cambie (o unas pocas veces; entonces se parte del zoom para
	// el que se reservó, y el mapa puede desbordar un poco el lienzo). A ese
	// zoom o más, ningún rótulo pisa a otro (LabelsNeverOverlapIn2D).
	const settle = () => {
		measurePpu();
		// Letra reservada: la natural, o el suelo al zoom del encuadre anterior.
		const reservedSize = ( floor ) => ( n ) => Math.max( size( n ), floor );
		let reserved = 0;
		let used = 0;
		let z = 1;
		for ( let pass = 0; pass < 4; pass++ ) {
			used = reserved;
			const at = reservedSize( used );
			boxes = inkBoxes( nodes, nodeEls, at );
			separate( nodes, boxes );
			z = frameAll();
			const need = FONT_MIN_PX / ( ppu * z );
			if ( nodes.every( ( n ) => at( n ) >= need - 1e-6 ) ) {
				fit = z;
				return;
			}
			reserved = need;
		}
		// Sin punto fijo: el zoom para el que se reservó la última vez.
		fit = Math.max( z, FONT_MIN_PX / ( ppu * used ) );
	};
	if ( !is3d && nodes.length ) {
		settle();
		zoom = fit;
	}
	// Cuánto escala la letra al zoom z: hasta el encuadre, igual que el mapa
	// (no reabre traslapes); más cerca, más lento (FONT_GROWTH).
	const grow = ( z ) => z <= fit ? z : fit * Math.pow( z / fit, FONT_GROWTH );
	// Letra de un rótulo (en unidades del lienzo), acotada en pantalla.
	const fontUnits = ( s ) => Math.min( FONT_MAX_PX,
		Math.max( FONT_MIN_PX, s * grow( zoom ) * ppu ) ) / ppu;

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
			const persp = is3d ? CAMERA / ( CAMERA - z2 ) : 1;
			node.px = x1 * persp * zoom;
			node.py = y2 * persp * zoom;
			node.depth = z2;
			const el = nodeEls.get( node.id );
			const box = boxes && boxes.get( node.id );
			const font = fontUnits( size( node ) * persp );
			// La tinta se centra con el desplazamiento medido, a esta letra.
			const ink = box ? font / box.s : 0;
			el.setAttribute( 'x', ( node.px + ( box ? box.ox * ink : 0 ) ).toFixed( 1 ) );
			el.setAttribute( 'y', ( node.py + ( box ? box.oy * ink : 0 ) ).toFixed( 1 ) );
			el.setAttribute( 'font-size', font.toFixed( 2 ) );
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
		if ( gliding ) {
			glide();
			again = again || gliding;
		}
		if ( !is3d && boxes && warm() ) {
			if ( reduce ) {
				render();
			} else {
				simStep();
				again = warm();
			}
		}
		const idle = !hovering && !pointers.size;
		if ( is3d && autorotate && !reduce && idle ) {
			yaw += 0.0025;
			again = true;
		}
		render();
		if ( again ) {
			frame = requestAnimationFrame( tick );
		}
	}
	function resume() {
		if ( !frame ) {
			frame = requestAnimationFrame( tick );
		}
	}
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

	// ── 2D: simulación en vivo ────────────────────────────────────────────
	// Al tomar un concepto el layout se recalienta (como d3-force): cada
	// arista es un resorte con el largo que tenía al empezar y la fuerza de
	// su grado, las cajas chocan y se empujan, y cada concepto tiende
	// suavemente a su lugar de partida para que el mapa no se vaya entero
	// detrás del puntero. El que se arrastra y los ya fijados no se mueven
	// por la simulación. Al soltar, el arrastrado queda fijado (node.pin) y
	// el resto se enfría donde quedó.
	const sim = { alpha: 0, target: 0, held: null, last: null, springs: [] };
	const DECAY = 0.03;
	// Tendencia de cada concepto a su lugar de partida.
	const ANCHOR = 0.01;
	function warm() {
		return sim.alpha > 0.004 || sim.target > 0;
	}
	const still = ( n ) => n === sim.held || !!n.pin;
	function heatUp() {
		if ( warm() ) {
			return;
		}
		// En frío: los lugares de partida y los largos de reposo son los de ahora.
		// Cuántos vecinos distintos tiene cada uno (un par puede tener hasta
		// tres aristas, una por grado): los muy conectados se reparten el tirón.
		const near = new Map( nodes.map( ( n ) => [ n.id, new Set() ] ) );
		links.forEach( ( l ) => {
			near.get( l.source ).add( l.target );
			near.get( l.target ).add( l.source );
		} );
		const count = new Map( [ ...near ].map( ( [ id, set ] ) => [ id, set.size ] ) );
		sim.springs = links.map( ( l ) => {
			const a = byId.get( l.source );
			const b = byId.get( l.target );
			const ca = count.get( l.source );
			const cb = count.get( l.target );
			return {
				a,
				b,
				rest: Math.hypot( b.x - a.x, b.y - a.y ),
				k: forceOf( view.forces, l.kind ) / Math.min( ca, cb ),
				bias: ca / ( ca + cb )
			};
		} );
		for ( const n of nodes ) {
			n.hx = n.x;
			n.hy = n.y;
			n.vx = 0;
			n.vy = 0;
		}
	}
	function simStep() {
		sim.alpha += ( sim.target - sim.alpha ) * DECAY;
		const alpha = sim.alpha;
		for ( const s of sim.springs ) {
			let dx = s.b.x + s.b.vx - s.a.x - s.a.vx;
			let dy = s.b.y + s.b.vy - s.a.y - s.a.vy;
			const l = Math.hypot( dx, dy ) || 0.01;
			const f = ( l - s.rest ) / l * alpha * s.k;
			dx *= f;
			dy *= f;
			s.b.vx -= dx * s.bias;
			s.b.vy -= dy * s.bias;
			s.a.vx += dx * ( 1 - s.bias );
			s.a.vy += dy * ( 1 - s.bias );
		}
		for ( const n of nodes ) {
			if ( still( n ) ) {
				n.vx = 0;
				n.vy = 0;
				continue;
			}
			n.vx = ( n.vx + ( n.hx - n.x ) * ANCHOR * alpha ) * 0.6;
			n.vy = ( n.vy + ( n.hy - n.y ) * ANCHOR * alpha ) * 0.6;
			n.x += n.vx;
			n.y += n.vy;
		}
		// Choques en vivo, blandos (el arrastrado empuja, nunca cede).
		collide( nodes, boxes, sim.held || sim.last, 0.5 );
		if ( !warm() ) {
			cool();
		}
	}
	// Enfriado: ninguna caja queda pisando a otra (LabelsNeverOverlapIn2D) y
	// los fijados guardan su lugar en este marco.
	function cool() {
		sim.alpha = 0;
		separate( nodes, boxes, sim.last );
		for ( const n of nodes ) {
			if ( n.pin ) {
				n.pin = { x: n.x, y: n.y };
			}
		}
		render();
		if ( view.onArrange ) {
			view.onArrange();
		}
	}
	function hold( node ) {
		if ( gliding ) {
			land();
		}
		heatUp();
		sim.held = node;
		sim.target = 0.3;
		sim.alpha = Math.max( sim.alpha, 0.3 );
	}
	function release( node ) {
		node.pin = { x: node.x, y: node.y };
		nodeEls.get( node.id ).classList.add( 'constel-graph__node--pinned' );
		sim.held = null;
		sim.last = node;
		sim.target = 0;
		if ( reduce ) {
			// Sin animación: la simulación corre de una vez.
			while ( warm() ) {
				simStep();
			}
		} else {
			resume();
		}
	}

	// ── Navegación, como el mapa de vera ──────────────────────────────────
	// Arrastrar el fondo desplaza (2D) u orbita (3D; con Shift o el botón de
	// en medio, desplaza). Dos dedos pellizcan: acercan y desplazan a la vez.
	// La rueda acerca hacia el cursor; el trackpad desplaza con dos dedos y
	// acerca con el pellizco (que llega como rueda con Ctrl). Incrustado en
	// una página (sin view.fill), la rueda sigue siendo de la página y sólo
	// Ctrl+rueda acerca. Nada de esto selecciona texto.
	let pan = { x: 0, y: 0 };
	let gesture = null;
	let pinch = null;
	let trackpad = false;
	const applyPan = () => {
		if ( pan.x || pan.y ) {
			stage.setAttribute( 'transform', `translate(${ pan.x.toFixed( 1 ) } ${ pan.y.toFixed( 1 ) })` );
		} else {
			stage.removeAttribute( 'transform' );
		}
	};
	// Un punto de la pantalla, en coordenadas del lienzo.
	const toCanvas = ( x, y ) => {
		const m = root.getScreenCTM();
		if ( !m ) {
			return { x: 0, y: 0 };
		}
		const p = root.createSVGPoint();
		p.x = x;
		p.y = y;
		return p.matrixTransform( m.inverse() );
	};
	// Acerca por `factor` dejando quieto el punto `at` del lienzo.
	const zoomAt = ( factor, at ) => {
		const next = Math.max( Math.min( 0.3, fit / 2 ), Math.min( ZOOM_MAX, zoom * factor ) );
		const f = next / zoom;
		zoom = next;
		pan = { x: at.x - ( at.x - pan.x ) * f, y: at.y - ( at.y - pan.y ) * f };
		applyPan();
		render();
	};
	const panBy = ( dx, dy ) => {
		pan = { x: pan.x + dx / ppu, y: pan.y + dy / ppu };
		applyPan();
	};
	const turn = ( dx, dy ) => {
		yaw += dx * 0.008;
		pitch = Math.max( -1.4, Math.min( 1.4, pitch + dy * 0.008 ) );
	};
	// Capturar un puntero que ya se soltó lanza: no debe cortar el gesto.
	const capture = ( id ) => {
		try {
			root.setPointerCapture( id );
		} catch ( err ) {}
	};
	const spread = () => {
		const [ a, b ] = [ ...pointers.values() ];
		return {
			d: Math.hypot( b.x - a.x, b.y - a.y ),
			x: ( a.x + b.x ) / 2,
			y: ( a.y + b.y ) / 2
		};
	};
	// Vuelve al encuadre de partida (el centro, al origen del mapa).
	function resetView() {
		yaw = is3d ? 0.6 : 0;
		pitch = is3d ? -0.35 : 0;
		zoom = is3d ? 1 : fit;
		pan = { x: 0, y: 0 };
		applyPan();
		// Encuadrar todo: el centro vuelve al origen del mapa.
		aim( null );
		render();
	}
	root.addEventListener( 'pointerdown', ( e ) => {
		// Un concepto que se arrastra (2D) se atiende en su rótulo.
		if ( grab || ( e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1 ) ) {
			return;
		}
		// Sin esto, arrastrar selecciona los rótulos como texto de la página.
		e.preventDefault();
		( e.target.closest( '[tabindex]' ) || root ).focus( { preventScroll: true } );
		pointers.set( e.pointerId, { x: e.clientX, y: e.clientY } );
		if ( pointers.size === 2 ) {
			// Dos dedos: pellizco, sin giro a medias por debajo.
			capture( e.pointerId );
			pinch = spread();
			gesture = null;
		} else if ( pointers.size === 1 ) {
			gesture = {
				move: is3d && !e.shiftKey && e.button !== 1 ? turn : panBy,
				x: e.clientX,
				y: e.clientY,
				active: false
			};
		}
	} );
	root.addEventListener( 'pointermove', ( e ) => {
		const p = pointers.get( e.pointerId );
		if ( !p ) {
			return;
		}
		const dx = e.clientX - p.x;
		const dy = e.clientY - p.y;
		p.x = e.clientX;
		p.y = e.clientY;
		if ( pinch && pointers.size >= 2 ) {
			const now = spread();
			if ( pinch.d > 0 && now.d > 0 ) {
				zoomAt( now.d / pinch.d, toCanvas( now.x, now.y ) );
			}
			// El punto medio arrastra el mapa: pellizcar y correr es un gesto.
			panBy( now.x - pinch.x, now.y - pinch.y );
			pinch = now;
			render();
			return;
		}
		if ( !gesture ) {
			return;
		}
		if ( !gesture.active ) {
			// Un pulso tiembla: hasta TAP_SLOP sigue siendo un clic.
			if ( Math.hypot( e.clientX - gesture.x, e.clientY - gesture.y ) < TAP_SLOP ) {
				return;
			}
			// La captura recién aquí: antes robaría el clic al rótulo (3D).
			gesture.active = true;
			capture( e.pointerId );
			root.classList.add( 'constel-graph--panning' );
			gesture.move( e.clientX - gesture.x, e.clientY - gesture.y );
		} else {
			gesture.move( dx, dy );
		}
		render();
	} );
	const lift = ( e ) => {
		if ( !pointers.delete( e.pointerId ) ) {
			return;
		}
		if ( gesture && gesture.active || pinch ) {
			swallowUntil = performance.now() + 250;
		}
		if ( pointers.size === 1 ) {
			// Levantar un dedo del pellizco deja al otro siguiendo, sin saltos.
			const [ q ] = pointers.values();
			pinch = null;
			gesture = { move: is3d ? turn : panBy, x: q.x, y: q.y, active: true };
			return;
		}
		pinch = pointers.size >= 2 ? spread() : null;
		if ( !pointers.size ) {
			gesture = null;
			root.classList.remove( 'constel-graph--panning' );
			resume();
		}
	};
	root.addEventListener( 'pointerup', lift );
	root.addEventListener( 'pointercancel', lift );
	root.addEventListener( 'pointerleave', () => {
		hovering = false;
		resume();
	} );
	root.addEventListener( 'pointerenter', () => {
		// Con el puntero encima se detiene la rotación: así se puede apuntar.
		hovering = true;
	} );
	root.addEventListener( 'wheel', ( e ) => {
		const pinching = e.ctrlKey || e.metaKey;
		if ( !pinching && !view.fill ) {
			return;
		}
		e.preventDefault();
		const k = e.deltaMode === 1 ? 16 : ( e.deltaMode === 2 ? root.clientHeight : 1 );
		const at = toCanvas( e.clientX, e.clientY );
		if ( pinching ) {
			// Pellizco del trackpad (o Ctrl+rueda): proporcional, sin saltos.
			zoomAt( Math.exp( -Math.max( -50, Math.min( 50, e.deltaY * k ) ) * 0.01 ), at );
			return;
		}
		// Un trackpad trae algo de horizontal o pasos fraccionarios; una rueda
		// de ratón, no. Una vez visto, se recuerda.
		if ( !trackpad && ( e.deltaX !== 0 || !Number.isInteger( e.deltaY ) ) ) {
			trackpad = true;
		}
		if ( trackpad ) {
			panBy( -e.deltaX * k, -e.deltaY * k );
			render();
		} else {
			zoomAt( e.deltaY > 0 ? 1 / 1.12 : 1.12, at );
		}
	}, { passive: false } );
	// Teclado: flechas orbitan (3D) o desplazan (2D) con el foco en el grafo;
	// + y − acercan y alejan, 0 encuadra.
	root.addEventListener( 'keydown', ( e ) => {
		if ( e.target !== root ) {
			return;
		}
		const step = ARROWS[ e.key ];
		if ( step ) {
			e.preventDefault();
			if ( is3d ) {
				turn( step[ 0 ] * 15, step[ 1 ] * 15 );
			} else {
				panBy( -step[ 0 ] * 30 * ppu, -step[ 1 ] * 30 * ppu );
			}
			render();
		} else if ( e.key === '+' || e.key === '=' || e.key === '-' ) {
			e.preventDefault();
			zoomAt( e.key === '-' ? 1 / 1.25 : 1.25, { x: 0, y: 0 } );
		} else if ( e.key === '0' ) {
			e.preventDefault();
			resetView();
		}
	} );

	render();
	resume();
	// La celda cambia de tamaño (ventana, panel): el lienzo la sigue. Sin
	// ResizeObserver, queda con la proporción del primer dibujo. La escala de
	// pantalla cambia también sin view.fill (el lienzo 8:5 sigue el ancho):
	// la letra se vuelve a acotar.
	// eslint-disable-next-line compat/compat
	const resize = window.ResizeObserver ? new ResizeObserver( () => {
		if ( measured && container.clientWidth && container.clientHeight ) {
			W = container.clientWidth * unit;
			H = container.clientHeight * unit;
			root.setAttribute( 'viewBox', viewBox() );
		}
		measurePpu();
		render();
	} ) : null;
	if ( resize ) {
		resize.observe( container );
	}
	// ── Fuerzas en vivo ───────────────────────────────────────────────────
	// Al mover una fuerza el layout se rehace tibio, desde el equilibrio
	// anterior (layout(…, warm)), sin redibujar: cada concepto se desliza a
	// su lugar nuevo (node.tx, ty, tz) y, si el mapa estaba encuadrado, el
	// zoom sigue al encuadre nuevo. Se puede llamar a cada cuadro mientras se
	// arrastra el control: el siguiente parte del destino del anterior.
	function glide() {
		let far = 0;
		for ( const n of nodes ) {
			n.x += ( n.tx - n.x ) * GLIDE;
			n.y += ( n.ty - n.y ) * GLIDE;
			n.z += ( n.tz - n.z ) * GLIDE;
			far = Math.max( far,
				Math.abs( n.tx - n.x ) + Math.abs( n.ty - n.y ) + Math.abs( n.tz - n.z ) );
		}
		if ( zoomGoal !== null ) {
			zoom += ( zoomGoal - zoom ) * GLIDE;
		}
		if ( far < 0.3 ) {
			land();
		}
	}
	// Llega de una vez al destino del deslizamiento.
	function land() {
		for ( const n of nodes ) {
			n.x = n.tx;
			n.y = n.ty;
			n.z = n.tz;
		}
		if ( zoomGoal !== null ) {
			zoom = zoomGoal;
		}
		gliding = false;
		zoomGoal = null;
	}
	function setForces( forces ) {
		if ( !document.contains( root ) ) {
			return;
		}
		view.forces = forces;
		links = active();
		styleLinks();
		if ( !nodes.length ) {
			return;
		}
		if ( sim.held ) {
			// Mientras se arrastra un concepto manda la simulación.
			return;
		}
		// Lo que se ve ahora; el layout parte del destino si aún se desliza.
		const shown = nodes.map( ( n ) => [ n.x, n.y, n.z ] );
		const seen = gliding && zoomGoal !== null ? zoomGoal : zoom;
		const framed = !is3d && Math.abs( seen - fit ) < fit * 1e-3;
		if ( gliding ) {
			land();
		}
		if ( is3d ) {
			layout( nodes, links, view.themeOf, 3, view.forces, 0, true );
		} else {
			layout( nodes, links, view.themeOf, 2, view.forces, edgeLength, true );
			settle();
		}
		nodes.forEach( ( n, i ) => {
			n.tx = n.x;
			n.ty = n.y;
			n.tz = n.z;
			[ n.x, n.y, n.z ] = shown[ i ];
		} );
		zoomGoal = framed ? fit : null;
		gliding = true;
		if ( selected ) {
			// El concepto elegido sigue al medio, en su lugar nuevo.
			target.x = selected.tx;
			target.y = selected.ty;
			target.z = selected.tz;
		}
		if ( reduce ) {
			land();
			Object.assign( center, target );
			render();
		} else {
			resume();
		}
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

	const controls = {
		zoomIn: () => zoomAt( 1.25, { x: 0, y: 0 } ),
		zoomOut: () => zoomAt( 1 / 1.25, { x: 0, y: 0 } ),
		reset: () => {
			selected = null;
			resetView();
		},
		// El concepto elegido pasa a ser el foco y el centro del mapa.
		select: ( id ) => {
			nodeEls.forEach( ( el, nid ) => el.classList.toggle( 'constel-graph__node--selected', nid === id ) );
			pan = { x: 0, y: 0 };
			applyPan();
			selected = byId.get( id ) || null;
			if ( gliding ) {
				land();
			}
			aim( selected );
		},
		setForces,
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
	return controls;
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
