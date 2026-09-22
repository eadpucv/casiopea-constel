<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Api;

use DatabaseLogEntry;
use MediaWiki\MainConfigNames;
use MediaWiki\Tests\Api\ApiTestCase;
use MediaWiki\Title\Title;
use MediaWiki\User\User;

/**
 * Moderación del vocabulario compartido y su registro público
 * (spec: ModeratorRenamesConcept, ModeratorMergesConcepts, ReaderDeletesExcerpt).
 *
 * @group Database
 * @group API
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiModerateConcept
 * @covers \MediaWiki\Extension\CasiopeaConstel\Api\ApiDeleteExcerpt
 * @covers \MediaWiki\Extension\CasiopeaConstel\Moderation\ModerationLog
 */
class ApiModerationTest extends ApiTestCase {

	private const TEXT = 'La travesía abre el espacio. El diseño de la travesía es un acto.';

	private Title $page;
	private int $revId;

	protected function setUp(): void {
		parent::setUp();
		// SemanticMediaWiki aborta si el idioma de tests difiere del de la wiki.
		$this->overrideConfigValue( MainConfigNames::LanguageCode, 'es' );
		$this->page = Title::makeTitle( NS_MAIN, 'ConstelModerationTest' );
		$this->revId = $this->editPage( $this->page, self::TEXT )->getNewRevision()->getId();
	}

	private function excerpt( User $user, string $concept, bool $allowVariant = false ): array {
		return $this->doApiRequestWithToken( [
			'action' => 'constel-createexcerpt',
			'title' => $this->page->getPrefixedText(),
			'revid' => $this->revId,
			'exact' => 'travesía',
			'prefix' => 'La ',
			'suffix' => ' abre',
			'start' => 3,
			'concept' => $concept,
			'allowvariant' => $allowVariant,
		], null, $user )[0]['constel-createexcerpt'];
	}

	private function moderate( User $user, array $params ): array {
		return $this->doApiRequestWithToken(
			[ 'action' => 'constel-moderate' ] + $params, null, $user
		)[0]['constel-moderate'];
	}

	/**
	 * @return string[] "acción:parámetros" de Special:Log/constel
	 */
	private function logEntries(): array {
		$rows = $this->getDb()->newSelectQueryBuilder()
			->select( [ 'log_action', 'log_params' ] )
			->from( 'logging' )
			->where( [ 'log_type' => 'constel' ] )
			->orderBy( 'log_id' )
			->caller( __METHOD__ )->fetchResultSet();
		$out = [];
		foreach ( $rows as $row ) {
			$params = unserialize( $row->log_params );
			$out[] = $row->log_action . ':' . implode( '|', $params );
		}
		return $out;
	}

	public function testReadersCannotModerate(): void {
		$concept = $this->excerpt( $this->getTestUser()->getUser(), 'Travesia' )['concept']['id'];
		$this->expectApiErrorCode( 'permissiondenied' );
		$this->moderate( $this->getTestUser()->getUser(),
			[ 'op' => 'rename', 'concept' => $concept, 'label' => 'Travesía' ] );
	}

	public function testRenameIsLogged(): void {
		$concept = $this->excerpt( $this->getTestUser()->getUser(), 'Travesia' )['concept']['id'];
		$out = $this->moderate( $this->getTestSysop()->getUser(),
			[ 'op' => 'rename', 'concept' => $concept, 'label' => 'travesía' ] );
		$this->assertSame( 'Travesía', $out['label'] );
		$this->assertSame( [ 'rename:Travesia|Travesía' ], $this->logEntries() );

		// Cómo se lee en Special:Log (mensaje logentry-constel-rename).
		$id = (int)$this->getDb()->newSelectQueryBuilder()->select( 'MAX(log_id)' )->from( 'logging' )
			->caller( __METHOD__ )->fetchField();
		$text = $this->getServiceContainer()->getLogFormatterFactory()
			->newFromEntry( DatabaseLogEntry::newFromId( $id, $this->getDb() ) )
			->getPlainActionText();
		$this->assertStringContainsString( '«Travesia» a «Travesía»', $text );
	}

	public function testRenameToATakenLabelMustBeAMerge(): void {
		$reader = $this->getTestUser()->getUser();
		$variant = $this->excerpt( $reader, 'Travesia' )['concept']['id'];
		$this->excerpt( $this->getMutableTestUser()->getUser(), 'Travesía', true );
		$this->expectApiErrorCode( 'labeltaken' );
		$this->moderate( $this->getTestSysop()->getUser(),
			[ 'op' => 'rename', 'concept' => $variant, 'label' => 'Travesía' ] );
	}

	public function testMergeMovesPassagesAndIsLogged(): void {
		$variant = $this->excerpt( $this->getTestUser()->getUser(), 'Travesia' );
		$kept = $this->excerpt( $this->getMutableTestUser()->getUser(), 'Travesía', true );

		$out = $this->moderate( $this->getTestSysop()->getUser(), [
			'op' => 'merge', 'concept' => $variant['concept']['id'], 'into' => $kept['concept']['id'],
		] );
		$this->assertSame( 'Travesía', $out['label'] );

		$excerpts = $this->doApiRequest( [
			'action' => 'query', 'list' => 'constelexcerpts', 'ceconcept' => $kept['concept']['id'],
		] )[0]['query']['constelexcerpts'];
		$this->assertCount( 2, $excerpts, 'el § de la variante ahora es de Travesía' );
		$this->assertSame( [ 'merge:Travesia|Travesía' ], $this->logEntries() );
	}

	public function testCannotMergeIntoItself(): void {
		$concept = $this->excerpt( $this->getTestUser()->getUser(), 'Travesía' )['concept']['id'];
		$this->expectApiErrorCode( 'mergeself' );
		$this->moderate( $this->getTestSysop()->getUser(),
			[ 'op' => 'merge', 'concept' => $concept, 'into' => $concept ] );
	}

	public function testOnlyDeletingOthersPassagesIsLogged(): void {
		$reader = $this->getTestUser()->getUser();
		$sysop = $this->getTestSysop()->getUser();
		$others = $this->excerpt( $reader, 'Travesía' )['excerpt'];
		$own = $this->excerpt( $sysop, 'Acto' )['excerpt'];

		foreach ( [ $own, $others ] as $excerpt ) {
			$this->doApiRequestWithToken(
				[ 'action' => 'constel-deleteexcerpt', 'excerpt' => $excerpt ], null, $sysop
			);
		}
		$this->assertSame( [ 'delete:' . $reader->getName() . '|travesía' ], $this->logEntries() );
	}
}
