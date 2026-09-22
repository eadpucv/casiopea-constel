<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Unit\Domain;

use MediaWiki\Extension\CasiopeaConstel\Domain\AnchorLocator;
use MediaWiki\Extension\CasiopeaConstel\Domain\TextAnchor;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\CasiopeaConstel\Domain\AnchorLocator
 */
class AnchorLocatorTest extends TestCase {

	private const CONTEXT = 8;

	private function anchor( string $text, string $exact, int $nth = 0 ): TextAnchor {
		$pos = -1;
		for ( $i = 0; $i <= $nth; $i++ ) {
			$pos = mb_strpos( $text, $exact, $pos + 1 );
		}
		return TextAnchor::fromRange( $text, $pos, $pos + mb_strlen( $exact ), self::CONTEXT );
	}

	public function testSameTextResolvesToSameRange(): void {
		$text = 'La travesía abre el espacio de América.';
		$anchor = $this->anchor( $text, 'travesía' );
		$located = ( new AnchorLocator( self::CONTEXT ) )->locate( $anchor, $text );
		$this->assertSame( [ $anchor->start, $anchor->end ], [ $located->start, $located->end ] );
	}

	public function testFollowsTextInsertedBefore(): void {
		$old = 'La travesía abre el espacio.';
		$new = 'Un prólogo nuevo. La travesía abre el espacio.';
		$located = ( new AnchorLocator( self::CONTEXT ) )->locate( $this->anchor( $old, 'travesía' ), $new );
		$this->assertSame( 'travesía', mb_substr( $new, $located->start, $located->end - $located->start ) );
		$this->assertSame( mb_strpos( $new, 'travesía' ), $located->start );
	}

	public function testContextDisambiguatesRepeatedPassage(): void {
		$old = 'el mar abre. Luego el mar cierra.';
		$anchor = $this->anchor( $old, 'el mar', 1 );
		$new = 'Primero: el mar abre. Luego el mar cierra.';
		$located = ( new AnchorLocator( self::CONTEXT ) )->locate( $anchor, $new );
		$this->assertSame( mb_strpos( $new, 'el mar', 12 ), $located->start );
	}

	public function testPartialContextStillResolves(): void {
		$old = 'antes, la ronda, después';
		$new = 'ANTES! la ronda, después';
		$located = ( new AnchorLocator( self::CONTEXT ) )->locate( $this->anchor( $old, 'la ronda' ), $new );
		$this->assertNotNull( $located );
	}

	public function testBareUniqueOccurrenceResolves(): void {
		$located = ( new AnchorLocator( self::CONTEXT ) )->locate(
			$this->anchor( 'xxxxxxxx la ronda yyyyyyyy', 'la ronda' ),
			'zzzzzzzz la ronda wwwwwwww'
		);
		$this->assertNotNull( $located );
	}

	public function testRemovedPassageIsLost(): void {
		$anchor = $this->anchor( 'La travesía abre el espacio.', 'travesía' );
		$this->assertNull( ( new AnchorLocator( self::CONTEXT ) )->locate( $anchor, 'El viaje abre el espacio.' ) );
	}

	public function testAmbiguityWithoutContextIsLost(): void {
		$anchor = $this->anchor( 'aaaaaaaa la ronda bbbbbbbb', 'la ronda' );
		$new = 'cccccccc la ronda dddddddd la ronda eeeeeeee';
		$this->assertNull( ( new AnchorLocator( self::CONTEXT ) )->locate( $anchor, $new ) );
	}

	public function testEquidistantTieIsLost(): void {
		$anchor = new TextAnchor( 'ab', 'x', 'y', 5, 7 );
		// Dos ocurrencias con contexto completo (en 1 y en 9), ambas a
		// distancia 4 de start=5.
		$this->assertNull( ( new AnchorLocator( 1 ) )->locate( $anchor, 'xabyxxxxxaby' ) );
	}
}
