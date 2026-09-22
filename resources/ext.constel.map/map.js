/**
 * Especial:Constelación — el mapa de conceptos (spec: ConceptMap).
 *
 * Barra de herramientas en dos filas:
 *  1. Vista 2D/3D (+ «Girar solo» sólo en 3D) · Mostrar aristas (+ peso
 *     mínimo, 1–4, visible sólo con aristas) · zoom.
 *  2. Píldoras con autocompletado: «Secciones de» (lectores; vacío = todas),
 *     «Páginas» (vacío = todas) y «Temas de» (la lente; por defecto quien
 *     mira, nunca vacía para una cuenta registrada).
 * Al elegir un concepto, el panel lateral muestra su detalle; si no, los
 * temas de la lente. Debajo, la misma información como lista
 * (AccessibleAlternative).
 */
const { api, icons } = require( 'ext.constel.ui' );
const graph = require( './graph.js' );
const side = require( './sidepanel.js' );
const pills = require( './pills.js' );

const cfg = mw.config.get( 'wgConstelMap' );
const me = mw.user.isNamed() ? mw.config.get( 'wgUserName' ) : null;
const THRESHOLD_MAX = 4;

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

function main( root ) {
	const pageParam = mw.util.getParamValue( 'page' );
	const state = {
		mode: '3d',
		autorotate: !!( mw.storage.getObject( 'constel-map' ) || {} ).autorotate,
		threshold: 1,
		edges: true,
		readers: [],
		pages: pageParam ? [ pageParam ] : [],
		lens: me ? [ me ] : [],
		data: null,
		themes: [],
		myThemes: [],
		selected: null,
		view: null
	};

	// ── Estructura ────────────────────────────────────────────────────────
	root.textContent = '';
	const controls = el( 'div', 'constel-ui constel-map__controls' );
	const rowView = el( 'div', 'constel-map__row' );
	const rowFilters = el( 'div', 'constel-map__row constel-map__row--filters' );
	controls.append( rowView, rowFilters );
	const layout = el( 'div', 'constel-map__layout' );
	const canvas = el( 'div', 'constel-map__canvas' );
	const aside = el( 'aside', 'constel-map__side' );
	const alt = el( 'details', 'constel-map__alt' );
	alt.append( el( 'summary', null, mw.msg( 'constellation-as-list' ) ) );
	const altList = el( 'ol', 'constel-map__fallback' );
	alt.append( altList );
	layout.append( canvas, aside );
	root.append( controls, layout, alt );

	const field = ( labelMsg, control ) => {
		const label = el( 'label', 'constel-map__field' );
		label.append( el( 'span', 'constel-label', mw.msg( labelMsg ) ), control );
		return label;
	};
	const checkbox = ( msg, checked, onChange ) => {
		const input = el( 'input' );
		input.type = 'checkbox';
		input.checked = checked;
		input.addEventListener( 'change', () => onChange( input.checked ) );
		const label = el( 'label', 'constel-map__field constel-map__field--inline' );
		label.append( input, ' ', mw.msg( msg ) );
		return { label, input };
	};

	// ── Fila 1: vista ─────────────────────────────────────────────────────
	const mode = el( 'select', 'constel-input' );
	[ [ '3d', 'constellation-mode-3d' ], [ '2d', 'constellation-mode-2d' ] ].forEach( ( [ v, m ] ) => {
		const o = el( 'option', null, mw.msg( m ) );
		o.value = v;
		mode.append( o );
	} );
	// Girar solo: junto a la vista, sólo en 3D; apagado por defecto.
	const spin = checkbox( 'constellation-autorotate', state.autorotate, ( on ) => {
		state.autorotate = on;
		mw.storage.setObject( 'constel-map', { autorotate: on } );
		if ( state.view ) {
			state.view.setAutorotate( on );
		}
	} );
	mode.addEventListener( 'change', () => {
		state.mode = mode.value;
		spin.label.hidden = state.mode !== '3d';
		// Nuevo layout desde cero: 2D y 3D no comparten posiciones.
		state.data.nodes.forEach( ( n ) => {
			delete n.x;
		} );
		render();
	} );
	const viewGroup = el( 'div', 'constel-map__group' );
	viewGroup.append( field( 'constellation-mode', mode ), spin.label );

	// Mostrar aristas condiciona el peso mínimo (1–4).
	const threshold = el( 'input', 'constel-input constel-map__threshold' );
	threshold.type = 'number';
	threshold.min = '1';
	threshold.max = String( THRESHOLD_MAX );
	threshold.step = '1';
	threshold.value = '1';
	threshold.addEventListener( 'change', () => {
		const n = Math.round( Number( threshold.value ) ) || 1;
		state.threshold = Math.min( THRESHOLD_MAX, Math.max( 1, n ) );
		threshold.value = String( state.threshold );
		render();
	} );
	const thresholdField = field( 'constellation-threshold', threshold );
	const edges = checkbox( 'constellation-edges', state.edges, ( on ) => {
		state.edges = on;
		// Sin aristas, el peso no tiene sentido: desaparece.
		thresholdField.hidden = !on;
		render();
	} );
	const edgesGroup = el( 'div', 'constel-map__group' );
	edgesGroup.append( edges.label, thresholdField );

	// Navegación del mapa: íconos Feather con nombre accesible.
	const zoom = el( 'div', 'constel-map__zoom' );
	zoom.setAttribute( 'role', 'group' );
	zoom.setAttribute( 'aria-label', mw.msg( 'constellation-navigation' ) );
	[ [ 'zoom-in', 'constellation-zoom-in', () => state.view && state.view.zoomIn() ],
		[ 'zoom-out', 'constellation-zoom-out', () => state.view && state.view.zoomOut() ],
		[ 'maximize', 'constellation-zoom-reset', () => state.view && state.view.reset() ],
		[ 'download', 'constellation-export-svg', () => state.view && exportSvg() ]
	].forEach( ( [ name, msg, fn ] ) => {
		const b = icons.iconButton( name, mw.msg( msg ) );
		b.addEventListener( 'click', fn );
		zoom.append( b );
	} );

	// Descarga el grafo tal como se ve (vista, filtros y proyección actuales).
	function exportSvg() {
		const describe = [
			state.readers.length ? mw.msg( 'constellation-sections' ) + ': ' + state.readers.join( ', ' ) : '',
			state.pages.length ? mw.msg( 'constellation-pages' ) + ': ' + state.pages.join( ', ' ) : ''
		].filter( Boolean ).join( ' · ' );
		const svg = state.view.exportSvg( {
			title: mw.msg( 'constellation-svg-title', mw.config.get( 'wgSiteName' ) ),
			description: describe
		} );
		const url = URL.createObjectURL( new Blob( [ svg ], { type: 'image/svg+xml' } ) );
		const a = el( 'a' );
		a.href = url;
		a.download = 'constelacion-' + new Date().toISOString().slice( 0, 10 ) + '.svg';
		document.body.append( a );
		a.click();
		a.remove();
		setTimeout( () => URL.revokeObjectURL( url ), 1000 );
	}
	rowView.append( viewGroup, edgesGroup, zoom );

	// ── Fila 2: filtros como píldoras ─────────────────────────────────────
	const readers = pills.create( {
		label: mw.msg( 'constellation-sections' ),
		placeholder: mw.msg( 'constellation-add-reader' ),
		empty: mw.msg( 'constellation-all-sections' ),
		search: api.searchUsers,
		onChange: ( values ) => {
			state.readers = values;
			loadGraph();
		}
	} );
	const pages = pills.create( {
		label: mw.msg( 'constellation-pages' ),
		placeholder: mw.msg( 'constellation-add-page' ),
		empty: mw.msg( 'constellation-all-pages' ),
		values: state.pages,
		search: api.searchPages,
		onChange: ( values ) => {
			state.pages = values;
			loadGraph();
		}
	} );
	// La lente: por defecto quien mira; nunca vacía para una cuenta registrada.
	const lens = pills.create( {
		label: mw.msg( 'constellation-lens' ),
		placeholder: mw.msg( 'constellation-add-reader' ),
		empty: mw.msg( 'constellation-no-lens' ),
		values: state.lens,
		min: me ? 1 : 0,
		search: api.searchUsers,
		onChange: ( values ) => {
			state.lens = values;
			state.selected = null;
			loadThemes();
		}
	} );
	rowFilters.append( readers.el, pages.el, lens.el );

	// ── Datos y dibujo ────────────────────────────────────────────────────
	const themeIndex = () => {
		const map = new Map();
		state.themes.forEach( ( t, i ) => t.concepts.forEach( ( c ) => map.set( c.id, i ) ) );
		return map;
	};

	function render() {
		if ( !state.data ) {
			return;
		}
		if ( !state.data.nodes.length ) {
			canvas.textContent = '';
			canvas.append( el( 'p', 'constel-map__empty', mw.msg( 'constellation-empty' ) ) );
		} else {
			if ( state.view ) {
				state.view.destroy();
			}
			state.view = graph.draw( canvas, state.data, {
				mode: state.mode,
				autorotate: state.autorotate,
				threshold: state.threshold,
				edges: state.edges,
				themeOf: themeIndex(),
				onSelect: select
			} );
			if ( state.selected ) {
				state.view.select( state.selected.id );
			}
		}
		renderList();
	}

	function renderList() {
		altList.textContent = '';
		const byId = new Map( state.data.nodes.map( ( n ) => [ n.id, n ] ) );
		const near = new Map();
		state.data.links.filter( ( l ) => l.weight >= state.threshold ).forEach( ( l ) => {
			[ [ l.source, l.target ], [ l.target, l.source ] ].forEach( ( [ a, b ] ) => {
				const entry = { id: b, kind: l.kind, weight: l.weight };
				near.set( a, ( near.get( a ) || [] ).concat( entry ) );
			} );
		} );
		const byFrequency = ( a, b ) => b.excerpts - a.excerpts || a.label.localeCompare( b.label );
		state.data.nodes.slice().sort( byFrequency )
			.forEach( ( n ) => {
				const li = el( 'li' );
				const open = el( 'button', 'constel-link constel-map__open', n.label );
				open.type = 'button';
				open.addEventListener( 'click', () => select( n ) );
				const counts = mw.msg( 'constellation-counts',
					mw.language.convertNumber( n.excerpts ), mw.language.convertNumber( n.pages ) );
				li.append( open, ' ', el( 'span', 'constel-map__count', counts ) );
				const links = ( near.get( n.id ) || [] ).sort( ( a, b ) => b.weight - a.weight );
				if ( links.length ) {
					const kinds = {
						// eslint-disable-next-line camelcase
						co_excerpt: 'constellation-link-coexcerpt',
						overlap: 'constellation-link-overlap',
						// eslint-disable-next-line camelcase
						co_page: 'constellation-link-copage'
					};
					// Mensajes: constellation-link-coexcerpt, -overlap, -copage
					const describe = ( l ) => mw.msg(
						kinds[ l.kind ], byId.get( l.id ).label, l.weight
					);
					li.append( el( 'span', 'constel-map__near', ' — ' + links.map( describe ).join( ', ' ) ) );
				}
				altList.append( li );
			} );
	}

	function select( node ) {
		state.selected = node;
		if ( state.view ) {
			state.view.select( node.id );
		}
		const back = el( 'button', 'constel-button constel-map__back', mw.msg( 'constellation-back-to-themes' ) );
		back.type = 'button';
		back.addEventListener( 'click', () => {
			state.selected = null;
			if ( state.view ) {
				state.view.select( null );
			}
			renderThemes();
		} );
		const box = el( 'div' );
		aside.textContent = '';
		aside.append( back, box );
		side.conceptDetail( box, node, {
			me,
			canAnnotate: cfg.canAnnotate,
			canModerate: cfg.canModerate,
			myThemes: state.myThemes,
			onChanged: () => loadThemes().then( () => select( node ) ),
			// Tras renombrar o fusionar, el grafo cambia: recargar y abrir el que queda.
			onModerated: ( keepId ) => loadGraph().then( loadThemes ).then( () => {
				const kept = state.data.nodes.find( ( n ) => n.id === keepId );
				if ( kept ) {
					select( kept );
				}
			} )
		} );
	}

	function renderThemes() {
		aside.textContent = '';
		if ( !state.lens.length ) {
			aside.append( el( 'p', 'constel-side__meta', mw.msg( 'constellation-no-lens' ) ) );
			return;
		}
		// Un bloque por lector de la lente, en su orden; los colores siguen
		// el índice global de temas (el mismo del grafo).
		let offset = 0;
		state.lens.forEach( ( name ) => {
			const own = state.themes.filter( ( t ) => t.author === name );
			const box = el( 'div', 'constel-side__lens' );
			side.themesPanel( box, own, {
				editable: cfg.canAnnotate && name === me,
				colorOffset: offset,
				ownerLabel: name === me ?
					mw.msg( 'constellation-my-themes' ) :
					mw.msg( 'constellation-themes-of', name ),
				onChanged: () => loadThemes(),
				onSelectConcept: ( id ) => {
					const node = state.data && state.data.nodes.find( ( n ) => n.id === id );
					if ( node ) {
						select( node );
					}
				}
			} );
			offset += own.length;
			aside.append( box );
		} );
	}

	function loadThemes() {
		const mine = me ? api.themesOf( me ) : Promise.resolve( [] );
		const lensed = state.lens.length ? api.themesOf( state.lens ) : Promise.resolve( [] );
		return Promise.all( [ mine, lensed ] ).then( ( [ my, found ] ) => {
			state.myThemes = my;
			// Mismo orden que las píldoras: así el índice de color es estable.
			const ofReader = ( name ) => found.filter( ( t ) => t.author === name );
			state.themes = state.lens.flatMap( ofReader );
			render();
			if ( !state.selected ) {
				renderThemes();
			}
		} );
	}

	function loadGraph() {
		canvas.textContent = mw.msg( 'constellation-loading' );
		return api.pageIds( state.pages ).then( ( ids ) => {
			const params = {};
			if ( state.readers.length ) {
				params.cgusers = state.readers;
			}
			if ( state.pages.length ) {
				// Páginas inexistentes: filtro imposible, no "todas".
				params.cgpageids = ids.length ? ids : [ 0 ];
			}
			return api.graph( params );
		} ).then( ( data ) => {
			state.data = data;
			render();
		} );
	}

	loadGraph().then( loadThemes );
}

$( () => {
	const root = document.getElementById( 'constel-map' );
	if ( root && cfg ) {
		main( root );
	}
} );
