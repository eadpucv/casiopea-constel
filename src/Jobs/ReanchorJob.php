<?php

namespace MediaWiki\Extension\CasiopeaConstel\Jobs;

use Job;
use MediaWiki\Extension\CasiopeaConstel\Domain\AnchorLocator;
use MediaWiki\Extension\CasiopeaConstel\Page\RenderedTextProvider;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptStore;
use MediaWiki\Page\PageReference;
use MediaWiki\Page\PageStore;
use MediaWiki\Revision\RevisionLookup;
use Wikimedia\Rdbms\IDBAccessObject;

/**
 * Re-ancla los §§ de una página tras una revisión nueva
 * (spec: PageRevisedReanchorsExcerpts).
 *
 * Idempotente y deduplicado por página: siempre trabaja contra la revisión
 * vigente al correr, aunque haya llegado tarde y la página haya cambiado
 * varias veces. Cada § anclado a una revisión anterior se ubica en el texto
 * canónico nuevo; si se encuentra sin ambigüedad se traslada, si no se pierde.
 */
class ReanchorJob extends Job {

	public const TYPE = 'constelReanchor';

	public function __construct(
		PageReference $page,
		array $params,
		private readonly ExcerptStore $excerpts,
		private readonly PageStore $pageStore,
		private readonly RevisionLookup $revisionLookup,
		private readonly RenderedTextProvider $renderedText,
		private readonly AnchorLocator $locator
	) {
		parent::__construct( self::TYPE, $page, $params );
		$this->removeDuplicates = true;
	}

	/** @inheritDoc */
	public function run() {
		$pageId = (int)$this->params['pageId'];
		$page = $this->pageStore->getPageById( $pageId, IDBAccessObject::READ_LATEST );
		if ( !$page ) {
			// La página ya no existe: nada que ubicar.
			$this->excerpts->markLostForPage( $pageId );
			return true;
		}
		$revision = $this->revisionLookup->getRevisionById( $page->getLatest(), IDBAccessObject::READ_LATEST );
		$text = $revision ? $this->renderedText->forRevision( $page, $revision ) : null;
		if ( $text === null ) {
			// Error transitorio de render: la cola reintenta.
			$this->setLastError( "No se pudo renderizar la revisión vigente de la página $pageId" );
			return false;
		}

		$lost = [];
		foreach ( $this->excerpts->listAnchoredForPage( $pageId, true ) as $excerpt ) {
			if ( $excerpt->revId === $revision->getId() ) {
				continue;
			}
			$anchor = $this->locator->locate( $excerpt->anchor, $text );
			if ( $anchor ) {
				$this->excerpts->relocate( $excerpt->id, $revision->getId(), $anchor );
			} else {
				$lost[] = $excerpt->id;
			}
		}
		$this->excerpts->markLost( $lost );
		return true;
	}
}
