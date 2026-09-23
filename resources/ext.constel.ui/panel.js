/**
 * Panel emergente de con§tel (el formulario del § y el detalle de un §).
 *
 * Se descarta con Escape y con activación fuera; retiene el foco mientras
 * está abierto y lo devuelve a quien lo abrió; se ubica dentro del viewport.
 * Se arrastra tomándolo por cualquier zona que no sea un control; una vez
 * movido por el lector, deja de reubicarse solo.
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

	const closeButton = require( './icons.js' ).iconButton(
		'x', mw.msg( 'constel-panel-close' ), 'constel-panel__close'
	);
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
	const stopDrag = draggable( el, () => {
		if ( current ) {
			current.moved = true;
		}
	} );

	current = {
		el,
		body,
		moved: false,
		close: () => {
			document.removeEventListener( 'mousedown', onOutside );
			stopDrag();
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

/* Lo que se toma para escribir o elegir no inicia un arrastre. */
const NO_DRAG = 'input, textarea, select, button, a, label, [contenteditable], ' +
	'[role="option"], [role="listbox"], [tabindex]';

/**
 * Arrastre con puntero (ratón, lápiz o dedo), acotado al viewport.
 *
 * @param {HTMLElement} el
 * @param {Function} onMove se llama al primer desplazamiento
 * @return {Function} desinstala los manejadores globales en curso
 */
function draggable( el, onMove ) {
	let drag = null;
	const move = ( e ) => {
		const margin = 8;
		const x = Math.min(
			Math.max( margin, e.clientX - drag.dx ),
			window.innerWidth - el.offsetWidth - margin
		);
		const y = Math.min(
			Math.max( margin, e.clientY - drag.dy ),
			window.innerHeight - Math.min( el.offsetHeight, 48 ) - margin
		);
		el.style.left = ( Math.max( margin, x ) + window.scrollX ) + 'px';
		el.style.top = ( y + window.scrollY ) + 'px';
		onMove();
	};
	const end = () => {
		if ( drag ) {
			el.classList.remove( 'constel-panel--dragging' );
			document.removeEventListener( 'pointermove', move );
			document.removeEventListener( 'pointerup', end );
			document.removeEventListener( 'pointercancel', end );
			drag = null;
		}
	};
	el.addEventListener( 'pointerdown', ( e ) => {
		if ( e.button !== 0 || e.target.closest( NO_DRAG ) ) {
			return;
		}
		const r = el.getBoundingClientRect();
		drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
		el.classList.add( 'constel-panel--dragging' );
		// Sin esto, arrastrar selecciona texto del panel o de la página.
		e.preventDefault();
		document.addEventListener( 'pointermove', move );
		document.addEventListener( 'pointerup', end );
		document.addEventListener( 'pointercancel', end );
	} );
	return end;
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
 * Reubica el panel abierto (su contenido cambió de alto), salvo que el
 * lector ya lo haya movido.
 *
 * @param {DOMRect} near
 */
function reposition( near ) {
	if ( current && !current.moved ) {
		position( current.el, near );
	}
}

module.exports = { open, close, reposition, isOpen: () => current !== null };
