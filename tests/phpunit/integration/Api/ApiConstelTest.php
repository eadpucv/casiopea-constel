<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Api;

use MediaWiki\Api\ApiUsageException;
use MediaWiki\Block\DatabaseBlock;
use MediaWiki\Block\Restriction\PageRestriction;
use MediaWiki\MainConfigNames;
use MediaWiki\Tests\Api\ApiTestCase;
use MediaWiki\Title\Title;
use MediaWiki\User\User;
use Wikimedia\Rdbms\IDBAccessObject;

/**
 * La API es la autoridad (spec: WritesAreTokenProtected): estos tests fijan
 * quién puede hacer qué, contra la BBDD de prueba.
 *
 * @group Database
 * @group API
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiConstelWriteBase
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiExcerptWriteBase
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiThemeWriteBase
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiCreateExcerpt
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiCodeExcerpt
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiGlossExcerpt
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiUncodeExcerpt
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiDeleteExcerpt
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiTheme
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiGroupConcept
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiThemeNote
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiQueryConstelExcerpts
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiQueryConstelConcepts
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiQueryConstelThemes
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\AuthorFormatter
 * @covers \MediaWiki\Extension\CasiopeaConstel\Page\RenderedTextProvider
 */
class ApiConstelTest extends ApiTestCase {

	private const TEXT = 'La travesía abre el espacio. El diseño de la travesía es un acto.';

	private Title $page;
	private int $revId;

	protected function setUp(): void {
		parent::setUp();
		// El entorno de tests fuerza 'en'; SemanticMediaWiki (presente en
		// Casiopea) aborta si el idioma cambia respecto de enableSemantics().
		$this->overrideConfigValue( MainConfigNames::LanguageCode, 'es' );
		$this->page = Title::makeTitle( NS_MAIN, 'ConstelApiTest' );
		$status = $this->editPage( $this->page, self::TEXT );
		$this->revId = $status->getNewRevision()->getId();
	}

	private function create( User $user, array $overrides = [] ): array {
		$result = $this->doApiRequestWithToken( $overrides + [
			'action' => 'constel-createexcerpt',
			'title' => $this->page->getPrefixedText(),
			'revid' => $this->revId,
			'exact' => 'travesía',
			'prefix' => 'La ',
			'suffix' => ' abre',
			'start' => 3,
			'concept' => 'travesía',
		], null, $user );
		return $result[0]['constel-createexcerpt'];
	}

	private function write( User $user, array $params ): array {
		return $this->doApiRequestWithToken( $params, null, $user )[0][$params['action']];
	}

	/**
	 * El lector principal es siempre el mismo; cualquier otro nombre da un
	 * lector distinto (getTestUser devuelve el mismo usuario por grupos).
	 */
	private function reader( string $who = 'reader' ): User {
		return $who === 'reader'
			? $this->getTestUser()->getUser()
			: $this->getMutableTestUser()->getUser();
	}

	public function testCreateMeasuresOnServerAndCanonicalisesConcept(): void {
		$out = $this->create( $this->reader(), [ 'start' => 999 ] );
		$this->assertSame( 3, $out['start'], 'la posición la fija el servidor' );
		$this->assertSame( 11, $out['end'] );
		$this->assertSame( 'Travesía', $out['concept']['label'] );
	}

	public function testSamePassageTwiceAddsToTheSameExcerpt(): void {
		$user = $this->reader();
		$first = $this->create( $user, [ 'gloss' => 'primera' ] );
		$again = $this->create( $user, [ 'concept' => 'Acto', 'gloss' => 'segunda' ] );
		$this->assertSame( $first['excerpt'], $again['excerpt'], 'no nace un § duplicado' );
		$this->assertFalse( $first['merged'] );
		$this->assertTrue( $again['merged'] );

		$list = $this->doApiRequest( [
			'action' => 'query', 'list' => 'constelexcerpts', 'cepageid' => $this->page->getArticleID(),
		] )[0]['query']['constelexcerpts'];
		$this->assertCount( 1, $list );
		$this->assertSame( [ 'Acto', 'Travesía' ], $this->sortedLabels( $list[0] ) );
		$this->assertSame( 'primera', $list[0]['gloss'], 'la glosa previa no se pisa' );

		$other = $this->create( $this->reader( 'other' ) );
		$this->assertNotSame( $first['excerpt'], $other['excerpt'], 'otro lector tiene su propio §' );
	}

