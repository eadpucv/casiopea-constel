<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Map;

use MediaWiki\Extension\CasiopeaConstel\ConstelServices;
use MediaWiki\Extension\CasiopeaConstel\Domain\TextAnchor;
use MediaWikiIntegrationTestCase;

/**
 * Topología del mapa (spec: TopologyCoExcerptAndOverlap, OverlapNeverConverges).
 *
 * @group Database
 * @covers \MediaWiki\Extension\CasiopeaConstel\Map\GraphBuilder
 */
class GraphBuilderTest extends MediaWikiIntegrationTestCase {

	private const TEXT = 'La travesía abre el espacio. El diseño de la travesía es un acto.';

	private function constel(): ConstelServices {
		return ConstelServices::wrap( $this->getServiceContainer() );
	}

	private function excerpt( int $actor, int $start, int $end, array $concepts, int $page = 10 ): int {
		$store = $this->constel()->getExcerptStore();
		$e = $store->create( $actor, $page, 100, TextAnchor::fromRange( self::TEXT, $start, $end, 8 ), $concepts[0] );
		foreach ( array_slice( $concepts, 1 ) as $label ) {
			$store->code( $e->id, $label );
		}
		return $e->id;
	}

	private function linkMap( array $graph ): array {
		$labels = array_column( $graph['nodes'], 'label', 'id' );
		$out = [];
		foreach ( $graph['links'] as $l ) {
			$pair = [ $labels[$l['source']], $labels[$l['target']] ];
			sort( $pair );
			$out[$l['kind'] . ':' . implode( '|', $pair )] = $l['weight'];
		}
		ksort( $out );
		return $out;
	}

	private function withoutCoPage( array $links ): array {
		return array_filter( $links, static fn ( $k ) => !str_starts_with( $k, 'co_page:' ), ARRAY_FILTER_USE_KEY );
	}

	public function testCoPageLinksConceptsOfTheSamePage(): void {
		$this->excerpt( 1, 3, 11, [ 'Travesía' ], 10 );
		$this->excerpt( 1, 44, 52, [ 'Diseño' ], 10 );
		$this->excerpt( 2, 3, 11, [ 'Acto' ], 10 );
		$this->excerpt( 1, 3, 11, [ 'Travesía' ], 11 );
		$this->excerpt( 1, 44, 52, [ 'Diseño' ], 11 );

		$links = $this->linkMap( $this->constel()->getGraphBuilder()->build( null, null, null ) );
		$this->assertSame( 2, $links['co_page:Diseño|Travesía'], 'comparten dos páginas' );
		$this->assertSame( 1, $links['co_page:Acto|Travesía'], 'de lectores distintos también' );
		$this->assertArrayNotHasKey( 'co_excerpt:Diseño|Travesía', $links );
	}

	public function testCoExcerptAndOverlap(): void {
		// Lector 1: "travesía abre" con dos conceptos (co_excerpt).
		$this->excerpt( 1, 3, 16, [ 'Travesía', 'Apertura' ] );
		// Lector 2 solapa con otro concepto (overlap con ambos).
		$this->excerpt( 2, 12, 27, [ 'Espacio' ] );
		// Lector 1 solapa consigo mismo: NO es overlap.
		$this->excerpt( 1, 5, 20, [ 'Acto' ] );

		$graph = $this->constel()->getGraphBuilder()->build( null, null, 1 );

		$this->assertSame( [
			'co_excerpt:Apertura|Travesía' => 1,
			'overlap:Acto|Espacio' => 1,
			'overlap:Apertura|Espacio' => 1,
			'overlap:Espacio|Travesía' => 1,
		], $this->withoutCoPage( $this->linkMap( $graph ) ) );
		$mine = array_column( $graph['nodes'], 'mine', 'label' );
		$this->assertTrue( $mine['Travesía'] );
		$this->assertFalse( $mine['Espacio'] );
	}

	public function testLostExcerptsGiveNoOverlap(): void {
		$this->excerpt( 1, 3, 16, [ 'Travesía' ] );
		$lost = $this->excerpt( 2, 12, 27, [ 'Espacio' ] );
		$this->constel()->getExcerptStore()->markLost( [ $lost ] );

		$graph = $this->constel()->getGraphBuilder()->build( null, null, null );
		$this->assertSame( [], $this->withoutCoPage( $this->linkMap( $graph ) ) );
		$this->assertCount( 2, $graph['nodes'], 'el perdido sigue aportando su concepto' );
	}

	public function testScopesAndCounts(): void {
		$this->excerpt( 1, 3, 11, [ 'Travesía' ], 10 );
		$this->excerpt( 2, 3, 11, [ 'Travesía' ], 11 );
		$this->excerpt( 2, 44, 52, [ 'Diseño' ], 11 );

		$all = array_column( $this->constel()->getGraphBuilder()->build( null, null, null )['nodes'], null, 'label' );
		$this->assertSame( 2, $all['Travesía']['excerpts'] );
		$this->assertSame( 2, $all['Travesía']['pages'] );

		$mine = $this->constel()->getGraphBuilder()->build( 1, null, 1 );
		$this->assertSame( [ 'Travesía' ], array_column( $mine['nodes'], 'label' ) );

		$page = $this->constel()->getGraphBuilder()->build( null, 11, null );
		$this->assertEqualsCanonicalizing( [ 'Travesía', 'Diseño' ], array_column( $page['nodes'], 'label' ) );
	}
}
