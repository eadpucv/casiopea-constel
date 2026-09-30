/**
 * Campo de píldoras con autocompletado: una lista de valores (lectores,
 * páginas) que se agregan escribiendo y eligiendo, y se quitan con ×.
 *
 * Cada píldora guarda un valor (p. ej. el nombre de usuario) y muestra un
 * rótulo (p. ej. el nombre real); el valor queda como tooltip. Vacío puede
 * significar "todas" (opts.empty); con opts.min no se deja quitar por debajo
 * de ese número.
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
 * @param {string} [opts.icon] ícono Lucide en lugar del rótulo visible (el
 *  nombre queda como tooltip y para lectores de pantalla)
 * @param {string} [opts.hint] explicación larga para el tooltip del ícono (por omisión, el nombre)
 * @param {string} opts.placeholder
 * @param {string} [opts.empty] texto cuando no hay ninguna
 * @param {string[]} [opts.values] valores iniciales
 * @param {number} [opts.min] mínimo de píldoras (default 0)
 * @param {number} [opts.max] máximo de píldoras (sin tope por omisión); lleno, el campo se apaga
 * @param {Function} opts.search (typed) => Promise<Array<string|{value, label, hint?}>>
 * @param {Function} [opts.decorate] (value, index, count, label) => HTMLElement|null, algo que
 *  se antepone a cada píldora (p. ej. el color de un lector)
 * @param {string} [opts.exclusive] valor que no convive con otros: al agregarlo
 *  reemplaza a los demás, y agregar cualquier otro lo saca
 * @param {Function} [opts.valueIcon] (value) => nombre de ícono|null, que lleva la píldora
 * @param {Function} [opts.describe] (values) => Promise<Map<value,label>>
 * @param {Function} [opts.onLabels] () => void, cuando llegan los rótulos iniciales
 * @param {Function} opts.onChange (values) => void
 * @return {{el: HTMLElement, box: HTMLElement, values: Function, labelOf: Function}}
 */
function create( opts ) {
	let values = ( opts.values || [] ).slice();
	const labels = new Map();
	const min = opts.min || 0;
	const labelOf = ( value ) => labels.get( value ) || value;

	const wrap = el( 'div', 'constel-map__field constel-pills' );
	const id = 'constel-pills-' + Math.random().toString( 36 ).slice( 2, 8 );
	const label = el( 'label', 'constel-label' );
	label.htmlFor = id;
	if ( opts.icon ) {
		wrap.classList.add( 'constel-pills--icon' );
		label.classList.add( 'constel-map__icon' );
		label.title = opts.hint || opts.label;
		label.append( icons.icon( opts.icon ), el( 'span', 'constel-visually-hidden', opts.label ) );
	} else {
		label.textContent = opts.label;
	}
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

	const changed = () => opts.onChange( values.slice() );
	const full = () => !!opts.max && values.length >= opts.max;
	const render = () => {
		list.textContent = '';
		values.forEach( ( value ) => {
			const li = el( 'li', 'constel-chip constel-pill' );
			const text = el( 'span', 'constel-chip__label', labelOf( value ) );
			if ( labelOf( value ) !== value && !( opts.valueIcon && opts.valueIcon( value ) ) ) {
				text.title = value;
			}
			const index = values.indexOf( value );
			const name = labelOf( value );
			const extra = opts.decorate && opts.decorate( value, index, values.length, name );
			if ( extra ) {
				li.append( extra );
			}
			const glyph = opts.valueIcon && opts.valueIcon( value );
			if ( glyph ) {
				li.classList.add( 'constel-pill--icon' );
				li.append( icons.icon( glyph ) );
			}
			li.append( text );
			if ( values.length > min ) {
				const remove = icons.iconButton(
					'x', mw.msg( 'constellation-pill-remove', labelOf( value ) ), 'constel-chip__remove'
				);
				remove.addEventListener( 'click', () => {
					values = values.filter( ( v ) => v !== value );
					render();
					changed();
					input.focus();
				} );
				li.append( remove );
			}
			list.append( li );
		} );
		emptyNote.hidden = values.length > 0 || !opts.empty;
		// Con el máximo de píldoras no caben más: el campo se apaga y lo dice.
		input.disabled = full();
		input.placeholder = full() ? mw.msg( 'constellation-pills-full', opts.max ) : opts.placeholder;
	};

	const add = ( value, text ) => {
		value = value.trim();
		if ( text ) {
			labels.set( value, text );
		}
		if ( value && !values.includes( value ) && ( !full() || value === opts.exclusive ) ) {
			if ( opts.exclusive ) {
				// Con el valor exclusivo, los demás salen; con otro, sale el exclusivo.
				values = value === opts.exclusive ?
					[] :
					values.filter( ( v ) => v !== opts.exclusive );
			}
			values.push( value );
			render();
			changed();
		}
		input.value = '';
	};

	const normalise = ( found ) => found.map( ( f ) => typeof f === 'string' ? { value: f, label: f } : f );
	const combo = autocomplete.attach( input, {
		source: ( typed ) => opts.search( typed ).then( ( found ) => normalise( found )
			.filter( ( item ) => !values.includes( item.value ) ) ),
		onPick: ( text, item ) => add( item.value || text, item.label )
	} );
	input.addEventListener( 'keydown', ( e ) => {
		if ( e.key === 'Enter' && !combo.isOpen() ) {
			// Sin elegir de la lista: se agrega lo escrito tal cual.
			e.preventDefault();
			add( input.value );
		} else if ( e.key === 'Backspace' && input.value === '' && values.length > min ) {
			values.pop();
			render();
			changed();
		}
	} );

	render();
	// Rótulos de los valores iniciales (p. ej. nombre real de quien mira).
	if ( opts.describe && values.length ) {
		opts.describe( values ).then( ( found ) => {
			found.forEach( ( text, value ) => labels.set( value, text ) );
			render();
			if ( opts.onLabels ) {
				opts.onLabels();
			}
		} );
	}
	return { el: wrap, box, values: () => values.slice(), labelOf };
}

module.exports = { create };
