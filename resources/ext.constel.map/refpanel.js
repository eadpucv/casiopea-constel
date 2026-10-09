/**
 * Panel flotante de referencias: las páginas a las que remite un concepto, con
 * sus §§ y los demás conceptos de cada §. Equivale a los anillos (el concepto
 * y sus vecinos de anillo 1) pero como menú de enlaces:
 *
 *   Título de la página                   → la página (con líneas de árbol:
 *                                           página ├ § ├ conceptos)
 *     «Texto de la secc…»                 → el § (40 caracteres y puntos)
 *       otro concepto · otro concepto     → llevan a ese concepto, al centro del mapa
 *
 * Sirve al mapa a pantalla completa y a las incrustaciones ({{#constel:}}).
 * Flota sobre la ventana (position: fixed, montado en <body>, o en el elemento
 * a pantalla completa mientras lo haya), así que puede salirse del marco del
 * mapa; sólo lo limitan los bordes de la ventana. Se arrastra por la cabecera
 * y se redimensiona por la esquina. Con teclado: flechas en la cabecera lo
 * mueven (16 px) y, con Mayús, lo redimensionan.
 */
const { api, icons } = require( 'ext.constel.ui' );

/** Caracteres visibles del texto de un § antes de los puntos suspensivos. */
const SNIPPET = 40;
const MIN_W = 180;
const MIN_H = 120;
const STEP = 16;
const MARGIN = 8;

function el( tag, className, text ) {
	const node = document.createElement( tag );
	if ( className ) {
		node.className = className;
	}
	if ( text !== undefined ) {
		node.textContent = text;
	}
	return node;
}

/**
 * Los primeros caracteres del texto de un §, en una sola línea.
 *
 * @param {string} text
 * @return {string}
 */
function snippet( text ) {
	const letters = Array.from( ( text || '' ).replace( /\s+/g, ' ' ).trim() );
	return letters.slice( 0, SNIPPET ).join( '' ) + ( letters.length > SNIPPET ? '…' : '' );
}

/**
 * §§ de un concepto agrupados por página: la de más §§ primero.
 *
 * @param {Array} excerpts
 * @return {Array<{title: string, items: Array}>}
 */
function byPage( excerpts ) {
	const pages = new Map();
	for ( const e of excerpts ) {
		if ( !e.title ) {
			continue;
		}
		if ( !pages.has( e.title ) ) {
			pages.set( e.title, [] );
		}
		pages.get( e.title ).push( e );
	}
	return Array.from( pages, ( [ title, items ] ) => ( { title, items } ) )
		.sort( ( a, b ) => b.items.length - a.items.length || a.title.localeCompare( b.title ) );
}

/**
 * @param {HTMLElement} host el mapa al que sirve: de él parte la posición inicial
 * @param {Object} options
 * @param {Function} [options.filter] (excerpt) => boolean, qué §§ se listan
 * @param {Function} [options.onPick] (conceptId, label) => boolean, al hacer clic en
 *  otro concepto: devuelve true si lo atendió (no se navega); sin él, el enlace navega
 * @return {{show: Function, hide: Function, destroy: Function}}
 */
