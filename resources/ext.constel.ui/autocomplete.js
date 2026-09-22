/**
 * Autocompletado del vocabulario compartido (spec: SharedVocabularyAutocomplete).
 * Patrón ARIA combobox: el input conserva el foco; las flechas recorren la
 * lista; Enter elige; Escape cierra sólo la lista.
 */
const api = require( './api.js' );

let seq = 0;

/**
 * @param {HTMLInputElement} input
 * @param {Object} [opts]
 * @param {Function} [opts.onPick] (label) => void
 * @return {{isOpen: Function, close: Function}}
 */
function attach( input, opts = {} ) {
	const id = 'constel-ac-' + ( ++seq );
	const list = document.createElement( 'ul' );
	list.id = id;
	list.className = 'constel-ac';
	list.setAttribute( 'role', 'listbox' );
	list.hidden = true;
	input.after( list );
	input.setAttribute( 'role', 'combobox' );
	input.setAttribute( 'aria-autocomplete', 'list' );
	input.setAttribute( 'aria-controls', id );
	input.setAttribute( 'aria-expanded', 'false' );
	input.autocomplete = 'off';

	let active = -1;
	let timer = null;
	let request = 0;

	const options = () => Array.from( list.children );
	const setActive = ( i ) => {
		options().forEach( ( o, j ) => o.setAttribute( 'aria-selected', String( j === i ) ) );
		active = i;
		if ( i >= 0 ) {
			input.setAttribute( 'aria-activedescendant', options()[ i ].id );
		} else {
			input.removeAttribute( 'aria-activedescendant' );
		}
	};
	const closeList = () => {
		list.hidden = true;
		input.setAttribute( 'aria-expanded', 'false' );
		setActive( -1 );
	};
	const pick = ( label ) => {
		input.value = label;
		closeList();
		if ( opts.onPick ) {
			opts.onPick( label );
		}
	};
	const render = ( concepts ) => {
		list.textContent = '';
		concepts.forEach( ( c, i ) => {
			const li = document.createElement( 'li' );
			li.id = id + '-' + i;
			li.setAttribute( 'role', 'option' );
			li.className = 'constel-ac__option';
			const label = document.createElement( 'span' );
			label.textContent = c.label;
			const uses = document.createElement( 'span' );
			uses.className = 'constel-ac__uses';
			uses.textContent = mw.msg( 'constel-suggestion-uses', mw.language.convertNumber( c.uses ), c.uses );
			li.append( label, uses );
			li.addEventListener( 'mousedown', ( e ) => {
				e.preventDefault();
				pick( c.label );
			} );
			list.appendChild( li );
		} );
		list.hidden = !concepts.length;
		input.setAttribute( 'aria-expanded', String( !list.hidden ) );
		setActive( -1 );
	};

	input.addEventListener( 'input', () => {
		clearTimeout( timer );
		const typed = input.value.trim();
		if ( !typed ) {
			closeList();
			return;
		}
		timer = setTimeout( () => {
			const mine = ++request;
			api.searchConcepts( typed ).then( ( concepts ) => {
				if ( mine === request ) {
					render( concepts );
				}
			} );
		}, 150 );
	} );
	input.addEventListener( 'keydown', ( e ) => {
		const n = options().length;
		if ( list.hidden || !n ) {
			return;
		}
		if ( e.key === 'ArrowDown' ) {
			e.preventDefault();
			setActive( ( active + 1 ) % n );
		} else if ( e.key === 'ArrowUp' ) {
			e.preventDefault();
			setActive( ( active - 1 + n ) % n );
		} else if ( e.key === 'Enter' && active >= 0 ) {
			e.preventDefault();
			e.stopPropagation();
			pick( options()[ active ].firstChild.textContent );
		} else if ( e.key === 'Escape' ) {
			e.preventDefault();
			e.stopPropagation();
			closeList();
		}
	} );
	input.addEventListener( 'blur', () => setTimeout( closeList, 100 ) );

	return { isOpen: () => !list.hidden, close: closeList };
}

module.exports = { attach };
