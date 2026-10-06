/**
 * Especial:MiConstel — acciones sobre los §§ propios (spec: MyReading):
 * codificar y borrar, con el mismo detalle que sobre la página. Un §
 * congelado (su página se borró), o cualquiera si no se tiene el derecho de
 * anotar, sólo ofrece borrarlo.
 */
const { api, autocomplete, detail, icons } = require( 'ext.constel.ui' );

/**
 * Botón sólo-ícono (Lucide) con tooltip, para Editar y Eliminar.
 *
 * @param {string} name
 * @param {string} label
 * @param {boolean} [danger]
 * @return {HTMLButtonElement}
 */
function iconButton( name, label, danger ) {
	return icons.iconButton( name, label,
		danger ? 'constel-button constel-button--icon constel-button--danger-icon' : 'constel-button constel-button--icon' );
}

function button( text, danger ) {
	const b = document.createElement( 'button' );
	b.type = 'button';
	b.className = danger ? 'constel-ui constel-button constel-button--danger' : 'constel-ui constel-button';
	b.textContent = text;
	return b;
}

/**
 * Confirmación como modal nativo (<dialog>): centrado, con velo; Esc o un clic
 * en el velo cancelan. `run` hace el trabajo y devuelve una promesa: si falla,
 * rechaza con el HTML del error, que se muestra dentro y deja reintentar.
 *
 * @param {string} question
 * @param {string} confirmLabel
 * @param {Function} run () => Promise
 * @param {HTMLElement} [returnFocus] a quién devolver el foco al cancelar
 */
function confirmDialog( question, confirmLabel, run, returnFocus ) {
	const dialog = document.createElement( 'dialog' );
	dialog.className = 'constel-ui constel-dialog';
	dialog.setAttribute( 'aria-labelledby', 'constel-mine-dialog-q' );
	const q = document.createElement( 'p' );
	q.className = 'constel-dialog__question';
	q.id = 'constel-mine-dialog-q';
	q.textContent = question;
	const feedback = document.createElement( 'p' );
	feedback.className = 'constel-dialog__note';
	feedback.setAttribute( 'role', 'alert' );
	const actions = document.createElement( 'div' );
	actions.className = 'constel-actions';
	const dismiss = () => {
		dialog.close();
		dialog.remove();
		if ( returnFocus && returnFocus.isConnected ) {
			returnFocus.focus();
		}
	};
	const no = button( mw.msg( 'constel-detail-delete-no' ) );
	const yes = button( confirmLabel, true );
	no.addEventListener( 'click', dismiss );
	yes.addEventListener( 'click', () => {
		yes.disabled = true;
		no.disabled = true;
		feedback.textContent = '';
		run().then( () => {
			dialog.close();
			dialog.remove();
		}, ( html ) => {
			yes.disabled = false;
			no.disabled = false;
			feedback.innerHTML = html;
		} );
	} );
	actions.append( no, yes );
	dialog.append( q, feedback, actions );
	dialog.addEventListener( 'close', () => dialog.remove() );
	dialog.addEventListener( 'click', ( e ) => {
		if ( e.target === dialog && !yes.disabled ) {
			dismiss();
		}
	} );
	document.body.append( dialog );
	dialog.showModal();
	no.focus();
}

/**
 * Una llamada de borrado como promesa que rechaza con el HTML del error (la
 * promesa de jQuery rechaza con (código, resultado), que await no ve entero).
 *
 * @param {number} id
 * @return {Promise}
 */
function deleteExcerpt( id ) {
	return new Promise( ( resolve, reject ) => {
		api.write( { action: 'constel-deleteexcerpt', excerpt: id } )
			.then( resolve, ( code, r ) => reject( api.describeError( code, r ).html ) );
	} );
}

/**
 * Borrar un §, con modal de confirmación. Todo § propio se puede borrar,
 * también un § congelado o sin el derecho de anotar (spec: RightToWithdraw).
 *
 * @param {HTMLElement} row
 * @param {number} id
 */
