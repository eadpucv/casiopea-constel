/**
 * Especial:Constelación — el mapa de conceptos (spec: ConceptMap).
 *
 * Controles: alcance (todos/míos), página, umbral de peso, aristas visibles y
 * la lente de temas (los del viewer, los de otro lector o ninguna). Al elegir
 * un concepto, el panel lateral muestra su detalle; si no, los temas de la
 * lente. Debajo, la misma información como lista (AccessibleAlternative).
 */
const { api } = require( 'ext.constel.ui' );
const graph = require( './graph.js' );
const side = require( './sidepanel.js' );

const cfg = mw.config.get( 'wgConstelMap' );
const me = mw.user.isNamed() ? mw.config.get( 'wgUserName' ) : null;

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
	const state = {
		scope: 'everyone',
		mode: '3d',
		autorotate: !!( mw.storage.getObject( 'constel-map' ) || {} ).autorotate,
		threshold: 1,
		edges: true,
		lens: me,
		page: mw.util.getParamValue( 'page' ),
		data: null,
		themes: [],
		myThemes: [],
		selected: null,
		view: null
	};

	// ── Estructura ────────────────────────────────────────────────────────
	root.textContent = '';
	const controls = el( 'div', 'constel-ui constel-map__controls' );
	const layout = el( 'div', 'constel-map__layout' );
	const canvas = el( 'div', 'constel-map__canvas' );
	const aside = el( 'aside', 'constel-map__side' );
	const alt = el( 'details', 'constel-map__alt' );
	alt.append( el( 'summary', null, mw.msg( 'constellation-as-list' ) ) );
	const altList = el( 'ol', 'constel-map__fallback' );
	alt.append( altList );
	layout.append( canvas, aside );
	root.append( controls, layout, alt );

	// ── Controles ─────────────────────────────────────────────────────────
	const field = ( labelMsg, control ) => {
		const label = el( 'label', 'constel-map__field' );
		label.append( el( 'span', 'constel-label', mw.msg( labelMsg ) ), control );
		return label;
	};
	const scope = el( 'select', 'constel-input' );
	[ [ 'everyone', 'constellation-scope-everyone' ], [ 'mine', 'constellation-scope-mine' ] ].forEach( ( [ v, m ] ) => {
		const o = el( 'option', null, mw.msg( m ) );
		o.value = v;
		scope.append( o );
	} );
	scope.disabled = !me;
	scope.addEventListener( 'change', () => {
		state.scope = scope.value;
		loadGraph();
	} );

	const threshold = el( 'input', 'constel-input constel-map__threshold' );
	threshold.type = 'number';
	threshold.min = '1';
	threshold.value = '1';
	threshold.addEventListener( 'change', () => {
		state.threshold = Math.max( 1, Number( threshold.value ) || 1 );
		render();
	} );

	const edges = el( 'input' );
	edges.type = 'checkbox';
	edges.checked = true;
	edges.addEventListener( 'change', () => {
		state.edges = edges.checked;
		render();
	} );
	const edgesField = el( 'label', 'constel-map__field constel-map__field--inline' );
	edgesField.append( edges, ' ', mw.msg( 'constellation-edges' ) );

	const lens = el( 'input', 'constel-input' );
	lens.type = 'text';
	lens.value = me || '';
	lens.placeholder = mw.msg( 'constellation-lens-placeholder' );
	lens.addEventListener( 'change', () => {
		state.lens = lens.value.trim() || null;
		state.selected = null;
		loadThemes();
	} );

	const page = el( 'input', 'constel-input' );
	page.type = 'text';
	page.value = state.page || '';
	page.placeholder = mw.msg( 'constellation-page-placeholder' );
	page.addEventListener( 'change', () => {
		state.page = page.value.trim() || null;
		loadGraph();
	} );

	const mode = el( 'select', 'constel-input' );
	[ [ '3d', 'constellation-mode-3d' ], [ '2d', 'constellation-mode-2d' ] ].forEach( ( [ v, m ] ) => {
		const o = el( 'option', null, mw.msg( m ) );
		o.value = v;
		mode.append( o );
	} );
	mode.addEventListener( 'change', () => {
		state.mode = mode.value;
		// Nuevo layout desde cero: 2D y 3D no comparten posiciones.
		state.data.nodes.forEach( ( n ) => {
			delete n.x;
		} );
		render();
	} );

	// Girar solo: apagado por defecto; se recuerda por navegador.
	const spin = el( 'input' );
	spin.type = 'checkbox';
	spin.checked = state.autorotate;
	spin.addEventListener( 'change', () => {
		state.autorotate = spin.checked;
		mw.storage.setObject( 'constel-map', { autorotate: state.autorotate } );
		if ( state.view ) {
			state.view.setAutorotate( state.autorotate );
		}
	} );
	const spinField = el( 'label', 'constel-map__field constel-map__field--inline' );
	spinField.append( spin, ' ', mw.msg( 'constellation-autorotate' ) );
	const syncSpin = () => {
		spinField.hidden = state.mode !== '3d';
	};
	mode.addEventListener( 'change', syncSpin );
	syncSpin();

	const zoom = el( 'div', 'constel-map__zoom' );
	[ [ '+', 'constellation-zoom-in', () => state.view && state.view.zoomIn() ],
		[ '−', 'constellation-zoom-out', () => state.view && state.view.zoomOut() ],
		[ '⌂', 'constellation-zoom-reset', () => state.view && state.view.reset() ]
	].forEach( ( [ text, msg, fn ] ) => {
		const b = el( 'button', 'constel-button', text );
		b.type = 'button';
		b.setAttribute( 'aria-label', mw.msg( msg ) );
		b.title = mw.msg( msg );
		b.addEventListener( 'click', fn );
		zoom.append( b );
	} );

	controls.append(
		field( 'constellation-mode', mode ),
		field( 'constellation-scope', scope ),
		field( 'constellation-page', page ),
		field( 'constellation-threshold', threshold ),
		edgesField,
		spinField,
		field( 'constellation-lens', lens ),
		zoom
	);

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
		side.themesPanel( aside, state.themes, {
			editable: cfg.canAnnotate && state.lens === me,
			ownerLabel: state.lens ?
				( state.lens === me ? mw.msg( 'constellation-my-themes' ) : mw.msg( 'constellation-themes-of', state.lens ) ) :
				mw.msg( 'constellation-no-lens' ),
			onChanged: () => loadThemes(),
			onSelectConcept: ( id ) => {
				const node = state.data && state.data.nodes.find( ( n ) => n.id === id );
				if ( node ) {
					select( node );
				}
			}
		} );
	}

	function loadThemes() {
		const mine = me ? api.themesOf( me ) : Promise.resolve( [] );
		const lensThemes = !state.lens ? Promise.resolve( [] ) :
			state.lens === me ? mine : api.themesOf( state.lens );
		return Promise.all( [ mine, lensThemes ] ).then( ( [ my, lensed ] ) => {
			state.myThemes = my;
			state.themes = lensed;
			render();
			if ( !state.selected ) {
				renderThemes();
			}
		} );
	}

	function loadGraph() {
		canvas.textContent = mw.msg( 'constellation-loading' );
		const params = { cgscope: state.scope };
		const pageLookup = state.page ? api.pageId( state.page ) : Promise.resolve( null );
		return pageLookup.then( ( id ) => {
			if ( id ) {
				params.cgpageid = id;
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