	private function sortedLabels( array $excerpt ): array {
		$labels = array_column( $excerpt['concepts'], 'label' );
		sort( $labels );
		return $labels;
	}

	public function testAnonymousCannotAnnotate(): void {
		$this->expectApiErrorCode( 'notnamed' );
		$this->create( $this->getServiceContainer()->getUserFactory()->newAnonymous() );
	}

	public function testStaleViewIsRejected(): void {
		$old = $this->revId;
		$this->editPage( $this->page, self::TEXT . ' Más.' );
		$this->expectApiErrorCode( 'staleview' );
		$this->create( $this->reader(), [ 'revid' => $old ] );
	}

	public function testPassageMustExistInPage(): void {
		$this->expectApiErrorCode( 'anchornotfound' );
		$this->create( $this->reader(), [ 'exact' => 'no está', 'prefix' => '', 'suffix' => '' ] );
	}

	public function testVariantNeedsConfirmation(): void {
		$this->create( $this->reader(), [ 'concept' => 'Travesía' ] );
		try {
			$this->create( $this->reader( 'other' ), [ 'concept' => 'travesia' ] );
			$this->fail( 'Se esperaba el error de variantes' );
		} catch ( ApiUsageException $e ) {
			$this->assertApiErrorCode( 'variants', $e );
		}
		$out = $this->create( $this->reader( 'other' ), [ 'concept' => 'travesia', 'allowvariant' => true ] );
		$this->assertSame( 'Travesia', $out['concept']['label'], 'identidad estricta: se crea la variante' );
	}

	public function testEnyeIsNotAVariant(): void {
		$this->create( $this->reader(), [ 'concept' => 'Año' ] );
		$out = $this->create( $this->reader( 'other' ), [ 'concept' => 'ano' ] );
		$this->assertSame( 'Ano', $out['concept']['label'], 'la ñ es una letra: no pide confirmación' );
	}

	public function testOnlyTheAuthorCodesAnExcerpt(): void {
		$excerpt = $this->create( $this->reader() )['excerpt'];
		$this->expectApiErrorCode( 'notyours' );
		$this->write( $this->reader( 'other' ), [
			'action' => 'constel-codeexcerpt', 'excerpt' => $excerpt, 'concept' => 'Acto',
		] );
	}

	public function testCodeAndUncodeUntilTheExcerptVanishes(): void {
		$user = $this->reader();
		$created = $this->create( $user );
		$coded = $this->write( $user, [
			'action' => 'constel-codeexcerpt', 'excerpt' => $created['excerpt'], 'concept' => 'Acto',
		] );
		$this->assertSame( 'Acto', $coded['concept']['label'] );

		$first = $this->write( $user, [
			'action' => 'constel-uncodeexcerpt', 'excerpt' => $created['excerpt'],
			'concept' => $created['concept']['id'],
		] );
		$this->assertFalse( $first['excerptremoved'] );
		$last = $this->write( $user, [
			'action' => 'constel-uncodeexcerpt', 'excerpt' => $created['excerpt'],
			'concept' => $coded['concept']['id'],
		] );
		$this->assertTrue( $last['excerptremoved'] );
	}

	public function testModeratorCanDeleteOthersExcerpts(): void {
		$excerpt = $this->create( $this->reader() )['excerpt'];
		$out = $this->write( $this->getTestSysop()->getUser(), [
			'action' => 'constel-deleteexcerpt', 'excerpt' => $excerpt,
		] );
		$this->assertSame( $excerpt, $out['excerpt'] );
	}

	public function testReaderCannotDeleteOthersExcerpts(): void {
		$excerpt = $this->create( $this->reader() )['excerpt'];
		$this->expectApiErrorCode( 'notyours' );
		$this->write( $this->reader( 'other' ), [ 'action' => 'constel-deleteexcerpt', 'excerpt' => $excerpt ] );
	}

	public function testSitewideBlockStopsAnnotation(): void {
		$user = $this->reader();
		$this->getServiceContainer()->getDatabaseBlockStore()->insertBlock( new DatabaseBlock( [
			'address' => $user,
			'by' => $this->getTestSysop()->getUser(),
			'expiry' => 'infinity',
		] ) );
		$this->expectApiErrorCode( 'blocked' );
		$this->write( $user, [ 'action' => 'constel-theme', 'op' => 'create', 'label' => 'Lugar' ] );
	}

