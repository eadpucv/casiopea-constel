<?php

namespace MediaWiki\Extension\CasiopeaConstel\Page;

use MediaWiki\Extension\CasiopeaConstel\Domain\CanonicalText;
use MediaWiki\Page\PageRecord;
use MediaWiki\Page\ParserOutputAccess;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\ObjectCache\WANObjectCache;

/**
 * Texto canónico de una revisión: la base sobre la que se miden las anclas
 * (docs/ARCHITECTURE.md § Anclaje).
 *
 * Se renderiza con opciones canónicas (no las del lector) y sin inyectar el
 * índice ni los enlaces de edición, para que el resultado dependa sólo de la
 * revisión. Como una revisión no cambia, el texto se cachea por revid.
 */
class RenderedTextProvider {

	/** Subir al cambiar CanonicalText o las opciones de render: invalida la caché. */
	private const VERSION = 1;

	public function __construct(
		private readonly ParserOutputAccess $parserOutputAccess,
		private readonly WANObjectCache $cache,
		private readonly CanonicalText $canonicalText
	) {
	}

	/**
	 * @return string|null null si la revisión no se pudo renderizar.
	 */
	public function forRevision( PageRecord $page, RevisionRecord $revision ): ?string {
		return $this->cache->getWithSetCallback(
			$this->cache->makeKey( 'constel-canonical-text', self::VERSION, $revision->getId() ),
			WANObjectCache::TTL_WEEK,
			function ( $old, &$ttl ) use ( $page, $revision ) {
				$text = $this->render( $page, $revision );
				if ( $text === null ) {
					$ttl = WANObjectCache::TTL_UNCACHEABLE;
				}
				return $text;
			}
		);
	}

	private function render( PageRecord $page, RevisionRecord $revision ): ?string {
		$options = ParserOptions::newFromAnon();
		$status = $this->parserOutputAccess->getParserOutput( $page, $options, $revision );
		if ( !$status->isOK() ) {
			return null;
		}
		$html = $status->getValue()->runOutputPipeline( $options, [
			'enableSectionEditLinks' => false,
			'injectTOC' => false,
			'unwrap' => true,
		] )->getContentHolderText();
		return $this->canonicalText->fromHtml( $html );
	}
}
