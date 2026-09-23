<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Api;

use MediaWiki\MainConfigNames;
use MediaWiki\Tests\Api\ApiTestCase;
use MediaWiki\Title\Title;
use MediaWiki\User\User;

/**
 * Los lectores se muestran por su nombre real, con el de usuario como
 * respaldo (spec: ReaderAndPageFilters).
 *
 * @group Database
 * @group API
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiQueryConstelReaders
 * @covers \MediaWiki\Extension\CasiopeaConstel\Readers\ReaderDirectory
 */
class ApiConstelReadersTest extends ApiTestCase {

	private User $named;
	private User $plain;

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( MainConfigNames::LanguageCode, 'es' );
		$this->overrideConfigValue( MainConfigNames::HiddenPrefs, [] );

		$page = Title::makeTitle( NS_MAIN, 'ConstelReadersTest' );
		$revId = $this->editPage( $page, 'La travesía abre el espacio.' )->getNewRevision()->getId();

		$this->named = $this->getMutableTestUser()->getUser();
		$this->named->setRealName( 'Ñandú Pérez' );
		$this->named->saveSettings();
		$this->plain = $this->getMutableTestUser()->getUser();
		$this->plain->setRealName( '' );
		$this->plain->saveSettings();

		foreach ( [ $this->named, $this->plain ] as $user ) {
			$this->doApiRequestWithToken( [
				'action' => 'constel-createexcerpt',
				'title' => $page->getPrefixedText(),
				'revid' => $revId,
				'exact' => 'travesía',
				'prefix' => 'La ',
				'suffix' => ' abre',
				'start' => 3,
				'concept' => 'travesía',
			], null, $user );
		}
	}

	private function query( array $params ): array {
		$result = $this->doApiRequest( $params + [ 'action' => 'query', 'list' => 'constelreaders' ] );
		return $result[0]['query']['constelreaders'];
	}

	public function testSearchMatchesRealNameIgnoringAccents(): void {
		$found = $this->query( [ 'crsearch' => 'perez' ] );
		$this->assertSame(
			[ [ 'name' => $this->named->getName(), 'display' => 'Ñandú Pérez' ] ],
			$found
		);
	}

	public function testSearchMatchesUserName(): void {
		$names = array_column( $this->query( [ 'crsearch' => $this->plain->getName() ] ), 'name' );
		$this->assertContains( $this->plain->getName(), $names );
	}

	public function testDescribeFallsBackToUserName(): void {
		$found = $this->query( [ 'crnames' => $this->named->getName() . '|' . $this->plain->getName() ] );
		$this->assertSame( [
			[ 'name' => $this->named->getName(), 'display' => 'Ñandú Pérez' ],
			[ 'name' => $this->plain->getName(), 'display' => $this->plain->getName() ],
		], $found );
	}

	public function testHiddenRealNameIsNotShown(): void {
		$this->overrideConfigValue( MainConfigNames::HiddenPrefs, [ 'realname' ] );
		$this->assertSame( [], $this->query( [ 'crsearch' => 'perez' ] ) );
		$found = $this->query( [ 'crnames' => $this->named->getName() ] );
		$this->assertSame( $this->named->getName(), $found[0]['display'] );
	}
}
