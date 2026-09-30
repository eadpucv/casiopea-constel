<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Api;

use MediaWiki\Block\DatabaseBlock;
use MediaWiki\MainConfigNames;
use MediaWiki\Tests\Api\ApiTestCase;
use MediaWiki\Title\Title;

/**
 * Los autores y los lectores se cargan en lote (spec: ReadingIsPublicData,
 * ReaderAndPageFilters): las consultas por autor no crecen con el número de
 * autores, y el nombre de un usuario oculto sigue sin mostrarse.
 *
 * @group Database
 * @group API
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\AuthorFormatter
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiQueryConstelExcerpts
 * @covers \MediaWiki\Extension\CasiopeaConstel\Readers\ReaderDirectory
 */
class ApiConstelAuthorsTest extends ApiTestCase {

	private int $pageId;
	private int $revId;
	private Title $page;

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( MainConfigNames::LanguageCode, 'es' );
		$this->overrideConfigValue( MainConfigNames::HiddenPrefs, [] );
		$this->page = Title::makeTitle( NS_MAIN, 'ConstelAuthorsTest' );
		$status = $this->editPage( $this->page, 'La travesía abre el espacio. El diseño de la travesía.' );
		$this->revId = $status->getNewRevision()->getId();
		$this->pageId = $this->page->getArticleID();
	}

	private function readers( int $count ): array {
		$users = [];
		for ( $i = 0; $i < $count; $i++ ) {
			$user = $this->getMutableTestUser()->getUser();
			$user->setRealName( "Lector Real $i" );
			$user->saveSettings();
			$this->doApiRequestWithToken( [
				'action' => 'constel-createexcerpt',
				'title' => $this->page->getPrefixedText(),
				'revid' => $this->revId,
				'exact' => 'travesía',
				'prefix' => 'La ',
				'suffix' => ' abre',
				'start' => 3,
				'concept' => 'travesía',
			], null, $user );
			$users[] = $user;
		}
		return $users;
	}

	/**
	 * Cuántos SELECT hace la lectura, con el contador de la sesión de MariaDB
	 * (en los tests todo pasa por la misma conexión).
	 */
	private function selects( array $request ): int {
		$db = $this->getDb();
		if ( $db->getType() !== 'mysql' ) {
			$this->markTestSkipped( 'Cuenta consultas con el contador de sesión de MySQL/MariaDB' );
		}
		$counter = static fn () => (int)$db->query(
			"SHOW SESSION STATUS LIKE 'Com_select'", __METHOD__
		)->fetchObject()->Value;
		// Como en una petición nueva: sin actores ni bloqueos ya en memoria
		// por haber creado los §§ en este mismo proceso.
		$this->resetServices();
		$before = $counter();
		$this->doApiRequest( $request );
		return $counter() - $before;
	}

	public function testAuthorQueriesDoNotGrowWithTheNumberOfAuthors(): void {
		$this->readers( 2 );
		$request = [ 'action' => 'query', 'list' => 'constelexcerpts', 'cepageid' => $this->pageId ];
		$few = $this->selects( $request );
		$this->readers( 8 );
		$many = $this->selects( $request );
		$this->assertLessThanOrEqual( $few + 2, $many,
			"con 10 autores hizo $many SELECT; con 2, $few" );
	}

	public function testAuthorsAreListedByName(): void {
		$users = $this->readers( 3 );
		$listed = $this->doApiRequest( [
			'action' => 'query', 'list' => 'constelexcerpts', 'cepageid' => $this->pageId,
		] )[0]['query']['constelexcerpts'];
		$this->assertEqualsCanonicalizing(
			array_map( static fn ( $u ) => $u->getName(), $users ),
			array_column( $listed, 'author' )
		);
		$this->assertSame( [ false ], array_values( array_unique( array_column( $listed, 'userhidden' ) ) ) );
	}

	public function testHiddenUsersAreMaskedForOthersAndShownToWhoCanSeeThem(): void {
		[ $visible, $hidden ] = $this->readers( 2 );
		$this->getServiceContainer()->getDatabaseBlockStore()->insertBlock( new DatabaseBlock( [
			'address' => $hidden,
			'by' => $this->getTestSysop()->getUser(),
			'expiry' => 'infinity',
			'hideName' => true,
		] ) );
		$this->resetServices();

		$excerpts = static fn ( array $rows ) => array_column( $rows, null, 'author' );
		$listed = $this->doApiRequest( [
			'action' => 'query', 'list' => 'constelexcerpts', 'cepageid' => $this->pageId,
		] )[0]['query']['constelexcerpts'];
		$this->assertCount( 2, $listed );
		$this->assertSame( [ null, $visible->getName() ], $this->sortedAuthors( $listed ) );
		$masked = array_values( array_filter( $listed, static fn ( $e ) => $e['author'] === null ) );
		$this->assertTrue( $masked[0]['userhidden'] );
		$this->assertArrayHasKey( $visible->getName(), $excerpts( $listed ) );

		$found = $this->doApiRequest(
			[ 'action' => 'query', 'list' => 'constelreaders', 'crsearch' => 'Lector' ]
		)[0]['query']['constelreaders'];
		$this->assertSame( [ $visible->getName() ], array_column( $found, 'name' ) );

		$suppressor = $this->getTestUser( [ 'suppress' ] )->getUser();
		$seen = $this->doApiRequest(
			[ 'action' => 'query', 'list' => 'constelexcerpts', 'cepageid' => $this->pageId ],
			null, false, $suppressor
		)[0]['query']['constelexcerpts'];
		$this->assertEqualsCanonicalizing(
			[ $visible->getName(), $hidden->getName() ], array_column( $seen, 'author' )
		);
		$seenReaders = $this->doApiRequest(
			[ 'action' => 'query', 'list' => 'constelreaders', 'crsearch' => 'Lector' ],
			null, false, $suppressor
		)[0]['query']['constelreaders'];
		$this->assertEqualsCanonicalizing(
			[ $visible->getName(), $hidden->getName() ], array_column( $seenReaders, 'name' )
		);
	}

	public function testGraphNamesEachReadersContributionAndHidesHiddenOnes(): void {
		[ $visible, $hidden ] = $this->readers( 2 );
		$request = [
			'action' => 'query', 'list' => 'constelgraph',
			'cgusers' => $visible->getName() . '|' . $hidden->getName(),
		];
		$nodes = $this->doApiRequest( $request )[0]['query']['constelgraph']['nodes'];
		$this->assertCount( 1, $nodes );
		$this->assertEqualsCanonicalizing(
			[ $visible->getName(), $hidden->getName() ], array_keys( $nodes[0]['readers'] )
		);
		$this->assertSame( [ 1, 1 ], array_values( $nodes[0]['readers'] ) );
		$this->assertSame( 2, $nodes[0]['excerpts'] );

		$this->getServiceContainer()->getDatabaseBlockStore()->insertBlock( new DatabaseBlock( [
			'address' => $hidden,
			'by' => $this->getTestSysop()->getUser(),
			'expiry' => 'infinity',
			'hideName' => true,
		] ) );
		$this->resetServices();
		$masked = $this->doApiRequest( $request )[0]['query']['constelgraph']['nodes'][0];
		$this->assertSame( [ $visible->getName() ], array_keys( $masked['readers'] ) );
		$this->assertSame( 2, $masked['excerpts'], 'el aporte oculto sigue en el total' );
		$this->assertArrayNotHasKey( 'by', $masked );

		$single = $this->doApiRequest( [
			'action' => 'query', 'list' => 'constelgraph', 'cgusers' => $visible->getName(),
		] )[0]['query']['constelgraph']['nodes'][0];
		$this->assertArrayNotHasKey( 'readers', $single, 'con un solo lector no hay desglose' );
	}

	private function sortedAuthors( array $rows ): array {
		$authors = array_column( $rows, 'author' );
		usort( $authors, static fn ( $a, $b ) => strcmp( (string)$a, (string)$b ) );
		return $authors;
	}
}
