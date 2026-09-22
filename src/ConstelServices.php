<?php

namespace MediaWiki\Extension\CasiopeaConstel;

use MediaWiki\Extension\CasiopeaConstel\Domain\AnchorLocator;
use MediaWiki\Extension\CasiopeaConstel\Domain\CanonicalText;
use MediaWiki\Extension\CasiopeaConstel\Domain\ConceptNormalizer;
use MediaWiki\Extension\CasiopeaConstel\Export\ExportBuilder;
use MediaWiki\Extension\CasiopeaConstel\Map\GraphBuilder;
use MediaWiki\Extension\CasiopeaConstel\Moderation\ModerationLog;
use MediaWiki\Extension\CasiopeaConstel\Page\RenderedTextProvider;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ThemeStore;
use MediaWiki\MediaWikiServices;
use Psr\Container\ContainerInterface;

/**
 * Acceso tipado a los servicios de la extensión. Para puntos de entrada que
 * no reciben inyección (scripts de mantenimiento, tests); el resto recibe
 * los servicios por constructor desde extension.json.
 */
class ConstelServices {

	public function __construct(
		private readonly ContainerInterface $services
	) {
	}

	public static function wrap( ?ContainerInterface $services = null ): self {
		return new self( $services ?? MediaWikiServices::getInstance() );
	}

	public function getAnchorLocator(): AnchorLocator {
		return $this->services->get( 'CasiopeaConstel.AnchorLocator' );
	}

	public function getCanonicalText(): CanonicalText {
		return $this->services->get( 'CasiopeaConstel.CanonicalText' );
	}

	public function getConceptNormalizer(): ConceptNormalizer {
		return $this->services->get( 'CasiopeaConstel.ConceptNormalizer' );
	}

	public function getConceptStore(): ConceptStore {
		return $this->services->get( 'CasiopeaConstel.ConceptStore' );
	}

	public function getExcerptStore(): ExcerptStore {
		return $this->services->get( 'CasiopeaConstel.ExcerptStore' );
	}

	public function getExportBuilder(): ExportBuilder {
		return $this->services->get( 'CasiopeaConstel.ExportBuilder' );
	}

	public function getGraphBuilder(): GraphBuilder {
		return $this->services->get( 'CasiopeaConstel.GraphBuilder' );
	}

	public function getModerationLog(): ModerationLog {
		return $this->services->get( 'CasiopeaConstel.ModerationLog' );
	}

	public function getRenderedTextProvider(): RenderedTextProvider {
		return $this->services->get( 'CasiopeaConstel.RenderedTextProvider' );
	}

	public function getThemeStore(): ThemeStore {
		return $this->services->get( 'CasiopeaConstel.ThemeStore' );
	}
}
