/**
 * Enlaces de con§tel: a dónde lleva un concepto.
 */

/**
 * Dirección de Especial:Constelación con el concepto elegido (y las secciones
 * de todos los lectores).
 *
 * @param {string} label
 * @return {string}
 */
function conceptHref( label ) {
	return mw.util.getUrl( 'Special:Constellation', { concept: label } );
}

/**
 * ¿Es un clic simple (sin Ctrl, Cmd, Mayús, Alt ni botón distinto del primero)?
 * Con otro, el navegador abre el enlace como sabe (pestaña nueva, etc.).
 *
 * @param {MouseEvent} event
 * @return {boolean}
 */
function isPlainClick( event ) {
	return event.button === 0 && !event.ctrlKey && !event.metaKey &&
		!event.shiftKey && !event.altKey;
}

module.exports = { conceptHref, isPlainClick };