	private function blockOnThePage( User $user ): void {
		$block = new DatabaseBlock( [
			'address' => $user,
			'by' => $this->getTestSysop()->getUser(),
			'sitewide' => false,
			'expiry' => 'infinity',
		] );
		$block->setRestrictions( [ new PageRestriction( 0, $this->page->getArticleID() ) ] );
		$this->getServiceContainer()->getDatabaseBlockStore()->insertBlock( $block );
	}

	public function testPartialBlockOnThePageStopsExcerpts(): void {
		$user = $this->reader();
		$this->blockOnThePage( $user );
		$this->expectApiErrorCode( 'blocked' );
		$this->create( $user );
	}

	public static function provideExcerptChanges(): array {
		return [
			'codificar' => [ [ 'action' => 'constel-codeexcerpt', 'concept' => 'Acto' ] ],
			'glosar' => [ [ 'action' => 'constel-glossexcerpt', 'gloss' => 'Eco' ] ],
			'borrar' => [ [ 'action' => 'constel-deleteexcerpt' ] ],
		];
	}

	/**
	 * @dataProvider provideExcerptChanges
	 */
	public function testPartialBlockOnThePageStopsChangesToExistingExcerpts( array $params ): void {
		$user = $this->reader();
		$excerpt = $this->create( $user )['excerpt'];
		$this->blockOnThePage( $user );
		$this->expectApiErrorCode( 'blocked' );
		$this->write( $user, $params + [ 'excerpt' => $excerpt ] );
	}

	public function testProtectedPageCanBeAnnotated(): void {
		$sysop = $this->getTestSysop()->getUser();
		$cascade = false;
		$this->getServiceContainer()->getWikiPageFactory()->newFromTitle( $this->page )->doUpdateRestrictions(
			[ 'edit' => 'sysop', 'move' => 'sysop' ], [ 'edit' => 'infinity', 'move' => 'infinity' ],
			$cascade, 'test', $sysop
		);
		// Proteger deja una revisión nula: la vista vigente es ésa.
		$this->revId = $this->page->getLatestRevID( IDBAccessObject::READ_LATEST );
		$user = $this->reader();
		$excerpt = $this->create( $user )['excerpt'];
		$out = $this->write( $user, [ 'action' => 'constel-codeexcerpt', 'excerpt' => $excerpt, 'concept' => 'Acto' ] );
		$this->assertSame( 'Acto', $out['concept']['label'], 'anotar no es editar: la protección no cuenta' );
	}

	private function deleteThePage(): void {
		$this->deletePage( $this->getServiceContainer()->getWikiPageFactory()->newFromTitle( $this->page ) );
	}

	/**
	 * @dataProvider provideExcerptChanges
	 */
	public function testFrozenExcerptCanOnlyBeDeleted( array $params ): void {
		$user = $this->reader();
		$excerpt = $this->create( $user )['excerpt'];
		$this->deleteThePage();
		if ( $params['action'] !== 'constel-deleteexcerpt' ) {
			$this->expectApiErrorCode( 'frozen' );
		}
		$out = $this->write( $user, $params + [ 'excerpt' => $excerpt ] );
		$this->assertSame( $excerpt, $out['excerpt'] );
		$this->assertNull( $this->getServiceContainer()->get( 'CasiopeaConstel.ExcerptStore' )->get( $excerpt, true ) );
	}

	public function testFrozenExcerptsAreSeenOnlyByTheirAuthorAndWhoCanSeeDeletedText(): void {
		$user = $this->reader();
		$created = $this->create( $user );
		$this->deleteThePage();
		$query = [
			'action' => 'query', 'list' => 'constelexcerpts', 'ceconcept' => $created['concept']['id'],
		];
		$seenBy = fn ( User $viewer ) => array_column(
			$this->doApiRequest( $query, null, false, $viewer )[0]['query']['constelexcerpts'], 'status', 'id'
		);

		$frozen = [ $created['excerpt'] => 'frozen' ];
		$this->assertSame( $frozen, $seenBy( $user ), 'su autor' );
		$this->assertSame( $frozen, $seenBy( $this->getTestSysop()->getUser() ), 'deletedtext' );
		$this->assertSame( [], $seenBy( $this->reader( 'other' ) ), 'otro lector' );
		$this->assertSame( [], $seenBy( $this->getServiceContainer()->getUserFactory()->newAnonymous() ), 'anónimo' );
	}