function addDelete( row, id ) {
	const cell = row.lastElementChild;
	const del = iconButton( 'trash', mw.msg( 'myconstel-delete' ), true );
	del.addEventListener( 'click', () => confirmDialog(
		mw.msg( 'constel-detail-delete-confirm' ),
		mw.msg( 'constel-detail-delete-yes' ),
		() => deleteExcerpt( id ).then( () => row.remove() ),
		del
	) );
	// Los íconos van tras la fecha, juntos: Editar (cuando llega) antes que Eliminar.
	const tools = document.createElement( 'span' );
	tools.className = 'constel-mine__tools';
	tools.append( del );
	cell.append( tools );
}

/**
 * Autocompletado en los filtros: páginas y conceptos del vocabulario.
 */
function filters() {
	const page = document.getElementById( 'constel-mine-page' );
	if ( page ) {
		autocomplete.attach( page, {
			source: ( typed ) => api.searchPages( typed ).then(
				( titles ) => titles.map( ( title ) => ( { label: title } ) )
			)
		} );
	}
	const concept = document.getElementById( 'constel-mine-concept' );
	if ( concept ) {
		autocomplete.attach( concept );
	}
}

/**
 * Selección fila a fila o de toda la página y «Acciones por lote», que por
 * ahora sólo tiene Eliminar (con confirmación en su lugar, como la de una
 * fila). Borra de a una —la API borra un § por llamada— y se detiene en el
 * primer error.
 *
 * @param {HTMLTableElement} table
 */
function bulk( table ) {
	const boxes = () => Array.from( table.querySelectorAll( 'tbody .constel-mine__select' ) );
	const all = document.createElement( 'input' );
	all.type = 'checkbox';
	all.setAttribute( 'aria-label', mw.msg( 'myconstel-select-all' ) );
	const head = table.querySelector( 'thead th' );
	if ( head ) {
		head.replaceChildren( all );
	}

	// Acciones por lote: un selector sin rótulo (su primera opción lo nombra), a
	// continuación del de «Resultados» y sólo mientras haya filas marcadas.
	const select = document.createElement( 'select' );
	select.id = 'constel-mine-bulk';
	select.className = 'constel-ui constel-input constel-mine__bulk';
	select.setAttribute( 'aria-label', mw.msg( 'myconstel-bulk' ) );
	const placeholder = new Option( mw.msg( 'myconstel-bulk' ), '' );
	placeholder.disabled = true;
	placeholder.selected = true;
	// Una sola acción por ahora; al elegirla se pide la confirmación.
	select.append( placeholder, new Option( mw.msg( 'myconstel-bulk-delete' ), 'delete' ) );
	const count = document.createElement( 'span' );
	count.className = 'constel-mine__count';
	count.setAttribute( 'aria-live', 'polite' );
	select.hidden = true;
	count.hidden = true;
	const limit = document.querySelector( '.constel-mine__limit' );
	if ( limit ) {
		limit.after( select, count );
	} else {
		table.before( select, count );
	}

	let busy = false;
	const refresh = () => {
		const total = boxes();
		const n = total.filter( ( b ) => b.checked ).length;
		all.checked = n > 0 && n === total.length;
		all.indeterminate = n > 0 && n < total.length;
		count.textContent = n ? mw.msg( 'myconstel-bulk-selected', n ) : '';
		select.hidden = !n;
		count.hidden = !n;
		select.disabled = busy;
	};
	table.addEventListener( 'change', ( e ) => {
		if ( e.target === all ) {
			boxes().forEach( ( b ) => {
				b.checked = all.checked;
			} );
		}
		refresh();
	} );
	// Las filas se borran una a una (también desde su ícono): recalcular.
	new MutationObserver( refresh ).observe( table.tBodies[ 0 ], { childList: true } );

	select.addEventListener( 'change', () => {
		// Vuelve al rótulo: la acción no queda «puesta» tras el modal.
		select.value = '';
		const rows = boxes().filter( ( b ) => b.checked ).map( ( b ) => b.closest( 'tr' ) );
		confirmDialog(
			mw.msg( 'myconstel-bulk-confirm', rows.length ),
			mw.msg( 'constel-detail-delete-yes' ),
			async () => {
				busy = true;
				refresh();
				try {
					// De a una: la API borra un § por llamada; se detiene en el primer error.
					for ( const row of rows ) {
						await deleteExcerpt( Number( row.dataset.constelExcerpt ) );
						row.remove();
					}
				} finally {
					busy = false;
					refresh();
				}
			},
			select
		);
	} );
	refresh();
}

