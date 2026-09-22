<?php

namespace MediaWiki\Extension\CasiopeaConstel\Hooks;

use JobQueueGroup;
use JobSpecification;
use MediaWiki\Extension\CasiopeaConstel\Jobs\ReanchorJob;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptStore;
use MediaWiki\Page\Hook\PageDeleteCompleteHook;
use MediaWiki\Storage\Hook\PageSaveCompleteHook;

/**
 * Las páginas cambian; los §§ las siguen o se pierden.
 */
class RevisionHooks implements PageSaveCompleteHook, PageDeleteCompleteHook {

	public function __construct(
		private readonly ExcerptStore $excerpts,
		private readonly JobQueueGroup $jobQueueGroup
	) {
	}

	/**
	 * Revisión nueva (edición, revert, restauración): re-anclar en diferido,
	 * nunca en la request del guardado.
	 *
	 * @inheritDoc
	 */
	public function onPageSaveComplete( $wikiPage, $user, $summary, $flags, $revisionRecord, $editResult ) {
		if ( $editResult->isNullEdit() || !$this->excerpts->hasAnchored( $wikiPage->getId() ) ) {
			return;
		}
		$this->jobQueueGroup->lazyPush( new JobSpecification(
			ReanchorJob::TYPE,
			[ 'pageId' => $wikiPage->getId() ],
			[ 'removeDuplicates' => true ],
			$wikiPage->getTitle()
		) );
	}

	/**
	 * Página borrada: sus §§ se pierden (spec: PageDeletedLosesExcerpts).
	 * Restaurarla no los re-ancla: `lost` es terminal.
	 *
	 * @inheritDoc
	 */
	public function onPageDeleteComplete(
		$page, $deleter, $reason, $pageID, $deletedRev, $logEntry, $archivedRevisionCount
	) {
		$this->excerpts->markLostForPage( $pageID );
	}
}
