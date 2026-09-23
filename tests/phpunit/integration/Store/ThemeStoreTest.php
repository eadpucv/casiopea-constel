<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Store;

use MediaWikiIntegrationTestCase;

/**
 * @group Database
 * @covers \MediaWiki\Extension\CasiopeaConstel\Store\ThemeStore
 */
class ThemeStoreTest extends MediaWikiIntegrationTestCase {
	use StoreTestTrait;

	public function testGroupingMovesConceptBetweenThemesOfTheSameReader(): void {
		$themes = $this->constel()->getThemeStore();
		$a = $themes->create( 1, 'Lugar' );
		$b = $themes->create( 1, 'Otro' );
		$themes->group( 1, 7, $a->id );
		$themes->group( 1, 7, $b->id );
		$this->assertSame( $b->id, $themes->themeOf( 1, 7 ) );
		$this->assertSame( [], $themes->conceptIds( $a->id ) );
	}

	public function testReadersGroupTheSameConceptIndependently(): void {
		$themes = $this->constel()->getThemeStore();
		$mine = $themes->create( 1, 'Lugar' );
		$theirs = $themes->create( 2, 'Viaje' );
		$themes->group( 1, 7, $mine->id );
		$themes->group( 2, 7, $theirs->id );
		$this->assertSame( $mine->id, $themes->themeOf( 1, 7 ) );
		$this->assertSame( $theirs->id, $themes->themeOf( 2, 7 ) );
	}

	public function testDevelopmentIsOnePerTheme(): void {
		$themes = $this->constel()->getThemeStore();
		$t = $themes->create( 1, 'Lugar' );
		$this->assertNull( $themes->getDevelopment( $t->id ) );

		$first = $themes->setDevelopment( $t->id, 'primera' );
		$second = $themes->setDevelopment( $t->id, 'segunda' );

		$this->assertSame( $first->id, $second->id );
		$this->assertSame( 'segunda', $themes->getDevelopment( $t->id )->text );
		$this->assertNull( $themes->setDevelopment( $t->id, '  ' ) );
		$this->assertNull( $themes->getDevelopment( $t->id ) );
	}

	public function testDeletingThemeUngroupsAndDeletesDevelopment(): void {
		$themes = $this->constel()->getThemeStore();
		$t = $themes->create( 1, 'Lugar' );
		$themes->group( 1, 7, $t->id );
		$themes->setDevelopment( $t->id, 'síntesis' );

		$themes->delete( $t->id );

		$this->assertNull( $themes->get( $t->id ) );
		$this->assertNull( $themes->themeOf( 1, 7 ) );
		$this->assertNull( $themes->getDevelopment( $t->id ) );
	}
}
