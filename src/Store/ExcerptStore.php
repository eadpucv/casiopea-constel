<?php

namespace MediaWiki\Extension\CasiopeaConstel\Store;

use MediaWiki\Extension\CasiopeaConstel\Domain\TextAnchor;
use stdClass;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IDatabase;
use Wikimedia\Rdbms\IReadableDatabase;
use Wikimedia\Rdbms\SelectQueryBuilder;

/**
 * Pasajes (§) y su codificación (spec: Excerpt, Coding).
 *
 * No comprueba permisos: eso es de la API. Sí garantiza las reglas de datos
 * del spec: un § nace codificado (ReaderCreatesExcerpt), sin duplicados
 * (NoDuplicateCoding), y las cascadas UncodedExcerptVanishes y
 * UnusedConceptVanishes.
 */
class ExcerptStore {

	private const FIELDS = [
		'ce_id', 'ce_actor', 'ce_page', 'ce_rev', 'ce_exact', 'ce_prefix', 'ce_suffix',
		'ce_start', 'ce_end', 'ce_gloss', 'ce_status', 'ce_created', 'ce_lost',
	];

	public function __construct(
		private readonly IConnectionProvider $dbProvider,
		private readonly ConceptStore $concepts
	) {
	}

	/**
	 * Crea un § con su primer concepto.
	 */
	public function create(
		int $actorId, int $pageId, int $revId, TextAnchor $anchor, string $conceptLabel, ?string $gloss = null
	): ExcerptRecord {
		$dbw = $this->primary();
		$dbw->startAtomic( __METHOD__ );
		$concept = $this->concepts->acquire( $conceptLabel );
		$now = $dbw->timestamp();
		$dbw->newInsertQueryBuilder()
			->insertInto( 'constel_excerpt' )
			->row( [
				'ce_actor' => $actorId,
				'ce_page' => $pageId,
				'ce_rev' => $revId,
				'ce_exact' => $anchor->exact,
				'ce_prefix' => $anchor->prefix,
				'ce_suffix' => $anchor->suffix,
				'ce_start' => $anchor->start,
				'ce_end' => $anchor->end,
				'ce_gloss' => $gloss,
				'ce_status' => ExcerptRecord::STATUS_ANCHORED,
				'ce_created' => $now,
				'ce_lost' => null,
			] )
			->caller( __METHOD__ )->execute();
		$id = $dbw->insertId();
		$this->insertCoding( $dbw, $id, $concept->id );
		$dbw->endAtomic( __METHOD__ );

		return new ExcerptRecord(
			$id, $actorId, $pageId, $revId, $anchor, ExcerptRecord::STATUS_ANCHORED, $now, null, $gloss
		);
	}

	public function get( int $id, bool $fromPrimary = false ): ?ExcerptRecord {
		$db = $fromPrimary ? $this->primary() : $this->replica();
		$row = $this->select( $db )->where( [ 'ce_id' => $id ] )->caller( __METHOD__ )->fetchRow();
		return $row ? $this->newRecord( $row ) : null;
	}

	/**
	 * Agrega un concepto a un § (spec: ReaderCodesExcerpt).
	 *
	 * @return ConceptRecord|null null si el § ya tenía ese concepto.
	 */
	public function code( int $excerptId, string $conceptLabel ): ?ConceptRecord {
		$dbw = $this->primary();
		$dbw->startAtomic( __METHOD__ );
		$concept = $this->concepts->acquire( $conceptLabel );
		$already = in_array( $concept->id, $this->conceptIds( $excerptId, $dbw ), true );
		if ( !$already ) {
			$this->insertCoding( $dbw, $excerptId, $concept->id );
		}
		$dbw->endAtomic( __METHOD__ );
		return $already ? null : $concept;
	}

	/**
	 * Fija o quita la glosa de un § (spec: ReaderGlossesExcerpt).
	 */
	public function setGloss( int $excerptId, ?string $gloss ): void {
		$this->primary()->newUpdateQueryBuilder()
			->update( 'constel_excerpt' )
			->set( [ 'ce_gloss' => $gloss ] )
			->where( [ 'ce_id' => $excerptId ] )
			->caller( __METHOD__ )->execute();
	}

