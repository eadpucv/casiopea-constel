<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Unit\Domain;

use MediaWiki\Extension\CasiopeaConstel\Domain\SvgExport;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\CasiopeaConstel\Domain\SvgExport
 */
class SvgExportTest extends TestCase {

	public static function provideSvg(): array {
		return [
			'con declaración XML' => [
				'<?xml version="1.0" encoding="UTF-8"?>' . "\n<svg viewBox=\"0 0 1 1\"></svg>",
				true
			],
			'sin declaración' => [ '<svg xmlns="http://www.w3.org/2000/svg"></svg>', true ],
			'vacío' => [ '', false ],
			'HTML' => [ '<html><script>alert(1)</script></html>', false ],
			'svg dentro de otra cosa' => [ '<div><svg></svg></div>', false ],
			'etiqueta parecida' => [ '<svgx></svgx>', false ],
		];
	}

	/**
	 * @dataProvider provideSvg
	 */
	public function testIsSvg( string $svg, bool $expected ): void {
		$this->assertSame( $expected, SvgExport::isSvg( $svg ) );
	}

	public function testRejectsTooLarge(): void {
		$this->assertFalse( SvgExport::isSvg( '<svg>' . str_repeat( 'a', 2 * 1024 * 1024 ) . '</svg>' ) );
	}

	public static function provideFileName(): array {
		return [
			'normal' => [ 'mapa-3d-hspencer-all.svg', 'mapa-3d-hspencer-all.svg' ],
			'sin extensión' => [ 'mapa-2d-visitante-all', 'mapa-2d-visitante-all.svg' ],
			'mayúsculas y espacios' => [ 'Mapa 3D Herbert Spencer.SVG', 'mapa-3d-herbert-spencer.svg' ],
			'ruta y comillas' => [ '../../etc/"passwd', 'etc-passwd.svg' ],
			'vacío' => [ '', 'mapa.svg' ],
		];
	}

	/**
	 * @dataProvider provideFileName
	 */
	public function testFileName( string $requested, string $expected ): void {
		$this->assertSame( $expected, SvgExport::fileName( $requested ) );
	}
}
