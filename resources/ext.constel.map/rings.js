/**
 * Vista de anillos (spec: ConceptMap.RingsView): un concepto al centro y sus
 * vecinos en tres anillos, uno por grado de proximidad. Un vecino con varios
 * grados va al anillo del más fuerte:
 *
 *   1. misma sección (co_excerpt)
 *   2. traslape (overlap)
 *   3. mismo texto (co_page)
 *
 * Dentro de cada anillo el orden angular agrupa a los vecinos que también son
 * próximos entre sí (seriación voraz por proximidad mutua), y cada anillo
 * tiene un cupo (RING_QUOTAS) de los de mayor peso; el resto no se dibuja (se
 * llega a ellos eligiendo otro centro). Los radios son discretos. Todos los rótulos se muestran.
 * Al elegir un vecino pasa al centro deslizándose (salvo con
 * prefers-reduced-motion). Los temas de la lente colorean igual que en el mapa.
 */
const { icons, device } = require( 'ext.constel.ui' );
const SVG = 'http://www.w3.org/2000/svg';
const CATEGORIES = 8;
/** Grado de cada anillo, del más fuerte al más débil. */
const RING_KINDS = [ 'co_excerpt', 'overlap', 'co_page' ];
const RING_MESSAGES = [
	'constellation-ring-coexcerpt',
	'constellation-ring-overlap',
	'constellation-ring-copage'
];
/** Lo que dice la guía de un anillo sin vecinos ($1 es el nombre del anillo). */
const RING_EMPTY_MESSAGES = [
	'constellation-ring-empty',
	'constellation-ring-empty-overlap',
	'constellation-ring-empty'
];
/** Radios discretos de los anillos (unidades del lienzo) y su cupo. */
const RING_RADII = [ 115, 215, 315 ];
const RING_QUOTAS = [ 8, 16, 24 ];
/** Lienzo: 1000 × 800 con el centro en el origen. */
const VIEW_W = 1000;
const VIEW_H = 800;
/** Duración del deslizamiento al cambiar de centro (ms). */
const GLIDE_MS = 450;
/** Radio del círculo de un concepto: del menor al mayor, y el del centro. */
const DOT_MIN = 3;
const DOT_MAX = 8.4;
const DOT_CENTER = 11;

function svg( tag, attrs ) {
	const el = document.createElementNS( SVG, tag );
	for ( const [ k, v ] of Object.entries( attrs || {} ) ) {
		el.setAttribute( k, v );
	}
	return el;
}

function html( tag, className, text ) {
	const el = document.createElement( tag );
	if ( className ) {
		el.className = className;
	}
	if ( text !== undefined ) {
		el.textContent = text;
	}
	return el;
}

/**
 * Los vecinos de un concepto repartidos por anillo.
 *
 * @param {number} centerId
 * @param {Array} links {source, target, kind, weight}
 * @param {Map<number,Object>} byId
 * @return {Array<Array<{node: Object, weight: number}>>} por anillo, de mayor a
 *  menor peso (todos, sin cupo)
 */
function neighboursByRing( centerId, links, byId ) {
	const rank = { [ RING_KINDS[ 0 ] ]: 0, [ RING_KINDS[ 1 ] ]: 1, [ RING_KINDS[ 2 ] ]: 2 };
	const best = new Map();
	for ( const l of links ) {
		if ( l.source !== centerId && l.target !== centerId ) {
			continue;
		}
		const id = l.source === centerId ? l.target : l.source;
		const current = best.get( id );
		if ( !current || rank[ l.kind ] < current.ring ||
			( rank[ l.kind ] === current.ring && l.weight > current.weight ) ) {
			best.set( id, { ring: rank[ l.kind ], weight: l.weight } );
		}
	}
	const rings = [ [], [], [] ];
	best.forEach( ( { ring, weight }, id ) => {
		if ( byId.has( id ) ) {
			rings[ ring ].push( { node: byId.get( id ), weight } );
		}
	} );
	const heavier = ( a, b ) => b.weight - a.weight || a.node.label.localeCompare( b.node.label );
	rings.forEach( ( ring ) => ring.sort( heavier ) );
	return rings;
}

