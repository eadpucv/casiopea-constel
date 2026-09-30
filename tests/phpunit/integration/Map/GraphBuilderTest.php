<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Map;

use MediaWiki\Extension\CasiopeaConstel\ConstelServices;
use MediaWiki\Extension\CasiopeaConstel\Domain\TextAnchor;
use MediaWiki\Extension\CasiopeaConstel\Map\GraphBuilder;
use MediaWiki\Extension\CasiopeaConstel\Map\GraphVersion;
use MediaWikiIntegrationTestCase;
use Wikimedia\ObjectCache\WANObjectCache;

/**
 * Topología del mapa (spec: TopologyCoExcerptAndOverlap, OverlapNeverConverges)
 * y su caché (spec: GraphIsCached).
 *
 * @group Database
 * @covers \MediaWiki\Extension\CasiopeaConstel\Map\GraphBuilder
 */
class GraphBuilderTest extends MediaWikiIntegrationTestCase {

	private const TEXT = 'La travesía abre el espacio. El diseño de la travesía es un acto.';

	/** Reloj simulado de la caché (ver tick()). */
	private float $now;

	protected function setUp(): void {
		parent::setUp();
		// La caché principal de la prueba (LocalSettings puede dar otra al grafo).
		$this->overrideConfigValue( 'ConstelGraphCache', null );
		// Segundos enteros: la marca de contacto de la caché los redondea.
		$this->now = (float)time();
		$this->getServiceContainer()->getMainWANObjectCache()->setMockTime( $this->now );
	}

	/**
	 * Avanza el reloj de la caché. La marca de contacto de WANObjectCache se
	 * redondea al segundo y el core reutiliza como «volátil» un valor escrito
	 * hace decenas de ms: un test que escribe y lee en el mismo instante no
	 * vería el contacto (en producción esa ventana es de milisegundos). Además,
	 * tras un contacto hay un período de espera (HOLDOFF_TTL) en el que los
	 * valores recién calculados no se reutilizan: pasarlo con $seconds.
	 */
	private function tick( float $seconds = 1.0 ): void {
		$this->now += $seconds;
	}

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

	public function testFrozenExcerptsDoNotCount(): void {
		$this->excerpt( 1, 3, 16, [ 'Travesía', 'Apertura' ], 10 );
		$this->excerpt( 2, 3, 11, [ 'Travesía', 'Espacio' ], 11 );
		$this->constel()->getExcerptStore()->freezeForPage( 11 );

		$graph = $this->constel()->getGraphBuilder()->build( null, null, null );
		$nodes = array_column( $graph['nodes'], null, 'label' );
		$this->assertSame( [ 'Apertura', 'Travesía' ], $this->sorted( array_keys( $nodes ) ),
			'un concepto que sólo vive en §§ congelados sale del mapa' );
		$this->assertSame( 1, $nodes['Travesía']['excerpts'] );
		$this->assertSame( 1, $nodes['Travesía']['pages'] );
	}

	private function sorted( array $labels ): array {
		sort( $labels );
		return $labels;
	}

	public function testScopesAndCounts(): void {
		$this->excerpt( 1, 3, 11, [ 'Travesía' ], 10 );
		$this->excerpt( 2, 3, 11, [ 'Travesía' ], 11 );
		$this->excerpt( 2, 44, 52, [ 'Diseño' ], 11 );

		$all = array_column( $this->constel()->getGraphBuilder()->build( null, null, null )['nodes'], null, 'label' );
		$this->assertSame( 2, $all['Travesía']['excerpts'] );
		$this->assertSame( 2, $all['Travesía']['pages'] );

		$mine = $this->constel()->getGraphBuilder()->build( [ 1 ], null, 1 );
		$this->assertSame( [ 'Travesía' ], array_column( $mine['nodes'], 'label' ) );

		$page = $this->constel()->getGraphBuilder()->build( null, [ 11 ], null );
		$this->assertEqualsCanonicalizing( [ 'Travesía', 'Diseño' ], array_column( $page['nodes'], 'label' ) );

		$both = $this->constel()->getGraphBuilder()->build( [ 1, 2 ], [ 10, 11 ], null );
		$this->assertCount( 2, $both['nodes'] );
		$this->assertSame( 2, array_column( $both['nodes'], null, 'label' )['Travesía']['pages'] );

		$page = $this->constel()->getGraphBuilder()->build( [], [], null );
		$this->assertCount( 2, $page['nodes'], 'vacío = todos' );
		$page = $this->constel()->getGraphBuilder()->build( null, [ 11 ], null );
		$this->assertEqualsCanonicalizing( [ 'Travesía', 'Diseño' ], array_column( $page['nodes'], 'label' ) );
	}

