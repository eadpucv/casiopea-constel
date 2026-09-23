/**
 * Marcas de los §§ sobre el texto. Sólo DOM del cliente: el HTML de la página
 * no cambia (spec: ContentUntouched). Las marcas NO se excluyen del texto
 * canónico (su texto es el de la página), así que medir sigue dando lo mismo.
 */
const canonical = require( './canonical.js' );
const { locate } = require( './locate.js' );

const MARK_CLASS = 'constel-mark';

/* Tonos (oklch) para los autores ajenos: saltan la zona del rojo de la nova,
 * que es de las marcas propias. La luminosidad y el croma, en tokens.css. */
const AUTHOR_HUES = [ 70, 110, 150, 190, 230, 270, 310 ];

/**
 * Tono estable de un autor: el mismo nombre da siempre el mismo color.
 *
 * @param {string} name
 * @return {number}
 */
function authorHue( name ) {
	let h = 0;
	for ( let i = 0; i < name.length; i++ ) {
		h = ( h * 31 + name.charCodeAt( i ) ) % 1000003;
	}
	return AUTHOR_HUES[ h % AUTHOR_HUES.length ];
}

/**
 * Quita todas las marcas y deja el texto como estaba.
 *
 * @param {Element} root
 */
function clear( root ) {
	const marks = root.querySelectorAll( '.' + MARK_CLASS );
	marks.forEach( ( mark ) => {
		mark.replaceWith( ...mark.childNodes );
	} );
	if ( marks.length ) {
		root.normalize();
	}
}

/**
 * Dibuja los §§. La posición guardada es la del servidor; si el DOM del
 * cliente difiere un poco (scripts que agregan texto), se re-ubica por la cita.
 *
 * @param {Element} root
 * @param {Array} excerpts de list=constelexcerpts
 * @param {Function} isMine (excerpt) => boolean
 * @return {number} cuántos §§ se pudieron dibujar
 */
function draw( root, excerpts, isMine ) {
	clear( root );
	let drawn = 0;
	for ( const excerpt of excerpts ) {
		const { index, segments } = canonical.read( root );
		let range = { start: excerpt.start, end: excerpt.end };
		if ( index.slice( range.start, range.end ) !== excerpt.exact ) {
			range = locate( excerpt, index );
		}
		if ( !range ) {
			continue;
		}
		const pieces = canonical.piecesOf( segments, range.start, range.end );
		const labels = excerpt.concepts.map( ( c ) => c.label ).join( ', ' );
		pieces.forEach( ( piece, i ) => {
			let node = piece.node;
			if ( piece.to < node.data.length ) {
				node.splitText( piece.to );
			}
			if ( piece.from > 0 ) {
				node = node.splitText( piece.from );
			}
			const mark = document.createElement( 'mark' );
			// Clases: constel-mark, constel-mark--mine, constel-mark--others,
			// constel-mark--hued
			if ( isMine( excerpt ) ) {
				mark.className = 'constel-mark constel-mark--mine';
			} else if ( excerpt.author && !excerpt.userhidden ) {
				mark.className = 'constel-mark constel-mark--others constel-mark--hued';
				mark.style.setProperty( '--constel-hue', String( authorHue( excerpt.author ) ) );
			} else {
				mark.className = 'constel-mark constel-mark--others';
			}
			mark.dataset.constelExcerpt = String( excerpt.id );
			if ( i === 0 ) {
				// Una sola parada de teclado por §.
				mark.tabIndex = 0;
				mark.setAttribute( 'role', 'button' );
				mark.setAttribute( 'aria-label', mw.msg( 'constel-mark-label', labels ) );
			}
			mark.title = labels;
			node.replaceWith( mark );
			mark.appendChild( node );
		} );
		drawn++;
	}
	return drawn;
}

/**
 * Ids de los §§ bajo un elemento (la marca y las que la contienen).
 *
 * @param {Element} target
 * @param {Element} root
 * @return {number[]}
 */
function excerptIdsAt( target, root ) {
	const ids = [];
	for ( let el = target.closest( '.' + MARK_CLASS ); el && root.contains( el );
		el = el.parentElement && el.parentElement.closest( '.' + MARK_CLASS ) ) {
		const id = Number( el.dataset.constelExcerpt );
		if ( !ids.includes( id ) ) {
			ids.push( id );
		}
	}
	return ids;
}

module.exports = { draw, clear, excerptIdsAt, authorHue, MARK_CLASS };
