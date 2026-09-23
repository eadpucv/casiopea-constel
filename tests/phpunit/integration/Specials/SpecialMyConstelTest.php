<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Specials;

use MediaWiki\Extension\CasiopeaConstel\ConstelServices;
use MediaWiki\Extension\CasiopeaConstel\Domain\TextAnchor;
use MediaWiki\MainConfigNames;
use MediaWiki\Title\Title;
use SpecialPageTestBase;

/**
 * Especial:MiConstel marca los §§ congelados con el aviso de borrado y su
 * motivo (spec: MyReading.FrozenFlagged).
 *
 * @group Database
 * @covers \MediaWiki\Extension\CasiopeaConstel\Specials\SpecialMyConstel
 * @covers \MediaWiki\Extension\CasiopeaConstel\Page\DeletionLog
 */
class SpecialMyConstelTest extends SpecialPageTestBase {

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( MainConfigNames::LanguageCode, 'es' );
	}

	protected function newSpecialPage() {
		return $this->getServiceContainer()->getSpecialPageFactory()->getPage( 'MyConstel' );
	}

	public function testFrozenExcerptShowsTheDeletionNoticeAndReason(): void {
		$user = $this->getTestUser()->getUser();
		$page = Title::makeTitle( NS_MAIN, 'ConstelMyConstelTest' );
		$revision = $this->editPage( $page, 'La travesía abre el espacio.' )->getNewRevision();
		$actorId = $this->getServiceContainer()->getActorNormalization()
			->acquireActorId( $user, $this->getDb() );
		$text = 'La travesía abre el espacio.';
		ConstelServices::wrap( $this->getServiceContainer() )->getExcerptStore()->create(
			$actorId, $page->getArticleID(), $revision->getId(), TextAnchor::fromRange( $text, 3, 11, 32 ), 'Travesía'
		);
		$this->deletePage(
			$this->getServiceContainer()->getWikiPageFactory()->newFromTitle( $page ),
			'Infracción de derechos de autor'
		);

		[ $html ] = $this->executeSpecialPage( '', null, 'es', $user );

		$this->assertStringContainsString( 'constel-mine__row--frozen', $html );
		$this->assertStringContainsString( 'data-constel-status="frozen"', $html );
		$this->assertStringContainsString( 'Infracción de derechos de autor', $html, 'el motivo del registro' );
		$this->assertStringContainsString( 'ConstelMyConstelTest', $html, 'el título de la página borrada' );
		$this->assertStringContainsString( 'travesía', $html, 'su autor ve el pasaje' );
	}
}
