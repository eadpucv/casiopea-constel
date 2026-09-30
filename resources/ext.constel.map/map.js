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
const rings = require( './rings.js' );

const cfg = mw.config.get( 'wgConstelMap' );
const me = mw.user.isNamed() ? mw.config.get( 'wgUserName' ) : null;
const full = !!cfg.full;
/** Proporción de ante (el grafo) en el par ante-dentro, en %. */
const ANTE_MIN = 20;
const ANTE_MAX = 80;
const ANTE_DEFAULT = 50;
/** Cuánto dura un aviso sobre el mapa antes de apagarse solo (ms). */
const NOTICE_MS = 12000;
/** Máximo de lectores en el filtro «Secciones de» (uno por color de categoría). */
const MAX_READERS = 8;
/**
 * Valor de «Todos» en el filtro de lectores. Lleva «#», que un nombre de usuario
 * no puede tener, así nunca choca con uno.
 */
const ALL_READERS = '#todos';
/** Ícono de «Todos»: en la píldora y en el autocompletado. */
const ALL_ICON = 'globe';

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

/**
 * Un color CSS cualquiera (variables, light-dark(), oklch…) como #rrggbb, que
 * es lo que entiende un input type=color: se pinta en un canvas de un píxel.
 *
 * @param {string} color
 * @return {string}
 */
function toHex( color ) {
	const ctx = toHex.ctx || ( toHex.ctx = document.createElement( 'canvas' ).getContext( '2d', { willReadFrequently: true } ) );
	ctx.clearRect( 0, 0, 1, 1 );
	ctx.fillStyle = '#000';
	ctx.fillStyle = color;
	ctx.fillRect( 0, 0, 1, 1 );
	const [ r, g, b ] = ctx.getImageData( 0, 0, 1, 1 ).data;
	return '#' + [ r, g, b ].map( ( v ) => v.toString( 16 ).padStart( 2, '0' ) ).join( '' );
}

/**
 * El color por omisión de la posición `index` en el filtro de lectores: el
 * mismo de las categorías de los temas, ya resuelto para el tema claro u oscuro.
 *
 * @param {number} index
 * @return {string}
 */
