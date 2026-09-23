<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Api;

use MediaWiki\Api\ApiUsageException;
use MediaWiki\Block\DatabaseBlock;
use MediaWiki\Block\Restriction\PageRestriction;
use MediaWiki\MainConfigNames;
use MediaWiki\Tests\Api\ApiTestCase;
use MediaWiki\Title\Title;
use MediaWiki\User\User;

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

	public function testPartialBlockOnThePageStopsExcerpts(): void {
		$user = $this->reader();
		$block = new DatabaseBlock( [
			'address' => $user,
			'by' => $this->getTestSysop()->getUser(),
			'sitewide' => false,
			'expiry' => 'infinity',
		] );
		$block->setRestrictions( [ new PageRestriction( 0, $this->page->getArticleID() ) ] );
		$this->getServiceContainer()->getDatabaseBlockStore()->insertBlock( $block );
		$this->expectApiErrorCode( 'blocked' );
		$this->create( $user );
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
