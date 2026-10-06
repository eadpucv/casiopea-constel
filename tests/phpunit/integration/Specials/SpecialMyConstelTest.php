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
			'concepto sin tildes ni mayúsculas' => [ [ 'concept' => 'travesia' ], [ 1, 0 ] ],
			'concepto por prefijo' => [ [ 'concept' => 'Trav' ], [ 1, 0 ] ],
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

	public function testTableHasNoStatusColumnButMarksLostOnes(): void {
		$user = $this->getTestUser()->getUser();
		$this->threeExcerpts( $user );
		[ $html ] = $this->executeSpecialPage( '', new FauxRequest(), 'es', $user );
		$this->assertStringNotContainsString( '>Estado<', preg_replace( '/<form.*?<\/form>/s', '', $html ) );
		$this->assertSame( 1, substr_count( $html, 'Perdida: el texto cambió' ) );
	}

	public function testEachRowHasASelectionCheckbox(): void {
		$user = $this->getTestUser()->getUser();
		$ids = $this->threeExcerpts( $user );
		[ $html ] = $this->executeSpecialPage( '', new FauxRequest(), 'es', $user );
		preg_match_all( '/<input[^>]*constel-mine__select[^>]*value="(\d+)"/', $html, $m );
		$this->assertEqualsCanonicalizing( $ids, array_map( 'intval', $m[1] ) );
	}

	public static function provideCsv(): array {
		return [
			'todo' => [ [], 3 ],
			'filtrado' => [ [ 'concept' => 'Acto' ], 1 ],
		];
	}

	/**
	 * @dataProvider provideCsv
	 */
	public function testExportsCsvWithTheTableFilters( array $query, int $rows ): void {
		$user = $this->getTestUser()->getUser();
		$this->threeExcerpts( $user );
		[ $csv ] = $this->executeSpecialPage( 'export', new FauxRequest( $query ), 'es', $user );
		$this->assertStringStartsWith( "\xEF\xBB\xBF", $csv );
		$lines = str_getcsv( substr( $csv, 3 ), "\n", '"', '' );
		$this->assertCount( $rows + 1, $lines, 'encabezado + filas' );
		$this->assertStringContainsString( 'ConstelFiltro', $csv );
	}

	public function testPaginatesBy20AtTheBottomOnly(): void {
		$user = $this->getTestUser()->getUser();
		$ids = $this->threeExcerpts( $user );
		$store = ConstelServices::wrap( $this->getServiceContainer() )->getExcerptStore();
		$actorId = $this->getServiceContainer()->getActorNormalization()->acquireActorId( $user, $this->getDb() );
		$page = $this->getServiceContainer()->getTitleFactory()->newFromText( 'ConstelFiltroA' );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $page );
		for ( $i = 0; $i < 18; $i++ ) {
			$ids[] = $store->create(
				$actorId, $revision->getPageId(), $revision->getId(), TextAnchor::fromRange( 'La travesía abre el espacio.', 3, 11, 32 ), 'Otro'
			)->id;
		}
		[ $html ] = $this->executeSpecialPage( '', new FauxRequest(), 'es', $user );
		$this->assertCount( 20, $this->rowIds( $html ), '20 por omisión' );
		$this->assertSame( 1, substr_count( $html, '<nav class="constel-mine__pager"' ), 'sólo al final' );
		$this->assertGreaterThan( strrpos( $html, '</table>' ), strpos( $html, 'constel-mine__pager' ) );
		$this->assertStringContainsString( 'offset=', $html );

		[ $html ] = $this->executeSpecialPage( '', new FauxRequest( [ 'limit' => 50 ] ), 'es', $user );
		$this->assertCount( 21, $this->rowIds( $html ), 'el selector ofrece 50' );
		[ $html ] = $this->executeSpecialPage( '', new FauxRequest( [ 'limit' => 7 ] ), 'es', $user );
		$this->assertCount( 20, $this->rowIds( $html ), 'un límite fuera del selector vuelve a 20' );
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
