<?php

namespace MediaWiki\Extension\CasiopeaConstel\Moderation;

use ManualLogEntry;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptRecord;
use MediaWiki\Page\PageStore;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Title\Title;
use MediaWiki\User\ActorStore;
use MediaWiki\User\UserIdentity;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * Registro público de la moderación del vocabulario compartido
 * (Special:Log/constel): renombres y fusiones de conceptos, y borrado de §§
 * ajenos. Lo que cambia la lectura de otros queda a la vista.
 */
class ModerationLog {

	public const TYPE = 'constel';
	private const QUOTE_MAX = 200;

	public function __construct(
		private readonly PageStore $pageStore,
		private readonly ActorStore $actorStore,
		private readonly IConnectionProvider $dbProvider
	) {
	}

	public function rename( UserIdentity $performer, string $from, string $to ): void {
		$this->log( 'rename', $performer, SpecialPage::getTitleFor( 'Constellation' ), [
			'4::from' => $from,
			'5::to' => $to,
		] );
	}

	public function merge( UserIdentity $performer, string $absorbed, string $keep ): void {
		$this->log( 'merge', $performer, SpecialPage::getTitleFor( 'Constellation' ), [
			'4::absorbed' => $absorbed,
			'5::keep' => $keep,
		] );
	}

	/**
	 * Un moderador borró el § de otro lector.
	 */
	public function deleteExcerpt( UserIdentity $performer, ExcerptRecord $excerpt ): void {
		$page = $this->pageStore->getPageById( $excerpt->pageId );
		$author = $this->actorStore->getActorById( $excerpt->actorId, $this->dbProvider->getReplicaDatabase() );
		$quote = mb_strlen( $excerpt->anchor->exact ) > self::QUOTE_MAX
			? mb_substr( $excerpt->anchor->exact, 0, self::QUOTE_MAX - 1 ) . '…'
			: $excerpt->anchor->exact;
		$this->log( 'delete', $performer,
			$page ? Title::newFromPageIdentity( $page ) : SpecialPage::getTitleFor( 'Constellation' ),
			[
				'4::author' => $author ? $author->getName() : '',
				'5::quote' => $quote,
			]
		);
	}

	private function log( string $action, UserIdentity $performer, Title $target, array $params ): void {
		$entry = new ManualLogEntry( self::TYPE, $action );
		$entry->setPerformer( $performer );
		$entry->setTarget( $target );
		$entry->setParameters( $params );
		$entry->publish( $entry->insert() );
	}
}