	/**
	 * Quita un concepto de un § (spec: ReaderUncodesExcerpt). Si era el
	 * último, el § desaparece; si el concepto queda sin uso, también.
	 */
	public function uncode( int $excerptId, int $conceptId ): void {
		$dbw = $this->primary();
		$dbw->startAtomic( __METHOD__ );
		$dbw->newDeleteQueryBuilder()
			->deleteFrom( 'constel_coding' )
			->where( [ 'ccd_excerpt' => $excerptId, 'ccd_concept' => $conceptId ] )
			->caller( __METHOD__ )->execute();
		if ( !$this->conceptIds( $excerptId, $dbw ) ) {
			$this->deleteRow( $dbw, $excerptId );
		}
		$this->concepts->purgeUnused( [ $conceptId ] );
		$dbw->endAtomic( __METHOD__ );
	}

	/**
	 * Borra un § y sus codificaciones (spec: ReaderDeletesExcerpt).
	 */
	public function delete( int $excerptId ): void {
		$dbw = $this->primary();
		$dbw->startAtomic( __METHOD__ );
		$conceptIds = $this->conceptIds( $excerptId, $dbw );
		$dbw->newDeleteQueryBuilder()
			->deleteFrom( 'constel_coding' )
			->where( [ 'ccd_excerpt' => $excerptId ] )
			->caller( __METHOD__ )->execute();
		$this->deleteRow( $dbw, $excerptId );
		$this->concepts->purgeUnused( $conceptIds );
		$dbw->endAtomic( __METHOD__ );
	}

	/**
	 * El ancla se ubicó en una revisión nueva (spec: PageRevisedReanchorsExcerpts).
	 */
	public function relocate( int $excerptId, int $revId, TextAnchor $anchor ): void {
		$this->primary()->newUpdateQueryBuilder()
			->update( 'constel_excerpt' )
			->set( [
				'ce_rev' => $revId,
				'ce_exact' => $anchor->exact,
				'ce_prefix' => $anchor->prefix,
				'ce_suffix' => $anchor->suffix,
				'ce_start' => $anchor->start,
				'ce_end' => $anchor->end,
			] )
			->where( [ 'ce_id' => $excerptId, 'ce_status' => ExcerptRecord::STATUS_ANCHORED ] )
			->caller( __METHOD__ )->execute();
	}

	/**
	 * El § pierde su ancla. `lost` es terminal: sólo afecta §§ anclados.
	 *
	 * @param int[] $excerptIds
	 */
	public function markLost( array $excerptIds ): void {
		if ( !$excerptIds ) {
			return;
		}
		$dbw = $this->primary();
		$dbw->newUpdateQueryBuilder()
			->update( 'constel_excerpt' )
			->set( [ 'ce_status' => ExcerptRecord::STATUS_LOST, 'ce_lost' => $dbw->timestamp() ] )
			->where( [ 'ce_id' => $excerptIds, 'ce_status' => ExcerptRecord::STATUS_ANCHORED ] )
			->caller( __METHOD__ )->execute();
	}

	/**
	 * ¿La página tiene §§ anclados? Barato: decide si vale la pena re-anclar.
	 */
	public function hasAnchored( int $pageId ): bool {
		return (bool)$this->primary()->newSelectQueryBuilder()
			->select( 'ce_id' )
			->from( 'constel_excerpt' )
			->where( [ 'ce_page' => $pageId, 'ce_status' => ExcerptRecord::STATUS_ANCHORED ] )
			->limit( 1 )
			->caller( __METHOD__ )->fetchField();
	}

	/**
	 * Todos los §§ anclados de la página pierden el ancla
	 * (spec: PageDeletedLosesExcerpts).
	 */
	public function markLostForPage( int $pageId ): void {
		$dbw = $this->primary();
		$dbw->newUpdateQueryBuilder()
			->update( 'constel_excerpt' )
			->set( [ 'ce_status' => ExcerptRecord::STATUS_LOST, 'ce_lost' => $dbw->timestamp() ] )
			->where( [ 'ce_page' => $pageId, 'ce_status' => ExcerptRecord::STATUS_ANCHORED ] )
			->caller( __METHOD__ )->execute();
	}

	/**
	 * @return ExcerptRecord[] §§ anclados de una página, en orden de texto.
	 */
	public function listAnchoredForPage( int $pageId, bool $fromPrimary = false ): array {
		$db = $fromPrimary ? $this->primary() : $this->replica();
		$res = $this->select( $db )
			->where( [ 'ce_page' => $pageId, 'ce_status' => ExcerptRecord::STATUS_ANCHORED ] )
			->orderBy( [ 'ce_start', 'ce_id' ] )
			->caller( __METHOD__ )->fetchResultSet();
		return array_map( [ $this, 'newRecord' ], iterator_to_array( $res ) );
	}

