/**
 * Controles de lectura en el menú de usuario (spec: PageReading.ScopeToggle,
 * MarksToggle, ReadingControlsReachable). El servidor agrega la entrada
 * (PageHooks::onSkinTemplateNavigation__Universal) con el mecanismo estándar
 * de portlets, así que funciona en cualquier skin; aquí su enlace se cambia
 * por un control de tres posiciones, como en con§tel:
 *
 *   −   sin marcas (lectura limpia; el alcance elegido se conserva)
 *   §   sólo mis secciones (alcance mine)
 *   §*  las secciones de todos (alcance everyone)
 *
 * Es un grupo de radios: Tab entra al elegido y las flechas se mueven entre
 * los tres. Se recuerda por navegador.
 */
const STORAGE_KEY = 'constel-reading';

const OPTIONS = [
	{ value: 'none', sign: '−', msg: 'constel-reading-none' },
	{ value: 'mine', sign: '§', msg: 'constel-reading-mine' },
	{ value: 'everyone', sign: '§*', msg: 'constel-reading-everyone' }
];

function load() {
	const saved = mw.storage.getObject( STORAGE_KEY ) || {};
	return { scope: saved.scope === 'everyone' ? 'everyone' : 'mine', marks: saved.marks !== false };
}

/**
 * @param {Object} state {scope, marks}
 * @param {Function} onChange (state) => void
 */
function bind( state, onChange ) {
	const item = document.getElementById( 'pt-constel-reading' );
	if ( !item ) {
		return;
	}
	const group = document.createElement( 'div' );
	group.className = 'constel-ui constel-seg';
	group.setAttribute( 'role', 'radiogroup' );
	group.setAttribute( 'aria-label', mw.msg( 'constel-reading-menu' ) );
	const buttons = OPTIONS.map( ( option ) => {
		const b = document.createElement( 'button' );
		b.type = 'button';
		b.className = 'constel-seg__option';
		b.setAttribute( 'role', 'radio' );
		b.setAttribute( 'aria-label', mw.msg( option.msg ) );
		b.title = mw.msg( option.msg );
		b.textContent = option.sign;
		b.dataset.value = option.value;
		group.append( b );
		return b;
	} );
	item.textContent = '';
	item.append( group );

	const current = () => state.marks ? state.scope : 'none';
	const sync = () => {
		buttons.forEach( ( b ) => {
			const on = b.dataset.value === current();
			b.setAttribute( 'aria-checked', String( on ) );
			b.tabIndex = on ? 0 : -1;
		} );
		mw.storage.setObject( STORAGE_KEY, state );
	};
	const choose = ( value ) => {
		if ( value === 'none' ) {
			state.marks = false;
		} else {
			state.marks = true;
			state.scope = value;
		}
		sync();
		onChange( state );
	};
	buttons.forEach( ( b, i ) => {
		// Elegir no cierra el menú del skin: se ve el cambio en la página.
		b.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			e.stopPropagation();
			choose( b.dataset.value );
		} );
		b.addEventListener( 'keydown', ( e ) => {
			const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[ e.key ];
			if ( step ) {
				e.preventDefault();
				const next = buttons[ ( i + step + buttons.length ) % buttons.length ];
				next.focus();
				choose( next.dataset.value );
			}
		} );
	} );
	sync();
}

module.exports = { load, bind };
