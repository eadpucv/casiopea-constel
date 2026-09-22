<?php

namespace MediaWiki\Extension\CasiopeaConstel\Hooks;

use MediaWiki\Config\Config;
use MediaWiki\Extension\CasiopeaConstel\Domain\CanonicalText;
use MediaWiki\ResourceLoader\Context;

/**
 * Configuración que el cliente necesita para medir igual que el servidor.
 */
class ResourceLoaderHooks {

	/**
	 * packageFiles callback de ext.constel.reader (config.json).
	 */
	public static function getReaderConfig( Context $context, Config $config ): array {
		return [
			// La MISMA lista de exclusión que usa el servidor (spec: texto canónico).
			'exclusions' => CanonicalText::exclusions(),
			'selectionMinLength' => $config->get( 'ConstelSelectionMinLength' ),
			'selectionMaxLength' => $config->get( 'ConstelSelectionMaxLength' ),
			'conceptMaxLength' => $config->get( 'ConstelConceptMaxLength' ),
			'anchorContextLength' => $config->get( 'ConstelAnchorContextLength' ),
		];
	}
}
