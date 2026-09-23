<?php

namespace MediaWiki\Extension\CasiopeaConstel\Domain;

use Normalizer;

/**
 * Identidad de los conceptos (spec: normalize_concept) y clave tolerante para
 * sugerir variantes (spec: SelectionPopup.VariantsSteered).
 *
 * La identidad es ESTRICTA, con la semántica de la parte textual de un título
 * de MediaWiki: NFC, "_" equivale a espacio, espacios colapsados, primera
 * letra en mayúscula si $wgCapitalLinks. El resto queda exacto: «Diseño» y
 * «Diseno» son conceptos distintos.
 *
 * La clave tolerante (fold) sólo sirve para encontrar variantes: pliega
 * mayúsculas, tildes, diéresis y también la ñ, para que «Diseno», escrito
 * desde un teclado sin ñ, sugiera «Diseño» (decisión 2026-09-23). Nunca
 * identifica: sugerir «¿Año?» ante «ano» no une nada.
 */
class ConceptNormalizer {

	public function __construct(
		private readonly bool $capitalLinks
	) {
	}

	/**
	 * Forma canónica: es la clave de identidad y el rótulo visible.
	 */
	public function canonical( string $label ): string {
		$label = $this->collapseSpace( $label );
		if ( $this->capitalLinks && $label !== '' ) {
			$first = mb_substr( $label, 0, 1 );
			$label = mb_strtoupper( $first ) . mb_substr( $label, 1 );
		}
		return $label;
	}

	/**
	 * Clave tolerante para buscar variantes. No es una identidad.
	 */
	public function fold( string $label ): string {
		$decomposed = Normalizer::normalize( $this->collapseSpace( $label ), Normalizer::FORM_D );
		if ( $decomposed === false ) {
			$decomposed = $label;
		}
		// Sin marcas combinantes: tildes, diéresis y la de la ñ.
		$stripped = preg_replace( '/\p{Mn}+/u', '', $decomposed );
		$recomposed = Normalizer::normalize( $stripped, Normalizer::FORM_C );
		return mb_strtolower( $recomposed === false ? $stripped : $recomposed );
	}

	/**
	 * Largo en caracteres de la forma canónica (para los límites de config).
	 */
	public function length( string $label ): int {
		return mb_strlen( $this->canonical( $label ) );
	}

	private function collapseSpace( string $label ): string {
		$nfc = Normalizer::normalize( $label, Normalizer::FORM_C );
		$label = $nfc === false ? $label : $nfc;
		$label = str_replace( '_', ' ', $label );
		$label = preg_replace( '/\s+/u', ' ', $label );
		return trim( $label );
	}
}
