<?php

namespace MediaWiki\Extension\CasiopeaConstel\Specials;

use MediaWiki\CommentStore\CommentStore;
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

		$typed = $this->typedFilters();
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

		if ( !$actorId ) {
			$out->addHTML( Html::element( 'p', [], $this->msg( 'myconstel-empty' )->text() ) );
			return;
		}
		$out->addHTML( $this->filterForm( $typed ) );
		$out->addHTML( $this->actionsRow( $typed ) );
		$pager = new MyConstelPager(
			$this->getContext(), $this->getLinkRenderer(), $this->excerpts, $this->concepts, $this->pageStore,
			$this->dbProvider, $this->commentStore, $actorId, $this->filters( $typed )
		);
		$out->addParserOutputContent( $pager->getFullOutput() );
	}

	/**
	 * Bajo los filtros: cantidad por página (primera de la fila) y los
	 * botones de exportación. El selector es un GET que conserva los filtros.
	 *
	 * @param array{page:string,concept:string,status:string} $typed
	 */
	private function actionsRow( array $typed ): string {
		$filtered = $this->isFiltered( $typed );
		$query = array_filter( $typed, static fn ( $v ) => $v !== '' );

		$current = MyConstelPager::limitFrom( $this->getRequest()->getInt( 'limit' ) );
		$options = '';
		foreach ( MyConstelPager::LIMITS as $limit ) {
			$options .= Html::element( 'option', [ 'value' => $limit, 'selected' => $limit === $current ], (string)$limit );
		}
		$hidden = Html::hidden( 'title', $this->getPageTitle()->getPrefixedDBkey() );
		foreach ( $query as $name => $value ) {
			$hidden .= Html::hidden( $name, $value );
		}
		$limitForm = Html::rawElement( 'form', [
				'class' => 'constel-ui constel-mine__limit',
				'method' => 'get',
				'action' => $this->getConfig()->get( 'Script' ),
			],
			$hidden .
			Html::label( $this->msg( 'myconstel-limit' )->text(), 'constel-mine-limit', [ 'class' => 'constel-label' ] ) .
			Html::rawElement( 'select', [ 'id' => 'constel-mine-limit', 'name' => 'limit', 'class' => 'constel-input' ], $options ) .
			// Sin JS, el selector aplica con este botón (mine.js lo oculta al elegir).
			Html::rawElement( 'noscript', [], Html::submitButton( $this->msg( 'myconstel-filter-submit' )->text(),
				[ 'class' => 'constel-button' ] ) )
		);

		$export = $this->getPageTitle( 'export' );
		return Html::rawElement( 'div', [ 'class' => 'constel-mine__actions' ],
			$limitForm .
			Html::element( 'a', [
				'class' => 'constel-button',
				'href' => $export->getLocalURL( $filtered ? $query : [] ),
			], $this->msg( $filtered ? 'myconstel-export-table' : 'myconstel-export' )->text() ) .
			( $filtered ? Html::element( 'a', [
				'class' => 'constel-button',
				'href' => $export->getLocalURL(),
			], $this->msg( 'myconstel-export-all' )->text() ) : '' ) .
			Html::element( 'a', [
				'class' => 'constel-button',
				'href' => SpecialPage::getTitleFor( 'Constellation' )->getLocalURL(),
			], $this->msg( 'myconstel-map' )->text() )
		);
	}

	/** @return array{page:string,concept:string,status:string} lo escrito en el formulario */
	private function typedFilters(): array {
		$request = $this->getRequest();
		return [
			'page' => trim( $request->getText( 'page' ) ),
			'concept' => trim( $request->getText( 'concept' ) ),
			'status' => $request->getVal( 'status', '' ),
		];
	}

	/** @param array{page:string,concept:string,status:string} $typed */
	private function isFiltered( array $typed ): bool {
		return $typed['page'] !== '' || $typed['concept'] !== '' || isset( self::STATUSES[$typed['status']] );
	}

	/**
	 * Lo escrito en el formulario, resuelto a ids. Una página que no existe da 0 y un concepto,
	 * [] (nada coincide): la tabla sale vacía en vez de ignorar el filtro.
	 *
	 * @param array{page:string,concept:string,status:string} $typed
	 * @return array{page:?int,concept:?int[],status:?int}
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
			$concept = $this->concepts->idsMatching( $typed['concept'] );
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
		$active = $this->isFiltered( $typed );
		return Html::rawElement( 'form', [
				'class' => 'constel-ui constel-mine__filters',
				'method' => 'get',
				'action' => $this->getConfig()->get( 'Script' ),
				'role' => 'search',
			],
			Html::hidden( 'title', $this->getPageTitle()->getPrefixedDBkey() ) .
			// Filtrar conserva la cantidad por página elegida.
			( $this->getRequest()->getCheck( 'limit' )
				? Html::hidden( 'limit', MyConstelPager::limitFrom( $this->getRequest()->getInt( 'limit' ) ) ) : '' ) .
			$field( 'page', $input( 'page', $typed['page'] ) ) .
			$field( 'concept', $input( 'concept', $typed['concept'] ) ) .
			$field( 'status', Html::rawElement( 'select', [
				'id' => 'constel-mine-status', 'name' => 'status', 'class' => 'constel-input',
			], $options ) ) .
			Html::rawElement( 'div', [ 'class' => 'constel-actions' ],
				Html::submitButton( $this->msg( 'myconstel-filter-submit' )->text(),
					[ 'class' => 'constel-button' ] ) .
				( $active ? ' ' . Html::element( 'a', [
					'class' => 'constel-button',
					'href' => $this->getPageTitle()->getLocalURL(),
				], $this->msg( 'myconstel-filter-clear' )->text() ) : '' )
			)
		);
	}

	/**
	 * CSV de lo que la tabla muestra con los filtros de la URL (sin filtros,
	 * todo). UTF-8 con BOM para que Excel lo abra bien.
	 */
	private function export( int $actorId ): void {
		$filters = $this->filters( $this->typedFilters() );
		$excerpts = $actorId ? $this->excerpts->listForActorFiltered(
			$actorId, $filters['page'], $filters['concept'], $filters['status']
		) : [];
		$codings = $this->excerpts->conceptIdsForMany( array_map( static fn ( $e ) => $e->id, $excerpts ) );
		$concepts = $this->concepts->getByIds( array_merge( [], ...array_values( $codings ) ) );
		$pageIds = array_values( array_unique( array_map( static fn ( $e ) => $e->pageId, $excerpts ) ) );
		$titles = [];
		if ( $pageIds ) {
			foreach ( $this->pageStore->newSelectQueryBuilder()->wherePageIds( $pageIds )->fetchPageRecords() as $page ) {
				$titles[$page->getId()] = Title::newFromPageIdentity( $page )->getPrefixedText();
			}
		}

		$fh = fopen( 'php://temp', 'r+' );
		fwrite( $fh, "\xEF\xBB\xBF" );
		$write = static function ( array $cells ) use ( $fh ) {
			// Una celda que empieza con = + - @ la tomaría una planilla por fórmula.
			$cells = array_map( static fn ( $c ) => preg_match( '/^[=+\-@\t\r]/', $c ) ? "'" . $c : $c, $cells );
			fputcsv( $fh, $cells, ',', '"', '' );
		};
		// Mensajes: myconstel-col-passage, -gloss, -page, -concepts, -status, -created
		$write( array_map( fn ( $c ) => $this->msg( "myconstel-col-$c" )->text(),
			[ 'passage', 'gloss', 'page', 'concepts', 'status', 'created' ] ) );
		foreach ( $excerpts as $e ) {
			$labels = [];
			foreach ( $codings[$e->id] ?? [] as $conceptId ) {
				if ( isset( $concepts[$conceptId] ) ) {
					$labels[] = $concepts[$conceptId]->label;
				}
			}
			$write( [
				$e->anchor->exact,
				$e->gloss ?? '',
				$titles[$e->pageId] ?? $this->msg( 'myconstel-page-gone' )->text(),
				implode( '; ', $labels ),
				// Mensajes: myconstel-status-anchored, -lost, -frozen
				$this->msg( 'myconstel-status-' . $e->statusName() )->text(),
				wfTimestamp( TS_ISO_8601, $e->created ),
			] );
		}
		rewind( $fh );
		$csv = stream_get_contents( $fh );
		fclose( $fh );

		$this->getOutput()->disable();
		$response = $this->getRequest()->response();
		$response->header( 'Content-Type: text/csv; charset=utf-8' );
		$response->header( 'Content-Disposition: attachment; filename="anotaciones-' . gmdate( 'Y-m-d' ) . '.csv"' );
		$response->header( 'Content-Length: ' . strlen( $csv ) );
		$response->header( 'Cache-Control: private, no-store' );
		print $csv;
	}

	/** @inheritDoc */
	protected function getGroupName() {
		return 'users';
	}
}
