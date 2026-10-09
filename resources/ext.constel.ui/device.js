/**
 * Detección de dispositivos táctiles. iOS (y iPadOS, que se anuncia como Mac)
 * no pinta bien los fondos desenfocados del SVG ni ejecuta con soltura las
 * animaciones del mapa; en ellos —y en cualquier móvil o tableta táctil— el
 * mapa usa texto del color del tema, sin desenfoque, y sin animaciones.
 */
let cached = null;

/**
 * @return {boolean} si el dispositivo es iOS/iPadOS o un móvil táctil
 */
function isMobile() {
	if ( cached === null ) {
		const ua = navigator.userAgent || '';
		const ios = /iPad|iPhone|iPod/.test( ua ) ||
			( navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 );
		const touch = window.matchMedia( '(hover: none) and (pointer: coarse)' ).matches;
		cached = ios || touch;
	}
	return cached;
}

module.exports = { isMobile };
