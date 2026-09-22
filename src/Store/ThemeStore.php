<?php

namespace MediaWiki\Extension\CasiopeaConstel\Store;

use stdClass;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IDatabase;
use Wikimedia\Rdbms\IReadableDatabase;
use Wikimedia\Rdbms\SelectQueryBuilder;

/**
 * Temas personales, pertenencias concepto→tema por lector y notas de
 * desarrollo (spec: Theme, ThemeMembership, ThemeNote).
 *
 * No comprueba permisos: eso es de la API. Sí garantiza las reglas de datos:
 * un concepto está en a lo sumo un tema de cada lector
 * (OneThemePerConceptPerReader, por clave primaria), y borrar un tema
 * desagrupa sus conceptos y borra sus notas (ReaderDeletesTheme).
 */
class ThemeStore {

	public function __construct(
		private readonly IConnectionProvider $dbProvider
	) {
	}

	public function create( int $actorId, string $label ): ThemeRecord {
		$dbw = $this->primary();
		$now = $dbw->timestamp();
		$dbw->newInsertQueryBuilder()
			->insertInto( 'constel_theme' )
			->row( [ 'ct_actor' => $actorId, 'ct_label' => $label, 'ct_created' => $now ] )
			->caller( __METHOD__ )->execute();
		return new ThemeRecord( $dbw->insertId(), $actorId, $label, $now );
	}

	public function get( int $id ): ?ThemeRecord {
		$row = $this->selectThemes( $this->replica() )
			->where( [ 'ct_id' => $id ] )
			->caller( __METHOD__ )->fetchRow();
		return $row ? $this->newTheme( $row ) : null;
	}

	/**
	 * @return ThemeRecord[]
	 */
	public function listForActor( int $actorId ): array {
		$res = $this->selectThemes( $this->replica() )
			->where( [ 'ct_actor' => $actorId ] )
			->orderBy( 'ct_id' )
			->caller( __METHOD__ )->fetchResultSet();
		return array_map( [ $this, 'newTheme' ], iterator_to_array( $res ) );
	}

	public function rename( int $themeId, string $label ): void {
		$this->primary()->newUpdateQueryBuilder()
			->update( 'constel_theme' )
			->set( [ 'ct_label' => $label ] )
			->where( [ 'ct_id' => $themeId ] )
			->caller( __METHOD__ )->execute();
	}

	public function delete( int $themeId ): void {
		$dbw = $this->primary();
		$dbw->startAtomic( __METHOD__ );
		$cascade = [ 'constel_membership' => 'cm_theme', 'constel_note' => 'cn_theme', 'constel_theme' => 'ct_id' ];
		foreach ( $cascade as $table => $field ) {
			$dbw->newDeleteQueryBuilder()
				->deleteFrom( $table )
				->where( [ $field => $themeId ] )
				->caller( __METHOD__ )->execute();
		}
		$dbw->endAtomic( __METHOD__ );
	}

	/**
	 * Pone el concepto en el tema; si el lector ya lo tenía en otro, lo mueve
	 * (spec: ReaderGroupsConcept). $actorId debe ser el dueño del tema.
	 */
	public function group( int $actorId, int $conceptId, int $themeId ): void {
		$this->primary()->newReplaceQueryBuilder()
			->replaceInto( 'constel_membership' )
			->uniqueIndexFields( [ 'cm_actor', 'cm_concept' ] )
			->row( [ 'cm_actor' => $actorId, 'cm_concept' => $conceptId, 'cm_theme' => $themeId ] )
			->caller( __METHOD__ )->execute();
	}

	public function ungroup( int $actorId, int $conceptId ): void {
		$this->primary()->newDeleteQueryBuilder()
			->deleteFrom( 'constel_membership' )
			->where( [ 'cm_actor' => $actorId, 'cm_concept' => $conceptId ] )
			->caller( __METHOD__ )->execute();
	}

	/**
	 * @return int[] Conceptos del tema.
	 */
	public function conceptIds( int $themeId ): array {
		return array_map( 'intval', $this->replica()->newSelectQueryBuilder()
			->select( 'cm_concept' )
			->from( 'constel_membership' )
			->where( [ 'cm_theme' => $themeId ] )
			->caller( __METHOD__ )->fetchFieldValues() );
	}

