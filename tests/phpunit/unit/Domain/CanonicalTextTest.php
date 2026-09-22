<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Unit\Domain;

use MediaWiki\Extension\CasiopeaConstel\Domain\CanonicalText;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\CasiopeaConstel\Domain\CanonicalText
 */
class CanonicalTextTest extends TestCase {

	public function testConcatenatesTextNodesInDocumentOrder(): void {
		$html = '<h2><span class="mw-headline">Amereida</span></h2><p>La <b>travesía</b> abre.</p>';
		$this->assertSame( 'AmereidaLa travesía abre.', ( new CanonicalText() )->fromHtml( $html ) );
	}

	public function testSkipsExcludedTagsAndClasses(): void {
		$html = '<p>uno<style>.x{}</style><span class="mw-editsection">[editar]</span>'
			. '<script>var a;</script> dos<span class="foo constel-ui">§</span></p>';
		$this->assertSame( 'uno dos', ( new CanonicalText() )->fromHtml( $html ) );
	}

	public function testDecodesEntitiesLikeTheBrowser(): void {
		$this->assertSame( "a\u{00A0}b & c", ( new CanonicalText() )->fromHtml( '<p>a&nbsp;b &amp; c</p>' ) );
	}

	public function testExclusionsAreExportable(): void {
		$exclusions = CanonicalText::exclusions();
		$this->assertContains( 'script', $exclusions['tags'] );
		$this->assertContains( 'mw-editsection', $exclusions['classes'] );
	}
}
