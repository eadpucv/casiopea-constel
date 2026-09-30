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
 * agruparlo. Quien modera renombra el concepto en el título; fusionar va
 * aparte, bajo el mapa (ver moderation()).
 *
 * @param {HTMLElement} box
 * @param {Object} node del grafo
 * @param {Object} ctx {me, canAnnotate, canModerate, myThemes: Array, onChanged,
 *  onModerated: (keepId) => void}
 */
function conceptDetail( box, node, ctx ) {
	box.textContent = '';
	// «[a]»: el concepto en la nomenclatura de con§tel (ancla, p[a]labra,
	// nombre), antepuesto como signo; como el «§» de la sección. Es un signo,
	// no parte del nombre: los lectores de pantalla no lo leen.
	// Quien modera lo renombra ahí mismo, como el título de un tema.
	const title = el( 'h4', 'constel-side__title' );
	const sign = el( 'span', 'constel-side__sign', '[a]' );
	sign.setAttribute( 'aria-hidden', 'true' );
	const renameFb = feedbackBox();
	title.append( sign, ctx.canModerate ?
		inlineName( node.label, mw.msg( 'constellation-concept-name', node.label ),
			( label ) => api.write( { action: 'constel-moderate', op: 'rename', concept: node.id, label } )
				.then( () => ctx.onModerated( node.id ), ( code, r ) => {
					renameFb.innerHTML = api.describeError( code, r ).html;
					return $.Deferred().reject();
				} ) ) :
		node.label );
	box.append(
		title,
		renameFb,
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
			// Clases: constel-side__excerpt--lost, constel-side__excerpt--frozen
			const item = el( 'figure', 'constel-side__excerpt' + ( e.status !== 'anchored' ? ' constel-side__excerpt--' + e.status : '' ) );
			item.append( el( 'blockquote', 'constel-quote', e.exact ) );
			if ( e.gloss ) {
				item.append( el( 'div', 'constel-gloss-text', e.gloss ) );
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
			if ( e.status !== 'anchored' ) {
				// Clases: constel-status--lost, constel-status--frozen
				const status = el( 'span', 'constel-status--' + e.status );
				// The following messages are used here:
				// * myconstel-status-lost
				// * myconstel-status-frozen
				status.textContent = mw.msg( 'myconstel-status-' + e.status );
				cap.append( ' · ', status );
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
			// Ningún tema viene elegido: se elige explícitamente, y hasta
			// entonces el botón no se habilita.
			const none = el( 'option', null, mw.msg( 'constellation-group-choose' ) );
			none.value = '';
			none.disabled = true;
			none.selected = true;
			select.append( none );
			ctx.myThemes.forEach( ( t ) => {
				const o = el( 'option', null, t.label );
				o.value = t.id;
				select.append( o );
			} );
			const fb = feedbackBox();
			const go = submitButton( mw.msg( 'constellation-group' ), 'constel-button--primary' );
			go.disabled = true;
			select.addEventListener( 'change', () => {
				go.disabled = !select.value;
			} );
			form.append( select, go, fb );
			form.addEventListener( 'submit', ( e ) => {
				e.preventDefault();
				if ( !select.value ) {
					return;
				}
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
 * Fusionar el concepto en otro (spec: ModeratorMergesConcepts), en una
 * línea bajo el mapa, con confirmación en un diálogo al centro (confirmMerge).
 * Renombrar va en el título del detalle (ModeratorRenamesConcept). Todo queda
 * en Special:Log/constel.
 *
 * @param {Object} node
 * @param {Object} ctx {onModerated: (keepId) => void}
 * @return {HTMLElement}
 */
function moderation( node, ctx ) {
	const section = el( 'section', 'constel-ui constel-map__moderation' );
	section.setAttribute( 'aria-label', mw.msg( 'constellation-moderate-concept', node.label ) );
	const fb = feedbackBox();

	// «Fusionar «X» con [concepto]»: sólo con un concepto existente, elegido
	// de la lista o escrito tal cual se llama; si no, el botón no se habilita.
	const mergeForm = el( 'form', 'constel-add constel-map__merge' );
	const intoId = 'constel-merge-into-' + node.id;
	const lead = el( 'label', 'constel-map__merge-lead' );
	lead.htmlFor = intoId;
	lead.title = mw.msg( 'constellation-merge-hint' );
	lead.append( icons.icon( 'git-merge' ), ' ' );
	const [ before, after ] = mw.msg( 'constellation-merge-with', '\u0000' ).split( '\u0000' );
	lead.append( before, el( 'strong', 'constel-map__merge-concept', node.label ), after );
	const field = el( 'div', 'constel-field' );
	const into = el( 'input', 'constel-input' );
	into.id = intoId;
	into.placeholder = mw.msg( 'constellation-merge-into' );
	field.append( into );
	const go = submitButton( mw.msg( 'constellation-merge' ), 'constel-button--danger' );
	let keep = null;
	const setKeep = ( concept ) => {
		keep = concept;
		go.disabled = !keep;
	};
	// Inválido se marca al salir del campo, no mientras se escribe.
	into.addEventListener( 'blur', () => setTimeout( () => {
		into.setAttribute( 'aria-invalid', String( !keep && into.value.trim() !== '' ) );
	}, 300 ) );
	into.addEventListener( 'focus', () => into.removeAttribute( 'aria-invalid' ) );
	setKeep( null );
	const combo = autocomplete.attach( into, {
		source: ( typed ) => api.searchConcepts( typed ).then( ( found ) => found
			.filter( ( c ) => c.id !== node.id )
			.map( ( c ) => ( {
				label: c.label,
				value: c,
				hint: mw.msg( 'constel-suggestion-uses', mw.language.convertNumber( c.uses ), c.uses )
			} ) ) ),
		onPick: ( label, item ) => setKeep( item.value )
	} );
	// Escrito a mano: vale si coincide exacto con un concepto (identidad estricta).
	let check = 0;
	into.addEventListener( 'input', () => {
		const label = into.value.trim();
		const mine = ++check;
		setKeep( null );
		fb.textContent = '';
		if ( label && label !== node.label ) {
			api.conceptByLabel( label ).then( ( found ) => {
				if ( mine === check && found && found.id !== node.id ) {
					setKeep( found );
				}
			} );
		}
	} );
	mergeForm.append( lead, field, go );
	mergeForm.addEventListener( 'submit', ( e ) => {
		e.preventDefault();
		if ( combo.isOpen() ) {
			return;
		}
		if ( !keep ) {
			if ( into.value.trim() ) {
				fb.textContent = mw.msg( 'constellation-merge-unknown', into.value.trim() );
			}
			return;
		}
		confirmMerge( node, keep, ctx );
	} );

	section.append( mergeForm, fb );
	return section;
}

/**
 * Confirmación de la fusión: un diálogo flotante al centro de la pantalla
 * (modal nativo: fondo velado, foco retenido, Esc cancela) con la frase
 * explícita «Vamos a fusionar «X» en «Y». ¿Lo confirmas?».
 *
 * @param {Object} node el concepto que desaparece
 * @param {Object} keep el que queda {id, label}
 * @param {Object} ctx {onModerated: (keepId) => void}
 */
function confirmMerge( node, keep, ctx ) {
	const dialog = el( 'dialog', 'constel-ui constel-dialog' );
	dialog.setAttribute( 'aria-labelledby', 'constel-dialog-q' );
	const q = el( 'p', 'constel-dialog__question',
		mw.msg( 'constellation-merge-confirm', node.label, keep.label ) );
	q.id = 'constel-dialog-q';
	const fb = feedbackBox();
	const actions = el( 'div', 'constel-actions' );
	// Se quita al cerrarse, sin esperar al evento close (que el navegador
	// encola; Esc sí pasa por él).
	const dismiss = () => {
		dialog.close();
		dialog.remove();
	};
	const cancel = button( mw.msg( 'constel-detail-delete-no' ), '', dismiss );
	const go = button( mw.msg( 'constellation-merge' ), 'constel-button--danger', () => {
		go.disabled = true;
		api.write( { action: 'constel-moderate', op: 'merge', concept: node.id, into: keep.id } )
			.then( () => {
				dismiss();
				ctx.onModerated( keep.id );
			}, ( code, r ) => {
				go.disabled = false;
				fb.innerHTML = api.describeError( code, r ).html;
			} );
	} );
	actions.append( cancel, go );
	dialog.append( q,
		el( 'p', 'constel-dialog__note', mw.msg( 'constellation-merge-consequence', node.label, keep.label ) ),
		fb, actions );
	dialog.addEventListener( 'close', () => dialog.remove() );
	// Un clic en el velo (fuera de la caja) cancela.
	dialog.addEventListener( 'click', ( e ) => {
		if ( e.target === dialog ) {
			dismiss();
		}
	} );
	document.body.append( dialog );
	dialog.showModal();
	cancel.focus();
}

/**
 * Un nombre que se edita en su lugar (título de un tema propio, o de un
 * concepto para quien modera): se reescribe y se guarda con Intro o al salir;
 * Esc vuelve al nombre anterior y vacío no renombra. El campo mide lo que su
 * texto, para que lo que va a su lado quede junto al nombre.
 *
 * @param {string} value nombre actual
 * @param {string} label nombre accesible y tooltip
 * @param {Function} save (nuevo nombre) => promesa; si falla, vuelve al actual
 * @return {HTMLInputElement}
 */
function inlineName( value, label, save ) {
	const name = el( 'input', 'constel-theme__name' );
	name.value = value;
	name.setAttribute( 'aria-label', label );
	name.title = label;
	// Ancho medido con su tipografía.
	const fit = () => {
		const style = getComputedStyle( name );
		const ctx2d = fit.ctx || ( fit.ctx = document.createElement( 'canvas' ).getContext( '2d' ) );
		ctx2d.font = `${ style.fontStyle } ${ style.fontWeight } ${ style.fontSize } ${ style.fontFamily }`;
		const text = ctx2d.measureText( name.value || ' ' ).width;
		const extra = parseFloat( style.paddingLeft ) + parseFloat( style.paddingRight ) +
			parseFloat( style.borderLeftWidth ) + parseFloat( style.borderRightWidth );
		name.style.width = Math.ceil( text + extra + 2 ) + 'px';
	};
	name.addEventListener( 'input', fit );
	// Medir cuando ya está en la página (antes no tiene estilo calculado).
	requestAnimationFrame( fit );
	let done = false;
	const commit = () => {
		const next = name.value.trim();
		if ( done || !next || next === value ) {
			name.value = next ? name.value : value;
			fit();
			return;
		}
		done = true;
		save( next ).then( null, () => {
			done = false;
			name.value = value;
			fit();
		} );
	};
	name.addEventListener( 'keydown', ( e ) => {
		if ( e.key === 'Enter' ) {
			e.preventDefault();
			name.blur();
		} else if ( e.key === 'Escape' ) {
			name.value = value;
			fit();
			name.blur();
		}
	} );
	name.addEventListener( 'blur', commit );
	return name;
}

/**
 * Título de un tema propio, editable en su lugar (ver inlineName()). La «x»
 * a su lado borra el tema, previa confirmación bajo el título.
 *
 * @param {Object} theme
 * @param {HTMLElement} section del tema (la confirmación va dentro)
 * @param {HTMLElement} fb caja de errores
 * @param {Object} ctx {onChanged}
 * @param {Function} fail (fb) => manejador de error
 * @return {HTMLElement[]} el campo y la «x»
 */
function themeTitle( theme, section, fb, ctx, fail ) {
	const name = inlineName( theme.label, mw.msg( 'constellation-theme-name', theme.label ),
		( label ) => api.write( { action: 'constel-theme', op: 'rename', theme: theme.id, label } )
			.then( ctx.onChanged, ( code, r ) => {
				fail( fb )( code, r );
				return $.Deferred().reject();
			} ) );

	return [ name, themeDelete( theme, section, fb, ctx, fail ) ];
}

/**
 * La «x» que borra un tema propio, previa confirmación bajo el título. Se
 * ofrece también sin el derecho de anotar (spec: RightToWithdraw).
 *
 * @param {Object} theme
 * @param {HTMLElement} section del tema (la confirmación va dentro)
 * @param {HTMLElement} fb caja de errores
 * @param {Object} ctx {onChanged}
 * @param {Function} fail (fb) => manejador de error
 * @return {HTMLElement}
 */
function themeDelete( theme, section, fb, ctx, fail ) {
	const remove = icons.iconButton(
		'x', mw.msg( 'constellation-theme-delete', theme.label ), 'constel-theme__delete'
	);
	remove.addEventListener( 'click', () => {
		if ( section.querySelector( '.constel-confirm' ) ) {
			return;
		}
		const confirm = el( 'div', 'constel-confirm' );
		confirm.append(
			el( 'span', null, mw.msg( 'constellation-theme-delete-confirm' ) ),
			button( mw.msg( 'constel-detail-delete-no' ), '', () => {
				confirm.remove();
				remove.focus();
			} ),
			button( mw.msg( 'constel-detail-delete-yes' ), 'constel-button--danger', () => api.write( { action: 'constel-theme', op: 'delete', theme: theme.id } )
				.then( ctx.onChanged, fail( fb ) ) )
		);
		section.querySelector( '.constel-theme__title' ).after( confirm );
		confirm.querySelector( 'button' ).focus();
	} );
	return remove;
}

/**
 * La píldora «+» al final de los conceptos de un tema propio: se abre en un
 * campo con autocompletado del vocabulario y agrupa ahí el concepto elegido
 * (spec: ReaderGroupsConcept; si estaba en otro tema del lector, lo mueve).
 * Sólo conceptos existentes: lo escrito a mano vale si coincide exacto.
 * Esc, o salir con el campo vacío, la vuelve a cerrar.
 *
 * @param {Object} theme
 * @param {HTMLElement} fb caja de errores del tema
 * @param {Object} ctx {onChanged}
 * @param {Function} fail (fb) => manejador de error
 * @return {HTMLElement}
 */
function addConceptPill( theme, fb, ctx, fail ) {
	const label = mw.msg( 'constellation-theme-add', theme.label );
	const li = el( 'li', 'constel-chip constel-chip--add' );
	const open = icons.iconButton( 'plus', label, 'constel-chip__add' );
	const field = el( 'div', 'constel-field constel-chip__field' );
	const input = el( 'input', 'constel-chip__input' );
	input.type = 'text';
	input.placeholder = mw.msg( 'constellation-theme-add-placeholder' );
	input.setAttribute( 'aria-label', label );
	field.append( input );
	field.hidden = true;
	li.append( open, field );

	const inTheme = new Set( theme.concepts.map( ( c ) => c.id ) );
	let busy = false;
	const group = ( concept ) => {
		if ( busy ) {
			return;
		}
		busy = true;
		api.write( { action: 'constel-groupconcept', op: 'group', concept: concept.id, theme: theme.id } )
			.then( ctx.onChanged, ( code, r ) => {
				busy = false;
				fail( fb )( code, r );
			} );
	};
	const close = () => {
		input.value = '';
		field.hidden = true;
		open.hidden = false;
		li.classList.remove( 'constel-chip--open' );
	};
	open.addEventListener( 'click', () => {
		fb.textContent = '';
		open.hidden = true;
		field.hidden = false;
		li.classList.add( 'constel-chip--open' );
		input.focus();
	} );
	const combo = autocomplete.attach( input, {
		source: ( typed ) => api.searchConcepts( typed ).then( ( found ) => found
			.filter( ( c ) => !inTheme.has( c.id ) )
			.map( ( c ) => ( {
				label: c.label,
				value: c,
				hint: mw.msg( 'constel-suggestion-uses', mw.language.convertNumber( c.uses ), c.uses )
			} ) ) ),
		onPick: ( text, item ) => group( item.value )
	} );
	input.addEventListener( 'keydown', ( e ) => {
		// El autocompletado ya atendió Intro (elegir) y Esc (cerrar su lista).
		if ( e.defaultPrevented ) {
			return;
		}
		if ( e.key === 'Escape' ) {
			e.preventDefault();
			close();
			open.focus();
		} else if ( e.key === 'Enter' && !combo.isOpen() ) {
			e.preventDefault();
			const typed = input.value.trim();
			if ( !typed ) {
				return;
			}
			api.conceptByLabel( typed ).then( ( found ) => {
				if ( found ) {
					group( found );
				} else {
					fb.textContent = mw.msg( 'constellation-theme-add-unknown', typed );
				}
			} );
		}
	} );
	input.addEventListener( 'blur', () => setTimeout( () => {
		if ( !busy && !input.value.trim() && document.activeElement !== input ) {
			close();
		}
	}, 150 ) );
	return li;
}

/**
 * El círculo de color de un tema, antes de su nombre: abre el selector de
 * color y deja el tema (texto, círculos y título) con el color elegido.
 *
 * @param {Object} theme
 * @param {string} current color actual, #rrggbb
 * @param {HTMLElement} title para teñir el título al elegir
 * @param {Object} ctx {onThemeColor}
 * @return {HTMLElement}
 */
function themeSwatch( theme, current, title, ctx ) {
	const text = mw.msg( 'constellation-theme-color', theme.label );
	const swatch = el( 'label', 'constel-pill__color constel-theme__color' );
	swatch.style.background = current;
	swatch.title = text;
	const input = el( 'input' );
	input.type = 'color';
	input.value = current;
	input.setAttribute( 'aria-label', text );
	input.addEventListener( 'input', () => {
		swatch.style.background = input.value;
		title.style.color = input.value;
	} );
	input.addEventListener( 'change', () => ctx.onThemeColor( theme, input.value ) );
	swatch.append( input );
	return swatch;
}

/**
 * Temas de un lector, con sus conceptos y su desarrollo (uno por tema).
 *
 * @param {HTMLElement} box
 * @param {Array} themes de list=constelthemes
 * @param {Object} ctx {editable, deletable, ownerLabel, colorOffset, themeColor,
 *  onThemeColor, onChanged, onSelectConcept}
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
		const title = el( 'h5', 'constel-theme__title' );
		if ( ctx.themeColor ) {
			const current = ctx.themeColor( theme, color );
			title.style.color = current;
			title.append( themeSwatch( theme, current, title, ctx ) );
		}
		if ( ctx.editable ) {
			title.append( ...themeTitle( theme, section, fb, ctx, fail ) );
		} else {
			title.textContent = theme.label;
			if ( ctx.deletable ) {
				title.append( themeDelete( theme, section, fb, ctx, fail ) );
			}
		}
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
		if ( ctx.editable ) {
			chips.append( addConceptPill( theme, fb, ctx, fail ) );
		}
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
			section.append( area, saveRow );
		}
		section.append( fb );
		box.append( section );
	} );

	if ( ctx.editable ) {
		// Separa el último tema (su desarrollo y «Guardar») del tema por crear.
		box.append( el( 'hr', 'constel-theme-sep' ) );
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
