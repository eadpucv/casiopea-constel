/**
 * La afordancia "§" (spec: SelectionPopup.AppearsOnSelection,
 * OnlyContentSelections, KeyboardOperable).
 *
 * Aparece al terminar una selección (ratón, táctil o teclado) de al menos N
 * caracteres contenida en el cuerpo de contenido. Con teclado: tras
 * seleccionar, Alt+Mayús+Intro abre el formulario.
 */
const canonical = require( './canonical.js' );
const config = require( './config.json' );

/**
 * @param {Element} root
 * @return {Object|null} {exact, prefix, suffix, start, rect}
 */
function currentSelection( root ) {
	const sel = window.getSelection();
	if ( !sel || sel.rangeCount === 0 || sel.isCollapsed ) {
		return null;
	}
	const range = sel.getRangeAt( 0 );
	if ( !root.contains( range.startContainer ) || !root.contains( range.endContainer ) ) {
		return null;
	}
	// Ni dentro de la UI de con§tel ni de zonas excluidas o editables.
	for ( const node of [ range.startContainer, range.endContainer ] ) {
		const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
		for ( let e = el; e && e !== root; e = e.parentElement ) {
			if ( canonical.isExcluded( e ) || e.isContentEditable || e.matches( 'input, textarea, select' ) ) {
				return null;
			}
		}
	}
	const { index, segments } = canonical.read( root );
	let start = canonical.positionOf( segments, range.startContainer, range.startOffset );
	let end = canonical.positionOf( segments, range.endContainer, range.endOffset );
	if ( start === null || end === null || end <= start ) {
		return null;
	}
	// Sin espacios en los bordes, como constel.
	while ( start < end && /\s/u.test( index.slice( start, start + 1 ) ) ) {
		start++;
	}
	while ( end > start && /\s/u.test( index.slice( end - 1, end ) ) ) {
		end--;
	}
	const exact = index.slice( start, end );
	const length = end - start;
	if ( length < config.selectionMinLength || length > config.selectionMaxLength ) {
		return null;
	}
	const context = config.anchorContextLength;
	return {
		exact,
		prefix: index.slice( Math.max( 0, start - context ), start ),
		suffix: index.slice( end, Math.min( index.length, end + context ) ),
		start,
		rect: range.getBoundingClientRect()
	};
}

/**
 * @param {Element} root
 * @param {Function} onActivate (selection, button) => void
 */
function install( root, onActivate ) {
	const button = document.createElement( 'button' );
	button.type = 'button';
	button.className = 'constel-ui constel-trigger';
	button.textContent = '§';
	button.setAttribute( 'aria-label', mw.msg( 'constel-trigger-label' ) );
	button.title = mw.msg( 'constel-trigger-label' );
	button.hidden = true;
	document.body.appendChild( button );

	let pending = null;

	const hide = () => {
		button.hidden = true;
		pending = null;
	};
	const refresh = () => {
		pending = currentSelection( root );
		if ( !pending ) {
			button.hidden = true;
			return;
		}
		const r = pending.rect;
		button.hidden = false;
		const size = button.offsetWidth;
		button.style.left = ( Math.min( r.right + 4, window.innerWidth - size - 8 ) + window.scrollX ) + 'px';
		button.style.top = ( Math.max( 8, r.top - size - 4 ) + window.scrollY ) + 'px';
	};
	const activate = () => {
		if ( pending ) {
			const selection = pending;
			hide();
			onActivate( selection, button );
		}
	};

	// mousedown en el botón no debe deshacer la selección.
	button.addEventListener( 'mousedown', ( e ) => e.preventDefault() );
	button.addEventListener( 'click', activate );
	document.addEventListener( 'mouseup', ( e ) => {
		if ( !button.contains( e.target ) ) {
			setTimeout( refresh, 10 );
		}
	} );
	document.addEventListener( 'touchend', () => setTimeout( refresh, 10 ) );
	document.addEventListener( 'keyup', ( e ) => {
		if ( e.shiftKey || e.key === 'Shift' ) {
			refresh();
		}
	} );
	document.addEventListener( 'keydown', ( e ) => {
		if ( e.altKey && e.shiftKey && e.key === 'Enter' ) {
			refresh();
			if ( pending ) {
				e.preventDefault();
				activate();
			}
		}
	} );
	document.addEventListener( 'selectionchange', () => {
		const sel = window.getSelection();
		if ( !sel || sel.isCollapsed ) {
			hide();
		}
	} );
}

module.exports = { install, currentSelection };
