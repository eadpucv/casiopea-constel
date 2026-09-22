/**
 * Panel lateral del mapa: detalle de un concepto (spec: ConceptDetail) y
 * temas de un lector (spec: ThemesPanel). Los temas ajenos se leen, nunca se
 * editan (OthersReadOnly).
 */
const { api, autocomplete, icons } = require( 'ext.constel.ui' );

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

function button( label, className, onClick ) {
	const b = el( 'button', 'constel-button' + ( className ? ' ' + className : '' ), label );
	b.type = 'button';
	b.addEventListener( 'click', onClick );
	return b;
}

function submitButton( label, className ) {
	const b = el( 'button', 'constel-button' + ( className ? ' ' + className : '' ), label );
	b.type = 'submit';
	return b;
}

function feedbackBox() {
	const f = el( 'div', 'constel-feedback' );
	f.setAttribute( 'role', 'alert' );
	return f;
}

/**
 * Detalle de un concepto: §§ agrupados por página (los propios primero en
 * cada página), temas que lo contienen y, para quien anota, agruparlo.
 *
 * @param {HTMLElement} box
 * @param {Object} node del grafo
 * @param {Object} ctx {me, canAnnotate, myThemes: Array, onChanged}
 */
function conceptDetail( box, node, ctx ) {
	box.textContent = '';
	const head = el( 'h2', 'constel-side__title' );
	head.append( el( 'span', 'constel-sign', '§' ), ' ', node.label );
	box.append( head, el( 'p', 'constel-side__meta',
		mw.msg( 'constellation-counts', mw.language.convertNumber( node.excerpts ),
			mw.language.convertNumber( node.pages ) ) ) );
	const list = el( 'div', 'constel-side__excerpts', mw.msg( 'constellation-loading' ) );
	const themesBox = el( 'div', 'constel-side__themes' );
	box.append( list, themesBox );

	api.excerptsOfConcept( node.id ).then( ( excerpts ) => {
		list.textContent = '';
		const byPage = new Map();
		excerpts.forEach( ( e ) => {
			const key = e.title || String( e.pageid );
			byPage.set( key, ( byPage.get( key ) || [] ).concat( e ) );
		} );
		byPage.forEach( ( pageExcerpts, title ) => {
			const section = el( 'section', 'constel-side__page' );
			const link = el( 'a', 'constel-link', title );
			link.href = mw.util.getUrl( title );
			section.appendChild( el( 'h3', null ) ).appendChild( link );
			pageExcerpts.sort( ( a, b ) => ( b.author === ctx.me ) - ( a.author === ctx.me ) );
			pageExcerpts.forEach( ( e ) => {
				const item = el( 'figure', 'constel-side__excerpt' + ( e.status === 'lost' ? ' constel-side__excerpt--lost' : '' ) );
				item.append( el( 'blockquote', 'constel-quote', e.exact ) );
				if ( e.gloss ) {
					item.append( el( 'p', 'constel-gloss-text', e.gloss ) );
				}
				const cap = el( 'figcaption', 'constel-side__by' );
				cap.textContent = e.author === ctx.me ? mw.msg( 'constel-detail-mine' ) :
					e.author === null ? mw.msg( 'constel-detail-hidden-user' ) :
						mw.msg( 'constel-detail-by', e.author );
				if ( e.status === 'lost' ) {
					cap.append( ' · ', el( 'span', 'constel-status--lost', mw.msg( 'myconstel-status-lost' ) ) );
				}
				item.append( cap );
				section.append( item );
			} );
			list.append( section );
		} );
	} );

	if ( ctx.canModerate ) {
		box.append( moderation( node, ctx ) );
	}

	api.conceptThemes( node.id ).then( ( themes ) => {
		themesBox.textContent = '';
		themesBox.append( el( 'h3', null, mw.msg( 'constellation-in-themes' ) ) );
		if ( !themes.length ) {
			themesBox.append( el( 'p', 'constel-side__meta', mw.msg( 'constellation-in-no-theme' ) ) );
		} else {
			const ul = el( 'ul', 'constel-chips' );
			themes.forEach( ( t ) => ul.append( el( 'li', 'constel-chip',
				t.author ? mw.msg( 'constellation-theme-of', t.label, t.author ) : t.label ) ) );
			themesBox.append( ul );
		}
		if ( ctx.canAnnotate && ctx.myThemes.length ) {
			const form = el( 'form', 'constel-add' );
			const select = el( 'select', 'constel-input' );
			select.setAttribute( 'aria-label', mw.msg( 'constellation-group-into' ) );
			ctx.myThemes.forEach( ( t ) => {
				const o = el( 'option', null, t.label );
				o.value = t.id;
				select.append( o );
			} );
			const fb = feedbackBox();
			form.append( select, submitButton( mw.msg( 'constellation-group' ), 'constel-button--primary' ), fb );
			form.addEventListener( 'submit', ( e ) => {
				e.preventDefault();
				api.write( { action: 'constel-groupconcept', op: 'group', concept: node.id, theme: select.value } )
					.then( ctx.onChanged, ( code, r ) => {
						fb.innerHTML = api.describeError( code, r ).html;
					} );
			} );
			themesBox.append( form );
		}
	} );
}

