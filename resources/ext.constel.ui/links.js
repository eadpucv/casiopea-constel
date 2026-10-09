/**
 * Enlaces de con§tel: a dónde lleva un concepto.
 */

/**
 * Dirección de Especial:Constelación con el concepto elegido y las secciones de
 * sus autores. Nunca abre «Todos»: con decenas de miles de notas sería cargar
 * todo el corpus. Sin autores (anónimo u oculto), el mapa abre con los de quien
 * mira.
 *
 * @param {string} label
 * @param {Array<string|null>} [authors] quienes anotaron
 * @return {string}
 */
function conceptHref( label, authors ) {
	const params = { concept: label };
	const names = ( authors || [] ).filter( Boolean );
	if ( names.length ) {
		params.users = names.join( ';' );
	}
	return mw.util.getUrl( 'Special:Constellation', params );
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
