/**
 * Especial:MiConstel — acciones sobre los §§ propios (spec: MyReading):
 * codificar y borrar, con el mismo detalle que sobre la página.
 */
const { api, detail } = require( 'ext.constel.ui' );

$( () => {
	const rows = document.querySelectorAll( '.constel-mine__row' );
	if ( !rows.length ) {
		return;
	}
	const me = mw.config.get( 'wgUserName' );
	api.excerptsOf( me ).then( ( excerpts ) => {
		const byId = new Map( excerpts.map( ( e ) => [ e.id, e ] ) );
		rows.forEach( ( row ) => {
			const excerpt = byId.get( Number( row.dataset.constelExcerpt ) );
			if ( !excerpt ) {
				return;
			}
			const edit = document.createElement( 'button' );
			edit.type = 'button';
			edit.className = 'constel-ui constel-button';
			edit.textContent = mw.msg( 'myconstel-edit' );
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