	public function testThemesAreOwnedByTheirReader(): void {
		$user = $this->reader();
		$concept = $this->create( $user )['concept']['id'];
		$theme = $this->write( $user, [ 'action' => 'constel-theme', 'op' => 'create', 'label' => 'Lugar' ] )['theme'];
		$grouped = $this->write( $user, [
			'action' => 'constel-groupconcept', 'op' => 'group', 'concept' => $concept, 'theme' => $theme,
		] );
		$this->assertSame( $theme, $grouped['theme'] );
		$written = $this->write( $user, [
			'action' => 'constel-themenote', 'theme' => $theme, 'text' => 'Síntesis',
		] );
		$this->assertSame( 'Síntesis', $written['development'] );
		$listed = $this->doApiRequest( [
			'action' => 'query', 'list' => 'constelthemes', 'ctids' => $theme,
		] )[0]['query']['constelthemes'][0];
		$this->assertSame( 'Síntesis', $listed['development'] );

		foreach ( [
			[ 'action' => 'constel-theme', 'op' => 'rename', 'theme' => $theme, 'label' => 'Otro' ],
			[ 'action' => 'constel-themenote', 'theme' => $theme, 'text' => 'Ajeno' ],
			[ 'action' => 'constel-groupconcept', 'op' => 'group', 'concept' => $concept, 'theme' => $theme ],
		] as $params ) {
			try {
				$this->write( $this->reader( 'other' ), $params );
				$this->fail( "Se esperaba notyours en {$params['action']}" );
			} catch ( ApiUsageException $e ) {
				$this->assertApiErrorCode( 'notyours', $e );
			}
		}
	}

	public function testReadModulesArePublic(): void {
		$user = $this->reader();
		$created = $this->create( $user );
		$this->write( $user, [ 'action' => 'constel-theme', 'op' => 'create', 'label' => 'Lugar' ] );
		$anon = $this->getServiceContainer()->getUserFactory()->newAnonymous();

		$excerpts = $this->doApiRequest( [
			'action' => 'query', 'list' => 'constelexcerpts', 'cepageid' => $this->page->getArticleID(),
		], null, false, $anon )[0]['query']['constelexcerpts'];
		$this->assertCount( 1, $excerpts );
		$this->assertSame( $created['excerpt'], $excerpts[0]['id'] );
		$this->assertSame( $user->getName(), $excerpts[0]['author'] );
		$this->assertSame( 'Travesía', $excerpts[0]['concepts'][0]['label'] );

		$concepts = $this->doApiRequest( [
			'action' => 'query', 'list' => 'constelconcepts', 'ccsearch' => 'TRAVESIA',
		], null, false, $anon )[0]['query']['constelconcepts'];
		$this->assertSame( 'Travesía', $concepts[0]['label'], 'búsqueda tolerante' );
		$this->assertSame( 1, $concepts[0]['uses'] );

		$themes = $this->doApiRequest( [
			'action' => 'query', 'list' => 'constelthemes', 'ctuser' => $user->getName(),
		], null, false, $anon )[0]['query']['constelthemes'];
		$this->assertSame( 'Lugar', $themes[0]['label'] );
	}

	public function testWritesNeedAToken(): void {
		$this->expectApiErrorCode( 'missingparam' );
		$this->doApiRequest( [
			'action' => 'constel-theme', 'op' => 'create', 'label' => 'Lugar',
		], null, false, $this->reader() );
	}

	public function testGlossIsCreatedEditedAndClearedByItsAuthorOnly(): void {
		$user = $this->reader();
		$excerpt = $this->create( $user, [ 'gloss' => '  Eco de la Eneida  ' ] )['excerpt'];
		$list = fn () => $this->doApiRequest( [
			'action' => 'query', 'list' => 'constelexcerpts', 'cepageid' => $this->page->getArticleID(),
		] )[0]['query']['constelexcerpts'][0]['gloss'];
		$this->assertSame( 'Eco de la Eneida', $list() );

		$this->write( $user, [ 'action' => 'constel-glossexcerpt', 'excerpt' => $excerpt, 'gloss' => 'Otra lectura' ] );
		$this->assertSame( 'Otra lectura', $list() );
		$this->write( $user, [ 'action' => 'constel-glossexcerpt', 'excerpt' => $excerpt, 'gloss' => '' ] );
		$this->assertNull( $list() );

		$this->expectApiErrorCode( 'notyours' );
		$this->write( $this->reader( 'other' ), [
			'action' => 'constel-glossexcerpt', 'excerpt' => $excerpt, 'gloss' => 'Ajena',
		] );
	}
}
