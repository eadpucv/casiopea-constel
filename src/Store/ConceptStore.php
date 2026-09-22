<?php

namespace MediaWiki\Extension\CasiopeaConstel\Store;

use MediaWiki\Extension\CasiopeaConstel\Domain\ConceptNormalizer;
use stdClass;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IDatabase;
use Wikimedia\Rdbms\IExpression;
use Wikimedia\Rdbms\IReadableDatabase;
use Wikimedia\Rdbms\LikeValue;
use Wikimedia\Rdbms\SelectQueryBuilder;

/**
 * Vocabulario global de conceptos (spec: Concept).
 *
 * No comprueba permisos: eso es de la API. Sí garantiza las reglas de datos
 * del spec: unicidad por forma canónica y UnusedConceptVanishes.
 */
class ConceptStore {

	public const DOMAIN = 'virtual-constel';

	public function __construct(
		private readonly IConnectionProvider $dbProvider,
		private readonly ConceptNormalizer $normalizer
	) {
	}

	public function getById( int $id ): ?ConceptRecord {
		$row = $this->select( $this->replica() )
			->where( [ 'cc_id' => $id ] )
			->caller( __METHOD__ )->fetchRow();
		return $row ? $this->newRecord( $row ) : null;
	}

	public function getByLabel( string $label ): ?ConceptRecord {
		$row = $this->select( $this->replica() )
			->where( [ 'cc_key' => $this->normalizer->canonical( $label ) ] )
			->caller( __METHOD__ )->fetchRow();
		return $row ? $this->newRecord( $row ) : null;
	}

	/**
	 * @param int[] $ids
	 * @return array<int,ConceptRecord> indexado por id
	 */
	public function getByIds( array $ids ): array {
		if ( !$ids ) {
			return [];
		}
		$res = $this->select( $this->replica() )
			->where( [ 'cc_id' => array_values( array_unique( $ids ) ) ] )
			->caller( __METHOD__ )->fetchResultSet();
		$out = [];
		foreach ( $res as $row ) {
			$out[(int)$row->cc_id] = $this->newRecord( $row );
		}
		return $out;
	}

	/**
	 * Búsqueda para el autocompletado: conceptos cuya clave tolerante empieza
	 * como la del texto escrito, los más usados primero.
	 *
	 * @return array<int,array{concept:ConceptRecord,uses:int}>
	 */
	public function search( string $typed, int $limit = 10 ): array {
		$db = $this->replica();
		$res = $db->newSelectQueryBuilder()
			->select( [ 'cc_id', 'cc_key', 'uses' => 'COUNT(ccd_excerpt)' ] )
			->from( 'constel_concept' )
			->leftJoin( 'constel_coding', null, 'ccd_concept = cc_id' )
			->where( $db->expr( 'cc_fold', IExpression::LIKE,
				new LikeValue( $this->normalizer->fold( $typed ), $db->anyString() ) ) )
			->groupBy( [ 'cc_id', 'cc_key' ] )
			->orderBy( 'uses', SelectQueryBuilder::SORT_DESC )
			->orderBy( 'cc_key', SelectQueryBuilder::SORT_ASC )
			->limit( $limit )
			->caller( __METHOD__ )->fetchResultSet();
		$out = [];
		foreach ( $res as $row ) {
			$out[] = [ 'concept' => $this->newRecord( $row ), 'uses' => (int)$row->uses ];
		}
		return $out;
	}

	/**
	 * Devuelve el concepto con esa forma canónica, creándolo si no existe.
	 * Seguro frente a carreras: INSERT IGNORE sobre el índice único.
	 */
	public function acquire( string $label ): ConceptRecord {
		$key = $this->normalizer->canonical( $label );
		$dbw = $this->primary();
		$dbw->newInsertQueryBuilder()
			->insertInto( 'constel_concept' )
			->ignore()
			->row( [
				'cc_key' => $key,
				'cc_fold' => $this->normalizer->fold( $key ),
				'cc_created' => $dbw->timestamp(),
			] )
			->caller( __METHOD__ )->execute();
		$row = $this->select( $dbw )
			->where( [ 'cc_key' => $key ] )
			->caller( __METHOD__ )->fetchRow();
		return $this->newRecord( $row );
	}

	/**
	 * Conceptos que difieren de $label sólo en tildes, diéresis, mayúsculas o
	 * espacios (spec: VariantsSteered). Excluye el concepto idéntico.
	 *
	 * @return ConceptRecord[]
	 */
	public function findVariants( string $label, int $limit = 10 ): array {
		$res = $this->select( $this->replica() )
			->where( [ 'cc_fold' => $this->normalizer->fold( $label ) ] )
			->andWhere( $this->replica()->expr( 'cc_key', '!=', $this->normalizer->canonical( $label ) ) )
			->orderBy( 'cc_key' )
			->limit( $limit )
			->caller( __METHOD__ )->fetchResultSet();
		return array_map( [ $this, 'newRecord' ], iterator_to_array( $res ) );
	}

