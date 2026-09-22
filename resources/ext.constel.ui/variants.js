/**
 * Respuesta a un error `variants` (spec: VariantsSteered): ofrece los
 * conceptos parecidos que ya existen y, con un gesto explícito, crear la
 * variante de todos modos. Compartido por el formulario del § y el detalle.
 */

/**
 * @param {HTMLElement} feedback contenedor del mensaje
 * @param {Object} error de api.describeError, con data.variants
 * @param {string} concept lo que escribió el lector
 * @param {Object} actions {choose: (label) => void, createAnyway: () => void}
 */
function render( feedback, error, concept, actions ) {
	feedback.innerHTML = error.html;
	const choices = document.createElement( 'div' );
	choices.className = 'constel-variants';
	( error.data.variants || [] ).forEach( ( variant ) => {
		const b = document.createElement( 'button' );
		b.type = 'button';
		b.className = 'constel-chip constel-chip--choice';
		b.textContent = variant;
		b.addEventListener( 'click', () => actions.choose( variant ) );
		choices.appendChild( b );
	} );
	const anyway = document.createElement( 'button' );
	anyway.type = 'button';
	anyway.className = 'constel-button';
	anyway.textContent = mw.msg( 'constel-form-variant-create', concept );
	anyway.addEventListener( 'click', () => actions.createAnyway() );
	choices.appendChild( anyway );
	feedback.appendChild( choices );
}

module.exports = { render };
