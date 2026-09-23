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
 * Detalle de un concepto: sus §§ (los propios primero), cada uno con su
 * página de procedencia al pie; temas que lo contienen y, para quien anota,
 * agruparlo. La moderación va aparte, bajo el mapa (ver moderation()).
 *
 * @param {HTMLElement} box
 * @param {Object} node del grafo
 * @param {Object} ctx {me, canAnnotate, myThemes: Array, onChanged}
 */
function conceptDetail( box, node, ctx ) {
	box.textContent = '';
	box.append(
		el( 'h4', 'constel-side__title', node.label ),
		el( 'p', 'constel-side__meta',
			mw.msg( 'constellation-counts', mw.language.convertNumber( node.excerpts ),
				mw.language.convertNumber( node.pages ) ) )
	);
	const list = el( 'div', 'constel-side__excerpts', mw.msg( 'constellation-loading' ) );
	const themesBox = el( 'div', 'constel-side__themes' );
	box.append( list, themesBox );

	api.excerptsOfConcept( node.id ).then( ( excerpts ) => {
		list.textContent = '';
		excerpts.sort( ( a, b ) => ( b.author === ctx.me ) - ( a.author === ctx.me ) );
		excerpts.forEach( ( e ) => {
			const item = el( 'figure', 'constel-side__excerpt' + ( e.status === 'lost' ? ' constel-side__excerpt--lost' : '' ) );
			item.append( el( 'blockquote', 'constel-quote', e.exact ) );
			if ( e.gloss ) {
				item.append( el( 'p', 'constel-gloss-text', e.gloss ) );
			}
			const cap = el( 'figcaption', 'constel-side__by' );
			cap.textContent = e.author === ctx.me ? mw.msg( 'constel-detail-mine' ) :
				e.author === null ? mw.msg( 'constel-detail-hidden-user' ) :
					mw.msg( 'constel-detail-by', e.author );
			if ( e.title ) {
				const link = el( 'a', 'constel-side__source', e.title );
				link.href = mw.util.getUrl( e.title );
				cap.append( ' · ', link );
			}
			if ( e.status === 'lost' ) {
				cap.append( ' · ', el( 'span', 'constel-status--lost', mw.msg( 'myconstel-status-lost' ) ) );
			}
			item.append( cap );
			list.append( item );
		} );
	} );

	api.conceptThemes( node.id ).then( ( themes ) => {
		themesBox.textContent = '';
		themesBox.append( el( 'h5', null, mw.msg( 'constellation-in-themes' ) ) );
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
	const section = el( 'section', 'constel-ui constel-map__moderation' );
	section.append( el( 'h4', null, mw.msg( 'constellation-moderate-concept', node.label ) ) );
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
 * Temas de un lector, con sus conceptos y su desarrollo (uno por tema).
 *
 * @param {HTMLElement} box
 * @param {Array} themes de list=constelthemes
 * @param {Object} ctx {editable, ownerLabel, colorOffset, onChanged, onSelectConcept}
 */
function themesPanel( box, themes, ctx ) {
	box.textContent = '';
	box.append( el( 'h4', 'constel-side__title', ctx.ownerLabel ) );
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
		// El color del tema (el mismo del grafo) va en el título, sin viñeta.
		section.append( el( 'h5', 'constel-theme__title', theme.label ) );

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

		if ( !ctx.editable ) {
			if ( theme.development ) {
				section.append( el( 'p', 'constel-development', theme.development ) );
			}
		} else {
			const area = el( 'textarea', 'constel-input constel-development__edit' );
			area.value = theme.development || '';
			area.rows = 4;
			area.placeholder = mw.msg( 'constellation-development-placeholder' );
			area.setAttribute( 'aria-label', mw.msg( 'constellation-development-label', theme.label ) );
			const save = button( mw.msg( 'constellation-development-save' ), 'constel-button--primary', () => api.write( { action: 'constel-themenote', theme: theme.id, text: area.value } )
				.then( ctx.onChanged, fail( fb ) ) );
			const saveRow = el( 'div', 'constel-actions' );
			saveRow.append( save );

			const rename = el( 'input', 'constel-input' );
			rename.value = theme.label;
			rename.setAttribute( 'aria-label', mw.msg( 'constellation-theme-rename' ) );
			const renameRow = el( 'div', 'constel-add' );
			renameRow.append( rename, button( mw.msg( 'constellation-theme-rename' ), '', () => api.write( { action: 'constel-theme', op: 'rename', theme: theme.id, label: rename.value } )
				.then( ctx.onChanged, fail( fb ) ) ) );

			const confirmRow = el( 'div', 'constel-actions' );
			confirmRow.append( button( mw.msg( 'constellation-theme-delete' ), 'constel-button--danger', () => {
				confirmRow.textContent = '';
				confirmRow.append(
					el( 'span', null, mw.msg( 'constellation-theme-delete-confirm' ) ),
					button( mw.msg( 'constel-detail-delete-no' ), '', () => ctx.onChanged() ),
					button( mw.msg( 'constel-detail-delete-yes' ), 'constel-button--danger', () => api.write( { action: 'constel-theme', op: 'delete', theme: theme.id } ).then( ctx.onChanged, fail( fb ) ) )
				);
			} ) );
			section.append( area, saveRow, renameRow, confirmRow );
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

module.exports = { conceptDetail, themesPanel, moderation };
