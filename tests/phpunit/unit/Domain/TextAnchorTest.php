<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Unit\Domain;

use InvalidArgumentException;
use MediaWiki\Extension\CasiopeaConstel\Domain\TextAnchor;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\CasiopeaConstel\Domain\TextAnchor
 */
class TextAnchorTest extends TestCase {

	public function testFromRangeMeasuresInCodePoints(): void {
		$text = 'año tras año, la travesía';
		$anchor = TextAnchor::fromRange( $text, 17, 25, 5 );
		$this->assertSame( 'travesía', $anchor->exact );
		// 'ñ' cuenta como un carácter: el prefijo son los 5 anteriores.
		$this->assertSame( ', la ', $anchor->prefix );
		$this->assertSame( '', $anchor->suffix );
	}

	public function testContextIsClippedAtEdges(): void {
		$anchor = TextAnchor::fromRange( 'abcdef', 0, 2, 32 );
		$this->assertSame( '', $anchor->prefix );
		$this->assertSame( 'cdef', $anchor->suffix );
	}

	public function testRejectsRangeOutsideText(): void {
		$this->expectException( InvalidArgumentException::class );
		TextAnchor::fromRange( 'abc', 1, 5, 4 );
	}

	public function testRejectsExactMismatch(): void {
		$this->expectException( InvalidArgumentException::class );
		new TextAnchor( 'abc', '', '', 0, 2 );
	}

	public function testOverlaps(): void {
		$a = new TextAnchor( 'abcd', '', '', 0, 4 );
		$this->assertTrue( $a->overlaps( new TextAnchor( 'de', '', '', 3, 5 ) ) );
		$this->assertFalse( $a->overlaps( new TextAnchor( 'ef', '', '', 4, 6 ) ), 'rangos contiguos no se solapan' );
	}
}
