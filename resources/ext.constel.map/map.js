/**
 * Especial:Constelación — el mapa de conceptos (spec: ConceptMap).
 *
 * Barra de herramientas en dos filas:
 *  1. Vista 2D/3D (+ «Girar solo» sólo en 3D) · Mostrar aristas · fuerza de
 *     cada grado de proximidad · zoom (+ «volver al orden automático» en 2D,
 *     si hay conceptos fijados a mano).
 *  2. Píldoras con autocompletado: «Secciones de» (lectores; por defecto
 *     quien mira; un interruptor fuera de la caja lo desactiva = todas),
 *     «Páginas» (vacío = todas) y «Temas de» (la lente; por defecto quien
 *     mira, nunca vacía para una cuenta registrada). Los lectores se
 *     muestran con su nombre real (o el de usuario si no lo definieron).
 * Al elegir un concepto, el panel lateral muestra su detalle; si no, los
 * temas de la lente. Debajo, la misma información como lista
 * (AccessibleAlternative).
 *
 * A pantalla completa (cfg.full) el mapa posee el viewport: barra arriba y,
 * debajo, el par ante-dentro —ante, el grafo; dentro, el panel—, cada uno
 * con su propio scroll; la lista va al final de dentro para no quedar fuera
 * de la pantalla. La división entre ambos se arrastra (o se mueve con las
 * flechas) y cada navegador recuerda la proporción.
 */
const { api, icons } = require( 'ext.constel.ui' );
const graph = require( './graph.js' );
const side = require( './sidepanel.js' );
const pills = require( './pills.js' );

const cfg = mw.config.get( 'wgConstelMap' );
const me = mw.user.isNamed() ? mw.config.get( 'wgUserName' ) : null;
const full = !!cfg.full;
/** Proporción de ante (el grafo) en el par ante-dentro, en %. */
const ANTE_MIN = 20;
const ANTE_MAX = 80;
const ANTE_DEFAULT = 50;

/**
 * Preferencias del mapa por navegador: se fusionan, no se pisan.
 *
 * @return {Object} {autorotate, ante}
 */
function prefs() {
	return mw.storage.getObject( 'constel-map' ) || {};
}

function savePref( key, value ) {
	mw.storage.setObject( 'constel-map', Object.assign( prefs(), { [ key ]: value } ) );
}

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
 * La división del par ante-dentro: un separador que se arrastra con el
 * puntero o se mueve con las flechas (Inicio/Fin a los extremos; doble clic
 * vuelve a mitad y mitad). Fija --constel-ante en el layout; el lienzo sigue
 * a su celda solo (ResizeObserver en graph.js).
 *
 * @param {HTMLElement} layout
 * @return {HTMLElement}
 */
function divider( layout ) {
	const bar = el( 'div', 'constel-map__divider' );
	bar.setAttribute( 'role', 'separator' );
	bar.setAttribute( 'aria-orientation', 'vertical' );
	bar.setAttribute( 'aria-label', mw.msg( 'constellation-divider' ) );
	bar.setAttribute( 'aria-valuemin', String( ANTE_MIN ) );
	bar.setAttribute( 'aria-valuemax', String( ANTE_MAX ) );
	bar.tabIndex = 0;

	let ante = Number( prefs().ante ) || ANTE_DEFAULT;
	const set = ( value, keep ) => {
		ante = Math.round( Math.min( ANTE_MAX, Math.max( ANTE_MIN, value ) ) * 10 ) / 10;
		layout.style.setProperty( '--constel-ante', ante + '%' );
		bar.setAttribute( 'aria-valuenow', String( Math.round( ante ) ) );
		if ( keep ) {
			savePref( 'ante', ante );
		}
	};
	set( ante, false );

	let dragging = false;
	bar.addEventListener( 'pointerdown', ( e ) => {
		dragging = true;
		bar.setPointerCapture( e.pointerId );
		layout.classList.add( 'constel-map__layout--dragging' );
		e.preventDefault();
	} );
	bar.addEventListener( 'pointermove', ( e ) => {
		if ( dragging ) {
			const box = layout.getBoundingClientRect();
			set( ( e.clientX - box.left ) / box.width * 100, false );
		}
	} );
	const end = () => {
		if ( dragging ) {
			dragging = false;
			layout.classList.remove( 'constel-map__layout--dragging' );
			set( ante, true );
		}
	};
	bar.addEventListener( 'pointerup', end );
	bar.addEventListener( 'pointercancel', end );
	bar.addEventListener( 'dblclick', () => set( ANTE_DEFAULT, true ) );
	bar.addEventListener( 'keydown', ( e ) => {
		const step = e.shiftKey ? 10 : 2;
		const to = {
			ArrowLeft: ante - step,
			ArrowRight: ante + step,
			Home: ANTE_MIN,
			End: ANTE_MAX
		}[ e.key ];
		if ( to !== undefined ) {
			e.preventDefault();
			set( to, true );
		}
	} );
	return bar;
}

