<?php

namespace MediaWiki\Extension\CasiopeaConstel\Specials;

use MediaWiki\CommentStore\CommentStore;
use MediaWiki\Extension\CasiopeaConstel\Export\ExportBuilder;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptRecord;
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

	/** Estados que se pueden filtrar, con su valor guardado. */
	private const STATUSES = [
		'anchored' => ExcerptRecord::STATUS_ANCHORED,
		'lost' => ExcerptRecord::STATUS_LOST,
		'frozen' => ExcerptRecord::STATUS_FROZEN,
	];

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

		if ( !$actorId ) {
			$out->addHTML( Html::element( 'p', [], $this->msg( 'myconstel-empty' )->text() ) );
			return;
		}
		$request = $this->getRequest();
		$typed = [
			'page' => trim( $request->getText( 'page' ) ),
			'concept' => trim( $request->getText( 'concept' ) ),
			'status' => $request->getVal( 'status', '' ),
		];
		$out->addHTML( $this->filterForm( $typed ) );
		$pager = new MyConstelPager(
			$this->getContext(), $this->getLinkRenderer(), $this->excerpts, $this->concepts, $this->pageStore,
			$this->dbProvider, $this->commentStore, $actorId, $this->filters( $typed )
		);
		$out->addParserOutputContent( $pager->getFullOutput() );
	}

	/**
	 * Lo escrito en el formulario, resuelto a ids. Una página o un concepto que
	 * no existen dan 0: la tabla sale vacía en vez de ignorar el filtro.
	 *
	 * @param array{page:string,concept:string,status:string} $typed
	 * @return array{page:?int,concept:?int,status:?int}
	 */
	private function filters( array $typed ): array {
		$page = null;
		if ( $typed['page'] !== '' ) {
			$title = Title::newFromText( $typed['page'] );
			$record = $title ? $this->pageStore->getPageForLink( $title ) : null;
			$page = $record && $record->exists() ? $record->getId() : 0;
		}
		$concept = null;
		if ( $typed['concept'] !== '' ) {
			$concept = $this->concepts->getByLabel( $typed['concept'] )->id ?? 0;
		}
		return [
			'page' => $page,
			'concept' => $concept,
			'status' => self::STATUSES[$typed['status']] ?? null,
		];
	}

	/**
	 * Filtros sobre la tabla (spec: MyReading.Browsable). GET: el filtro queda
	 * en la URL. mine.js suma el autocompletado de páginas y conceptos.
	 *
	 * @param array{page:string,concept:string,status:string} $typed
	 */
	private function filterForm( array $typed ): string {
		$field = function ( string $name, string $control ): string {
			// Mensajes: myconstel-filter-page, myconstel-filter-concept, myconstel-filter-status
			return Html::rawElement( 'div', [ 'class' => 'constel-field constel-mine__filter' ],
				Html::label( $this->msg( "myconstel-filter-$name" )->text(), "constel-mine-$name",
					[ 'class' => 'constel-label' ] ) .
				$control
			);
		};
		$input = static fn ( string $name, string $value ) => Html::input( $name, $value, 'search', [
			'id' => "constel-mine-$name",
			'class' => 'constel-input',
			'autocomplete' => 'off',
		] );
		$options = Html::element( 'option', [ 'value' => '' ], $this->msg( 'myconstel-filter-status-all' )->text() );
		foreach ( array_keys( self::STATUSES ) as $status ) {
			// Mensajes: myconstel-status-anchored, -lost, -frozen
			$options .= Html::element( 'option', [ 'value' => $status, 'selected' => $typed['status'] === $status ],
				$this->msg( "myconstel-status-$status" )->text() );
		}
		$active = $typed['page'] !== '' || $typed['concept'] !== '' || isset( self::STATUSES[$typed['status']] );
		return Html::rawElement( 'form', [
				'class' => 'constel-ui constel-mine__filters',
				'method' => 'get',
				'action' => $this->getConfig()->get( 'Script' ),
				'role' => 'search',
			],
			Html::hidden( 'title', $this->getPageTitle()->getPrefixedDBkey() ) .
			// Filtrar conserva la cantidad por página elegida.
			( $this->getRequest()->getCheck( 'limit' )
				? Html::hidden( 'limit', $this->getRequest()->getInt( 'limit' ) ) : '' ) .
			$field( 'page', $input( 'page', $typed['page'] ) ) .
			$field( 'concept', $input( 'concept', $typed['concept'] ) ) .
			$field( 'status', Html::rawElement( 'select', [
				'id' => 'constel-mine-status', 'name' => 'status', 'class' => 'constel-input',
			], $options ) ) .
			Html::rawElement( 'div', [ 'class' => 'constel-actions' ],
				Html::submitButton( $this->msg( 'myconstel-filter-submit' )->text(),
					[ 'class' => 'constel-button constel-button--primary' ] ) .
				( $active ? ' ' . Html::element( 'a', [
					'class' => 'constel-button',
					'href' => $this->getPageTitle()->getLocalURL(),
				], $this->msg( 'myconstel-filter-clear' )->text() ) : '' )
			)
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
