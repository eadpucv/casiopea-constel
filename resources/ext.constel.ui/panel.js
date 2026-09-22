/**
 * Panel emergente de con§tel (el formulario del § y el detalle de un §).
 *
 * Se descarta con Escape y con activación fuera; retiene el foco mientras
 * está abierto y lo devuelve a quien lo abrió; se ubica dentro del viewport.
 * Lleva la clase constel-ui: queda fuera del texto canónico.
 */
let current = null;

/**
 * @param {Object} opts
 * @param {string} opts.label nombre accesible del diálogo
 * @param {DOMRect} opts.near rectángulo de referencia (viewport)
 * @param {Element|null} [opts.returnFocus]
 * @return {{el: HTMLElement, body: HTMLElement, close: Function}}
 */
function open( opts ) {
	close();
	const el = document.createElement( 'div' );
	el.className = 'constel-ui constel-panel';
	el.setAttribute( 'role', 'dialog' );
	el.setAttribute( 'aria-label', opts.label );

	const closeButton = document.createElement( 'button' );
	closeButton.type = 'button';
	closeButton.className = 'constel-panel__close';
	closeButton.setAttribute( 'aria-label', mw.msg( 'constel-panel-close' ) );
	closeButton.title = mw.msg( 'constel-panel-close' );
	closeButton.textContent = '×';
	closeButton.addEventListener( 'click', () => close() );

	const body = document.createElement( 'div' );
	body.className = 'constel-panel__body';
	el.append( closeButton, body );
	document.body.appendChild( el );

	const onKey = ( e ) => {
		if ( e.key === 'Escape' ) {
			e.preventDefault();
			close();
		} else if ( e.key === 'Tab' ) {
			trapFocus( el, e );
		}
	};
	const onOutside = ( e ) => {
		if ( !el.contains( e.target ) ) {
			close();
		}
	};
	el.addEventListener( 'keydown', onKey );
	// En el siguiente ciclo, para no cerrarse con el mismo clic que lo abrió.
	setTimeout( () => document.addEventListener( 'mousedown', onOutside ) );

	current = {
		el,
		body,
		close: () => {
			document.removeEventListener( 'mousedown', onOutside );
			el.remove();
			current = null;
			if ( opts.returnFocus && document.contains( opts.returnFocus ) ) {
				opts.returnFocus.focus();
			}
		}
	};
	position( el, opts.near );
	return current;
}

function close() {
	if ( current ) {
		current.close();
	}
}

/**
 * Debajo de la referencia si cabe, si no encima; siempre dentro del viewport.
 *
 * @param {HTMLElement} el
 * @param {DOMRect} near
 */
function position( el, near ) {
	const margin = 8;
	const width = el.offsetWidth;
	const height = el.offsetHeight;
	let left = Math.min( Math.max( margin, near.left ), window.innerWidth - width - margin );
	let top = near.bottom + margin;
	if ( top + height > window.innerHeight - margin && near.top - height - margin > margin ) {
		top = near.top - height - margin;
	}
	left = Math.max( margin, left );
	el.style.left = ( left + window.scrollX ) + 'px';
	el.style.top = ( Math.max( margin, top ) + window.scrollY ) + 'px';
}

/**
 * @param {HTMLElement} el
 * @param {KeyboardEvent} e
 */
function trapFocus( el, e ) {
	const focusable = Array.from( el.querySelectorAll(
		'button:not([disabled]), input:not([disabled]), [tabindex="0"]'
	) ).filter( ( f ) => f.offsetParent !== null );
	if ( !focusable.length ) {
		return;
	}
	const first = focusable[ 0 ];
	const last = focusable[ focusable.length - 1 ];
	if ( e.shiftKey && document.activeElement === first ) {
		e.preventDefault();
		last.focus();
	} else if ( !e.shiftKey && document.activeElement === last ) {
		e.preventDefault();
		first.focus();
	}
}

/**
 * Reubica el panel abierto (su contenido cambió de alto).
 *
 * @param {DOMRect} near
 */
function reposition( near ) {
	if ( current ) {
		position( current.el, near );
	}
}

module.exports = { open, close, reposition, isOpen: () => current !== null };
