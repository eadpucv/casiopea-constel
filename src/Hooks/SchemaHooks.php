<?php

namespace MediaWiki\Extension\CasiopeaConstel\Hooks;

use MediaWiki\Installer\DatabaseUpdater;
use MediaWiki\Installer\Hook\LoadExtensionSchemaUpdatesHook;

/**
 * Instala el esquema de con§tel en su dominio virtual.
 *
 * Handler aparte y sin servicios: LoadExtensionSchemaUpdates corre durante la
 * instalación/actualización, cuando el contenedor de servicios no es fiable.
 */
class SchemaHooks implements LoadExtensionSchemaUpdatesHook {

	/**
	 * @param DatabaseUpdater $updater
	 */
	public function onLoadExtensionSchemaUpdates( $updater ) {
		$type = $updater->getDB()->getType();
		$dir = dirname( __DIR__, 2 ) . "/sql/$type";

		// Un solo archivo crea las seis tablas; constel_concept es la testigo.
		$updater->addExtensionUpdateOnVirtualDomain(
			[ 'virtual-constel', 'addTable', 'constel_concept', "$dir/tables-generated.sql", true ]
		);
		// 0.1.0: glosa por §.
		$updater->addExtensionUpdateOnVirtualDomain(
			[ 'virtual-constel', 'addField', 'constel_excerpt', 'ce_gloss',
				"$dir/patch-constel_excerpt-ce_gloss.sql", true ]
		);
		// 0.4.0: un solo desarrollo por tema. Primero se funden las notas
		// que ya hubiera por tema; después el índice pasa a único.
		$updater->addExtensionUpdateOnVirtualDomain(
			[ 'virtual-constel', [ self::class, 'mergeThemeNotes' ] ]
		);
		$updater->addExtensionUpdateOnVirtualDomain(
			[ 'virtual-constel', 'dropIndex', 'constel_note', 'cn_theme',
				"$dir/patch-constel_note-cn_theme_unique.sql", true ]
		);
	}

	/**
	 * Funde en una las notas de cada tema (en orden de creación, separadas
	 * por una línea en blanco), para que el índice único no falle. Sólo
	 * corre mientras exista el índice viejo.
	 */
	public static function mergeThemeNotes( DatabaseUpdater $updater ): void {
		$db = $updater->getDB();
		if ( !$db->tableExists( 'constel_note', __METHOD__ )
			|| !$db->indexExists( 'constel_note', 'cn_theme', __METHOD__ )
		) {
			return;
		}
		$themes = $db->newSelectQueryBuilder()
			->select( 'cn_theme' )
			->from( 'constel_note' )
			->groupBy( 'cn_theme' )
			->having( 'COUNT(*) > 1' )
			->caller( __METHOD__ )
			->fetchFieldValues();
		foreach ( $themes as $theme ) {
			$rows = $db->newSelectQueryBuilder()
				->select( [ 'cn_id', 'cn_text', 'cn_updated' ] )
				->from( 'constel_note' )
				->where( [ 'cn_theme' => (int)$theme ] )
				->orderBy( 'cn_id' )
				->caller( __METHOD__ )
				->fetchResultSet();
			$ids = [];
			$texts = [];
			$updated = '';
			foreach ( $rows as $row ) {
				$ids[] = (int)$row->cn_id;
				$texts[] = trim( $row->cn_text );
				$updated = max( $updated, $row->cn_updated );
			}
			$keep = array_shift( $ids );
			$db->newUpdateQueryBuilder()
				->update( 'constel_note' )
				->set( [ 'cn_text' => implode( "\n\n", array_filter( $texts, 'strlen' ) ), 'cn_updated' => $updated ] )
				->where( [ 'cn_id' => $keep ] )
				->caller( __METHOD__ )
				->execute();
			$db->newDeleteQueryBuilder()
				->deleteFrom( 'constel_note' )
				->where( [ 'cn_id' => $ids ] )
				->caller( __METHOD__ )
				->execute();
		}
		$updater->output( '...merged ' . count( $themes ) . " theme(s) with several notes.\n" );
	}
}
