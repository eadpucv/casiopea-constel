<?php

namespace MediaWiki\Extension\CasiopeaConstel\Specials;

use MediaWiki\CommentStore\CommentStore;
use MediaWiki\Context\IContextSource;
use MediaWiki\Extension\CasiopeaConstel\Page\DeletionLog;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptRecord;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptStore;
use MediaWiki\Html\Html;
use MediaWiki\Linker\LinkRenderer;
use MediaWiki\Page\PageStore;
use MediaWiki\Pager\IndexPager;
use MediaWiki\Pager\TablePager;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * La tabla de Especial:MiConstel (spec: MyReading.Browsable): paginada, con
 * orden por fecha o estado y filtros por página, concepto y estado. Cada
 * fila conserva su marcado (clases y data-*), del que se cuelga mine.js.
 */
class MyConstelPager extends TablePager {

	private const SORTABLE = [ 'ce_created', 'ce_status' ];

	/** @var array<int,ExcerptRecord> los §§ de la página visible, por id */
	private array $records = [];
	/** @var array<int,int[]> concept ids por §, en orden de codificación */
	private array $codings = [];
	/** @var array<int,\MediaWiki\Extension\CasiopeaConstel\Store\ConceptRecord> */
	private array $conceptRecords = [];
	/** @var array<int,Title> páginas vigentes, por page_id */
	private array $titles = [];
	/** @var array<int,array> borrados (DeletionLog) de las páginas de §§ congelados */
	private array $deletions = [];

	/**
	 * @param IContextSource $context
	 * @param LinkRenderer $linkRenderer
	 * @param ExcerptStore $excerpts
	 * @param ConceptStore $concepts
	 * @param PageStore $pageStore
	 * @param IConnectionProvider $dbProvider
	 * @param CommentStore $commentStore
	 * @param int $actorId el lector
	 * @param array{page:?int,concept:?int,status:?int} $filters null = sin filtro;
	 *  0 en page/concept = un valor que no existe (la tabla sale vacía)
	 */
	public function __construct(
		IContextSource $context,
		LinkRenderer $linkRenderer,
		private readonly ExcerptStore $excerpts,
		private readonly ConceptStore $concepts,
		private readonly PageStore $pageStore,
		private readonly IConnectionProvider $dbProvider,
		private readonly CommentStore $commentStore,
		private readonly int $actorId,
		private readonly array $filters
	) {
		// Las tablas de con§tel viven en su dominio virtual.
		$this->mDb = $dbProvider->getReplicaDatabase( ConceptStore::DOMAIN );
		parent::__construct( $context, $linkRenderer );
	}

	/** @inheritDoc */
	public function getQueryInfo() {
		$info = [
			'tables' => [ 'constel_excerpt' ],
			'fields' => ExcerptStore::FIELDS,
			'conds' => [ 'ce_actor' => $this->actorId ],
			'options' => [],
			'join_conds' => [],
		];
		if ( $this->filters['page'] !== null ) {
			$info['conds']['ce_page'] = $this->filters['page'];
		}
		if ( $this->filters['status'] !== null ) {
			$info['conds']['ce_status'] = $this->filters['status'];
		}
		if ( $this->filters['concept'] !== null ) {
			$info['tables'][] = 'constel_coding';
			$info['conds']['ccd_concept'] = $this->filters['concept'];
			$info['join_conds']['constel_coding'] = [ 'JOIN', 'ccd_excerpt = ce_id' ];
		}
		return $info;
	}

	/** @inheritDoc */
	protected function getFieldNames() {
		$names = [];
		foreach ( [
			'ce_exact' => 'passage',
			'ce_page' => 'page',
			'concepts' => 'concepts',
			'ce_status' => 'status',
			'ce_created' => 'created',
		] as $field => $col ) {
			// Mensajes: myconstel-col-passage, -page, -concepts, -status, -created
			$names[$field] = $this->msg( "myconstel-col-$col" )->text();
		}
		return $names;
	}

	/** @inheritDoc */
	protected function isFieldSortable( $field ) {
		return in_array( $field, self::SORTABLE, true );
	}

	/** @inheritDoc */
	public function getDefaultSort() {
		return 'ce_created';
	}

	/** @inheritDoc */
	protected function getDefaultDirections() {
		return IndexPager::DIR_DESCENDING;
	}

	/** @inheritDoc */
	protected function getExtraSortFields() {
		return [ 'ce_id' ];
	}

	/**
	 * Carga en lote lo que las filas visibles necesitan: conceptos, páginas y
	 * borrados de las páginas de los §§ congelados.
	 *
	 * @inheritDoc
	 */
	protected function preprocessResults( $result ) {
		$this->records = [];
		foreach ( $result as $row ) {
			$record = $this->excerpts->newRecord( $row );
			$this->records[$record->id] = $record;
		}
		$result->rewind();
		if ( !$this->records ) {
			return;
		}
		$this->codings = $this->excerpts->conceptIdsForMany( array_keys( $this->records ) );
		$this->conceptRecords = $this->concepts->getByIds( array_merge( [], ...array_values( $this->codings ) ) );
		$pageIds = array_values( array_unique( array_map( static fn ( $e ) => $e->pageId, $this->records ) ) );
		foreach ( $this->pageStore->newSelectQueryBuilder()->wherePageIds( $pageIds )->fetchPageRecords() as $page ) {
			$this->titles[$page->getId()] = Title::newFromPageIdentity( $page );
		}
		$frozen = array_filter( $this->records, static fn ( $e ) => $e->isFrozen() );
		$this->deletions = ( new DeletionLog( $this->dbProvider, $this->commentStore ) )
			->lastDeletions( array_map( static fn ( $e ) => $e->pageId, $frozen ), $this->getAuthority() );
	}

