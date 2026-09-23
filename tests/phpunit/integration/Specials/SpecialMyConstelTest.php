<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Specials;

use MediaWiki\Extension\CasiopeaConstel\ConstelServices;
use MediaWiki\Extension\CasiopeaConstel\Domain\TextAnchor;
use MediaWiki\MainConfigNames;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Title\Title;
use SpecialPageTestBase;

/**
 * Especial:MiConstel marca los §§ congelados con el aviso de borrado y su
 * motivo (spec: MyReading.FrozenFlagged).
 *
 * @group Database
 * @covers \MediaWiki\Extension\CasiopeaConstel\Specials\SpecialMyConstel
 * @covers \MediaWiki\Extension\CasiopeaConstel\Specials\MyConstelPager
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

	/**
	 * Tres §§ de un lector en dos páginas: «Travesía» ×2 (una perdida) y
	 * «Acto» ×1.
	 *
	 * @return int[] ids, en orden de creación
	 */
	private function threeExcerpts( \MediaWiki\User\User $user ): array {
		$store = ConstelServices::wrap( $this->getServiceContainer() )->getExcerptStore();
		$actorId = $this->getServiceContainer()->getActorNormalization()->acquireActorId( $user, $this->getDb() );
		$text = 'La travesía abre el espacio.';
		$revisions = [];
		foreach ( [ 'ConstelFiltroA', 'ConstelFiltroB' ] as $name ) {
			$revisions[$name] = $this->editPage( Title::makeTitle( NS_MAIN, $name ), $text )->getNewRevision();
		}
		$ids = [];
		foreach ( [ [ 'ConstelFiltroA', 'Travesía' ], [ 'ConstelFiltroB', 'Travesía' ], [ 'ConstelFiltroB', 'Acto' ] ]
			as [ $name, $concept ]
		) {
			$revision = $revisions[$name];
			$anchor = TextAnchor::fromRange( $text, 3, 11, 32 );
			$ids[] = $store->create( $actorId, $revision->getPageId(), $revision->getId(), $anchor, $concept )->id;
		}
		$store->markLost( [ $ids[1] ] );
		return $ids;
	}

	private function rowIds( string $html ): array {
		preg_match_all( '/data-constel-excerpt="(\d+)"/', $html, $m );
		return array_map( 'intval', $m[1] );
	}

	public static function provideFilters(): array {
		return [
			'sin filtro, lo más nuevo primero' => [ [], [ 2, 1, 0 ] ],
			'por concepto' => [ [ 'concept' => 'travesía' ], [ 1, 0 ] ],
			'por página' => [ [ 'page' => 'ConstelFiltroB' ], [ 2, 1 ] ],
			'por estado' => [ [ 'status' => 'lost' ], [ 1 ] ],
			'combinados' => [ [ 'page' => 'ConstelFiltroB', 'concept' => 'Acto' ], [ 2 ] ],
			'concepto inexistente: vacía' => [ [ 'concept' => 'Nada' ], [] ],
			'orden por fecha ascendente' => [ [ 'sort' => 'ce_created', 'asc' => 1 ], [ 0, 1, 2 ] ],
		];
	}

	/**
	 * @dataProvider provideFilters
	 */
	public function testFiltersAndSort( array $query, array $expected ): void {
		$user = $this->getTestUser()->getUser();
		$ids = $this->threeExcerpts( $user );
		[ $html ] = $this->executeSpecialPage( '', new FauxRequest( $query ), 'es', $user );
		$this->assertSame( array_map( static fn ( $i ) => $ids[$i], $expected ), $this->rowIds( $html ) );
		if ( !$expected ) {
			$this->assertStringContainsString( 'Ninguna sección coincide', $html );
		}
	}

	public function testPaginatesWithoutAHiddenCap(): void {
		$user = $this->getTestUser()->getUser();
		$ids = $this->threeExcerpts( $user );
		[ $html ] = $this->executeSpecialPage( '', new FauxRequest( [ 'limit' => 2 ] ), 'es', $user );
		$this->assertSame( [ $ids[2], $ids[1] ], $this->rowIds( $html ) );
		$this->assertMatchesRegularExpression(
			'/TablePager-button-next[^>]*oo-ui-widget-enabled/', $html, 'hay página siguiente'
		);
		$this->assertStringContainsString( 'offset=', $html );
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