function defaultReaderColor( index ) {
	const probe = document.createElement( 'span' );
	probe.style.color = `var(--constel-cat-${ index % 8 })`;
	document.body.append( probe );
	const color = getComputedStyle( probe ).color;
	probe.remove();
	return toHex( color );
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
		// Conceptos como 'words' (palabras, por omisión) o 'nodes' (círculos).
		// Con nodos, `lead` (apagado por
		// omisión: nodos son nodos) rotula los principales. Ambos se recuerdan
		// por navegador.
		concepts: [ 'words', 'nodes' ].includes( prefs().concepts ) ? prefs().concepts : null,
		lead: prefs().lead === true,
		// Fuerza de cada grado de proximidad (0–1); se recuerda por navegador.
		forces: Object.assign( {}, graph.FORCES, prefs().forces || {} ),
		// Si quien mira ya fijó sus fuerzas, no se le cambian (autoForces).
		forcesTouched: !!prefs().forces,
		// Color elegido para cada lector (usuario → #rrggbb); el que no tiene
		// usa el de su lugar en el filtro (readerColor).
		readerColors: prefs().readerColors || {},
		themeColors: prefs().themeColors || {},
		// Con varios lectores: todo, sólo lo compartido, o sólo lo propio de cada uno.
		scope: 'all',
		// Lectores del filtro «Secciones de»: quien mira, o «Todos» (ALL_READERS)
		// para un visitante anónimo.
		readers: me ? [ me ] : [ ALL_READERS ],
		readerLabel: ( name ) => name,
		pages: pageParam ? [ pageParam ] : [],
		lens: me ? [ me ] : [],
		data: null,
		// Grados de arista ya pedidos a la API (sólo se piden los que tienen
		// fuerza), los filtros con que se pidieron y la vuelta de carga vigente.
		kinds: new Set(),
		graphParams: {},
		// Vista de anillos abierta (rings.open) y sus datos, con los tres grados.
		rings: null,
		ringData: null,
		epoch: 0,
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
	// Avisos de los topes de carga (mapa recortado, rótulos o aristas limitados):
	// una sobreposición sobre el mapa, sin lugar propio en el diseño, que se
	// cierra con su botón y se apaga sola pasado un rato.
	const notice = el( 'div', 'constel-map__notice' );
	notice.setAttribute( 'role', 'status' );
	const noticeText = el( 'span', 'constel-map__notice-text' );
	const noticeClose = icons.iconButton( 'x', mw.msg( 'constellation-notice-close' ),
		'constel-button constel-button--icon constel-map__notice-close' );
	notice.append( noticeText, noticeClose );
	notice.hidden = true;
	// El lienzo va dentro de un visor que lleva, en su esquina superior
	// derecha, el botón de pantalla completa del puro mapa (maximize ↔
	// minimize). Se pone en pantalla completa el visor, no el lienzo, para que
	// el botón siga a mano; Esc también sale.
	const viewport = el( 'div', 'constel-map__viewport' );
	viewport.append( canvas, notice );
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

	// Controles en línea: un ícono Lucide en vez de rótulo; el nombre
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
	// Interruptor (role=switch) o casilla con su ícono: el nombre va en el
	// tooltip y para lectores de pantalla, así la barra es baja.
	const toggle = ( iconName, text, checked, onChange, asSwitch ) => {
		const label = el( 'label', 'constel-map__toggle' );
		label.title = text;
		const input = el( 'input', asSwitch ? 'constel-switch' : null );
		input.type = 'checkbox';
		if ( asSwitch ) {
			input.setAttribute( 'role', 'switch' );
		}
		input.checked = checked;
		input.addEventListener( 'change', () => onChange( input.checked ) );
		const mark = el( 'span', 'constel-map__icon' );
		mark.append( icons.icon( iconName ) );
		label.append( input, mark, el( 'span', 'constel-visually-hidden', text ) );
		return { label, input };
	};
	// Una de dos opciones con su ícono (botón con nombre accesible).
	const iconChoice = ( iconName, text ) => {
		const button = icons.iconButton( iconName, text, 'constel-map__choice' );
		button.setAttribute( 'aria-pressed', 'false' );
		return button;
	};

	// ── Fila 1: vista ─────────────────────────────────────────────────────
	// Vista plana (2D) o en el espacio (3D): un interruptor con un ícono a cada
	// lado, como palabras ⇄ nodos. «Girar solo» sólo existe en 3D.
	const flatChoice = iconChoice( 'square', mw.msg( 'constellation-mode-2d' ) );
	const spaceChoice = iconChoice( 'box', mw.msg( 'constellation-mode-3d' ) );
	const viewSwitch = el( 'input', 'constel-switch' );
	viewSwitch.type = 'checkbox';
	viewSwitch.setAttribute( 'role', 'switch' );
	viewSwitch.setAttribute( 'aria-label', mw.msg( 'constellation-mode-3d' ) );
	// Girar solo: junto a la vista, sólo en 3D; apagado por defecto.
	const spin = toggle( 'rotate-3d', mw.msg( 'constellation-autorotate' ), state.autorotate, ( on ) => {
		state.autorotate = on;
		savePref( 'autorotate', on );
		if ( state.view ) {
			state.view.setAutorotate( on );
		}
	}, false );
	const syncMode = () => {
		const space = state.mode === '3d';
		viewSwitch.checked = space;
		flatChoice.classList.toggle( 'constel-map__choice--on', !space );
		spaceChoice.classList.toggle( 'constel-map__choice--on', space );
		flatChoice.setAttribute( 'aria-pressed', String( !space ) );
		spaceChoice.setAttribute( 'aria-pressed', String( space ) );
		spin.label.hidden = !space;
	};
	const chooseMode = ( value ) => {
		if ( value === state.mode ) {
			return;
		}
		state.mode = value;
		syncMode();
		// Nuevo layout desde cero: 2D y 3D no comparten posiciones.
		state.data.nodes.forEach( ( n ) => {
			delete n.x;
		} );
		renderSoon();
	};
	viewSwitch.addEventListener( 'change', () => chooseMode( viewSwitch.checked ? '3d' : '2d' ) );
	flatChoice.addEventListener( 'click', () => chooseMode( '2d' ) );
	spaceChoice.addEventListener( 'click', () => chooseMode( '3d' ) );
	const viewGroup = el( 'div', 'constel-map__group' );
	viewGroup.setAttribute( 'role', 'group' );
	viewGroup.setAttribute( 'aria-label', mw.msg( 'constellation-mode' ) );
	viewGroup.title = mw.msg( 'constellation-mode' );
	viewGroup.append( flatChoice, viewSwitch, spaceChoice, spin.label );
	syncMode();

	const edges = toggle( 'waypoints', mw.msg( 'constellation-edges' ), state.edges, ( on ) => {
		state.edges = on;
		renderSoon();
	}, true );
	const edgesGroup = el( 'div', 'constel-map__group' );
	edgesGroup.append( edges.label );

	// Conceptos como palabras o como nodos (círculos de área proporcional a su
	// frecuencia y del color de su tema), con un interruptor que dice las dos
	// cosas. Con nodos, «Rotular los principales» deja la palabra de los más
	// frecuentes. Las aristas de un mapa de nodos se dibujan al apuntar uno.
	const effectiveConcepts = () => state.concepts || 'words';
	// Lo que entiende graph.draw: todos los rótulos, sólo los principales o ninguno.
	const conceptsMode = () => effectiveConcepts() === 'words' ? 'all' : ( state.lead ? 'main' : 'none' );
	const conceptsGroup = el( 'div', 'constel-map__group' );
	conceptsGroup.setAttribute( 'role', 'group' );
	conceptsGroup.setAttribute( 'aria-label', mw.msg( 'constellation-concepts' ) );
	const wordsLabel = iconChoice( 'type', mw.msg( 'constellation-concepts-words' ) );
	const nodesLabel = iconChoice( 'circle-dot', mw.msg( 'constellation-concepts-nodes' ) );
	const conceptsSwitch = el( 'input', 'constel-switch' );
	conceptsSwitch.type = 'checkbox';
	conceptsSwitch.setAttribute( 'role', 'switch' );
	conceptsSwitch.setAttribute( 'aria-label', mw.msg( 'constellation-concepts-nodes' ) );
	const lead = toggle( 'star', mw.msg( 'constellation-lead' ), state.lead, ( on ) => {
		state.lead = on;
		savePref( 'lead', on );
		renderSoon();
	}, false );
	const syncConcepts = () => {
		const nodes = effectiveConcepts() === 'nodes';
		conceptsSwitch.checked = nodes;
		wordsLabel.classList.toggle( 'constel-map__choice--on', !nodes );
		nodesLabel.classList.toggle( 'constel-map__choice--on', nodes );
		wordsLabel.setAttribute( 'aria-pressed', String( !nodes ) );
		nodesLabel.setAttribute( 'aria-pressed', String( nodes ) );
		lead.label.hidden = !nodes;
	};
	const chooseConcepts = ( value ) => {
		state.concepts = value;
		savePref( 'concepts', value );
		syncConcepts();
		renderSoon();
	};
	conceptsSwitch.addEventListener( 'change', () => chooseConcepts( conceptsSwitch.checked ? 'nodes' : 'words' ) );
	wordsLabel.addEventListener( 'click', () => chooseConcepts( 'words' ) );
	nodesLabel.addEventListener( 'click', () => chooseConcepts( 'nodes' ) );
	conceptsGroup.append( wordsLabel, conceptsSwitch, nodesLabel, lead.label );
	syncConcepts();

	// Proximidad: cada grado con su fuerza (0 = ni arista ni atracción).
	const forces = el( 'div', 'constel-map__forces' );
	forces.setAttribute( 'role', 'group' );
	forces.setAttribute( 'aria-label', mw.msg( 'constellation-proximity' ) );
	// El mapa sigue al control mientras se arrastra: a lo más un recálculo
	// por cuadro, con el último valor (graph.setForces parte tibio del
	// equilibrio anterior, así que no salta). Al soltar sólo se recuerda.
	// Varios lectores en el filtro «Secciones de», y si el mapa muestra sólo una parte.
	const everyone = () => state.readers.includes( ALL_READERS );
	const isMulti = () => !everyone() && state.readers.length >= 2;
	const readerColor = ( name, index ) => state.readerColors[ name ] ||
		defaultReaderColor( index );
	const isFiltered = () => isMulti() && state.scope !== 'all';

	// El mapa tarda en leerse y calcularse: mientras tanto el lienzo lo dice, con el
	// texto al centro. Un cambio de vista sobre un mapa grande lo muestra primero
	// y deja pintar un cuadro antes de calcular, para que no parezca colgado.
	function showLoading() {
		canvas.textContent = '';
		canvas.append( el( 'p', 'constel-map__loading', mw.msg( 'constellation-loading-map' ) ) );
	}
	function renderSoon() {
		if ( !state.data || state.data.nodes.length < 150 ) {
			render();
			return;
		}
		showLoading();
		requestAnimationFrame( () => setTimeout( render, 0 ) );
	}
	let pendingForces = null;
	const applyForces = () => {
		if ( !pendingForces ) {
			pendingForces = requestAnimationFrame( () => {
				pendingForces = null;
				// Un grado que estaba en 0 y recién tiene fuerza aún no se
				// pidió: se pide y se suma sin redibujar el mapa.
				ensureKinds().then( ( added ) => {
					if ( added.length && isFiltered() ) {
						// El mapa dibuja una copia filtrada: se suman a los datos y se redibuja.
						added.forEach( ( link ) => state.data.links.push( link ) );
						render();
						return;
					}
					if ( state.view && state.view.overloads( state.forces ) ) {
						// Con estas fuerzas las aristas ya no caben: se redibuja, y el
						// mapa las dibuja sólo al apuntar un concepto.
						if ( added.length ) {
							added.forEach( ( link ) => state.data.links.push( link ) );
						}
						render();
						return;
					}
					if ( state.view ) {
						if ( added.length ) {
							state.view.addLinks( added );
						} else {
							state.view.setForces( state.forces );
						}
					}
					if ( added.length ) {
						renderList();
					}
				} );
			} );
		}
	};
	const forceInputs = {};
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
		forceInputs[ kind ] = { range, show };
		range.addEventListener( 'input', () => {
			show();
			state.forces[ kind ] = Number( range.value ) / 100;
			applyForces();
		} );
		range.addEventListener( 'change', () => {
			state.forces[ kind ] = Number( range.value ) / 100;
			state.forcesTouched = true;
			savePref( 'forces', state.forces );
			applyForces();
			// La lista alternativa nombra sólo las aristas de grados con fuerza.
			if ( state.data ) {
				renderList();
			}
		} );
		const label = iconLabel( iconName, msg );
		label.classList.add( 'constel-map__force' );
		label.append( range, out );
		forces.append( label );
	} );

	// Con varios lectores el mapa parte con el traslape al 100 % y el mismo
	// texto en 0 % (lo que une a lectores distintos), salvo que quien mira ya
	// haya guardado sus fuerzas (spec: ConceptMap.OverlapFirstForSeveralReaders).
	const autoForces = () => {
		if ( state.forcesTouched ) {
			return;
		}
		// eslint-disable-next-line camelcase
		Object.assign( state.forces, graph.FORCES, isMulti() ? { overlap: 1, co_page: 0 } : {} );
		Object.keys( forceInputs ).forEach( ( kind ) => {
			forceInputs[ kind ].range.value = String( Math.round( state.forces[ kind ] * 100 ) );
			forceInputs[ kind ].show();
		} );
	};

	// Navegación del mapa: íconos Lucide con nombre accesible.
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
		const sections = everyone() ? 'all' : state.readers.map( slug ).join( '-' );
		return [ mw.msg( 'constellation-file-prefix' ), state.mode, who, sections ].join( '-' ) + '.svg';
	}

	// Descarga el grafo tal como se ve (vista, filtros y proyección actuales).
	function exportSvg() {
		const describe = [
			mw.msg( 'constellation-sections' ) + ': ' + state.readers.map( state.readerLabel ).join( ', ' ),
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
	// Con varios lectores (fila «qué se ve»): qué conceptos se ven, si todos, los
	// que comparten dos o más de los lectores filtrados o los propios de uno solo.
	const SCOPES = [
		{ value: 'all', msg: 'constellation-scope-all' },
		{ value: 'shared', msg: 'constellation-scope-shared' },
		{ value: 'own', msg: 'constellation-scope-own' }
	];
	const scope = el( 'select', 'constel-input' );
	SCOPES.forEach( ( option ) => {
		const o = el( 'option', null, mw.msg( option.msg ) );
		o.value = option.value;
		scope.append( o );
	} );
	const scopeField = field( 'filter', 'constellation-scope', scope );
	scopeField.hidden = true;
	const syncScope = () => {
		scopeField.hidden = !isMulti();
		scope.value = state.scope;
	};
	scope.addEventListener( 'change', () => {
		state.scope = scope.value;
		renderSoon();
	} );
	rowView.append( brand, viewGroup, edgesGroup, conceptsGroup, forces, zoom );

	// ── Fila 2: filtros como píldoras ─────────────────────────────────────
	// Secciones: como la lente (por defecto quien mira; se suman lectores).
	// «Todos» es un lector más, con su ícono: reemplaza a los demás y quita el filtro.
	const readers = pills.create( {
		label: mw.msg( 'constellation-sections' ),
		hint: mw.msg( 'constellation-sections-hint' ),
		icon: 'users',
		placeholder: mw.msg( 'constellation-add-reader' ),
		values: state.readers,
		min: 1,
		max: MAX_READERS,
		exclusive: ALL_READERS,
		valueIcon: ( value ) => value === ALL_READERS ? ALL_ICON : null,
		// Con varios lectores, cada píldora lleva el color de su lector (un
		// círculo que abre el selector de color) con el que se pinta en el mapa.
		decorate: ( value, index, count, label ) => {
			if ( count < 2 ) {
				return null;
			}
			const color = readerColor( value, index );
			const swatch = el( 'label', 'constel-pill__color' );
			swatch.style.background = color;
			swatch.title = mw.msg( 'constellation-reader-color', label );
			const input = el( 'input' );
			input.type = 'color';
			input.value = color;
			input.setAttribute( 'aria-label', mw.msg( 'constellation-reader-color', label ) );
			input.addEventListener( 'input', () => {
				swatch.style.background = input.value;
			} );
			input.addEventListener( 'change', () => {
				state.readerColors[ value ] = input.value;
				savePref( 'readerColors', state.readerColors );
				render();
			} );
			swatch.append( input );
			return swatch;
		},
		search: ( typed ) => api.searchReaders( typed ).then( ( found ) => {
			// «Todos» se ofrece como un lector más, con su ícono, al escribir su inicio.
			const all = mw.msg( 'constellation-all-readers' );
			return all.toLowerCase().startsWith( typed.trim().toLowerCase() ) ?
				[ { value: ALL_READERS, label: all, icon: ALL_ICON } ].concat( found ) :
				found;
		} ),
		describe: ( values ) => api.describeReaders( values.filter( ( v ) => v !== ALL_READERS ) )
			.then( ( found ) => found.set( ALL_READERS, mw.msg( 'constellation-all-readers' ) ) ),
		onChange: ( values ) => {
			state.readers = values;
			loadGraph();
		}
	} );
	state.readerLabel = readers.labelOf;
	const pages = pills.create( {
		label: mw.msg( 'constellation-pages' ),
		hint: mw.msg( 'constellation-pages-hint' ),
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
		hint: mw.msg( 'constellation-lens-hint' ),
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
	rowFilters.append( readers.el, pages.el, lens.el, scopeField );

	// ── Datos y dibujo ────────────────────────────────────────────────────
	const themeIndex = () => {
		const map = new Map();
		state.themes.forEach( ( t, i ) => t.concepts.forEach( ( c ) => map.set( c.id, i ) ) );
		return map;
	};
	// Color de un tema: el que eligió el lector, o el de su categoría.
	const themeColor = ( theme, index ) => state.themeColors[ theme.id ] ||
		defaultReaderColor( index );
	// Concepto → color, sólo de los temas con color propio.
	const conceptColors = () => {
		const map = new Map();
		state.themes.forEach( ( t ) => {
			if ( state.themeColors[ t.id ] ) {
				t.concepts.forEach( ( c ) => map.set( c.id, state.themeColors[ t.id ] ) );
			}
		} );
		return map;
	};

	/**
	 * Lo que se dibuja: todo, o con varios lectores sólo los conceptos que
	 * aportan dos o más de ellos (compartido) o uno solo (propio), con las
	 * aristas entre los que quedan.
	 *
	 * @return {{nodes: Array, links: Array}}
	 */
	function visibleData() {
		if ( !isFiltered() ) {
			return state.data;
		}
		const contributors = ( n ) => Object.keys( n.readers || {} ).length;
		const keep = state.scope === 'shared' ?
			( n ) => contributors( n ) >= 2 :
			( n ) => contributors( n ) === 1;
		const nodes = state.data.nodes.filter( keep );
		const ids = new Set( nodes.map( ( n ) => n.id ) );
		return {
			nodes,
			links: state.data.links.filter( ( l ) => ids.has( l.source ) && ids.has( l.target ) )
		};
	}

	function render() {
		if ( !state.data ) {
			return;
		}
		if ( state.rings ) {
			// Con los anillos abiertos el lienzo es de ellos: sólo se repintan los temas.
			state.rings.setThemes( themeIndex(), conceptColors() );
			renderList();
			return;
		}
		const shown = visibleData();
		if ( !shown.nodes.length ) {
			if ( state.view ) {
				state.view.destroy();
				state.view = null;
			}
			canvas.textContent = '';
			canvas.append( el( 'p', 'constel-map__empty', mw.msg( 'constellation-empty' ) ) );
		} else {
			if ( state.view ) {
				state.view.destroy();
			}
			state.view = graph.draw( canvas, shown, {
				readers: isMulti() ? state.readers : null,
				readerColors: isMulti() ? state.readers.map( readerColor ) : null,
				mode: state.mode,
				autorotate: state.autorotate,
				edges: state.edges,
				labels: conceptsMode(),
				mainLabels: cfg.mainLabels,
				maxLabels: cfg.maxLabels,
				maxLinks: cfg.maxLinks,
				forces: state.forces,
				fill: full,
				themeOf: themeIndex(),
				conceptColors: conceptColors(),
				onSelect: select,
				onArrange: syncUnpin
			} );
			if ( state.selected ) {
				state.view.select( state.selected.id );
			}
		}
		syncUnpin();
		syncConcepts();
		syncScope();
		syncNotice();
		renderList();
	}

	// Muestra un aviso sobre el mapa; lo cerrado o vencido no vuelve a salir
	// mientras el texto sea el mismo (un texto nuevo sí).
	let noticeTimer = null;
	let noticeDone = '';
	function dismissNotice() {
		clearTimeout( noticeTimer );
		noticeDone = noticeText.textContent;
		notice.hidden = true;
	}
	noticeClose.addEventListener( 'click', dismissNotice );
	function showNotice( text ) {
		if ( !text ) {
			clearTimeout( noticeTimer );
			noticeDone = '';
			notice.hidden = true;
		} else if ( text !== noticeDone && ( notice.hidden || text !== noticeText.textContent ) ) {
			noticeText.textContent = text;
			notice.hidden = false;
			clearTimeout( noticeTimer );
			noticeTimer = setTimeout( dismissNotice, NOTICE_MS );
		}
	}

	// Lo que el mapa recortó para no colgarse: conceptos, rótulos o aristas.
	function syncNotice() {
		const notes = [];
		const data = state.data;
		if ( data && data.total > data.nodes.length ) {
			const shown = mw.language.convertNumber( data.nodes.length );
			notes.push( mw.msg( 'constellation-notice-nodes', shown, mw.language.convertNumber( data.total ) ) );
		}
		const limits = state.view && state.view.limits;
		if ( limits && limits.labels ) {
			const shownLabels = mw.language.convertNumber( limits.labels );
			notes.push( mw.msg( 'constellation-notice-labels', shownLabels ) );
		}
		if ( limits && limits.links ) {
			notes.push( mw.msg( 'constellation-notice-links', mw.language.convertNumber( limits.links ) ) );
		}
		showNotice( notes.join( ' ' ) );
	}

	function renderList() {
		altList.textContent = '';
		const shown = visibleData();
		const byId = new Map( shown.nodes.map( ( n ) => [ n.id, n ] ) );
		const near = new Map();
		shown.links.filter( ( l ) => state.forces[ l.kind ] > 0 ).forEach( ( l ) => {
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
		shown.nodes.slice().sort( byFrequency )
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

	/**
	 * Los tres grados de todas las aristas, para los anillos (aparte de lo
	 * que el mapa cargó según las fuerzas), una vez por vuelta de carga.
	 *
	 * @return {Promise<{nodes: Array, links: Array}>}
	 */
	function loadRingData() {
		if ( !state.ringData ) {
			const kinds = Object.keys( graph.FORCES );
			const params = Object.assign( {}, state.graphParams, { cgkinds: kinds } );
			state.ringData = api.graph( params );
		}
		return state.ringData;
	}

	function closeRings() {
		if ( !state.rings ) {
			return;
		}
		state.rings.destroy();
		state.rings = null;
		// Vuelve al mapa con la misma selección.
		render();
	}

	function openRings( node ) {
		showLoading();
		loadRingData().then( ( data ) => {
			if ( state.view ) {
				state.view.destroy();
				state.view = null;
			}
			state.rings = rings.open( canvas, data, {
				center: node.id,
				themeOf: themeIndex(),
				conceptColors: conceptColors(),
				onSelect: ( chosen ) => select( chosen ),
				onClose: closeRings
			} );
		}, () => render() );
	}

	function select( node ) {
		state.selected = node;
		if ( state.view ) {
			state.view.select( node.id );
		}
		if ( state.rings ) {
			state.rings.center( node.id );
		}
		// «← Temas»: texto discreto con su flecha, no un botón.
		const back = el( 'button', 'constel-backlink' );
		back.type = 'button';
		back.append( icons.icon( 'arrow-left' ), el( 'span', null, mw.msg( 'constellation-back-to-themes' ) ) );
		back.title = mw.msg( 'constellation-back-to-themes-hint' );
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
		// Sólo el ícono (círculos concéntricos): el nombre va de tooltip y de nombre accesible.
		const ringsButton = icons.iconButton( 'disc-2', mw.msg( 'constellation-rings-open' ),
			'constel-map__choice constel-map__rings' );
		ringsButton.hidden = !!state.rings;
		ringsButton.addEventListener( 'click', () => openRings( node ) );
		const box = el( 'div' );
		sideBody.textContent = '';
		// Fila de cabecera: «← Temas» a la izquierda y los anillos a la derecha,
		// centrados en la misma línea.
		const head = el( 'div', 'constel-map__head' );
		head.append( back, ringsButton );
		sideBody.append( head, box );
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
				// Borrar lo propio no pide el derecho (spec: RightToWithdraw).
				deletable: !!me && name === me,
				colorOffset: offset,
				themeColor,
				onThemeColor: ( theme, color ) => {
					state.themeColors[ theme.id ] = color;
					savePref( 'themeColors', state.themeColors );
					render();
				},
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

	/**
	 * Grados de arista con fuerza mayor que cero: los únicos que el mapa
	 * usa (con 0 no dibujan ni atraen), así que los únicos que se piden.
	 *
	 * @param {Set<string>} [except] grados que no hace falta pedir
	 * @return {string[]}
	 */
	function wantedKinds( except ) {
		return Object.keys( graph.FORCES )
			.filter( ( kind ) => state.forces[ kind ] > 0 && !( except && except.has( kind ) ) );
	}

	/**
	 * Pide los grados con fuerza que aún no se cargaron, con los mismos
	 * filtros del mapa vigente.
	 *
	 * @return {Promise<Array>} las aristas que llegaron (vacío si no faltaba nada)
	 */
	function ensureKinds() {
		const missing = wantedKinds( state.kinds );
		if ( !missing.length || !state.data ) {
			return Promise.resolve( [] );
		}
		const epoch = state.epoch;
		missing.forEach( ( kind ) => state.kinds.add( kind ) );
		const params = Object.assign( {}, state.graphParams, { cgkinds: missing } );
		// Si mientras tanto cambiaron los filtros, estas aristas son de otro mapa.
		const fresh = ( found ) => epoch === state.epoch ? found.links : [];
		return api.graph( params ).then( fresh, () => {
			missing.forEach( ( kind ) => state.kinds.delete( kind ) );
			return [];
		} );
	}

	function loadGraph() {
		showLoading();
		const epoch = ++state.epoch;
		autoForces();
		if ( !isMulti() ) {
			state.scope = 'all';
		}
		// Otros filtros son otro mapa: los anillos se cierran y se vuelven a abrir a mano.
		state.ringData = null;
		if ( state.rings ) {
			state.rings.destroy();
			state.rings = null;
		}
		return api.pageIds( state.pages ).then( ( ids ) => {
			const params = {};
			if ( !everyone() ) {
				params.cgusers = state.readers;
			}
			if ( state.pages.length ) {
				// Páginas inexistentes: filtro imposible, no "todas".
				params.cgpageids = ids.length ? ids : [ 0 ];
			}
			state.graphParams = params;
			const kinds = wantedKinds();
			return api.graph( Object.assign( { cgkinds: kinds }, params ) ).then( ( data ) => {
				if ( epoch === state.epoch ) {
					state.kinds = new Set( kinds );
				}
				return data;
			} );
		} ).then( ( data ) => {
			if ( epoch !== state.epoch ) {
				return;
			}
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

// Para las pruebas QUnit (la lógica pura del grafo).
module.exports = { graph, rings };
