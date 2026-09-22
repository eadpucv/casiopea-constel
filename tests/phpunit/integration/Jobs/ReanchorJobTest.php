<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Jobs;

use MediaWiki\Extension\CasiopeaConstel\ConstelServices;
use MediaWiki\Extension\CasiopeaConstel\Domain\TextAnchor;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptRecord;
use MediaWiki\MainConfigNames;
use MediaWiki\Title\Title;
use MediaWikiIntegrationTestCase;

/**
 * Las páginas cambian; los §§ las siguen o se pierden
 * (spec: PageRevisedReanchorsExcerpts, PageDeletedLosesExcerpts).
 *
 * @group Database
 * @covers \MediaWiki\Extension\CasiopeaConstel\Jobs\ReanchorJob
 * @covers \MediaWiki\Extension\CasiopeaConstel\Hooks\RevisionHooks
 */
class ReanchorJobTest extends MediaWikiIntegrationTestCase {

	private const TEXT = 'La travesía abre el espacio. El diseño de la travesía es un acto.';

	private Title $page;

	protected function setUp(): void {
		parent::setUp();
		// SemanticMediaWiki aborta si el idioma de tests difiere del de la wiki.
		$this->overrideConfigValue( MainConfigNames::LanguageCode, 'es' );
		$this->page = Title::makeTitle( NS_MAIN, 'ConstelReanchorTest' );
	}

	private function constel(): ConstelServices {
		return ConstelServices::wrap( $this->getServiceContainer() );
	}

	/**
	 * Crea la página y un § sobre la primera "travesía", medido sobre el
	 * texto canónico real del servidor.
	 */
	private function excerptOnFirstTravesia(): ExcerptRecord {
		$revision = $this->editPage( $this->page, self::TEXT )->getNewRevision();
		$record = $this->getServiceContainer()->getPageStore()->getPageForLink( $this->page );
		$text = $this->constel()->getRenderedTextProvider()->forRevision( $record, $revision );
		$start = mb_strpos( $text, 'travesía' );
		$anchor = TextAnchor::fromRange( $text, $start, $start + mb_strlen( 'travesía' ), 32 );
		return $this->constel()->getExcerptStore()->create(
			1, $this->page->getArticleID(), $revision->getId(), $anchor, 'Travesía'
		);
	}

	private function reload( ExcerptRecord $excerpt ): ExcerptRecord {
		return $this->constel()->getExcerptStore()->get( $excerpt->id, true );
	}

	public function testExcerptFollowsTheTextAfterAnEdit(): void {
		$excerpt = $this->excerptOnFirstTravesia();
		$newRev = $this->editPage( $this->page, 'Un prólogo nuevo. ' . self::TEXT )->getNewRevision();
		$this->runJobs( [ 'minJobs' => 1 ], [ 'type' => 'constelReanchor' ] );

		$after = $this->reload( $excerpt );
		$this->assertTrue( $after->isAnchored() );
		$this->assertSame( $newRev->getId(), $after->revId );
		$this->assertSame( $excerpt->anchor->start + mb_strlen( 'Un prólogo nuevo. ' ), $after->anchor->start );
		$this->assertSame( 'travesía', $after->anchor->exact );
	}

	public function testExcerptIsLostWhenItsPassageDisappears(): void {
		$excerpt = $this->excerptOnFirstTravesia();
		$this->editPage( $this->page, 'Otro texto, sin aquel pasaje.' );
		$this->runJobs( [ 'minJobs' => 1 ], [ 'type' => 'constelReanchor' ] );

		$after = $this->reload( $excerpt );
		$this->assertFalse( $after->isAnchored() );
		$this->assertNotNull( $after->lost );
		$this->assertSame( $excerpt->revId, $after->revId, 'conserva la revisión donde fue válido' );
	}

	public function testLostExcerptStaysLostWhenThePassageReturns(): void {
		$excerpt = $this->excerptOnFirstTravesia();
		$this->editPage( $this->page, 'Otro texto.' );
		$this->runJobs( [ 'minJobs' => 1 ], [ 'type' => 'constelReanchor' ] );
		$this->editPage( $this->page, self::TEXT );
		// Sin §§ anclados, la página no encola nada: nadie intenta revivirlo.
		$this->runJobs( [ 'numJobs' => 0 ], [ 'type' => 'constelReanchor' ] );

		$this->assertFalse( $this->reload( $excerpt )->isAnchored(), 'lost es terminal' );
	}

	public function testDeletingThePageLosesItsExcerpts(): void {
		$excerpt = $this->excerptOnFirstTravesia();
		$this->deletePage( $this->getServiceContainer()->getWikiPageFactory()->newFromTitle( $this->page ) );

		$this->assertFalse( $this->reload( $excerpt )->isAnchored() );
	}

	public function testPagesWithoutExcerptsQueueNothing(): void {
		$this->editPage( $this->page, self::TEXT );
		$this->editPage( $this->page, self::TEXT . ' Más.' );
		$this->runJobs( [ 'numJobs' => 0 ], [ 'type' => 'constelReanchor' ] );
	}
}
