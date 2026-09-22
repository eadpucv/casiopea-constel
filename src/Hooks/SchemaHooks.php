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
	}
}
