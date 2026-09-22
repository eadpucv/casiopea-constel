/**
 * Llamadas a la API de con§tel. El servidor es la autoridad: aquí sólo se
 * arman peticiones y se devuelven promesas.
 */
const PARAMS = { formatversion: 2, errorformat: 'html', errorlang: mw.config.get( 'wgUserLanguage' ) };

let api = null;
function get() {
	api = api || new mw.Api( { parameters: PARAMS } );
	return api;
}

function listExcerpts( pageId ) {
	return get().get( { action: 'query', list: 'constelexcerpts', cepageid: pageId } )
		.then( ( r ) => r.query.constelexcerpts );
}

function searchConcepts( typed ) {
	return get().get( { action: 'query', list: 'constelconcepts', ccsearch: typed, cclimit: 8 } )
		.then( ( r ) => r.query.constelconcepts, () => [] );
}

function write( params ) {
	return get().postWithToken( 'csrf', params ).then( ( r ) => r[ params.action ] );
}

/**
 * Código y mensaje (HTML ya localizado) de un error de la API.
 *
 * @param {string} code
 * @param {Object} result
 * @return {{code: string, html: string, data: Object}}
 */
function describeError( code, result ) {
	const error = result && result.errors && result.errors[ 0 ];
	return {
		code: error ? error.code : code,
		html: error ? error.html : mw.message( 'constel-error-generic' ).escaped(),
		data: ( error && error.data ) || {}
	};
}

function graph( params ) {
	return get().get( Object.assign( { action: 'query', list: 'constelgraph' }, params ) )
		.then( ( r ) => r.query.constelgraph );
}

function excerptsOfConcept( conceptId ) {
	return get().get( { action: 'query', list: 'constelexcerpts', ceconcept: conceptId } )
		.then( ( r ) => r.query.constelexcerpts );
}

function conceptThemes( conceptId ) {
	return get().get( { action: 'query', list: 'constelconcepts', ccids: conceptId, ccthemes: 1 } )
		.then( ( r ) => ( r.query.constelconcepts[ 0 ] || { themes: [] } ).themes );
}

function themesOf( userName ) {
	return get().get( { action: 'query', list: 'constelthemes', ctuser: userName } )
		.then( ( r ) => r.query.constelthemes, () => [] );
}

function excerptsOf( userName ) {
	return get().get( { action: 'query', list: 'constelexcerpts', ceuser: userName } )
		.then( ( r ) => r.query.constelexcerpts );
}

function pageIdOf( title ) {
	return get().get( { action: 'query', titles: title } )
		.then( ( r ) => {
			const page = r.query.pages[ 0 ];
			return page && !page.missing ? page.pageid : null;
		} );
}

function conceptByLabel( label ) {
	const exact = ( found ) => found.find( ( c ) => c.label === label ) || null;
	return searchConcepts( label ).then( exact );
}

function saveAck() {
	return get().saveOption( 'constel-public-ack', '1' );
}

module.exports = {
	listExcerpts, searchConcepts, write, describeError, saveAck,
	graph, excerptsOfConcept, conceptThemes, themesOf, excerptsOf,
	pageId: pageIdOf, conceptByLabel
};
