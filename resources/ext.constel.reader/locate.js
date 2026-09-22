/**
 * Ubicación de un ancla en el texto canónico: espejo de AnchorLocator (PHP).
 *
 * Niveles: contexto completo > contexto parcial > ocurrencia única. En los
 * dos primeros, con varias candidatas gana la más cercana al start original;
 * un empate es ambigüedad (null).
 */

/**
 * @param {Object} anchor {exact, prefix, suffix, start} (start en code points)
 * @param {Object} index TextIndex de canonical.js
 * @return {{start: number, end: number}|null} en code points
 */
function locate( anchor, index ) {
	const text = index.text;
	const exact = anchor.exact;
	if ( !exact ) {
		return null;
	}
	const occurrences = [];
	for ( let u = text.indexOf( exact ); u !== -1; u = text.indexOf( exact, u + 1 ) ) {
		occurrences.push( u );
	}
	if ( !occurrences.length ) {
		return null;
	}
	const full = [];
	const partial = [];
	for ( const u of occurrences ) {
		const prefixOk = text.slice( Math.max( 0, u - anchor.prefix.length ), u ) === anchor.prefix;
		const after = u + exact.length;
		const suffixOk = text.slice( after, after + anchor.suffix.length ) === anchor.suffix;
		if ( prefixOk && suffixOk ) {
			full.push( u );
		} else if ( prefixOk || suffixOk ) {
			partial.push( u );
		}
	}

	const nearest = ( candidates ) => {
		let best = null;
		let bestDistance = Infinity;
		let tie = false;
		for ( const u of candidates ) {
			const distance = Math.abs( index.cpOf( u ) - anchor.start );
			if ( distance < bestDistance ) {
				best = u;
				bestDistance = distance;
				tie = false;
			} else if ( distance === bestDistance ) {
				tie = true;
			}
		}
		return tie ? null : best;
	};

	let unit;
	if ( full.length ) {
		unit = nearest( full );
	} else if ( partial.length ) {
		unit = nearest( partial );
	} else {
		unit = occurrences.length === 1 ? occurrences[ 0 ] : null;
	}
	if ( unit === null ) {
		return null;
	}
	const start = index.cpOf( unit );
	return { start, end: start + Array.from( exact ).length };
}

module.exports = { locate };
