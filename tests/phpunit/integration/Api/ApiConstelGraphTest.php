<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Api;

use MediaWiki\MainConfigNames;
use MediaWiki\Tests\Api\ApiTestCase;
use MediaWiki\Title\Title;
use MediaWiki\User\User;

/**
 * list=constelgraph: grados pedidos y forma compacta (spec: ConceptMap,
 * GraphIsCached, GraphAsksWhatItDraws).
 *
 * @group Database
 * @group API
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiQueryConstelGraph
 */
class ApiConstelGraphTest extends ApiTestCase {

	private const TEXT = 'La travesía abre el espacio. El diseño de la travesía es un acto.';

	private Title $page;
	private int $revId;

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( MainConfigNames::LanguageCode, 'es' );
		$this->overrideConfigValue( 'ConstelGraphCache', null );
		$this->page = Title::makeTitle( NS_MAIN, 'ConstelGraphApiTest' );
		$this->revId = $this->editPage( $this->page, self::TEXT )->getNewRevision()->getId();
	}

	private function create( User $user, int $start, string $exact, string $concept ): void {
		$this->doApiRequestWithToken( [
			'action' => 'constel-createexcerpt',
			'title' => $this->page->getPrefixedText(),
			'revid' => $this->revId,
			'exact' => $exact,
			'prefix' => '',
			'suffix' => '',
			'start' => $start,
			'concept' => $concept,
		], null, $user );
	}

	private function graph( array $params = [] ): array {
		$request = [ 'action' => 'query', 'list' => 'constelgraph' ] + $params;
		return $this->doApiRequest( $request )[0]['query']['constelgraph'];
	}

	private function seed(): void {
		$one = $this->getTestUser()->getUser();
		$two = $this->getMutableTestUser()->getUser();
		$this->create( $one, 3, 'travesía abre', 'Travesía' );
		$this->create( $one, 3, 'travesía abre', 'Apertura' );
		$this->create( $two, 12, 'abre el espacio', 'Espacio' );
	}

	public function testKindsLimitTheLinksButNotTheNodes(): void {
		$this->seed();
		$all = $this->graph();
		$this->assertCount( 3, $all['nodes'] );
		$kinds = array_unique( array_column( $all['links'], 'kind' ) );
		sort( $kinds );
		$this->assertSame( [ 'co_excerpt', 'co_page', 'overlap' ], $kinds );

		$some = $this->graph( [ 'cgkinds' => 'co_excerpt|overlap' ] );
		$this->assertSame( $all['nodes'], $some['nodes'] );
		$kinds = array_unique( array_column( $some['links'], 'kind' ) );
		sort( $kinds );
		$this->assertSame( [ 'co_excerpt', 'overlap' ], $kinds );

		$none = $this->graph( [ 'cgkinds' => '' ] );
		$this->assertCount( 3, $none['nodes'] );
		$this->assertSame( [], $none['links'] );
	}

	public function testCompactReturnsRunsInsteadOfLinks(): void {
		$this->seed();
		$verbose = $this->graph();
		$compact = $this->graph( [ 'cgcompact' => 1 ] );
		$this->assertArrayNotHasKey( 'links', $compact );
		$this->assertSame( $verbose['nodes'], $compact['nodes'] );

		$ids = array_column( $compact['nodes'], 'id' );
		$decoded = [];
		foreach ( $compact['runs'] as $kind => $text ) {
			$run = $text === '' ? [] : array_map( 'intval', explode( ',', $text ) );
			for ( $p = 0; $p < count( $run ); $p += 2 + 2 * $n ) {
				$n = $run[$p + 1];
				for ( $q = $p + 2; $q < $p + 2 + 2 * $n; $q += 2 ) {
					$decoded[] = [ 'source' => $ids[$run[$p]], 'target' => $ids[$run[$q]],
						'kind' => $kind, 'weight' => $run[$q + 1] ];
				}
			}
		}
		$this->assertEqualsCanonicalizing( $verbose['links'], $decoded );

		$onlyOverlap = $this->graph( [ 'cgcompact' => 1, 'cgkinds' => 'overlap' ] );
		$this->assertSame( [ 'overlap' ], array_keys( $onlyOverlap['runs'] ) );
	}

	public function testMineFollowsTheViewerOverTheSharedGraph(): void {
		$this->seed();
		$mine = static function ( array $g ) {
			$flags = array_column( $g['nodes'], 'mine', 'label' );
			ksort( $flags );
			return $flags;
		};
		$this->assertSame( [ 'Apertura' => false, 'Espacio' => false, 'Travesía' => false ], $mine( $this->graph() ) );
		$asOne = $this->doApiRequest(
			[ 'action' => 'query', 'list' => 'constelgraph' ], null, false, $this->getTestUser()->getUser()
		)[0]['query']['constelgraph'];
		$this->assertSame( [ 'Apertura' => true, 'Espacio' => false, 'Travesía' => true ], $mine( $asOne ) );
	}
}
