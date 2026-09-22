<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Export;

use MediaWiki\Extension\CasiopeaConstel\ConstelServices;
use MediaWiki\Extension\CasiopeaConstel\Domain\TextAnchor;
use MediaWiki\MainConfigNames;
use MediaWiki\Title\Title;
use MediaWikiIntegrationTestCase;
use ZipArchive;

/**
 * Exportación al constel standalone (spec: ReaderExportsReading).
 *
 * @group Database
 * @covers \MediaWiki\Extension\CasiopeaConstel\Export\ExportBuilder
 */
class ExportBuilderTest extends MediaWikiIntegrationTestCase {

	/** Un emoji (2 unidades UTF-16) antes del pasaje: la conversión importa. */
	private const TEXT = "Año 😀 de la travesía.\n\nLa travesía abre el espacio.";

	protected function setUp(): void {
		parent::setUp();
		// SemanticMediaWiki aborta si el idioma de tests difiere del de la wiki.
		$this->overrideConfigValue( MainConfigNames::LanguageCode, 'es' );
	}

	public function testExportMatchesConstelFormat(): void {
		$constel = ConstelServices::wrap( $this->getServiceContainer() );
		$title = Title::makeTitle( NS_MAIN, 'ConstelExportTest' );
		$revision = $this->editPage( $title, self::TEXT )->getNewRevision();
		$page = $this->getServiceContainer()->getPageStore()->getPageForLink( $title );
		$text = $constel->getRenderedTextProvider()->forRevision( $page, $revision );

		$start = mb_strpos( $text, 'travesía' );
		$anchor = TextAnchor::fromRange( $text, $start, $start + mb_strlen( 'travesía' ), 32 );
		$kept = $constel->getExcerptStore()->create(
			1, $title->getArticleID(), $revision->getId(), $anchor, 'Travesía'
		);
		$lostStart = mb_strpos( $text, 'espacio' );
		$lost = $constel->getExcerptStore()->create( 1, $title->getArticleID(), $revision->getId(),
			TextAnchor::fromRange( $text, $lostStart, $lostStart + 7, 32 ), 'Espacio' );
		$constel->getExcerptStore()->markLost( [ $lost->id ] );
		$theme = $constel->getThemeStore()->create( 1, 'Lugar' );
		$conceptId = $constel->getExcerptStore()->conceptIds( $kept->id )[0];
		$constel->getThemeStore()->group( 1, $conceptId, $theme->id );
		$constel->getThemeStore()->addNote( $theme->id, 'Síntesis' );

		$export = $constel->getExportBuilder()->build( 1, 'http://example.org' );
		$db = $export['db'];

		$this->assertSame( 1, $db['version'] );
		$this->assertCount( 1, $db['excerpts'], 'los perdidos no se exportan' );
		$excerpt = reset( $db['excerpts'] );
		$source = $db['sources'][$excerpt['sourceId']];
		$body = trim( preg_replace( '/^---\n.*?\n---\n/s', '', $export['files']['corpus/' . $source['filename']] ) );
		// constel mide en UTF-16 (JS): se reproduce con mb_convert_encoding.
		$utf16 = mb_convert_encoding( $body, 'UTF-16LE', 'UTF-8' );
		$sliced = mb_convert_encoding(
			substr( $utf16, $excerpt['start'] * 2, ( $excerpt['end'] - $excerpt['start'] ) * 2 ), 'UTF-8', 'UTF-16LE'
		);
		$this->assertSame( 'travesía', $sliced );
		$this->assertSame( 'travesía', $excerpt['text'] );

		$concept = $db['concepts'][$excerpt['conceptIds'][0]];
		$this->assertSame( 'Travesía', $concept['label'] );
		$this->assertSame( "thm_{$theme->id}", $concept['themeId'] );
		$this->assertSame( 'Síntesis', reset( $db['notes'] )['text'] );

		$zip = new ZipArchive();
		$path = tempnam( sys_get_temp_dir(), 'constel-test' );
		file_put_contents( $path, $constel->getExportBuilder()->zip( $export ) );
		$this->assertTrue( $zip->open( $path ) );
		$this->assertNotFalse( $zip->locateName( 'constel-db.json' ) );
		$this->assertNotFalse( $zip->locateName( 'corpus/' . $source['filename'] ) );
		$zip->close();
		unlink( $path );
	}
}
