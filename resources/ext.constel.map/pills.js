/**
 * Campo de píldoras con autocompletado: una lista de valores (usuarios,
 * páginas) que se agregan escribiendo y eligiendo, y se quitan con ×.
 *
 * Vacío puede significar "todos" (se muestra el texto de opts.empty); con
 * opts.min, no se deja quitar por debajo de ese número.
 */
const { autocomplete, icons } = require( 'ext.constel.ui' );

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
 * @param {Object} opts
 * @param {string} opts.label nombre del campo
 * @param {string} opts.placeholder
 * @param {string} [opts.empty] texto cuando no hay ninguna (p. ej. "todas")
 * @param {string[]} [opts.values] valores iniciales
 * @param {number} [opts.min] mínimo de píldoras (default 0)
 * @param {Function} opts.search (typed) => Promise<string[]>
 * @param {Function} opts.onChange (values) => void
 * @return {{el: HTMLElement, values: Function}}
 */
function create( opts ) {
	let values = ( opts.values || [] ).slice();
	const min = opts.min || 0;

	const wrap = el( 'div', 'constel-map__field constel-pills' );
	const id = 'constel-pills-' + Math.random().toString( 36 ).slice( 2, 8 );
	const label = el( 'label', 'constel-label', opts.label );
	label.htmlFor = id;
	const box = el( 'div', 'constel-pills__box' );
	const list = el( 'ul', 'constel-chips constel-pills__list' );
	list.setAttribute( 'aria-label', opts.label );
	const emptyNote = el( 'span', 'constel-pills__empty', opts.empty || '' );
	const field = el( 'div', 'constel-field constel-pills__field' );
	const input = el( 'input', 'constel-input constel-pills__input' );
	input.id = id;
	input.type = 'text';
	input.placeholder = opts.placeholder;
	field.append( input );
	box.append( list, emptyNote, field );
	wrap.append( label, box );

	const render = () => {
		list.textContent = '';
		values.forEach( ( value ) => {
			const li = el( 'li', 'constel-chip constel-pill' );
			li.append( el( 'span', 'constel-chip__label', value ) );
			if ( values.length > min ) {
				const remove = icons.iconButton(
					'x', mw.msg( 'constellation-pill-remove', value ), 'constel-chip__remove'
				);
				remove.addEventListener( 'click', () => {
					values = values.filter( ( v ) => v !== value );
					render();
					opts.onChange( values.slice() );
					input.focus();
				} );
				li.append( remove );
			}
			list.append( li );
		} );
		emptyNote.hidden = values.length > 0 || !opts.empty;
	};

	const add = ( value ) => {
		value = value.trim();
		if ( value && !values.includes( value ) ) {
			values.push( value );
			render();
			opts.onChange( values.slice() );
		}
		input.value = '';
	};

	const combo = autocomplete.attach( input, {
		source: ( typed ) => opts.search( typed ).then( ( found ) => found
			.filter( ( v ) => !values.includes( v ) )
			.map( ( v ) => ( { label: v } ) ) ),
		onPick: add
	} );
	input.addEventListener( 'keydown', ( e ) => {
		if ( e.key === 'Enter' && !combo.isOpen() ) {
			// Sin elegir de la lista: se agrega lo escrito tal cual.
			e.preventDefault();
			add( input.value );
		} else if ( e.key === 'Backspace' && input.value === '' && values.length > min ) {
			values.pop();
			render();
			opts.onChange( values.slice() );
		}
	} );

	render();
	return { el: wrap, values: () => values.slice() };
}

module.exports = { create };