function main( root ) {
	const pageParam = mw.util.getParamValue( 'page' );
	const state = {
		// 2D por defecto: se lee de un vistazo y se arregla a mano.
		mode: '2d',
		autorotate: !!prefs().autorotate,
		edges: true,
		// Fuerza de cada grado de proximidad (0–1); se recuerda por navegador.
		forces: Object.assign( {}, graph.FORCES, prefs().forces || {} ),
		readersOn: !!me,
		readers: me ? [ me ] : [],
		readerLabel: ( name ) => name,
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
	const stage = el( 'div', 'constel-map__main' );
	const canvas = el( 'div', 'constel-map__canvas' );
	// Moderación del concepto seleccionado: bajo el mapa, no en el panel.
	const below = el( 'div', 'constel-map__below' );
	// El lienzo va dentro de un visor que lleva, en su esquina superior
	// derecha, el botón de pantalla completa del puro mapa (maximize ↔
	// minimize). Se pone en pantalla completa el visor, no el lienzo, para que
	// el botón siga a mano; Esc también sale.
	const viewport = el( 'div', 'constel-map__viewport' );
	viewport.append( canvas );
	if ( viewport.requestFullscreen ) {
		const fullscreen = icons.iconButton( 'maximize', mw.msg( 'constellation-fullscreen' ),
			'constel-button constel-button--icon constel-map__fullscreen' );
		fullscreen.addEventListener( 'click', () => {
			if ( document.fullscreenElement ) {
				document.exitFullscreen();
			} else {
				viewport.requestFullscreen().catch( () => {} );
			}
		} );
		document.addEventListener( 'fullscreenchange', () => {
			const on = document.fullscreenElement === viewport;
			const label = mw.msg( on ? 'constellation-fullscreen-exit' : 'constellation-fullscreen' );
			fullscreen.replaceChildren( icons.icon( on ? 'minimize' : 'maximize' ) );
			fullscreen.setAttribute( 'aria-label', label );
			fullscreen.title = label;
		} );
		viewport.append( fullscreen );
	}
	stage.append( viewport, below );
	const aside = el( 'aside', 'constel-map__side' );
	// Lo que cambia con la selección; la lista (a pantalla completa) queda.
	const sideBody = el( 'div', 'constel-map__side-body' );
	aside.append( sideBody );
	const alt = el( 'details', 'constel-map__alt' );
	alt.append( el( 'summary', null, mw.msg( 'constellation-as-list' ) ) );
	const altList = el( 'ol', 'constel-map__fallback' );
	alt.append( altList );
	layout.append( stage, aside );
	if ( full ) {
		root.classList.add( 'constel-map--full' );
		aside.append( alt );
		layout.append( divider( layout ) );
		root.append( controls, layout );
	} else {
		root.append( controls, layout, alt );
	}

	// Controles en línea: un ícono Feather en vez de rótulo; el nombre
	// queda como tooltip y para lectores de pantalla. Así la barra es baja.
	const iconLabel = ( iconName, msg ) => {
		const label = el( 'label', 'constel-map__field constel-map__field--icon' );
		label.title = mw.msg( msg );
		const mark = el( 'span', 'constel-map__icon' );
		mark.append( icons.icon( iconName ) );
		label.append( mark, el( 'span', 'constel-visually-hidden', mw.msg( msg ) ) );
		return label;
	};
	const field = ( iconName, labelMsg, control ) => {
		const label = iconLabel( iconName, labelMsg );
		label.append( control );
		return label;
	};
	const checkbox = ( iconName, msg, checked, onChange ) => {
		const input = el( 'input' );
		input.type = 'checkbox';
		input.checked = checked;
		input.addEventListener( 'change', () => onChange( input.checked ) );
		const label = iconLabel( iconName, msg );
		label.prepend( input );
		return { label, input };
	};

	// ── Fila 1: vista ─────────────────────────────────────────────────────
	const mode = el( 'select', 'constel-input' );
	[ [ '2d', 'constellation-mode-2d' ], [ '3d', 'constellation-mode-3d' ] ].forEach( ( [ v, m ] ) => {
		const o = el( 'option', null, mw.msg( m ) );
		o.value = v;
		mode.append( o );
	} );
	mode.value = state.mode;
	// Girar solo: junto a la vista, sólo en 3D; apagado por defecto.
	const spin = checkbox( 'rotate-cw', 'constellation-autorotate', state.autorotate, ( on ) => {
		state.autorotate = on;
		savePref( 'autorotate', on );
		if ( state.view ) {
			state.view.setAutorotate( on );
		}
	} );
	spin.label.hidden = state.mode !== '3d';
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
	viewGroup.append( field( 'eye', 'constellation-mode', mode ), spin.label );

	const edges = checkbox( 'share-2', 'constellation-edges', state.edges, ( on ) => {
		state.edges = on;
		render();
	} );
	const edgesGroup = el( 'div', 'constel-map__group' );
	edgesGroup.append( edges.label );

	// Proximidad: cada grado con su fuerza (0 = ni arista ni atracción).
	const forces = el( 'div', 'constel-map__forces' );
	forces.setAttribute( 'role', 'group' );
	forces.setAttribute( 'aria-label', mw.msg( 'constellation-proximity' ) );
	[ [ 'co_excerpt', 'constellation-force-coexcerpt', 'align-left' ],
		[ 'overlap', 'constellation-force-overlap', 'layers' ],
		[ 'co_page', 'constellation-force-copage', 'file-text' ]
	].forEach( ( [ kind, msg, iconName ] ) => {
		const range = el( 'input' );
		range.type = 'range';
		range.min = '0';
		range.max = '100';
		range.step = '5';
		range.value = String( Math.round( state.forces[ kind ] * 100 ) );
		const out = el( 'output' );
		const show = () => {
			const text = mw.language.convertNumber( Number( range.value ) ) + ' %';
			out.textContent = text;
			range.setAttribute( 'aria-valuetext', text );
		};
		show();
		range.addEventListener( 'input', show );
		range.addEventListener( 'change', () => {
			state.forces[ kind ] = Number( range.value ) / 100;
			savePref( 'forces', state.forces );
			// Otro equilibrio de fuerzas: layout desde cero.
			state.data.nodes.forEach( ( n ) => {
				delete n.x;
			} );
			render();
		} );
		const label = iconLabel( iconName, msg );
		label.classList.add( 'constel-map__force' );
		label.append( range, out );
		forces.append( label );
	} );

	// Navegación del mapa: íconos Feather con nombre accesible.
	const zoom = el( 'div', 'constel-map__zoom' );
	let unpin = null;
	zoom.setAttribute( 'role', 'group' );
	zoom.setAttribute( 'aria-label', mw.msg( 'constellation-navigation' ) );
	[ [ 'zoom-in', 'constellation-zoom-in', () => state.view && state.view.zoomIn() ],
		[ 'zoom-out', 'constellation-zoom-out', () => state.view && state.view.zoomOut() ],
		[ 'crosshair', 'constellation-zoom-reset', () => state.view && state.view.reset() ],
		// 2D: suelta los conceptos fijados a mano y rehace el layout.
		[ 'rotate-ccw', 'constellation-unpin', () => {
			state.data.nodes.forEach( ( n ) => {
				delete n.pin;
				delete n.x;
			} );
			render();
		} ],
		[ 'download', 'constellation-export-svg', () => state.view && exportSvg() ]
	].forEach( ( [ name, msg, fn ] ) => {
		const b = icons.iconButton( name, mw.msg( msg ) );
		b.addEventListener( 'click', fn );
		zoom.append( b );
		if ( name === 'rotate-ccw' ) {
			unpin = b;
			unpin.hidden = true;
		}
	} );
	const syncUnpin = () => {
		unpin.hidden = state.mode !== '2d' || !state.data.nodes.some( ( n ) => n.pin );
	};

	/**
	 * Parte segura para un nombre de archivo: minúsculas, sin tildes ni §,
	 * guiones en vez de espacios y signos.
	 *
	 * @param {string} text
	 * @return {string}
	 */
	function slug( text ) {
		return text.normalize( 'NFD' ).replace( /[\u0300-\u036f]/g, '' )
			.toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /^-+|-+$/g, '' );
	}

	/**
	 * mapa-{2d|3d}-{quien exporta}-{secciones}.svg; secciones = los lectores
	 * del filtro «Secciones de», o «all» si está vacío.
	 *
	 * @return {string}
	 */
	function fileName() {
		const who = slug( me || mw.msg( 'constellation-file-visitor' ) );
		const sections = state.readersOn && state.readers.length ?
			state.readers.map( slug ).join( '-' ) :
			'all';
		return [ mw.msg( 'constellation-file-prefix' ), state.mode, who, sections ].join( '-' ) + '.svg';
	}

	// Descarga el grafo tal como se ve (vista, filtros y proyección actuales).
	function exportSvg() {
		const describe = [
			state.readersOn ?
				mw.msg( 'constellation-sections' ) + ': ' + state.readers.map( state.readerLabel ).join( ', ' ) :
				'',
			state.pages.length ? mw.msg( 'constellation-pages' ) + ': ' + state.pages.join( ', ' ) : ''
		].filter( Boolean ).join( ' · ' );
		const svg = state.view.exportSvg( {
			title: mw.msg( 'constellation-svg-title', mw.config.get( 'wgSiteName' ) ),
			description: describe
		} );
		// La descarga la sirve la wiki (Especial:ConstellationSvg) como archivo
		// adjunto: con URLs blob:/data: algunos navegadores (Chrome en macOS)
		// guardaban el archivo trunco y sin extensión. El formulario se envía a
		// un iframe oculto, así la página del mapa nunca navega.
		let sink = document.getElementById( 'constel-svg-sink' );
		if ( !sink ) {
			sink = el( 'iframe' );
			sink.id = 'constel-svg-sink';
			sink.name = 'constel-svg-sink';
			sink.hidden = true;
			sink.title = mw.msg( 'constellation-export-svg' );
			document.body.append( sink );
		}
		const form = el( 'form' );
		form.method = 'post';
		form.action = mw.util.getUrl( 'Special:ConstellationSvg' );
		form.target = sink.name;
		form.hidden = true;
		[ [ 'svg', svg ], [ 'filename', fileName() ] ].forEach( ( [ name, value ] ) => {
			const input = el( 'input' );
			input.type = 'hidden';
			input.name = name;
			input.value = value;
			form.append( input );
		} );
		document.body.append( form );
		form.submit();
		form.remove();
	}
	// La marca, como isotipo al inicio de la barra (decorativa: la página ya
	// se llama Constelación).
	const brand = el( 'span', 'constel-map__brand', 'con§tel' );
	brand.setAttribute( 'aria-hidden', 'true' );
	rowView.append( brand, viewGroup, edgesGroup, forces, zoom );

	// ── Fila 2: filtros como píldoras ─────────────────────────────────────
	// Secciones: como la lente (por defecto quien mira; se suman lectores).
	// El interruptor, fuera de la caja, desactiva el filtro: todas.
	const readers = pills.create( {
		label: mw.msg( 'constellation-sections' ),
		icon: 'users',
		placeholder: mw.msg( 'constellation-add-reader' ),
		values: state.readers,
		min: 1,
		search: api.searchReaders,
		describe: api.describeReaders,
		onChange: ( values ) => {
			state.readers = values;
			loadGraph();
		}
	} );
	const readersSwitch = el( 'input', 'constel-switch' );
	readersSwitch.type = 'checkbox';
	readersSwitch.setAttribute( 'role', 'switch' );
	readersSwitch.checked = state.readersOn;
	const readersSwitchLabel = el( 'label', 'constel-map__field--inline constel-map__switch' );
	readersSwitch.setAttribute( 'aria-label', mw.msg( 'constellation-sections-filter' ) );
	readersSwitchLabel.title = mw.msg( 'constellation-sections-filter' );
	readersSwitchLabel.append( readersSwitch );
	const allNote = el( 'div', 'constel-pills__box constel-pills__box--off' );
	allNote.append( el( 'span', 'constel-pills__empty', mw.msg( 'constellation-all-sections' ) ) );
	const syncReaders = () => {
		readers.box.hidden = !state.readersOn;
		allNote.hidden = state.readersOn;
	};
	readersSwitch.addEventListener( 'change', () => {
		state.readersOn = readersSwitch.checked;
		syncReaders();
		loadGraph();
	} );
	readers.el.querySelector( '.constel-label' ).after( readersSwitchLabel );
	readers.box.after( allNote );
	state.readerLabel = readers.labelOf;
	syncReaders();
	const pages = pills.create( {
		label: mw.msg( 'constellation-pages' ),
		icon: 'file',
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
		icon: 'tag',
		placeholder: mw.msg( 'constellation-add-reader' ),
		empty: mw.msg( 'constellation-no-lens' ),
		values: state.lens,
		min: me ? 1 : 0,
		search: api.searchReaders,
		describe: api.describeReaders,
		onLabels: () => {
			if ( !state.selected ) {
				renderThemes();
			}
		},
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
				edges: state.edges,
				forces: state.forces,
				fill: full,
				themeOf: themeIndex(),
				onSelect: select,
				onArrange: syncUnpin
			} );
			if ( state.selected ) {
				state.view.select( state.selected.id );
			}
		}
		syncUnpin();
		renderList();
	}

	function renderList() {
		altList.textContent = '';
		const byId = new Map( state.data.nodes.map( ( n ) => [ n.id, n ] ) );
		const near = new Map();
		state.data.links.filter( ( l ) => state.forces[ l.kind ] > 0 ).forEach( ( l ) => {
			[ [ l.source, l.target ], [ l.target, l.source ] ].forEach( ( [ a, b ] ) => {
				const entry = { id: b, kind: l.kind, weight: l.weight };
				near.set( a, ( near.get( a ) || [] ).concat( entry ) );
			} );
		} );
		// Los temas de la lente que contienen cada concepto: lo que en el
		// grafo dice el color (spec: ConceptMap.AccessibleAlternative).
		const themesOf = new Map();
		state.themes.forEach( ( t ) => t.concepts.forEach( ( c ) => {
			themesOf.set( c.id, ( themesOf.get( c.id ) || [] ).concat(
				mw.msg( 'constellation-theme-of', t.label, lens.labelOf( t.author ) )
			) );
		} ) );
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
				const inThemes = themesOf.get( n.id ) || [];
				if ( inThemes.length ) {
					li.append( el( 'span', 'constel-map__in-themes', ' — ' + mw.msg(
						'constellation-list-themes', mw.language.listToText( inThemes ), inThemes.length
					) ) );
				}
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
		// Tras renombrar o fusionar, el grafo cambia: recargar y abrir el que queda.
		const onModerated = ( keepId ) => loadGraph().then( loadThemes ).then( () => {
			const kept = state.data.nodes.find( ( n ) => n.id === keepId );
			if ( kept ) {
				select( kept );
			}
		} );
		const box = el( 'div' );
		sideBody.textContent = '';
		sideBody.append( back, box );
		side.conceptDetail( box, node, {
			me,
			canAnnotate: cfg.canAnnotate,
			canModerate: cfg.canModerate,
			myThemes: state.myThemes,
			onChanged: () => loadThemes().then( () => select( node ) ),
			onModerated
		} );
		below.textContent = '';
		if ( cfg.canModerate ) {
			below.append( side.moderation( node, { onModerated } ) );
		}
	}

	function renderThemes() {
		sideBody.textContent = '';
		below.textContent = '';
		if ( !state.lens.length ) {
			sideBody.append( el( 'p', 'constel-side__meta', mw.msg( 'constellation-no-lens' ) ) );
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
					mw.msg( 'constellation-themes-of', lens.labelOf( name ) ),
				onChanged: () => loadThemes(),
				onSelectConcept: ( id ) => {
					const node = state.data && state.data.nodes.find( ( n ) => n.id === id );
					if ( node ) {
						select( node );
					}
				}
			} );
			offset += own.length;
			sideBody.append( box );
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
			if ( state.readersOn && state.readers.length ) {
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
