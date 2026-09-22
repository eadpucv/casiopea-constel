/**
 * Controles de lectura en el menú de usuario (spec: PageReading.ScopeToggle,
 * MarksToggle, ReadingControlsReachable). El servidor agrega las entradas
 * (PageHooks::onSkinTemplateNavigation__Universal) con el mecanismo estándar
 * de portlets, así que funcionan en cualquier skin; aquí se les da
 * comportamiento y se refleja el estado. Se recuerda por navegador.
 */
const STORAGE_KEY = 'constel-reading';

function load() {
	const saved = mw.storage.getObject( STORAGE_KEY ) || {};
	return { scope: saved.scope === 'everyone' ? 'everyone' : 'mine', marks: saved.marks !== false };
}

/**
 * @param {Object} state {scope, marks}
 * @param {Function} onChange (state) => void
 */
function bind( state, onChange ) {
	const link = ( id ) => document.querySelector( '#pt-' + id + ' a' );
	const items = {
		mine: link( 'constel-mine' ),
		everyone: link( 'constel-everyone' ),
		marks: link( 'constel-marks' )
	};

	const sync = () => {
		[ [ items.mine, 'mine', 'constel-mine-menu' ], [ items.everyone, 'everyone', 'constel-everyone-menu' ] ]
			.forEach( ( [ a, scope, msg ] ) => {
				if ( a ) {
					const active = state.scope === scope;
					a.setAttribute( 'aria-pressed', String( active ) );
					a.textContent = ( active ? '✓ ' : '' ) + mw.msg( msg );
				}
			} );
		if ( items.marks ) {
			items.marks.textContent = mw.msg( state.marks ? 'constel-marks-menu' : 'constel-marks-show-menu' );
		}
		mw.storage.setObject( STORAGE_KEY, state );
	};
	const on = ( a, change ) => {
		if ( a ) {
			a.setAttribute( 'role', 'button' );
			a.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				change();
				sync();
				onChange( state );
			} );
		}
	};
	on( items.mine, () => {
		state.scope = 'mine';
	} );
	on( items.everyone, () => {
		state.scope = 'everyone';
	} );
	on( items.marks, () => {
		state.marks = !state.marks;
	} );
	sync();
}

module.exports = { load, bind };
