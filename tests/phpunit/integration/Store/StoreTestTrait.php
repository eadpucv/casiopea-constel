<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Store;

use MediaWiki\Extension\CasiopeaConstel\ConstelServices;
use MediaWiki\Extension\CasiopeaConstel\Domain\TextAnchor;

/**
 * Atajos compartidos por los tests de stores.
 */
trait StoreTestTrait {

	private const TEXT = 'La travesía abre el espacio. El diseño de la travesía es un acto.';

	private function constel(): ConstelServices {
		return ConstelServices::wrap( $this->getServiceContainer() );
	}

	private function anchor( string $exact, int $nth = 0 ): TextAnchor {
		$pos = -1;
		for ( $i = 0; $i <= $nth; $i++ ) {
			$pos = mb_strpos( self::TEXT, $exact, $pos + 1 );
		}
		return TextAnchor::fromRange( self::TEXT, $pos, $pos + mb_strlen( $exact ), 32 );
	}
}
