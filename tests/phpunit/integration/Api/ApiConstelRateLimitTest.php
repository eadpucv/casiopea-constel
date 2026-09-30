<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Api;

use MediaWiki\Api\ApiUsageException;
use MediaWiki\MainConfigNames;
use MediaWiki\Tests\Api\ApiTestCase;
use MediaWiki\Title\Title;

/**
 * El límite de frecuencia de las escrituras (spec: WritesAreRateLimited).
 *
 * @group Database
 * @group API
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiConstelWriteBase
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiTheme
 */
class ApiConstelRateLimitTest extends ApiTestCase {

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( MainConfigNames::LanguageCode, 'es' );
	}

	public function testThemeWritesAreRateLimitedButWithdrawingIsNot(): void {
		$this->overrideConfigValue( MainConfigNames::RateLimits, [
			'constel-annotate' => [ 'user' => [ 2, 60 ], 'newbie' => [ 2, 60 ] ],
		] );
		$user = $this->getMutableTestUser()->getUser();
		$made = [];
		for ( $i = 0; $i < 2; $i++ ) {
			$made[] = $this->doApiRequestWithToken(
				[ 'action' => 'constel-theme', 'op' => 'create', 'label' => "Tema $i" ], null, $user
			)[0]['constel-theme']['theme'];
		}
		try {
			$this->doApiRequestWithToken(
				[ 'action' => 'constel-theme', 'op' => 'create', 'label' => 'Tema 3' ], null, $user
			);
			$this->fail( 'Se esperaba ratelimited' );
		} catch ( ApiUsageException $e ) {
			$this->assertApiErrorCode( 'ratelimited', $e );
		}
		foreach ( $made as $id ) {
			$this->assertSame( $id, $this->doApiRequestWithToken(
				[ 'action' => 'constel-theme', 'op' => 'delete', 'theme' => $id ], null, $user
			)[0]['constel-theme']['theme'], 'retirarse nunca se limita' );
		}
	}

	public function testSysopsAreNotRateLimited(): void {
		$this->overrideConfigValue( MainConfigNames::RateLimits, [
			'constel-annotate' => [ 'user' => [ 1, 60 ], 'newbie' => [ 1, 60 ] ],
		] );
		$sysop = $this->getTestSysop()->getUser();
		for ( $i = 0; $i < 3; $i++ ) {
			$out = $this->doApiRequestWithToken(
				[ 'action' => 'constel-theme', 'op' => 'create', 'label' => "Tema $i" ], null, $sysop
			);
			$this->assertArrayHasKey( 'theme', $out[0]['constel-theme'] );
		}
	}

	public function testExcerptWritesCountToo(): void {
		$page = Title::makeTitle( NS_MAIN, 'ConstelRateLimitTest' );
		$revId = $this->editPage( $page, 'La travesía abre el espacio. El diseño de la travesía es un acto.' )
			->getNewRevision()->getId();
		$this->overrideConfigValue( MainConfigNames::RateLimits, [
			'constel-annotate' => [ 'user' => [ 3, 60 ], 'newbie' => [ 3, 60 ] ],
		] );
		$user = $this->getMutableTestUser()->getUser();
		$create = fn ( int $start, string $exact, string $concept ) => $this->doApiRequestWithToken( [
			'action' => 'constel-createexcerpt', 'title' => $page->getPrefixedText(), 'revid' => $revId,
			'exact' => $exact, 'prefix' => '', 'suffix' => '', 'start' => $start, 'concept' => $concept,
		], null, $user )[0]['constel-createexcerpt'];

		$first = $create( 3, 'travesía', 'Travesía' )['excerpt'];
		$this->doApiRequestWithToken(
			[ 'action' => 'constel-glossexcerpt', 'excerpt' => $first, 'gloss' => 'Una nota' ], null, $user
		);
		$create( 44, 'diseño', 'Diseño' );
		try {
			$create( 12, 'abre', 'Apertura' );
			$this->fail( 'Se esperaba ratelimited' );
		} catch ( ApiUsageException $e ) {
			$this->assertApiErrorCode( 'ratelimited', $e );
		}
		$this->assertSame( $first, $this->doApiRequestWithToken(
			[ 'action' => 'constel-deleteexcerpt', 'excerpt' => $first ], null, $user
		)[0]['constel-deleteexcerpt']['excerpt'], 'borrar lo propio no cuenta' );
	}
}