/**
 * Ordena a los vecinos de un anillo para que los próximos entre sí queden
 * contiguos: parte del de mayor peso y agrega, cada vez, el que tiene más
 * proximidad con el último (suma de log2(1 + peso) de todos los grados entre
 * ambos); a igualdad, el de mayor peso al centro.
 *
 * @param {Array<{node: Object, weight: number}>} items
 * @param {Map<string,number>} mutual proximidad entre pares ("a:b", a < b)
 * @return {Array<{node: Object, weight: number}>}
 */
function seriate( items, mutual ) {
	const pool = items.slice();
	const out = [];
	const near = ( a, b ) => mutual.get( a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id ) || 0;
	while ( pool.length ) {
		const last = out.length ? out[ out.length - 1 ].node : null;
		let pick = 0;
		if ( last ) {
			let top = -1;
			pool.forEach( ( item, i ) => {
				const value = near( last, item.node );
				if ( value > top ) {
					top = value;
					pick = i;
				}
			} );
		}
		out.push( pool.splice( pick, 1 )[ 0 ] );
	}
	return out;
}

/**
 * Posiciones de una disposición: el centro en el origen y los vecinos
 * repartidos por anillo con su cupo.
 *
 * @param {number} centerId
 * @param {Array} links
 * @param {Map<number,Object>} byId
 * @return {{places: Map<number,Object>, more: Array<Array>, all: Array<Array>}}
 *  places: id → {x, y, ring (−1 el centro), angle}; more: por anillo, los que
 *  no caben en el cupo; all: por anillo, todos
 */
function arrange( centerId, links, byId ) {
	const all = neighboursByRing( centerId, links, byId );
	const shown = all.map( ( ring, i ) => ring.slice( 0, RING_QUOTAS[ i ] ) );
	const more = all.map( ( ring, i ) => ring.slice( RING_QUOTAS[ i ] ) );
	const inRing = new Set( shown.flat().map( ( item ) => item.node.id ) );
	// Proximidad entre los vecinos mostrados, de cualquier grado.
	const mutual = new Map();
	for ( const l of links ) {
		if ( inRing.has( l.source ) && inRing.has( l.target ) ) {
			const key = l.source < l.target ? l.source + ':' + l.target : l.target + ':' + l.source;
			mutual.set( key, ( mutual.get( key ) || 0 ) + Math.log2( 1 + l.weight ) );
		}
	}
	const places = new Map( [ [ centerId, { x: 0, y: 0, ring: -1, angle: 0 } ] ] );
	shown.forEach( ( items, i ) => {
		const ordered = seriate( items, mutual );
		// Cada anillo parte de un ángulo distinto, para que los rótulos de un
		// anillo no queden alineados radialmente con los del siguiente.
		const start = -Math.PI / 2 + i * Math.PI / 5;
		ordered.forEach( ( item, j ) => {
			const angle = start + 2 * Math.PI * j / ordered.length;
			places.set( item.node.id, {
				x: RING_RADII[ i ] * Math.cos( angle ),
				y: RING_RADII[ i ] * Math.sin( angle ),
				ring: i,
				angle
			} );
		} );
	} );
	return { places, more, all };
}

/**
 * @param {HTMLElement} container
 * @param {Object} data {nodes, links}
 * @param {Object} options
 * @param {number} options.center id del concepto al centro
 * @param {Map<number,number>} options.themeOf concepto → índice de tema
 * @param {Function} options.onSelect (node) => void, al elegir un concepto
 * @param {Function} options.onClose vuelve al mapa
 * @return {{center: Function, setThemes: Function, destroy: Function}}
 */