	public function testGraphIsCachedUntilAWriteTouchesIt(): void {
		$this->excerpt( 1, 3, 11, [ 'Travesía' ] );
		$builder = $this->constel()->getGraphBuilder();
		// Pasada la espera que sigue a la escritura, el grafo queda guardado.
		$this->tick( WANObjectCache::HOLDOFF_TTL + 1 );
		$this->assertSame( [ 'Travesía' ], array_column( $builder->build( null, null, null )['nodes'], 'label' ) );

		// Una escritura por fuera de los almacenes no toca la clave: el
		// grafo guardado sigue vigente (así se sabe que es la caché la que responde).
		$this->getDb()->newUpdateQueryBuilder()
			->update( 'constel_concept' )->set( [ 'cc_key' => 'Viaje' ] )
			->where( [ 'cc_key' => 'Travesía' ] )->caller( __METHOD__ )->execute();
		$this->tick();
		$this->assertSame( [ 'Travesía' ], array_column( $builder->build( null, null, null )['nodes'], 'label' ) );

		// Con el contacto, se rehace.
		$this->constel()->getGraphVersion()->touch( $this->getDb() );
		$this->tick();
		$this->assertSame( [ 'Viaje' ], array_column( $builder->build( null, null, null )['nodes'], 'label' ) );
	}

	public function testEveryStoreWriteTouchesTheGraph(): void {
		$builder = $this->constel()->getGraphBuilder();
		$store = $this->constel()->getExcerptStore();
		$labels = function () use ( $builder ) {
			$this->tick();
			return array_column( $builder->build( null, null, null )['nodes'], 'excerpts', 'label' );
		};

		$this->assertSame( [], $labels() );
		$id = $this->excerpt( 1, 3, 11, [ 'Travesía' ] );
		$this->assertSame( [ 'Travesía' => 1 ], $labels(), 'crear' );
		$store->code( $id, 'Acto' );
		$this->assertSame( [ 'Travesía' => 1, 'Acto' => 1 ], $labels(), 'codificar' );
		$this->excerpt( 2, 3, 11, [ 'Travesía' ] );
		$this->assertSame( [ 'Travesía' => 2, 'Acto' => 1 ], $labels(), 'otro lector' );
		$store->markLost( [ $id ] );
		$this->tick();
		$this->assertSame( [], $this->linkKind( $builder->build( null, null, null ), 'overlap' ), 'perder' );
		$this->constel()->getConceptStore()->rename(
			$this->constel()->getConceptStore()->getByLabel( 'Acto' )->id, 'Gesto'
		);
		$this->assertSame( [ 'Travesía' => 2, 'Gesto' => 1 ], $labels(), 'renombrar' );
		$store->uncode( $id, $this->constel()->getConceptStore()->getByLabel( 'Gesto' )->id );
		$this->assertSame( [ 'Travesía' => 2 ], $labels(), 'descodificar' );
		$store->freezeForPage( 10 );
		$this->assertSame( [], $labels(), 'congelar' );
		$store->adoptFrozen( [ 10 ], 12 );
		$this->assertSame( [], $labels(), 'lo congelado adoptado sigue congelado hasta re-anclar' );
		$store->delete( $id );
		$this->assertSame( [], $labels(), 'borrar' );
	}

