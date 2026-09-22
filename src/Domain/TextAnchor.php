<?php

namespace MediaWiki\Extension\CasiopeaConstel\Domain;

use InvalidArgumentException;

/**
 * Ancla textual de un § (spec: TextAnchor), estilo W3C Web Annotation:
 * TextQuoteSelector (exact + prefix + suffix) y TextPositionSelector
 * (start/end). Las posiciones están en code points sobre el texto canónico
 * (ver CanonicalText); end es exclusivo.
 */
final class TextAnchor {

	public function __construct(
		public readonly string $exact,
		public readonly string $prefix,
		public readonly string $suffix,
		public readonly int $start,
		public readonly int $end
	) {
		if ( $start < 0 || $end < $start ) {
			throw new InvalidArgumentException( "Rango inválido: [$start, $end)" );
		}
		if ( mb_strlen( $exact ) !== $end - $start ) {
			throw new InvalidArgumentException( 'exact no coincide con el largo del rango' );
		}
	}

	/**
	 * Construye el ancla de un rango sobre el texto canónico, recortando el
	 * contexto a $contextLength caracteres por lado.
	 */
	public static function fromRange( string $text, int $start, int $end, int $contextLength ): self {
		$length = mb_strlen( $text );
		if ( $start < 0 || $end > $length || $end <= $start ) {
			throw new InvalidArgumentException( "Rango fuera del texto: [$start, $end) de $length" );
		}
		$prefixStart = max( 0, $start - $contextLength );
		return new self(
			mb_substr( $text, $start, $end - $start ),
			mb_substr( $text, $prefixStart, $start - $prefixStart ),
			mb_substr( $text, $end, $contextLength ),
			$start,
			$end
		);
	}

	public function overlaps( self $other ): bool {
		return $this->start < $other->end && $other->start < $this->end;
	}
}
