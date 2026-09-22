<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Store;

use MediaWikiIntegrationTestCase;

/**
 * @group Database
 * @covers \MediaWiki\Extension\CasiopeaConstel\Store\ExcerptStore
 */
class ExcerptStoreTest extends MediaWikiIntegrationTestCase {
	use StoreTestTrait;

	public function testCreateCodesWithFirstConcept(): void {
		$constel = $this->constel();
		$e = $constel->getExcerptStore()->create( 1, 10, 100, $this->anchor( 'travesía' ), 'travesía' );
		$ids = $constel->getExcerptStore()->conceptIds( $e->id );
		$this->assertCount( 1, $ids );
		$this->assertSame( 'Travesía', $constel->getConceptStore()->getById( $ids[0] )->label );
		$this->assertTrue( $e->isAnchored() );
	}

	public function testCodeRejectsDuplicates(): void {
		$store = $this->constel()->getExcerptStore();
		$e = $store->create( 1, 10, 100, $this->anchor( 'travesía' ), 'Travesía' );
		$this->assertNull( $store->code( $e->id, 'travesía' ) );
		$this->assertSame( 'Acto', $store->code( $e->id, 'acto' )->label );
		$this->assertCount( 2, $store->conceptIds( $e->id ) );
	}

	public function testUncodingTheLastConceptRemovesExcerptAndUnusedConcept(): void {
		$constel = $this->constel();
		$store = $constel->getExcerptStore();
		$e = $store->create( 1, 10, 100, $this->anchor( 'travesía' ), 'Travesía' );
		$conceptId = $store->conceptIds( $e->id )[0];
		$theme = $constel->getThemeStore()->create( 1, 'Lugar' );
		$constel->getThemeStore()->group( 1, $conceptId, $theme->id );

		$store->uncode( $e->id, $conceptId );

		$this->assertNull( $store->get( $e->id, true ) );
		$this->assertNull( $constel->getConceptStore()->getById( $conceptId ) );
		$this->assertNull( $constel->getThemeStore()->themeOf( 1, $conceptId ), 'la pertenencia se va con él' );
	}

	public function testConceptSurvivesWhileAnotherExcerptUsesIt(): void {
		$constel = $this->constel();
		$store = $constel->getExcerptStore();
		$a = $store->create( 1, 10, 100, $this->anchor( 'travesía' ), 'Travesía' );
		$store->create( 2, 10, 100, $this->anchor( 'travesía', 1 ), 'Travesía' );
		$store->delete( $a->id );
		$this->assertNotNull( $constel->getConceptStore()->getByLabel( 'Travesía' ) );
	}

	public function testLostIsTerminal(): void {
		$store = $this->constel()->getExcerptStore();
		$e = $store->create( 1, 10, 100, $this->anchor( 'travesía' ), 'Travesía' );
		$store->markLost( [ $e->id ] );
		$store->relocate( $e->id, 101, $this->anchor( 'travesía', 1 ) );

		$after = $store->get( $e->id, true );
		$this->assertFalse( $after->isAnchored() );
		$this->assertNotNull( $after->lost );
		$this->assertSame( 100, $after->revId, 'relocate no revive un § perdido' );
		$this->assertSame( [], $store->listAnchoredForPage( 10, true ) );
		$this->assertCount( 1, $store->listForActor( 1 ) );
	}

	public function testRelocateMovesAnchor(): void {
		$store = $this->constel()->getExcerptStore();
		$e = $store->create( 1, 10, 100, $this->anchor( 'travesía' ), 'Travesía' );
		$store->relocate( $e->id, 101, $this->anchor( 'travesía', 1 ) );
		$after = $store->get( $e->id, true );
		$this->assertSame( 101, $after->revId );
		$this->assertSame( mb_strrpos( self::TEXT, 'travesía' ), $after->anchor->start );
	}
}