function open( container, data, options ) {
	container.textContent = '';
	const byId = new Map( data.nodes.map( ( n ) => [ n.id, n ] ) );
	const maxExc = Math.max( 1, ...data.nodes.map( ( n ) => n.excerpts ) );
	const maxPages = Math.max( 1, ...data.nodes.map( ( n ) => n.pages ) );
	const dotOf = ( n ) => DOT_MIN + ( DOT_MAX - DOT_MIN ) *
		Math.sqrt( 0.6 * n.excerpts / maxExc + 0.4 * n.pages / maxPages );
	const reduce = device.isMobile() || window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
	let themeOf = options.themeOf;
	let colors = options.conceptColors || new Map();

	const wrap = html( 'div', 'constel-rings' );
	const bar = html( 'div', 'constel-rings__bar' );
	// «← Mapa»: texto discreto con su flecha (como «← Temas» del panel).
	const back = html( 'button', 'constel-backlink constel-rings__close' );
	back.type = 'button';
	back.append( icons.icon( 'arrow-left' ), html( 'span', null, mw.msg( 'constellation-rings-close' ) ) );
	back.title = mw.msg( 'constellation-rings-close-hint' );
	back.addEventListener( 'click', () => options.onClose() );
	const title = html( 'span', 'constel-rings__title' );
	bar.append( back, title );
	const root = svg( 'svg', {
		class: 'constel-rings__svg',
		viewBox: `${ -VIEW_W / 2 } ${ -VIEW_H / 2 } ${ VIEW_W } ${ VIEW_H }`,
		role: 'group'
	} );
	const guides = svg( 'g', { class: 'constel-rings__guides' } );
	RING_RADII.forEach( ( r ) => guides.append( svg( 'circle', { class: 'constel-rings__guide', r } ) ) );
	// Leyenda de los anillos, de adentro hacia afuera: cada uno con su nombre, y
	// uno sin vecinos lo dice (así el traslape, que pide lectores distintos, no
	// parece un fallo).
	const legend = html( 'ol', 'constel-rings__legend' );
	const legendItems = RING_RADII.map( () => legend.appendChild( html( 'li' ) ) );
	const layer = svg( 'g' );
	root.append( guides, layer );
	wrap.append( bar, legend, root );
	container.append( wrap );

	// id → {g, dot, text, x, y, fx, fy, tx, ty, opacity, target opacity}
	const els = new Map();
	let centerId = null;
	let frame = null;
	let started = 0;

	const category = ( id ) => {
		const t = themeOf.get( id );
		return t === undefined ? null : 'constel-graph__node--cat-' + ( t % CATEGORIES );
	};

	function makeNode( node ) {
		const classes = [ 'constel-graph__node' ];
		if ( node.mine ) {
			classes.push( 'constel-graph__node--mine' );
		}
		const g = svg( 'g', {
			class: 'constel-rings__node',
			tabindex: '0',
			role: 'button',
			'aria-label': mw.msg( 'constellation-node-label', node.label, node.excerpts, node.pages )
		} );
		const dot = svg( 'circle', { class: classes.join( ' ' ) + ' constel-graph__dot' } );
		const text = svg( 'text', { class: classes.join( ' ' ), 'dominant-baseline': 'middle' } );
		text.textContent = node.label;
		g.append( dot, text );
		g.addEventListener( 'click', () => choose( node ) );
		g.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' || e.key === ' ' ) {
				e.preventDefault();
				choose( node );
			}
		} );
		layer.append( g );
		return {
			g, dot, text, node, x: 0, y: 0, fx: 0, fy: 0, tx: 0, ty: 0, opacity: 0, to: 1, ring: -1
		};
	}

	function paint( entry ) {
		const isCenter = entry.ring === -1;
		const cat = category( entry.node.id );
		[ entry.dot, entry.text ].forEach( ( el ) => {
			// Clases: constel-graph__node--cat-0 … constel-graph__node--cat-7
			el.setAttribute( 'class', el.getAttribute( 'class' )
				.replace( /\s*constel-graph__node--cat-\d/g, '' ) + ( cat ? ' ' + cat : '' ) );
		} );
		[ entry.dot, entry.text ].forEach( ( el ) => {
			el.style.fill = colors.get( entry.node.id ) || '';
		} );
		entry.dot.setAttribute( 'r', ( isCenter ? DOT_CENTER : dotOf( entry.node ) ).toFixed( 1 ) );
		entry.g.classList.toggle( 'constel-rings__node--center', isCenter );
		entry.g.setAttribute( 'aria-current', String( isCenter ) );
	}

	// El rótulo va afuera del círculo, sobre el radio: a la derecha o a la
	// izquierda según el lado, y arriba o abajo cerca de los polos.
	function placeText( entry ) {
		const r = entry.ring === -1 ? DOT_CENTER : dotOf( entry.node );
		entry.text.setAttribute( 'font-size', entry.ring === -1 ? '20' : '15' );
		const { angle } = entry;
		const c = Math.cos( angle );
		const s = Math.sin( angle );
		if ( entry.ring === -1 ) {
			entry.text.setAttribute( 'text-anchor', 'middle' );
			entry.text.setAttribute( 'x', '0' );
			entry.text.setAttribute( 'y', String( -r - 10 ) );
			return;
		}
		const gap = r + 6;
		if ( Math.abs( c ) < 0.12 ) {
			entry.text.setAttribute( 'text-anchor', 'middle' );
			entry.text.setAttribute( 'x', '0' );
			entry.text.setAttribute( 'y', String( s * gap + ( s > 0 ? 8 : -8 ) ) );
		} else {
			entry.text.setAttribute( 'text-anchor', c > 0 ? 'start' : 'end' );
			entry.text.setAttribute( 'x', String( c * gap ) );
			entry.text.setAttribute( 'y', String( s * gap ) );
		}
	}

	function draw( now ) {
		frame = null;
		const t = Math.min( 1, ( now - started ) / GLIDE_MS );
		const e = 1 - Math.pow( 1 - t, 3 );
		els.forEach( ( entry, id ) => {
			entry.x = entry.fx + ( entry.tx - entry.fx ) * e;
			entry.y = entry.fy + ( entry.ty - entry.fy ) * e;
			entry.opacity = entry.fo + ( entry.to - entry.fo ) * e;
			entry.g.setAttribute( 'transform', `translate(${ entry.x.toFixed( 1 ) } ${ entry.y.toFixed( 1 ) })` );
			entry.g.style.opacity = entry.opacity.toFixed( 2 );
			if ( t === 1 && entry.to === 0 ) {
				entry.g.remove();
				els.delete( id );
			}
		} );
		if ( t < 1 ) {
			frame = requestAnimationFrame( draw );
		}
	}

	/**
	 * La leyenda: cada anillo con su nombre, y uno sin vecinos lo dice.
	 *
	 * @param {Object} layout lo que devuelve arrange
	 */
	function legendFor( layout ) {
		layout.all.forEach( ( ring, i ) => {
			const name = mw.msg( RING_MESSAGES[ i ] );
			legendItems[ i ].textContent = ring.length ?
				name :
				mw.msg( RING_EMPTY_MESSAGES[ i ], name );
			legendItems[ i ].classList.toggle( 'constel-rings__legend-empty', !ring.length );
		} );
	}

	function layoutFor( id ) {
		const node = byId.get( id );
		const layout = arrange( id, data.links, byId );
		title.textContent = mw.msg( 'constellation-rings-title', node.label );
		root.setAttribute( 'aria-label', mw.msg( 'constellation-rings-title', node.label ) );
		legendFor( layout );
		return layout;
	}

	function center( id, immediate ) {
		if ( id === centerId || !byId.has( id ) ) {
			return;
		}
		centerId = id;
		const layout = layoutFor( id );
		started = performance.now();
		els.forEach( ( entry ) => {
			entry.fx = entry.x;
			entry.fy = entry.y;
			entry.fo = entry.opacity;
			entry.to = 0;
		} );
		layout.places.forEach( ( place, nodeId ) => {
			let entry = els.get( nodeId );
			if ( !entry ) {
				entry = makeNode( byId.get( nodeId ) );
				entry.x = place.x;
				entry.y = place.y;
				entry.fx = place.x;
				entry.fy = place.y;
				entry.fo = 0;
				els.set( nodeId, entry );
			}
			entry.tx = place.x;
			entry.ty = place.y;
			entry.to = 1;
			entry.ring = place.ring;
			entry.angle = place.angle;
			paint( entry );
			placeText( entry );
		} );
		// Los que ya no están, se apagan donde estaban.
		els.forEach( ( entry ) => {
			if ( entry.to === 0 ) {
				entry.tx = entry.x;
				entry.ty = entry.y;
			}
		} );
		if ( immediate || reduce ) {
			started = -Infinity;
		}
		if ( frame ) {
			cancelAnimationFrame( frame );
		}
		frame = requestAnimationFrame( draw );
	}

	function choose( node ) {
		if ( node.id !== centerId ) {
			center( node.id );
		}
		options.onSelect( node );
	}

	center( options.center, true );
	return {
		center,
		setThemes: ( map, custom ) => {
			themeOf = map;
			colors = custom || new Map();
			els.forEach( paint );
		},
		centerId: () => centerId,
		destroy: () => {
			if ( frame ) {
				cancelAnimationFrame( frame );
			}
			container.textContent = '';
		}
	};
}

module.exports = { open, arrange, seriate, neighboursByRing, RING_QUOTAS, RING_RADII };
