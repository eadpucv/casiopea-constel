<?php

namespace MediaWiki\Extension\CasiopeaConstel\Specials;

use MediaWiki\CommentStore\CommentStore;
use MediaWiki\Extension\CasiopeaConstel\Export\ExportBuilder;
use MediaWiki\Extension\CasiopeaConstel\Page\DeletionLog;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptStore;
use MediaWiki\Html\Html;
use MediaWiki\Page\PageStore;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Title\Title;
use MediaWiki\User\ActorNormalization;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * Especial:MiConstel — la lectura propia, incluidos los §§ perdidos y los
 * congelados (spec: MyReading), y su exportación al constel standalone
 * (spec: ReaderExportsReading): Especial:MiConstel/export.
 */
class SpecialMyConstel extends SpecialPage {

	public function __construct(
		private readonly ExcerptStore $excerpts,
		private readonly ConceptStore $concepts,
		private readonly PageStore $pageStore,
		private readonly ExportBuilder $exportBuilder,
		private readonly ActorNormalization $actorNormalization,
		private readonly IConnectionProvider $dbProvider,
		private readonly CommentStore $commentStore
	) {
		parent::__construct( 'MyConstel' );
	}

	/** @inheritDoc */
	public function execute( $subPage ) {
		$this->requireNamedUser( 'myconstel-needlogin' );
		$actorId = $this->actorNormalization->findActorId( $this->getUser(), $this->dbProvider->getReplicaDatabase() );

		if ( $subPage === 'export' ) {
			$this->export( $actorId ?? 0 );
			return;
		}

		$this->setHeaders();
		$this->outputHeader( 'myconstel-summary' );
		$out = $this->getOutput();
		$out->addModuleStyles( [ 'ext.constel.map.styles' ] );
		// Página ancha: el skin decide qué significa (Stella Nova la absorbe en
		// su skinStyles; en otros skins no tiene efecto).
		$out->addBodyClasses( 'constel-wide' );
		$out->addModules( [ 'ext.constel.mine' ] );
		// Sin el derecho de anotar, lo propio sólo se borra (spec: RightToWithdraw).
		$out->addJsConfigVars( 'wgConstelMine', [
			'canAnnotate' => $this->getAuthority()->isAllowed( 'constel-annotate' ),
		] );

		$out->addHTML( Html::rawElement( 'p', [ 'class' => 'constel-mine__actions' ],
			Html::element( 'a', [
				'class' => 'constel-button constel-button--primary',
				'href' => $this->getPageTitle( 'export' )->getLocalURL(),
			], $this->msg( 'myconstel-export' )->text() ) . ' ' .
			Html::element( 'a', [
				'class' => 'constel-button',
				'href' => SpecialPage::getTitleFor( 'Constellation' )->getLocalURL(),
			], $this->msg( 'myconstel-map' )->text() )
		) );

		$records = $actorId ? $this->excerpts->listForActor( $actorId, 1000 ) : [];
		if ( !$records ) {
			$out->addHTML( Html::element( 'p', [], $this->msg( 'myconstel-empty' )->text() ) );
			return;
		}
		$out->addHTML( $this->table( $records ) );
	}