function create( host, options ) {
	const box = { x: 0, y: 0, w: 0, h: 0 };
	let placed = false;
	let token = 0;

	const root = el( 'aside', 'constel-refs' );
	root.hidden = true;
	const head = el( 'div', 'constel-refs__head' );
	head.tabIndex = 0;
	const title = el( 'span', 'constel-refs__name' );
	const close = icons.iconButton( 'x', mw.msg( 'constellation-refs-close' ),
		'constel-button constel-button--icon constel-refs__close' );
	head.append( title, close );
	const body = el( 'div', 'constel-refs__body' );
	const grip = el( 'div', 'constel-refs__grip' );
	grip.setAttribute( 'role', 'separator' );
	grip.title = mw.msg( 'constellation-refs-resize' );
	root.append( head, body, grip );

	// Dónde vive el panel: a pantalla completa sólo se ve dentro del elemento a
	// pantalla completa; si no, en <body>.
	function mountPoint() {
		// eslint-disable-next-line compat/compat
		return document.fullscreenElement || document.body;
	}
	function remount() {
		if ( root.parentNode !== mountPoint() ) {
			mountPoint().append( root );
		}
	}
	remount();

	function apply() {
		const vw = document.documentElement.clientWidth;
		const vh = document.documentElement.clientHeight;
		box.w = Math.min( Math.max( box.w, MIN_W ), Math.max( MIN_W, vw - 2 * MARGIN ) );
		box.h = Math.min( Math.max( box.h, MIN_H ), Math.max( MIN_H, vh - 2 * MARGIN ) );
		box.x = Math.min( Math.max( box.x, 0 ), Math.max( 0, vw - box.w ) );
		box.y = Math.min( Math.max( box.y, 0 ), Math.max( 0, vh - box.h ) );
		root.style.left = box.x + 'px';
		root.style.top = box.y + 'px';
		root.style.width = box.w + 'px';
		root.style.height = box.h + 'px';
	}

	function place() {
		if ( placed ) {
			apply();
			return;
		}
		placed = true;
		// En la esquina superior derecha del mapa, lejos del botón de pantalla
		// completa.
		const at = host.getBoundingClientRect();
		box.w = 288;
		box.h = Math.min( 360, Math.round( at.height * 0.7 ) );
		box.x = at.right - box.w - MARGIN;
		box.y = Math.max( at.top, 0 ) + MARGIN + 40;
		apply();
	}

	// Arrastrar y redimensionar con puntero (ratón, lápiz o dedo).
	function track( handle, move ) {
		handle.addEventListener( 'pointerdown', ( event ) => {
			if ( event.button > 0 || event.target.closest( '.constel-refs__close' ) ) {
				return;
			}
			event.preventDefault();
			const start = {
				px: event.clientX, py: event.clientY, x: box.x, y: box.y, w: box.w, h: box.h
			};
			handle.setPointerCapture( event.pointerId );
			const onMove = ( e ) => {
				move( start, e.clientX - start.px, e.clientY - start.py );
				apply();
			};
			const onUp = () => {
				handle.removeEventListener( 'pointermove', onMove );
				handle.removeEventListener( 'pointerup', onUp );
				handle.removeEventListener( 'pointercancel', onUp );
			};
			handle.addEventListener( 'pointermove', onMove );
			handle.addEventListener( 'pointerup', onUp );
			handle.addEventListener( 'pointercancel', onUp );
		} );
	}
	track( head, ( s, dx, dy ) => {
		box.x = s.x + dx;
		box.y = s.y + dy;
	} );
	track( grip, ( s, dx, dy ) => {
		box.w = s.w + dx;
		box.h = s.h + dy;
		// El tope por el borde derecho/inferior lo pone apply() con x/y fijos.
		box.w = Math.min( box.w, document.documentElement.clientWidth - s.x );
		box.h = Math.min( box.h, document.documentElement.clientHeight - s.y );
	} );
	head.addEventListener( 'keydown', ( event ) => {
		const dir = {
			ArrowLeft: [ -STEP, 0 ],
			ArrowRight: [ STEP, 0 ],
			ArrowUp: [ 0, -STEP ],
			ArrowDown: [ 0, STEP ]
		}[ event.key ];
		if ( !dir ) {
			return;
		}
		event.preventDefault();
		if ( event.shiftKey ) {
			box.w += dir[ 0 ];
			box.h += dir[ 1 ];
		} else {
			box.x += dir[ 0 ];
			box.y += dir[ 1 ];
		}
		apply();
	} );
	close.addEventListener( 'click', () => hide() );
	const onResize = () => placed && apply();
	const onFullscreen = () => {
		remount();
		onResize();
	};
	window.addEventListener( 'resize', onResize );
	document.addEventListener( 'fullscreenchange', onFullscreen );

	function page( group, centerId ) {
		const section = el( 'section', 'constel-refs__page' );
		const link = el( 'a', 'constel-refs__title', group.title );
		link.href = mw.util.getUrl( group.title );
		const list = el( 'ul', 'constel-refs__sections' );
		for ( const e of group.items ) {
			const item = el( 'li', 'constel-refs__section' );
			const text = el( 'a', 'constel-refs__text', snippet( e.exact ) );
			// Al § mismo, si sigue anclado; uno perdido ya no tiene dónde.
			text.href = mw.util.getUrl( group.title ) +
				( e.status === 'anchored' ? '#constel-' + e.id : '' );
			text.title = e.exact;
			item.append( text );
			const others = ( e.concepts || [] ).filter( ( c ) => c.id !== centerId );
			if ( others.length ) {
				const row = el( 'ul', 'constel-refs__others' );
				for ( const c of others ) {
					// Un enlace de verdad al mapa con ese concepto: sirve con clic
					// derecho, Ctrl+clic o pestaña nueva. Un clic simple lo toma
					// options.onPick (si lo hay y el concepto está a mano); si no,
					// navega.
					const entry = el( 'li', 'constel-refs__other' );
					const pick = el( 'a', 'constel-refs__concept', c.label );
					pick.href = mw.util.getUrl( 'Special:Constellation', { concept: c.label } );
					pick.title = mw.msg( 'constellation-refs-concept', c.label );
					pick.addEventListener( 'click', ( event ) => {
						const plain = event.button === 0 && !event.ctrlKey && !event.metaKey &&
							!event.shiftKey && !event.altKey;
						if ( plain && options.onPick && options.onPick( c.id, c.label ) ) {
							event.preventDefault();
						}
					} );
					entry.append( pick );
					row.append( entry );
				}
				item.append( row );
			}
			list.append( item );
		}
		section.append( link, list );
		return section;
	}

	function show( node ) {
		const mine = ++token;
		title.textContent = node.label;
		root.setAttribute( 'aria-label', mw.msg( 'constellation-refs-label', node.label ) );
		body.replaceChildren( el( 'p', 'constel-refs__note', mw.msg( 'constellation-loading' ) ) );
		root.hidden = false;
		place();
		api.excerptsOfConcept( node.id ).then( ( excerpts ) => {
			if ( mine !== token ) {
				return;
			}
			const kept = options.filter ? excerpts.filter( options.filter ) : excerpts;
			const groups = byPage( kept );
			if ( !groups.length ) {
				body.replaceChildren( el( 'p', 'constel-refs__note', mw.msg( 'constellation-refs-empty' ) ) );
				return;
			}
			body.replaceChildren( ...groups.map( ( group ) => page( group, node.id ) ) );
		}, () => {
			if ( mine === token ) {
				body.replaceChildren( el( 'p', 'constel-refs__note', mw.msg( 'constel-error-generic' ) ) );
			}
		} );
	}

	function hide() {
		token++;
		root.hidden = true;
	}

	function destroy() {
		token++;
		window.removeEventListener( 'resize', onResize );
		document.removeEventListener( 'fullscreenchange', onFullscreen );
		root.remove();
	}

	return { show, hide, destroy };
}

module.exports = { create, snippet };
