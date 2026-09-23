<?php

namespace MediaWiki\Extension\CasiopeaConstel\Domain;

/**
 * Reglas de la descarga del mapa como SVG (Especial:ConstellationSvg): qué
 * contenido se acepta y con qué nombre se entrega. Sin dependencias de
 * MediaWiki, para probarlas en aislamiento.
 */
class SvgExport {

	public const MAX_BYTES = 2 * 1024 * 1024;

	/**
	 * Un documento SVG de tamaño razonable: declaración XML opcional y raíz <svg>.
	 */
	public static function isSvg( string $svg ): bool {
		if ( $svg === '' || strlen( $svg ) > self::MAX_BYTES ) {
			return false;
		}
		return (bool)preg_match( '/^\s*(<\?xml[^>]*\?>\s*)?<svg[\s>]/', $svg );
	}

	/**
	 * Nombre seguro: minúsculas, [a-z0-9-], siempre con extensión .svg.
	 */
	public static function fileName( string $requested ): string {
		$base = preg_replace( '/\.svg$/i', '', $requested );
		$base = trim( preg_replace( '/[^a-z0-9]+/', '-', strtolower( $base ) ), '-' );
		return ( $base !== '' ? substr( $base, 0, 120 ) : 'mapa' ) . '.svg';
	}
}