	private function table( array $records ): string {
		$codings = $this->excerpts->conceptIdsForMany( array_map( static fn ( $e ) => $e->id, $records ) );
		$concepts = $this->concepts->getByIds( array_merge( [], ...array_values( $codings ) ) );
		$pages = [];
		foreach ( $this->pageStore->newSelectQueryBuilder()
			->wherePageIds( array_values( array_unique( array_map( static fn ( $e ) => $e->pageId, $records ) ) ) )
			->fetchPageRecords() as $page
		) {
			$pages[$page->getId()] = Title::newFromPageIdentity( $page );
		}
		$linkRenderer = $this->getLinkRenderer();
		$lang = $this->getLanguage();

		$head = '';
		foreach ( [ 'passage', 'page', 'concepts', 'status', 'created' ] as $col ) {
			$head .= Html::element( 'th', [ 'scope' => 'col' ], $this->msg( "myconstel-col-$col" )->text() );
		}
		$rows = '';
		$frozen = array_filter( $records, static fn ( $e ) => $e->isFrozen() );
		$deletions = ( new DeletionLog( $this->dbProvider, $this->commentStore ) )
			->lastDeletions( array_map( static fn ( $e ) => $e->pageId, $frozen ), $this->getAuthority() );
		foreach ( $records as $e ) {
			$title = $pages[$e->pageId] ?? null;
			$notice = '';
			if ( $e->isFrozen() ) {
				// Congelado: la página se borró. El título y el motivo, si el
				// registro de borrado los deja ver (spec: MyReading.FrozenFlagged).
				$deletion = $deletions[$e->pageId] ?? null;
				$pageCell = $deletion && $deletion['title']
					? $linkRenderer->makeLink( $deletion['title'] )
					: $this->msg( 'myconstel-page-gone' )->escaped();
				$notice = Html::rawElement( 'div', [ 'class' => 'constel-frozen', 'role' => 'alert' ],
					Html::element( 'strong', [], $this->msg( 'myconstel-frozen-notice' )->text() ) .
					( $deletion && $deletion['reason'] !== null
						? ' ' . Html::element( 'span', [ 'class' => 'constel-frozen__reason' ],
							$this->msg( 'myconstel-frozen-reason', $deletion['reason'] )->text() )
						: '' )
				);
			} elseif ( !$title ) {
				$pageCell = $this->msg( 'myconstel-page-gone' )->escaped();
			} elseif ( $e->isAnchored() ) {
				$pageCell = $linkRenderer->makeKnownLink( $title );
			} else {
				// Perdido: la página y la revisión donde el § era válido.
				$pageCell = $linkRenderer->makeKnownLink( $title ) . ' · ' .
					$linkRenderer->makeKnownLink( $title, $this->msg( 'myconstel-where-valid' )->text(), [],
						[ 'oldid' => $e->revId ] );
			}
			$chips = '';
			foreach ( $codings[$e->id] ?? [] as $conceptId ) {
				if ( isset( $concepts[$conceptId] ) ) {
					$chips .= Html::element( 'li', [ 'class' => 'constel-chip' ], $concepts[$conceptId]->label );
				}
			}
			$status = $e->statusName();
			// Clases: constel-mine__row--anchored, --lost, --frozen
			$rows .= Html::rawElement( 'tr', [
					'class' => "constel-mine__row constel-mine__row--$status",
					'data-constel-excerpt' => $e->id,
					'data-constel-status' => $status,
				],
				Html::rawElement( 'td', [],
					$notice .
					Html::element( 'blockquote', [ 'class' => 'constel-quote' ], $e->anchor->exact ) .
					( $e->gloss === null ? '' :
						Html::element( 'div', [ 'class' => 'constel-gloss-text' ], $e->gloss ) ) ) .
				Html::rawElement( 'td', [], $pageCell ) .
				Html::rawElement( 'td', [], Html::rawElement( 'ul', [ 'class' => 'constel-chips' ], $chips ) ) .
				// Clases: constel-status--anchored, constel-status--lost, constel-status--frozen
				// Mensajes: myconstel-status-anchored, -lost, -frozen
				Html::element( 'td', [ 'class' => "constel-status constel-status--$status" ],
					$this->msg( "myconstel-status-$status" )->text() ) .
				Html::element( 'td', [], $lang->userDate( $e->created, $this->getUser() ) )
			);
		}
		return Html::rawElement( 'table', [ 'class' => 'wikitable constel-mine' ],
			Html::rawElement( 'thead', [], Html::rawElement( 'tr', [], $head ) ) .
			Html::rawElement( 'tbody', [], $rows )
		);
	}

	private function export( int $actorId ): void {
		$bytes = $this->exportBuilder->zip(
			$this->exportBuilder->build( $actorId, $this->getConfig()->get( 'CanonicalServer' ) )
		);
		$this->getOutput()->disable();
		$response = $this->getRequest()->response();
		$response->header( 'Content-Type: application/zip' );
		$response->header( 'Content-Disposition: attachment; filename="constel-' . gmdate( 'Y-m-d' ) . '.zip"' );
		$response->header( 'Content-Length: ' . strlen( $bytes ) );
		$response->header( 'Cache-Control: private, no-store' );
		print $bytes;
	}

	/** @inheritDoc */
	protected function getGroupName() {
		return 'users';
	}
}
