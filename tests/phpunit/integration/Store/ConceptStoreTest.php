<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Store;

use MediaWiki\Extension\CasiopeaConstel\Hooks\SchemaHooks;
use MediaWiki\Installer\DatabaseUpdater;
use MediaWikiIntegrationTestCase;

/**
 * @group Database
 * @covers \MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore
 */
class ConceptStoreTest extends MediaWikiIntegrationTestCase {
	use StoreTestTrait;

	public function testAcquireIsIdempotentOnCanonicalForm(): void {
		$store = $this->constel()->getConceptStore();
		$a = $store->acquire( 'diseño_de  la ciudad' );
		$b = $store->acquire( 'Diseño de la ciudad' );
		$this->assertSame( 'Diseño de la ciudad', $a->label );
		$this->assertSame( $a->id, $b->id );
	}

	public function testIdentityIsStrictButVariantsAreFound(): void {
		$store = $this->constel()->getConceptStore();
		$store->acquire( 'Travesía' );
		$this->assertNull( $store->getByLabel( 'Travesia' ) );
		$variants = $store->findVariants( 'travesia' );
		$this->assertSame( [ 'Travesía' ], array_map( static fn ( $c ) => $c->label, $variants ) );
		$this->assertSame( [], $store->findVariants( 'Travesía' ), 'la forma exacta no es su propia variante' );
	}

	public function testEnyeVariantsAreFound(): void {
		$store = $this->constel()->getConceptStore();
		$store->acquire( 'Diseño' );
		$variants = $store->findVariants( 'Diseno' );
		$this->assertSame( [ 'Diseño' ], array_map( static fn ( $c ) => $c->label, $variants ) );
		$found = $store->search( 'disen' );
		$this->assertSame( [ 'Diseño' ], array_map( static fn ( $s ) => $s['concept']->label, $found ) );
	}

	/**
	 * @covers \MediaWiki\Extension\CasiopeaConstel\Hooks\SchemaHooks::refoldConcepts
	 */
	public function testUpdateRefoldsStoredKeys(): void {
		$store = $this->constel()->getConceptStore();
		$concept = $store->acquire( 'Diseño' );
		// La clave que guardaba la regla anterior (que conservaba la ñ).
		$this->getDb()->newUpdateQueryBuilder()
			->update( 'constel_concept' )->set( [ 'cc_fold' => 'diseño' ] )
			->where( [ 'cc_id' => $concept->id ] )->caller( __METHOD__ )->execute();
		$this->assertSame( [], $store->findVariants( 'Diseno' ) );

		$updater = $this->createMock( DatabaseUpdater::class );
		$updater->method( 'getDB' )->willReturn( $this->getDb() );
		SchemaHooks::refoldConcepts( $updater );
		$this->assertCount( 1, $store->findVariants( 'Diseno' ) );
	}

	public function testRenameRefusesATakenForm(): void {
		$store = $this->constel()->getConceptStore();
		$a = $store->acquire( 'Diseno' );
		$store->acquire( 'Diseño' );
		$this->assertFalse( $store->rename( $a->id, 'Diseño' ), 'eso es una fusión' );
		$this->assertTrue( $store->rename( $a->id, 'Diseño gráfico' ) );
		$this->assertSame( 'Diseño gráfico', $store->getById( $a->id )->label );
	}

	public function testMergeMovesCodingsAndKeepsPriorMembership(): void {
		$constel = $this->constel();
		$excerpts = $constel->getExcerptStore();
		$themes = $constel->getThemeStore();
		$concepts = $constel->getConceptStore();

		$e1 = $excerpts->create( 1, 10, 100, $this->anchor( 'travesía' ), 'Travesía' );
		$excerpts->code( $e1->id, 'Travesia' );
		$e2 = $excerpts->create( 2, 10, 100, $this->anchor( 'travesía', 1 ), 'Travesia' );
		$keep = $concepts->getByLabel( 'Travesía' );
		$absorbed = $concepts->getByLabel( 'Travesia' );

		$mine = $themes->create( 1, 'Lugar' );
		$other = $themes->create( 1, 'Otro' );
		$themes->group( 1, $keep->id, $mine->id );
		$themes->group( 1, $absorbed->id, $other->id );

		$concepts->merge( $keep->id, $absorbed->id );

		$this->assertNull( $concepts->getByLabel( 'Travesia' ) );
		$this->assertSame( [ $keep->id ], $excerpts->conceptIds( $e1->id ), 'sin codificación duplicada' );
		$this->assertSame( [ $keep->id ], $excerpts->conceptIds( $e2->id ), 'el § del otro lector se re-apunta' );
		$this->assertSame( $mine->id, $themes->themeOf( 1, $keep->id ), 'gana la pertenencia previa' );
	}
}