	/**
	 * @return ExcerptRecord[] §§ codificados con un concepto (anclados y perdidos).
	 */
	public function listForConcept( int $conceptId, int $limit = 500 ): array {
		$res = $this->select( $this->replica() )
			->join( 'constel_coding', null, 'ccd_excerpt = ce_id' )
			->where( [ 'ccd_concept' => $conceptId ] )
			->orderBy( [ 'ce_page', 'ce_start' ] )
			->limit( $limit )
			->caller( __METHOD__ )->fetchResultSet();
		return array_map( [ $this, 'newRecord' ], iterator_to_array( $res ) );
	}

	/**
	 * @return ExcerptRecord[] §§ de un lector, incluidos los perdidos, del más nuevo al más viejo.
	 */
	public function listForActor( int $actorId, int $limit = 500 ): array {
		$res = $this->select( $this->replica() )
			->where( [ 'ce_actor' => $actorId ] )
			->orderBy( [ 'ce_created', 'ce_id' ], 'DESC' )
			->limit( $limit )
			->caller( __METHOD__ )->fetchResultSet();
		return array_map( [ $this, 'newRecord' ], iterator_to_array( $res ) );
	}

	/**
	 * @return int[]
	 */
	public function conceptIds( int $excerptId, ?IReadableDatabase $db = null ): array {
		$db ??= $this->replica();
		return array_map( 'intval', $db->newSelectQueryBuilder()
			->select( 'ccd_concept' )
			->from( 'constel_coding' )
			->where( [ 'ccd_excerpt' => $excerptId ] )
			->orderBy( 'ccd_timestamp' )
			->caller( __METHOD__ )->fetchFieldValues() );
	}

	/**
	 * @param int[] $excerptIds
	 * @return array<int,int[]> conceptos por §, en orden de codificación
	 */
	public function conceptIdsForMany( array $excerptIds ): array {
		if ( !$excerptIds ) {
			return [];
		}
		$res = $this->replica()->newSelectQueryBuilder()
			->select( [ 'ccd_excerpt', 'ccd_concept' ] )
			->from( 'constel_coding' )
			->where( [ 'ccd_excerpt' => $excerptIds ] )
			->orderBy( [ 'ccd_excerpt', 'ccd_timestamp' ] )
			->caller( __METHOD__ )->fetchResultSet();
		$out = array_fill_keys( $excerptIds, [] );
		foreach ( $res as $row ) {
			$out[(int)$row->ccd_excerpt][] = (int)$row->ccd_concept;
		}
		return $out;
	}

	private function insertCoding( IDatabase $dbw, int $excerptId, int $conceptId ): void {
		$dbw->newInsertQueryBuilder()
			->insertInto( 'constel_coding' )
			->row( [
				'ccd_excerpt' => $excerptId,
				'ccd_concept' => $conceptId,
				'ccd_timestamp' => $dbw->timestamp(),
			] )
			->caller( __METHOD__ )->execute();
	}

	private function deleteRow( IDatabase $dbw, int $excerptId ): void {
		$dbw->newDeleteQueryBuilder()
			->deleteFrom( 'constel_excerpt' )
			->where( [ 'ce_id' => $excerptId ] )
			->caller( __METHOD__ )->execute();
	}

	private function select( IReadableDatabase $db ): SelectQueryBuilder {
		return $db->newSelectQueryBuilder()->select( self::FIELDS )->from( 'constel_excerpt' );
	}

	private function newRecord( stdClass $row ): ExcerptRecord {
		return new ExcerptRecord(
			(int)$row->ce_id,
			(int)$row->ce_actor,
			(int)$row->ce_page,
			(int)$row->ce_rev,
			new TextAnchor(
				$row->ce_exact, $row->ce_prefix, $row->ce_suffix, (int)$row->ce_start, (int)$row->ce_end
			),
			(int)$row->ce_status,
			$row->ce_created,
			$row->ce_lost,
			$row->ce_gloss
		);
	}

	private function primary(): IDatabase {
		return $this->dbProvider->getPrimaryDatabase( ConceptStore::DOMAIN );
	}

	private function replica(): IReadableDatabase {
		return $this->dbProvider->getReplicaDatabase( ConceptStore::DOMAIN );
	}
}