	private function linkKind( array $graph, string $kind ): array {
		return array_filter(
			$this->linkMap( $graph ),
			static fn ( $k ) => str_starts_with( $k, "$kind:" ),
			ARRAY_FILTER_USE_KEY
		);
	}

	public function testKindsFilterTheLinksNotTheNodes(): void {
		$this->excerpt( 1, 3, 16, [ 'Travesía', 'Apertura' ] );
		$this->excerpt( 2, 12, 27, [ 'Espacio' ] );
		$builder = $this->constel()->getGraphBuilder();

		$all = $builder->build( null, null, null );
		$onlySection = $builder->build( null, null, null, [ 'co_excerpt' ] );
		$this->assertSame( $all['nodes'], $onlySection['nodes'] );
		$this->assertSame( [ 'co_excerpt:Apertura|Travesía' => 1 ], $this->linkMap( $onlySection ) );

		$none = $builder->build( null, null, null, [] );
		$this->assertSame( [], $none['links'] );
		$this->assertCount( 3, $none['nodes'] );

		$twice = $builder->build( null, null, null, [ 'overlap', 'bogus', 'overlap' ] );
		$this->assertSame( [
			'overlap:Apertura|Espacio' => 1,
			'overlap:Espacio|Travesía' => 1,
		], $this->linkMap( $twice ) );
	}

	public function testPackedRunsDescribeTheSameLinks(): void {
		$this->excerpt( 1, 3, 16, [ 'Travesía', 'Apertura' ] );
		$this->excerpt( 2, 12, 27, [ 'Espacio' ] );
		$this->excerpt( 2, 44, 52, [ 'Diseño' ], 11 );
		$builder = $this->constel()->getGraphBuilder();
		$packed = $builder->buildPacked( null, null, null );
		$this->assertSame(
			array_column( $packed['nodes'], 'id' ),
			array_column( $builder->build( null, null, null )['nodes'], 'id' )
		);
		$this->assertSame( GraphBuilder::KINDS, array_keys( $packed['runs'] ) );

		$ids = array_column( $packed['nodes'], 'id' );
		$decoded = [];
		foreach ( $packed['runs'] as $kind => $text ) {
			$run = $text === '' ? [] : array_map( 'intval', explode( ',', $text ) );
			for ( $p = 0; $p < count( $run ); $p += 2 + 2 * $n ) {
				$n = $run[$p + 1];
				for ( $q = $p + 2; $q < $p + 2 + 2 * $n; $q += 2 ) {
					$this->assertGreaterThan( $run[$p], $run[$q], 'i < j' );
					$decoded[] = [ $ids[$run[$p]], $ids[$run[$q]], $kind, $run[$q + 1] ];
				}
			}
		}
		$expanded = array_map(
			static fn ( $l ) => [ $l['source'], $l['target'], $l['kind'], $l['weight'] ],
			$builder->build( null, null, null )['links']
		);
		$this->assertEqualsCanonicalizing( $expanded, $decoded );
		$this->assertNotEmpty( $decoded );
	}

	public function testMineIsComputedApartFromTheCachedGraph(): void {
		$this->excerpt( 1, 3, 11, [ 'Travesía' ], 10 );
		$this->excerpt( 2, 44, 52, [ 'Diseño' ], 11 );
		$builder = $this->constel()->getGraphBuilder();
		$mine = static fn ( array $g ) => array_column( $g['nodes'], 'mine', 'label' );

		$this->assertSame( [ 'Travesía' => false, 'Diseño' => false ], $mine( $builder->build( null, null, null ) ) );
		$this->assertSame( [ 'Travesía' => true, 'Diseño' => false ], $mine( $builder->build( null, null, 1 ) ) );
		$this->assertSame( [ 'Travesía' => false, 'Diseño' => true ], $mine( $builder->build( null, null, 2 ) ) );
		$this->assertSame( [ 'Travesía' => true ], $mine( $builder->build( [ 1 ], null, 1 ) ) );
		$this->assertSame( [ 'Travesía' => false ], $mine( $builder->build( [ 1 ], null, 2 ) ),
			'quien mira no está entre los lectores filtrados' );
		$this->assertSame( [ 'Diseño' => false ], $mine( $builder->build( null, [ 11 ], 1 ) ),
			'sólo cuentan sus §§ dentro de las páginas filtradas' );
	}

