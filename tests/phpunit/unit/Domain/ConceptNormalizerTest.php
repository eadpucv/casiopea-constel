<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Unit\Domain;

use MediaWiki\Extension\CasiopeaConstel\Domain\ConceptNormalizer;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\CasiopeaConstel\Domain\ConceptNormalizer
 */
class ConceptNormalizerTest extends TestCase {

	public static function provideCanonical(): array {
		return [
			'primera letra en mayúscula' => [ 'diseño', 'Diseño' ],
			'guion bajo = espacio' => [ 'diseño_de_la_ciudad', 'Diseño de la ciudad' ],
			'espacios colapsados y recortados' => [ "  la   ronda\t", 'La ronda' ],
			'el resto queda exacto' => [ 'la Travesía', 'La Travesía' ],
			'NFD pasa a NFC' => [ "disen\u{0303}o", 'Diseño' ],
			'inicial con tilde' => [ 'ámbito', 'Ámbito' ],
			'vacío' => [ '   ', '' ],
		];
	}

	/**
	 * @dataProvider provideCanonical
	 */
	public function testCanonical( string $input, string $expected ): void {
		$this->assertSame( $expected, ( new ConceptNormalizer( true ) )->canonical( $input ) );
	}

	public function testCanonicalWithoutCapitalLinks(): void {
		$this->assertSame( 'diseño', ( new ConceptNormalizer( false ) )->canonical( 'diseño' ) );
	}

	public function testIdentityIsStrict(): void {
		$n = new ConceptNormalizer( true );
		$this->assertNotSame( $n->canonical( 'Diseño' ), $n->canonical( 'Diseno' ) );
		$this->assertNotSame( $n->canonical( 'Travesía' ), $n->canonical( 'TRAVESÍA' ) );
	}

	public static function provideVariants(): array {
		return [
			'sin tilde' => [ 'Diseño gráfico', 'Diseño grafico', true ],
			'mayúsculas' => [ 'Travesía', 'TRAVESÍA', true ],
			'diéresis' => [ 'Pingüino', 'pinguino', true ],
			'espacios' => [ 'La ronda', 'la_ronda', true ],
			'la ñ no es una tilde' => [ 'Año', 'Ano', false ],
			'ñ mayúscula' => [ 'AÑO', 'año', true ],
			'palabras distintas' => [ 'Casa', 'Caza', false ],
		];
	}

	/**
	 * @dataProvider provideVariants
	 */
	public function testFoldFindsVariants( string $a, string $b, bool $same ): void {
		$n = new ConceptNormalizer( true );
		$this->assertSame( $same, $n->fold( $a ) === $n->fold( $b ) );
	}

	public function testLengthCountsCharacters(): void {
		$this->assertSame( 6, ( new ConceptNormalizer( true ) )->length( '  diseño ' ) );
	}
}
