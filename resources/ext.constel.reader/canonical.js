/**
 * Texto canónico en el navegador: espejo exacto de CanonicalText (PHP).
 *
 * Concatenación, en orden de documento, de los nodos de texto bajo la raíz,
 * saltando los subárboles excluidos. La lista de exclusión viene del
 * servidor (config.json), así que ambos lados miden igual.
 *
 * Las posiciones son code points Unicode, no unidades UTF-16: TextIndex
 * convierte entre ambas.
 */
const config = require( './config.json' );

const excludedTags = new Set( config.exclusions.tags.map( ( t ) => t.toUpperCase() ) );
const excludedClasses = config.exclusions.classes;

/**
 * @param {Element} el
 * @return {boolean}
 */
function isExcluded( el ) {
	return excludedTags.has( el.tagName ) ||
		excludedClasses.some( ( c ) => el.classList.contains( c ) );
}

/**
 * Índice de un texto: conversión entre code points y unidades UTF-16.
 */
class TextIndex {
	/**
	 * @param {string} text
	 */
	constructor( text ) {
		this.text = text;
		// unitOf[cp] = unidad UTF-16 donde empieza el code point cp.
		const unitOf = [];
		for ( let unit = 0; unit < text.length; ) {
			unitOf.push( unit );
			unit += text.codePointAt( unit ) > 0xFFFF ? 2 : 1;
		}
		unitOf.push( text.length );
		this.unitOf = unitOf;
		this.length = unitOf.length - 1;
	}

	/**
	 * @param {number} unit
	 * @return {number} code point que contiene esa unidad
	 */
	cpOf( unit ) {
		let lo = 0;
		let hi = this.length;
		while ( lo < hi ) {
			const mid = Math.floor( ( lo + hi + 1 ) / 2 );
			if ( this.unitOf[ mid ] <= unit ) {
				lo = mid;
			} else {
				hi = mid - 1;
			}
		}
		return lo;
	}

	/**
	 * @param {number} start code point
	 * @param {number} end code point (exclusivo)
	 * @return {string}
	 */
	slice( start, end ) {
		return this.text.slice( this.unitOf[ start ], this.unitOf[ end ] );
	}
}

/**
 * Recorre la raíz y devuelve el texto canónico con sus segmentos.
 *
 * @param {Element} root
 * @return {{index: TextIndex, segments: Array<{node: Text, start: number, length: number}>}}
 */
function read( root ) {
	const segments = [];
	let text = '';
	let cp = 0;
	const walker = document.createTreeWalker(
		root,
		// eslint-disable-next-line no-bitwise
		NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
		{
			acceptNode: ( node ) => node.nodeType === Node.ELEMENT_NODE && isExcluded( node ) ?
				NodeFilter.FILTER_REJECT :
				NodeFilter.FILTER_ACCEPT
		}
	);
	for ( let node = walker.nextNode(); node; node = walker.nextNode() ) {
		if ( node.nodeType === Node.TEXT_NODE && node.data !== '' ) {
			const length = Array.from( node.data ).length;
			segments.push( { node, start: cp, length } );
			text += node.data;
			cp += length;
		}
	}
	return { index: new TextIndex( text ), segments };
}

/**
 * Posición canónica (code point) de un punto del DOM.
 *
 * @param {Array} segments
 * @param {Node} container
 * @param {number} offset
 * @return {number|null} null si el punto cae fuera del texto canónico
 */
function positionOf( segments, container, offset ) {
	if ( container.nodeType === Node.TEXT_NODE ) {
		const seg = segments.find( ( s ) => s.node === container );
		return seg ? seg.start + Array.from( container.data.slice( 0, offset ) ).length : null;
	}
	// El punto está entre hijos de un elemento: es la posición del primer
	// segmento que viene después.
	const point = document.createRange();
	point.setStart( container, offset );
	const after = segments.find( ( s ) => point.comparePoint( s.node, 0 ) > 0 );
	if ( after ) {
		return after.start;
	}
	const last = segments[ segments.length - 1 ];
	return last ? last.start + last.length : 0;
}

/**
 * Pedazos de nodos de texto que cubren [start, end), en unidades UTF-16 locales.
 *
 * @param {Array} segments
 * @param {number} start
 * @param {number} end
 * @return {Array<{node: Text, from: number, to: number}>}
 */
function piecesOf( segments, start, end ) {
	const pieces = [];
	for ( const seg of segments ) {
		const segEnd = seg.start + seg.length;
		if ( segEnd <= start || seg.start >= end ) {
			continue;
		}
		const local = new TextIndex( seg.node.data );
		pieces.push( {
			node: seg.node,
			from: local.unitOf[ Math.max( start, seg.start ) - seg.start ],
			to: local.unitOf[ Math.min( end, segEnd ) - seg.start ]
		} );
	}
	return pieces;
}

module.exports = { read, positionOf, piecesOf, isExcluded, TextIndex };