/**
 * Moderación del vocabulario (spec: ModeratorRenamesConcept,
 * ModeratorMergesConcepts): renombrar, o fusionar en otro concepto con
 * confirmación. Todo queda en Special:Log/constel.
 *
 * @param {Object} node
 * @param {Object} ctx {onModerated: (keepId) => void}
 * @return {HTMLElement}
 */
function moderation( node, ctx ) {
	const section = el( 'section', 'constel-side__moderation' );
	section.append( el( 'h3', null, mw.msg( 'constellation-moderate' ) ) );
	const fb = feedbackBox();
	const fail = ( code, r ) => {
		fb.innerHTML = api.describeError( code, r ).html;
	};

	const renameForm = el( 'form', 'constel-add' );
	const rename = el( 'input', 'constel-input' );
	rename.value = node.label;
	rename.setAttribute( 'aria-label', mw.msg( 'constellation-rename-concept' ) );
	renameForm.append( rename, submitButton( mw.msg( 'constellation-rename-concept' ) ) );
	renameForm.addEventListener( 'submit', ( e ) => {
		e.preventDefault();
		api.write( { action: 'constel-moderate', op: 'rename', concept: node.id, label: rename.value } )
			.then( () => ctx.onModerated( node.id ), fail );
	} );

	const mergeForm = el( 'form', 'constel-add' );
	const field = el( 'div', 'constel-field' );
	const into = el( 'input', 'constel-input' );
	into.placeholder = mw.msg( 'constellation-merge-into' );
	into.setAttribute( 'aria-label', mw.msg( 'constellation-merge-into' ) );
	field.append( into );
	const combo = autocomplete.attach( into );
	mergeForm.append( field, submitButton( mw.msg( 'constellation-merge' ), 'constel-button--danger' ) );
	mergeForm.addEventListener( 'submit', ( e ) => {
		e.preventDefault();
		const label = into.value.trim();
		if ( !label || combo.isOpen() ) {
			return;
		}
		api.conceptByLabel( label ).then( ( keep ) => {
			if ( !keep ) {
				fb.textContent = mw.msg( 'constellation-merge-unknown', label );
				return;
			}
			const confirm = el( 'div', 'constel-confirm' );
			confirm.append(
				el( 'span', null, mw.msg( 'constellation-merge-confirm', node.label, keep.label ) ),
				button( mw.msg( 'constel-detail-delete-no' ), '', () => confirm.remove() ),
				button( mw.msg( 'constellation-merge' ), 'constel-button--danger', () => api.write( { action: 'constel-moderate', op: 'merge', concept: node.id, into: keep.id } )
					.then( () => ctx.onModerated( keep.id ), fail ) )
			);
			fb.textContent = '';
			fb.append( confirm );
		} );
	} );

	section.append( renameForm, mergeForm, fb );
	return section;
}

/**
 * Temas de un lector, con sus conceptos y notas.
 *
 * @param {HTMLElement} box
 * @param {Array} themes de list=constelthemes
 * @param {Object} ctx {editable, ownerLabel, colorOffset, onChanged, onSelectConcept}
 */