	public function testConceptCountsMatchTheGraphNodes(): void {
		$this->excerpt( 1, 3, 11, [ 'Travesía', 'Acto' ], 10 );
		$this->excerpt( 2, 3, 11, [ 'Travesía' ], 11 );
		$this->excerpt( 2, 44, 52, [ 'Diseño' ], 11 );
		$frozen = $this->excerpt( 2, 44, 52, [ 'Oculto' ], 12 );
		$this->constel()->getExcerptStore()->freezeForPage( 12 );

		$counts = $this->constel()->getGraphBuilder()->conceptCounts();
		$this->assertSame( [ 'Travesía', 'Acto', 'Diseño' ], array_column( $counts, 'label' ),
			'más usados primero, luego por rótulo; lo congelado no cuenta' );
		$nodes = array_column( $this->constel()->getGraphBuilder()->build( null, null, null )['nodes'], null, 'id' );
		foreach ( $counts as $row ) {
			$this->assertSame( $nodes[$row['id']]['excerpts'], $row['excerpts'] );
			$this->assertSame( $nodes[$row['id']]['pages'], $row['pages'] );
		}
		$this->assertNotNull( $frozen );
	}

	public function testOverlapCapKeepsTheOldestExcerptsOfAPage(): void {
		$first = $this->excerpt( 1, 3, 16, [ 'Travesía' ] );
		$this->excerpt( 2, 12, 27, [ 'Espacio' ] );
		$this->excerpt( 3, 5, 20, [ 'Acto' ] );
		$services = $this->getServiceContainer();
		$capped = new GraphBuilder(
			$services->getConnectionProvider(),
			$services->getMainWANObjectCache(),
			new GraphVersion( $services->getMainWANObjectCache() ),
			2
		);
		$this->assertSame(
			[ 'overlap:Espacio|Travesía' => 1 ],
			$this->linkKind( $capped->build( null, null, null ), 'overlap' ),
			'con tope 2, sólo los dos §§ más antiguos de la página se comparan'
		);
		$uncapped = $this->constel()->getGraphBuilder()->build( null, null, null );
		$this->assertCount( 3, $this->linkKind( $uncapped, 'overlap' ) );
		$this->assertNotNull( $first );
	}

	public function testSeveralReadersGetTheirContributionPerConcept(): void {
		$this->excerpt( 1, 3, 11, [ 'Travesía' ], 10 );
		$this->excerpt( 1, 44, 52, [ 'Diseño' ], 10 );
		$this->excerpt( 2, 3, 11, [ 'Travesía' ], 11 );
		$this->excerpt( 3, 44, 52, [ 'Diseño' ], 11 );
		$builder = $this->constel()->getGraphBuilder();
		$by = static fn ( array $g ) => array_column( $g['nodes'], 'by', 'label' );

		$two = $by( $builder->build( [ 1, 2 ], null, null ) );
		$this->assertSame( [ 1 => 1, 2 => 1 ], $two['Travesía'], 'la comparten' );
		$this->assertSame( [ 1 => 1 ], $two['Diseño'], 'sólo la del lector 1 entra en el filtro' );

		$one = $builder->build( [ 1 ], null, null )['nodes'][0];
		$this->assertArrayNotHasKey( 'by', $one, 'un lector: sin desglose' );
		$this->assertArrayNotHasKey( 'by', $builder->build( null, null, null )['nodes'][0], 'todos: sin desglose' );
	}
}