	/**
	 * Los temas (de cualquier lector) que contienen el concepto.
	 *
	 * @return ThemeRecord[]
	 */
	public function listByConcept( int $conceptId ): array {
		$res = $this->selectThemes( $this->replica() )
			->join( 'constel_membership', null, 'cm_theme = ct_id' )
			->where( [ 'cm_concept' => $conceptId ] )
			->orderBy( 'ct_id' )
			->caller( __METHOD__ )->fetchResultSet();
		return array_map( [ $this, 'newTheme' ], iterator_to_array( $res ) );
	}

	/**
	 * @return int|null El tema donde el lector tiene al concepto, si lo tiene.
	 */
	public function themeOf( int $actorId, int $conceptId ): ?int {
		$id = $this->replica()->newSelectQueryBuilder()
			->select( 'cm_theme' )
			->from( 'constel_membership' )
			->where( [ 'cm_actor' => $actorId, 'cm_concept' => $conceptId ] )
			->caller( __METHOD__ )->fetchField();
		return $id === false ? null : (int)$id;
	}

	public function addNote( int $themeId, string $text ): NoteRecord {
		$dbw = $this->primary();
		$now = $dbw->timestamp();
		$dbw->newInsertQueryBuilder()
			->insertInto( 'constel_note' )
			->row( [ 'cn_theme' => $themeId, 'cn_text' => $text, 'cn_updated' => $now ] )
			->caller( __METHOD__ )->execute();
		return new NoteRecord( $dbw->insertId(), $themeId, $text, $now );
	}

	public function getNote( int $noteId ): ?NoteRecord {
		$row = $this->selectNotes( $this->replica() )
			->where( [ 'cn_id' => $noteId ] )
			->caller( __METHOD__ )->fetchRow();
		return $row ? $this->newNote( $row ) : null;
	}

	/**
	 * @return NoteRecord[]
	 */
	public function listNotes( int $themeId ): array {
		$res = $this->selectNotes( $this->replica() )
			->where( [ 'cn_theme' => $themeId ] )
			->orderBy( 'cn_id' )
			->caller( __METHOD__ )->fetchResultSet();
		return array_map( [ $this, 'newNote' ], iterator_to_array( $res ) );
	}

	public function editNote( int $noteId, string $text ): void {
		$dbw = $this->primary();
		$dbw->newUpdateQueryBuilder()
			->update( 'constel_note' )
			->set( [ 'cn_text' => $text, 'cn_updated' => $dbw->timestamp() ] )
			->where( [ 'cn_id' => $noteId ] )
			->caller( __METHOD__ )->execute();
	}

	public function deleteNote( int $noteId ): void {
		$this->primary()->newDeleteQueryBuilder()
			->deleteFrom( 'constel_note' )
			->where( [ 'cn_id' => $noteId ] )
			->caller( __METHOD__ )->execute();
	}

	private function selectThemes( IReadableDatabase $db ): SelectQueryBuilder {
		return $db->newSelectQueryBuilder()
			->select( [ 'ct_id', 'ct_actor', 'ct_label', 'ct_created' ] )
			->from( 'constel_theme' );
	}

	private function selectNotes( IReadableDatabase $db ): SelectQueryBuilder {
		return $db->newSelectQueryBuilder()
			->select( [ 'cn_id', 'cn_theme', 'cn_text', 'cn_updated' ] )
			->from( 'constel_note' );
	}

	private function newTheme( stdClass $row ): ThemeRecord {
		return new ThemeRecord( (int)$row->ct_id, (int)$row->ct_actor, $row->ct_label, $row->ct_created );
	}

	private function newNote( stdClass $row ): NoteRecord {
		return new NoteRecord( (int)$row->cn_id, (int)$row->cn_theme, $row->cn_text, $row->cn_updated );
	}

	private function primary(): IDatabase {
		return $this->dbProvider->getPrimaryDatabase( ConceptStore::DOMAIN );
	}

	private function replica(): IReadableDatabase {
		return $this->dbProvider->getReplicaDatabase( ConceptStore::DOMAIN );
	}
}