	private function current(): ExcerptRecord {
		return $this->records[(int)$this->getCurrentRow()->ce_id];
	}

	/** @inheritDoc */
	public function formatValue( $name, $value ) {
		$e = $this->current();
		switch ( $name ) {
			case 'ce_exact':
				return $this->frozenNotice( $e ) .
					Html::element( 'blockquote', [ 'class' => 'constel-quote' ], $e->anchor->exact ) .
					( $e->gloss === null ? '' :
						Html::element( 'div', [ 'class' => 'constel-gloss-text' ], $e->gloss ) );
			case 'ce_page':
				return $this->pageCell( $e );
			case 'concepts':
				$chips = '';
				foreach ( $this->codings[$e->id] ?? [] as $conceptId ) {
					if ( isset( $this->conceptRecords[$conceptId] ) ) {
						$chips .= Html::element( 'li', [ 'class' => 'constel-chip' ],
							$this->conceptRecords[$conceptId]->label );
					}
				}
				return Html::rawElement( 'ul', [ 'class' => 'constel-chips' ], $chips );
			case 'ce_status':
				// Mensajes: myconstel-status-anchored, -lost, -frozen
				return $this->msg( 'myconstel-status-' . $e->statusName() )->escaped();
			case 'ce_created':
				return htmlspecialchars( $this->getLanguage()->userDate( $e->created, $this->getUser() ) );
		}
		return '';
	}

	/**
	 * Congelado: la página se borró. El título y el motivo, si el registro de
	 * borrado los deja ver (spec: MyReading.FrozenFlagged).
	 */
	private function frozenNotice( ExcerptRecord $e ): string {
		if ( !$e->isFrozen() ) {
			return '';
		}
		$deletion = $this->deletions[$e->pageId] ?? null;
		return Html::rawElement( 'div', [ 'class' => 'constel-frozen', 'role' => 'alert' ],
			Html::element( 'strong', [], $this->msg( 'myconstel-frozen-notice' )->text() ) .
			( $deletion && $deletion['reason'] !== null
				? ' ' . Html::element( 'span', [ 'class' => 'constel-frozen__reason' ],
					$this->msg( 'myconstel-frozen-reason', $deletion['reason'] )->text() )
				: '' )
		);
	}

	private function pageCell( ExcerptRecord $e ): string {
		$linkRenderer = $this->getLinkRenderer();
		if ( $e->isFrozen() ) {
			$deletion = $this->deletions[$e->pageId] ?? null;
			return $deletion && $deletion['title']
				? $linkRenderer->makeLink( $deletion['title'] )
				: $this->msg( 'myconstel-page-gone' )->escaped();
		}
		$title = $this->titles[$e->pageId] ?? null;
		if ( !$title ) {
			return $this->msg( 'myconstel-page-gone' )->escaped();
		}
		if ( $e->isAnchored() ) {
			return $linkRenderer->makeKnownLink( $title );
		}
		// Perdido: la página y la revisión donde el § era válido.
		return $linkRenderer->makeKnownLink( $title ) . ' · ' .
			$linkRenderer->makeKnownLink( $title, $this->msg( 'myconstel-where-valid' )->text(), [],
				[ 'oldid' => $e->revId ] );
	}

	/** @inheritDoc */
	protected function getRowAttrs( $row ) {
		$status = $this->records[(int)$row->ce_id]->statusName();
		return [
			// Clases: constel-mine__row--anchored, --lost, --frozen
			'class' => "constel-mine__row constel-mine__row--$status",
			'data-constel-excerpt' => (int)$row->ce_id,
			'data-constel-status' => $status,
		];
	}

	/** @inheritDoc */
	protected function getCellAttrs( $field, $value ) {
		$attrs = parent::getCellAttrs( $field, $value );
		if ( $field === 'ce_status' ) {
			// Clases: constel-status--anchored, constel-status--lost, constel-status--frozen
			$attrs['class'] .= ' constel-status constel-status--' . $this->current()->statusName();
		}
		return $attrs;
	}

	/** @inheritDoc */
	protected function getTableClass() {
		return parent::getTableClass() . ' wikitable constel-mine';
	}

	/** @inheritDoc */
	protected function getEmptyBody() {
		$filtered = array_filter( $this->filters, static fn ( $v ) => $v !== null );
		$colspan = count( $this->getFieldNames() );
		// Mensajes: myconstel-empty, myconstel-filter-empty
		return Html::rawElement( 'tr', [],
			Html::element( 'td', [ 'colspan' => $colspan ],
				$this->msg( $filtered ? 'myconstel-filter-empty' : 'myconstel-empty' )->text() )
		);
	}
}