	/**
	 * Cambia la forma canónica de un concepto (spec: ModeratorRenamesConcept).
	 *
	 * @return bool false si la forma nueva ya pertenece a otro concepto (eso
	 *   es una fusión, no un renombre).
	 */
	public function rename( int $id, string $newLabel ): bool {
		$key = $this->normalizer->canonical( $newLabel );
		$dbw = $this->primary();
		$holder = $dbw->newSelectQueryBuilder()
			->select( 'cc_id' )
			->from( 'constel_concept' )
			->where( [ 'cc_key' => $key ] )
			->forUpdate()
			->caller( __METHOD__ )->fetchField();
		if ( $holder !== false && (int)$holder !== $id ) {
			return false;
		}
		$dbw->newUpdateQueryBuilder()
			->update( 'constel_concept' )
			->set( [ 'cc_key' => $key, 'cc_fold' => $this->normalizer->fold( $key ) ] )
			->where( [ 'cc_id' => $id ] )
			->caller( __METHOD__ )->execute();
		return $dbw->affectedRows() > 0 || $holder !== false;
	}

	/**
	 * Fusiona $absorbedId en $keepId (spec: ModeratorMergesConcepts): las
	 * codificaciones y pertenencias pasan a $keepId, deduplicando; en los
	 * temas de cada lector gana la pertenencia que ya tenía $keepId.
	 */
	public function merge( int $keepId, int $absorbedId ): void {
		if ( $keepId === $absorbedId ) {
			return;
		}
		$dbw = $this->primary();
		$dbw->startAtomic( __METHOD__ );

		// Codificaciones: los §§ que ya tienen $keepId pierden la duplicada;
		// el resto se re-apunta.
		$this->moveReferences( $dbw, 'constel_coding', 'ccd_concept', 'ccd_excerpt', $keepId, $absorbedId );
		// Pertenencias: por lector, gana la que ya tenía $keepId.
		$this->moveReferences( $dbw, 'constel_membership', 'cm_concept', 'cm_actor', $keepId, $absorbedId );

		$dbw->newDeleteQueryBuilder()
			->deleteFrom( 'constel_concept' )
			->where( [ 'cc_id' => $absorbedId ] )
			->caller( __METHOD__ )->execute();

		$dbw->endAtomic( __METHOD__ );
	}

	/**
	 * Re-apunta filas de $absorbedId a $keepId en una tabla cuya clave es
	 * ($owner, $conceptField), borrando antes las que chocarían.
	 */
	private function moveReferences(
		IDatabase $dbw, string $table, string $conceptField, string $ownerField, int $keepId, int $absorbedId
	): void {
		$owners = static fn ( int $conceptId ) => $dbw->newSelectQueryBuilder()
			->select( $ownerField )
			->from( $table )
			->where( [ $conceptField => $conceptId ] )
			->caller( __METHOD__ )->fetchFieldValues();
		$clashing = array_intersect( $owners( $absorbedId ), $owners( $keepId ) );
		if ( $clashing ) {
			$dbw->newDeleteQueryBuilder()
				->deleteFrom( $table )
				->where( [ $conceptField => $absorbedId, $ownerField => array_values( $clashing ) ] )
				->caller( __METHOD__ )->execute();
		}
		$dbw->newUpdateQueryBuilder()
			->update( $table )
			->set( [ $conceptField => $keepId ] )
			->where( [ $conceptField => $absorbedId ] )
			->caller( __METHOD__ )->execute();
	}

	/**
	 * Borra el concepto y sus pertenencias si ningún § lo usa
	 * (spec: UnusedConceptVanishes).
	 *
	 * @param int[] $ids
	 */
	public function purgeUnused( array $ids ): void {
		if ( !$ids ) {
			return;
		}
		$dbw = $this->primary();
		$used = $dbw->newSelectQueryBuilder()
			->select( 'ccd_concept' )
			->distinct()
			->from( 'constel_coding' )
			->where( [ 'ccd_concept' => $ids ] )
			->caller( __METHOD__ )->fetchFieldValues();
		$unused = array_values( array_diff( $ids, array_map( 'intval', $used ) ) );
		if ( !$unused ) {
			return;
		}
		$dbw->startAtomic( __METHOD__ );
		$dbw->newDeleteQueryBuilder()
			->deleteFrom( 'constel_membership' )
			->where( [ 'cm_concept' => $unused ] )
			->caller( __METHOD__ )->execute();
		$dbw->newDeleteQueryBuilder()
			->deleteFrom( 'constel_concept' )
			->where( [ 'cc_id' => $unused ] )
			->caller( __METHOD__ )->execute();
		$dbw->endAtomic( __METHOD__ );
	}

	private function select( IReadableDatabase $db ): SelectQueryBuilder {
		return $db->newSelectQueryBuilder()
			->select( [ 'cc_id', 'cc_key' ] )
			->from( 'constel_concept' );
	}

	private function newRecord( stdClass $row ): ConceptRecord {
		return new ConceptRecord( (int)$row->cc_id, $row->cc_key );
	}

	private function primary(): IDatabase {
		return $this->dbProvider->getPrimaryDatabase( self::DOMAIN );
	}

	private function replica(): IReadableDatabase {
		return $this->dbProvider->getReplicaDatabase( self::DOMAIN );
	}
}