function themesPanel( box, themes, ctx ) {
	box.textContent = '';
	box.append( el( 'h2', 'constel-side__title', ctx.ownerLabel ) );
	if ( !themes.length && !ctx.editable ) {
		box.append( el( 'p', 'constel-side__meta', mw.msg( 'constellation-no-themes' ) ) );
	}
	const fail = ( fb ) => ( code, r ) => {
		fb.innerHTML = api.describeError( code, r ).html;
	};

	themes.forEach( ( theme, index ) => {
		// Clases: constel-theme--cat-0 … constel-theme--cat-7
		const color = ( ( ctx.colorOffset || 0 ) + index ) % 8;
		const section = el( 'section', 'constel-theme constel-theme--cat-' + color );
		const fb = feedbackBox();
		const title = el( 'h3', 'constel-theme__title' );
		title.append( el( 'span', 'constel-theme__swatch' ), theme.label );
		section.append( title );

		const chips = el( 'ul', 'constel-chips' );
		theme.concepts.forEach( ( c ) => {
			const li = el( 'li', 'constel-chip' );
			const open = el( 'button', 'constel-chip__label constel-chip__open', c.label );
			open.type = 'button';
			open.addEventListener( 'click', () => ctx.onSelectConcept( c.id ) );
			li.append( open );
			if ( ctx.editable ) {
				const remove = icons.iconButton(
					'x', mw.msg( 'constellation-ungroup', c.label ), 'constel-chip__remove'
				);
				remove.addEventListener( 'click', () => api.write( {
					action: 'constel-groupconcept', op: 'ungroup', concept: c.id
				} ).then( ctx.onChanged, fail( fb ) ) );
				li.append( remove );
			}
			chips.append( li );
		} );
		if ( !theme.concepts.length ) {
			section.append( el( 'p', 'constel-side__meta', mw.msg( 'constellation-theme-empty' ) ) );
		}
		section.append( chips );

		theme.notes.forEach( ( note ) => {
			if ( !ctx.editable ) {
				section.append( el( 'p', 'constel-note', note.text ) );
				return;
			}
			const area = el( 'textarea', 'constel-input constel-note__edit' );
			area.value = note.text;
			area.rows = 4;
			area.setAttribute( 'aria-label', mw.msg( 'constellation-note-label', theme.label ) );
			const noteActions = el( 'div', 'constel-actions' );
			section.append( area, noteActions );
			noteActions.append(
				button( mw.msg( 'constel-detail-delete-yes' ), 'constel-button--danger', () => api.write( { action: 'constel-themenote', op: 'delete', note: note.id } ).then( ctx.onChanged, fail( fb ) ) ),
				button( mw.msg( 'constellation-save' ), 'constel-button--primary', () => api.write( { action: 'constel-themenote', op: 'edit', note: note.id, text: area.value } )
					.then( ctx.onChanged, fail( fb ) ) )
			);
		} );

		if ( ctx.editable ) {
			const newNote = el( 'textarea', 'constel-input' );
			newNote.rows = 3;
			newNote.placeholder = mw.msg( 'constellation-note-new' );
			newNote.setAttribute( 'aria-label', mw.msg( 'constellation-note-new' ) );
			const rename = el( 'input', 'constel-input' );
			rename.value = theme.label;
			rename.setAttribute( 'aria-label', mw.msg( 'constellation-theme-rename' ) );
			const confirmRow = el( 'div', 'constel-actions' );
			const del = button( mw.msg( 'constellation-theme-delete' ), 'constel-button--danger', () => {
				confirmRow.textContent = '';
				confirmRow.append(
					el( 'span', null, mw.msg( 'constellation-theme-delete-confirm' ) ),
					button( mw.msg( 'constel-detail-delete-no' ), '', () => ctx.onChanged() ),
					button( mw.msg( 'constel-detail-delete-yes' ), 'constel-button--danger', () => api.write( { action: 'constel-theme', op: 'delete', theme: theme.id } ).then( ctx.onChanged, fail( fb ) ) )
				);
			} );
			confirmRow.append(
				button( mw.msg( 'constellation-note-add' ), '', () => {
					if ( newNote.value.trim() ) {
						api.write( { action: 'constel-themenote', op: 'create', theme: theme.id, text: newNote.value } )
							.then( ctx.onChanged, fail( fb ) );
					}
				} ),
				del
			);
			const renameRow = el( 'div', 'constel-add' );
			renameRow.append( rename, button( mw.msg( 'constellation-theme-rename' ), '', () => api.write( { action: 'constel-theme', op: 'rename', theme: theme.id, label: rename.value } )
				.then( ctx.onChanged, fail( fb ) ) ) );
			section.append( newNote, confirmRow, renameRow );
		}
		section.append( fb );
		box.append( section );
	} );

	if ( ctx.editable ) {
		const form = el( 'form', 'constel-add constel-theme-new' );
		const input = el( 'input', 'constel-input' );
		input.placeholder = mw.msg( 'constellation-theme-new' );
		input.setAttribute( 'aria-label', mw.msg( 'constellation-theme-new' ) );
		const fb = feedbackBox();
		form.append( input, submitButton( mw.msg( 'constellation-theme-create' ), 'constel-button--primary' ), fb );
		form.addEventListener( 'submit', ( e ) => {
			e.preventDefault();
			if ( input.value.trim() ) {
				api.write( { action: 'constel-theme', op: 'create', label: input.value } )
					.then( ctx.onChanged, fail( fb ) );
			}
		} );
		box.append( form );
	}
}

module.exports = { conceptDetail, themesPanel };