/**
 * Ajusta cada píldora de concepto que se parte en varias líneas al ancho de su
 * línea más larga: una caja con texto envuelto ocupa todo el ancho disponible
 * aunque el texto no lo llene, y eso no tiene solución sólo con CSS.
 */
function fitChips() {
	const chips = Array.from( document.querySelectorAll( '.constel-mine .constel-chip' ) );
	chips.forEach( ( chip ) => {
		chip.style.width = '';
	} );
	// Primero se mide todo y luego se escribe, para no forzar un reflujo por píldora.
	const widths = chips.map( ( chip ) => {
		const range = document.createRange();
		range.selectNodeContents( chip );
		const rects = Array.from( range.getClientRects() );
		if ( rects.length < 2 ) {
			return null;
		}
		const left = Math.min( ...rects.map( ( r ) => r.left ) );
		const right = Math.max( ...rects.map( ( r ) => r.right ) );
		return Math.ceil( right - left ) + 1;
	} );
	chips.forEach( ( chip, i ) => {
		if ( widths[ i ] ) {
			chip.style.width = widths[ i ] + 'px';
		}
	} );
}

/** El selector de cantidad por página aplica al elegir (sin JS queda el botón). */
function limitSelect() {
	const select = document.getElementById( 'constel-mine-limit' );
	if ( select ) {
		select.addEventListener( 'change', () => select.form.submit() );
	}
}

$( () => {
	filters();
	limitSelect();
	fitChips();
	let frame = 0;
	window.addEventListener( 'resize', () => {
		cancelAnimationFrame( frame );
		frame = requestAnimationFrame( fitChips );
	} );
	const rows = document.querySelectorAll( '.constel-mine__row' );
	if ( !rows.length ) {
		return;
	}
	bulk( rows[ 0 ].closest( 'table' ) );
	const canAnnotate = !!( mw.config.get( 'wgConstelMine' ) || {} ).canAnnotate;
	// Editar va antes que Eliminar: se agrega primero cuando llega el §; el
	// Eliminar se pone al tiro y Editar se inserta delante.
	rows.forEach( ( row ) => addDelete( row, Number( row.dataset.constelExcerpt ) ) );
	if ( !canAnnotate ) {
		return;
	}
	// Sólo las filas visibles: la tabla va paginada.
	const ids = Array.from( rows, ( row ) => Number( row.dataset.constelExcerpt ) );
	api.excerptsByIds( ids ).then( ( excerpts ) => {
		const byId = new Map( excerpts.map( ( e ) => [ e.id, e ] ) );
		rows.forEach( ( row ) => {
			const excerpt = byId.get( Number( row.dataset.constelExcerpt ) );
			if ( !excerpt || excerpt.status === 'frozen' ) {
				return;
			}
			const edit = iconButton( 'square-pen', mw.msg( 'myconstel-edit' ) );
			edit.addEventListener( 'click', () => detail.open( [ excerpt ], {
				near: edit.getBoundingClientRect(),
				returnFocus: edit,
				isMine: () => true,
				canAnnotate: true,
				canModerate: false,
				onChanged: () => location.reload()
			} ) );
			row.querySelector( '.constel-mine__tools' ).prepend( edit );
		} );
	} );
} );
