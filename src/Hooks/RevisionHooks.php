<?php

namespace MediaWiki\Extension\CasiopeaConstel\Hooks;

use JobQueueGroup;
use JobSpecification;
use ManualLogEntry;
use MediaWiki\Extension\CasiopeaConstel\Jobs\ReanchorJob;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptStore;
use MediaWiki\Page\Hook\PageDeleteCompleteHook;
use MediaWiki\Page\Hook\PageUndeleteCompleteHook;
use MediaWiki\Page\PageReference;
use MediaWiki\Page\ProperPageIdentity;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Storage\Hook\PageSaveCompleteHook;

/**
 * Las páginas cambian; los §§ las siguen, se pierden o se congelan.
 */
class RevisionHooks implements PageSaveCompleteHook, PageDeleteCompleteHook, PageUndeleteCompleteHook {

	public function __construct(
		private readonly ExcerptStore $excerpts,
		private readonly JobQueueGroup $jobQueueGroup
	) {
	}

	/**
	 * Revisión nueva (edición, revert): re-anclar en diferido, nunca en la
	 * request del guardado.
	 *
	 * @inheritDoc
	 */
	public function onPageSaveComplete( $wikiPage, $user, $summary, $flags, $revisionRecord, $editResult ) {
		if ( $editResult->isNullEdit() || !$this->excerpts->hasReanchorable( $wikiPage->getId() ) ) {
			return;
		}
		$this->pushReanchor( $wikiPage->getId(), $wikiPage->getTitle() );
	}

	/**
	 * Página borrada: sus §§ quedan congelados (spec: PageDeletedFreezesExcerpts).
	 *
	 * @inheritDoc
	 */
	public function onPageDeleteComplete(
		$page, $deleter, $reason, $pageID, $deletedRev, $logEntry, $archivedRevisionCount
	) {
		$this->excerpts->freezeForPage( $pageID );
	}

	/**
	 * Página restaurada: sus §§ congelados se intentan re-anclar
	 * (spec: PageRestoredReanchorsExcerpts).
	 */
	public function onPageUndeleteComplete(
		ProperPageIdentity $page,
		Authority $restorer,
		string $reason,
		RevisionRecord $restoredRev,
		ManualLogEntry $logEntry,
		int $restoredRevisionCount,
		bool $created,
		array $restoredPageIds
	): void {
		$this->excerpts->adoptFrozen( $restoredPageIds, $page->getId() );
		if ( $this->excerpts->hasReanchorable( $page->getId() ) ) {
			$this->pushReanchor( $page->getId(), $page );
		}
	}

	private function pushReanchor( int $pageId, PageReference $page ): void {
		$this->jobQueueGroup->lazyPush( new JobSpecification(
			ReanchorJob::TYPE,
			[ 'pageId' => $pageId ],
			[ 'removeDuplicates' => true ],
			$page
		) );
	}
}
