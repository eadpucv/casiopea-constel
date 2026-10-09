/**
 * {{#constel: …}} — el mapa limpio, sin controles, dentro de una página.
 *
 * Reusa graph.draw del mapa. La vista sale sólo de los parámetros de la
 * plantilla (data-constel), con los mismos valores de partida que el mapa
 * completo; no lee ni guarda las preferencias del navegador, así todos ven lo
 * mismo. Cada mapa es independiente: puede haber varios en una página.
 */
const { api, device } = require( 'ext.constel.ui' );
const { graph, refpanel } = require( 'ext.constel.map' );

const DEFAULT_FORCE = 0.25;
const ALL_KINDS = Object.keys( graph.FORCES );

/**
 * Color resuelto de la categoría `index` (el mismo del filtro de lectores).
 *
 * @param {number} index
 * @return {string}
 */
function categoryColor( index ) {
	const probe = document.createElement( 'span' );
	probe.style.color = `var(--constel-cat-${ index % 8 })`;
	document.body.append( probe );
	const color = getComputedStyle( probe ).color;
	probe.remove();
	return color;
}

/**
 * Títulos iguales sin distinguir «_» de espacio.
 *
 * @param {string} a
 * @param {string} b
 * @return {boolean}
 */
function sameTitle( a, b ) {
	return a.replace( /_/g, ' ' ) === b.replace( /_/g, ' ' );
}

function settings( raw ) {
	const readers = raw.readers || [];
	const several = readers.length >= 2;
	// Mismas fuerzas de partida que el mapa completo (con varios lectores, el
	// traslape al 100 % y el mismo texto en 0 %).
	const forces = Object.assign( {
		// eslint-disable-next-line camelcase
		co_excerpt: DEFAULT_FORCE,
		overlap: DEFAULT_FORCE,
		// eslint-disable-next-line camelcase
		co_page: DEFAULT_FORCE,
		theme: DEFAULT_FORCE
	// eslint-disable-next-line camelcase
	}, several ? { overlap: 1, co_page: 0 } : {}, raw.forces || {} );
	return {
		readers,
		pages: raw.pages || [],
		concept: ( raw.concept || '' ).trim().toLowerCase(),
		mode: raw.mode === '3d' ? '3d' : '2d',
		autorotate: !!raw.autorotate,
		edges: raw.edges !== false,
		labels: raw.concepts === 'nodes' ? 'none' : 'all',
		forces
	};
}

function mount( root ) {
	let raw;
	try {
		raw = JSON.parse( root.dataset.constel || '{}' );
	} catch ( e ) {
		return;
	}
	const s = settings( raw );
	const canvas = document.createElement( 'div' );
	canvas.className = 'constel-map__canvas constel-embed__canvas';
	const loading = document.createElement( 'p' );
	loading.className = 'constel-map__loading';
	loading.textContent = mw.msg( 'constellation-loading-map' );
	canvas.append( loading );
	root.replaceChildren( canvas );

	const kinds = ALL_KINDS.filter( ( kind ) => s.forces[ kind ] > 0 );
	api.pageIds( s.pages ).then( ( ids ) => {
		const params = { cgkinds: kinds };
		if ( s.readers.length ) {
			params.cgusers = s.readers;
		}
		if ( s.pages.length ) {
			// Páginas inexistentes: filtro imposible, no «todas».
			params.cgpageids = ids.length ? ids : [ 0 ];
		}
		return api.graph( params );
	} ).then( ( data ) => {
		if ( !data.nodes.length ) {
			const empty = document.createElement( 'p' );
			empty.className = 'constel-map__empty';
			empty.textContent = mw.msg( 'constellation-empty' );
			canvas.replaceChildren( empty );
			return;
		}
		let view = null;
		// Los conceptos del panel son enlaces al mapa completo con ese concepto
		// elegido (y las secciones de todos los lectores).
		const refs = refpanel.create( root, {
			filter: ( e ) => ( !s.readers.length || s.readers.includes( e.author ) ) &&
				( !s.pages.length || s.pages.some( ( t ) => sameTitle( t, e.title || '' ) ) )
		} );
		view = graph.draw( canvas, data, {
			readers: s.readers.length >= 2 ? s.readers : null,
			readerColors: s.readers.length >= 2 ?
				s.readers.map( ( r, i ) => categoryColor( i ) ) : null,
			mode: s.mode,
			autorotate: s.autorotate,
			edges: s.edges,
			labels: s.labels,
			forces: s.forces,
			fill: true,
			themeOf: new Map(),
			conceptColors: new Map(),
			wash: false,
			calm: device.isMobile(),
			onSelect: ( node ) => {
				view.select( node.id );
				refs.show( node );
			}
		} );
		if ( s.concept ) {
			const focus = data.nodes.find( ( n ) => n.label.toLowerCase() === s.concept );
			if ( focus ) {
				view.select( focus.id );
				refs.show( focus );
			}
		}
	}, () => {
		const error = document.createElement( 'p' );
		error.className = 'constel-map__empty';
		error.textContent = mw.msg( 'constel-error-generic' );
		canvas.replaceChildren( error );
	} );
}

$( () => {
	Array.prototype.forEach.call( document.querySelectorAll( '.constel-embed[data-constel]' ), mount );
} );
