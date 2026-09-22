/**
 * Formulario del § (spec: SelectionPopup): concepto con autocompletado del
 * vocabulario compartido; variantes ofrecidas antes de crear una nueva
 * (VariantsSteered); aviso de datos públicos la primera vez
 * (ReadingIsPublicData); vista vieja informada sin perder lo escrito
 * (StaleViewReported).
 */
const api = require( 'ext.constel.ui' ).api;
const panel = require( 'ext.constel.ui' ).panel;
const autocomplete = require( 'ext.constel.ui' ).autocomplete;
const variants = require( 'ext.constel.ui' ).variants;

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
 * @param {Object} selection {exact, prefix, suffix, start, rect}
 * @param {Object} ctx {pageId, revId, onCreated, returnFocus}
 */
function open( selection, ctx ) {
	const p = panel.open( {
		label: mw.msg( 'constel-form-title' ),
		near: selection.rect,
		returnFocus: ctx.returnFocus
	} );

	const form = el( 'form', 'constel-form' );
	const title = el( 'p', 'constel-panel__title' );
	title.append( el( 'span', 'constel-sign', '§' ), ' ', mw.msg( 'constel-form-title' ) );
	const quote = el( 'blockquote', 'constel-quote' );
	quote.textContent = selection.exact.length > 160 ?
		selection.exact.slice( 0, 157 ) + '…' :
		selection.exact;

	const inputId = 'constel-concept-input';
	const label = el( 'label', 'constel-label', mw.msg( 'constel-form-concept-label' ) );
	label.htmlFor = inputId;
	const field = el( 'div', 'constel-field' );
	const input = el( 'input', 'constel-input' );
	input.id = inputId;
	input.type = 'text';
	input.required = true;
	input.maxLength = require( './config.json' ).conceptMaxLength;
	input.placeholder = mw.msg( 'constel-form-concept-placeholder' );
	field.appendChild( input );

	const glossId = 'constel-gloss-input';
	const glossLabel = el( 'label', 'constel-label', mw.msg( 'constel-form-gloss-label' ) );
	glossLabel.htmlFor = glossId;
	const gloss = el( 'textarea', 'constel-input constel-gloss' );
	gloss.id = glossId;
	gloss.rows = 3;
	gloss.placeholder = mw.msg( 'constel-form-gloss-placeholder' );
	// Enter en la glosa es salto de línea; Ctrl/Cmd+Enter envía.
	gloss.addEventListener( 'keydown', ( e ) => {
		if ( e.key === 'Enter' && ( e.ctrlKey || e.metaKey ) ) {
			e.preventDefault();
			form.requestSubmit();
		}
	} );

	const feedback = el( 'div', 'constel-feedback' );
	feedback.setAttribute( 'role', 'alert' );

	const actions = el( 'div', 'constel-actions' );
	const submit = el( 'button', 'constel-button constel-button--primary', mw.msg( 'constel-form-submit' ) );
	submit.type = 'submit';
	// Un solo botón: se descarta con × o Escape.
	actions.append( submit );

	form.append( title, quote, label, field, glossLabel, gloss );
	if ( !Number( mw.user.options.get( 'constel-public-ack' ) ) ) {
		form.append( el( 'p', 'constel-notice', mw.msg( 'constel-form-public-notice' ) ) );
	}
	form.append( feedback, actions );
	p.body.appendChild( form );
	panel.reposition( selection.rect );

	const combo = autocomplete.attach( input );
	input.focus();

	let send = null;
	// Un solo envío a la vez: un doble Enter no crea dos §§ iguales.
	let sending = false;

	const showError = ( error, concept ) => {
		feedback.innerHTML = error.html;
		if ( error.code === 'variants' ) {
			variants.render( feedback, error, concept, {
				choose: ( variant ) => {
					input.value = variant;
					send( false );
				},
				createAnyway: () => send( true )
			} );
		} else if ( error.code === 'staleview' ) {
			const reload = el( 'a', 'constel-link', mw.msg( 'constel-form-reload' ) );
			reload.href = location.href;
			feedback.append( ' ', reload );
		}
		panel.reposition( selection.rect );
	};

	send = ( allowVariant ) => {
		const concept = input.value.trim();
		if ( !concept ) {
			input.focus();
			return;
		}
		if ( sending ) {
			return;
		}
		sending = true;
		submit.disabled = true;
		feedback.textContent = mw.msg( 'constel-form-saving' );
		api.write( {
			action: 'constel-createexcerpt',
			pageid: ctx.pageId,
			revid: ctx.revId,
			exact: selection.exact,
			prefix: selection.prefix,
			suffix: selection.suffix,
			start: selection.start,
			concept,
			gloss: gloss.value.trim() || undefined,
			allowvariant: allowVariant ? 1 : undefined
		} ).then( ( result ) => {
			if ( !Number( mw.user.options.get( 'constel-public-ack' ) ) ) {
				mw.user.options.set( 'constel-public-ack', '1' );
				api.saveAck();
			}
			panel.close();
			ctx.onCreated( result );
		}, ( code, result ) => {
			sending = false;
			submit.disabled = false;
			showError( api.describeError( code, result ), concept );
		} );
	};

	form.addEventListener( 'submit', ( e ) => {
		e.preventDefault();
		if ( !combo.isOpen() ) {
			send( false );
		}
	} );
}

module.exports = { open };
