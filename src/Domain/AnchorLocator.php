<?php

namespace MediaWiki\Extension\CasiopeaConstel\Domain;

/**
 * Ubica un TextAnchor en un texto canónico (spec: anchor_resolves / relocate).
 *
 * Por niveles, del más estricto al más laxo:
 *   1. ocurrencias de `exact` con prefix Y suffix intactos;
 *   2. ocurrencias con prefix O suffix intacto;
 *   3. ocurrencias de `exact` a secas, sólo si hay exactamente una.
 * En los niveles 1 y 2, si hay varias, gana la más cercana al `start`
 * original; un empate de distancia es ambigüedad. El primer nivel con
 * candidatos decide: si es ambiguo, el ancla no se resuelve (el § se pierde),
 * sin bajar al siguiente.
 */
class AnchorLocator {

	public function __construct(
		private readonly int $contextLength
	) {
	}

	/**
	 * @return TextAnchor|null El ancla recalculada en $text, o null si no se
	 *   puede ubicar sin ambigüedad.
	 */
	public function locate( TextAnchor $anchor, string $text ): ?TextAnchor {
		if ( $anchor->exact === '' ) {
			return null;
		}
		$occurrences = $this->occurrences( $anchor->exact, $text );
		if ( !$occurrences ) {
			return null;
		}
		$exactLength = mb_strlen( $anchor->exact );

		$full = [];
		$partial = [];
		foreach ( $occurrences as $pos ) {
			$prefixOk = $this->endsWithAt( $text, $pos, $anchor->prefix );
			$suffixOk = $this->startsWithAt( $text, $pos + $exactLength, $anchor->suffix );
			if ( $prefixOk && $suffixOk ) {
				$full[] = $pos;
			} elseif ( $prefixOk || $suffixOk ) {
				$partial[] = $pos;
			}
		}

		if ( $full ) {
			$pos = $this->nearest( $full, $anchor->start );
		} elseif ( $partial ) {
			$pos = $this->nearest( $partial, $anchor->start );
		} else {
			$pos = count( $occurrences ) === 1 ? $occurrences[0] : null;
		}

		return $pos === null
			? null
			: TextAnchor::fromRange( $text, $pos, $pos + $exactLength, $this->contextLength );
	}

	public function resolves( TextAnchor $anchor, string $text ): bool {
		return $this->locate( $anchor, $text ) !== null;
	}

	/**
	 * @return int[] Posiciones (code points) de cada ocurrencia, incluidas
	 *   las solapadas.
	 */
	private function occurrences( string $needle, string $haystack ): array {
		$positions = [];
		$pos = mb_strpos( $haystack, $needle );
		while ( $pos !== false ) {
			$positions[] = $pos;
			$pos = mb_strpos( $haystack, $needle, $pos + 1 );
		}
		return $positions;
	}

	/**
	 * @param int[] $candidates
	 */
	private function nearest( array $candidates, int $target ): ?int {
		$best = null;
		$bestDistance = PHP_INT_MAX;
		$tie = false;
		foreach ( $candidates as $pos ) {
			$distance = abs( $pos - $target );
			if ( $distance < $bestDistance ) {
				$best = $pos;
				$bestDistance = $distance;
				$tie = false;
			} elseif ( $distance === $bestDistance ) {
				$tie = true;
			}
		}
		return $tie ? null : $best;
	}

	private function endsWithAt( string $text, int $pos, string $prefix ): bool {
		$length = mb_strlen( $prefix );
		return $length <= $pos && mb_substr( $text, $pos - $length, $length ) === $prefix;
	}

	private function startsWithAt( string $text, int $pos, string $suffix ): bool {
		return mb_substr( $text, $pos, mb_strlen( $suffix ) ) === $suffix;
	}
}
