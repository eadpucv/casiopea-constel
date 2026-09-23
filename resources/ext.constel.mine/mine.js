/**
 * Especial:MiConstel — acciones sobre los §§ propios (spec: MyReading):
 * codificar y borrar, con el mismo detalle que sobre la página. Un §
 * congelado (su página se borró), o cualquiera si no se tiene el derecho de
 * anotar, sólo ofrece borrarlo.
 */
const { api, detail } = require( 'ext.constel.ui' );

function button( text, danger ) {
	const b = document.createElement( 'button' );
	b.type = 'button';
	b.className = danger ? 'constel-ui constel-button constel-button--danger' : 'constel-ui constel-button';
	b.textContent = text;
	return b;
}

/**
 * Sólo borrar, con confirmación en su lugar (sin diálogos del navegador): un
 * § congelado, o cualquiera cuando no se tiene el derecho de anotar
 * (spec: RightToWithdraw).
 *
 * @param {HTMLElement} row
 * @param {number} id
 */
function deleteOnly( row, id ) {
	const cell = row.lastElementChild;
	const del = button( mw.msg( 'constel-detail-delete' ), true );
	del.addEventListener( 'click', () => {
		const confirm = document.createElement( 'span' );
		confirm.className = 'constel-mine__confirm';
		confirm.textContent = mw.msg( 'constel-detail-delete-confirm' ) + ' ';
		const no = button( mw.msg( 'constel-detail-delete-no' ) );
		const yes = button( mw.msg( 'constel-detail-delete-yes' ), true );
		no.addEventListener( 'click', () => {
			confirm.replaceWith( del );
			del.focus();
		} );
		yes.addEventListener( 'click', () => {
			yes.disabled = true;
			api.write( { action: 'constel-deleteexcerpt', excerpt: id } ).then(
				() => row.remove(),
				( code, r ) => {
					yes.disabled = false;
					confirm.textContent = '';
					confirm.insertAdjacentHTML( 'afterbegin', api.describeError( code, r ).html );
					confirm.append( ' ', no );
				}
			);
		} );
		confirm.append( no, ' ', yes );
		del.replaceWith( confirm );
		no.focus();
	} );
	cell.append( ' ', del );
}

$( () => {
	const rows = document.querySelectorAll( '.constel-mine__row' );
	if ( !rows.length ) {
		return;
	}
	const canAnnotate = !!( mw.config.get( 'wgConstelMine' ) || {} ).canAnnotate;
	rows.forEach( ( row ) => {
		if ( row.dataset.constelStatus === 'frozen' || !canAnnotate ) {
			deleteOnly( row, Number( row.dataset.constelExcerpt ) );
		}
	} );
	if ( !canAnnotate ) {
		return;
	}
	const me = mw.config.get( 'wgUserName' );
	api.excerptsOf( me ).then( ( excerpts ) => {
		const byId = new Map( excerpts.map( ( e ) => [ e.id, e ] ) );
		rows.forEach( ( row ) => {
			const excerpt = byId.get( Number( row.dataset.constelExcerpt ) );
			if ( !excerpt || excerpt.status === 'frozen' ) {
				return;
			}
			const edit = button( mw.msg( 'myconstel-edit' ) );
			edit.addEventListener( 'click', () => detail.open( [ excerpt ], {
				near: edit.getBoundingClientRect(),
				returnFocus: edit,
				isMine: () => true,
				canAnnotate: true,
				canModerate: false,
				onChanged: () => location.reload()
			} ) );
			row.lastElementChild.append( ' ', edit );
		} );
	} );
} );
