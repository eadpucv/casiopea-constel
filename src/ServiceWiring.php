<?php

use MediaWiki\Extension\CasiopeaConstel\Domain\AnchorLocator;
use MediaWiki\Extension\CasiopeaConstel\Domain\CanonicalText;
use MediaWiki\Extension\CasiopeaConstel\Domain\ConceptNormalizer;
use MediaWiki\Extension\CasiopeaConstel\Export\ExportBuilder;
use MediaWiki\Extension\CasiopeaConstel\Map\GraphBuilder;
use MediaWiki\Extension\CasiopeaConstel\Map\GraphVersion;
use MediaWiki\Extension\CasiopeaConstel\Moderation\ModerationLog;
use MediaWiki\Extension\CasiopeaConstel\Page\RenderedTextProvider;
use MediaWiki\Extension\CasiopeaConstel\Readers\ReaderDirectory;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ThemeStore;
use MediaWiki\MainConfigNames;
use MediaWiki\MediaWikiServices;
use Wikimedia\ObjectCache\WANObjectCache;

/** @phpcs-require-sorted-array */
return [
	'CasiopeaConstel.AnchorLocator' => static function ( MediaWikiServices $services ): AnchorLocator {
		return new AnchorLocator(
			$services->getMainConfig()->get( 'ConstelAnchorContextLength' )
		);
	},
	'CasiopeaConstel.CanonicalText' => static function (): CanonicalText {
		return new CanonicalText();
	},
	'CasiopeaConstel.ConceptNormalizer' => static function ( MediaWikiServices $services ): ConceptNormalizer {
		return new ConceptNormalizer(
			$services->getMainConfig()->get( MainConfigNames::CapitalLinks )
		);
	},
	'CasiopeaConstel.ConceptStore' => static function ( MediaWikiServices $services ): ConceptStore {
		return new ConceptStore(
			$services->getConnectionProvider(),
			$services->get( 'CasiopeaConstel.ConceptNormalizer' ),
			$services->get( 'CasiopeaConstel.GraphVersion' )
		);
	},
	'CasiopeaConstel.ExcerptStore' => static function ( MediaWikiServices $services ): ExcerptStore {
		return new ExcerptStore(
			$services->getConnectionProvider(),
			$services->get( 'CasiopeaConstel.ConceptStore' ),
			$services->get( 'CasiopeaConstel.GraphVersion' )
		);
	},
	'CasiopeaConstel.ExportBuilder' => static function ( MediaWikiServices $services ): ExportBuilder {
		return new ExportBuilder(
			$services->get( 'CasiopeaConstel.ExcerptStore' ),
			$services->get( 'CasiopeaConstel.ConceptStore' ),
			$services->get( 'CasiopeaConstel.ThemeStore' ),
			$services->getPageStore(),
			$services->getRevisionLookup(),
			$services->get( 'CasiopeaConstel.RenderedTextProvider' ),
			$services->get( 'CasiopeaConstel.AnchorLocator' ),
			$services->getTitleFormatter()
		);
	},
	// La caché del grafo: la principal de la wiki o, si ConstelGraphCache
	// nombra un tipo de $wgObjectCaches (p. ej. CACHE_DB), una propia.
	'CasiopeaConstel.GraphBuilder' => static function ( MediaWikiServices $services ): GraphBuilder {
		return new GraphBuilder(
			$services->getConnectionProvider(),
			$services->get( 'CasiopeaConstel.GraphCache' ),
			$services->get( 'CasiopeaConstel.GraphVersion' ),
			(int)$services->getMainConfig()->get( 'ConstelOverlapMaxPerPage' ),
			(int)$services->getMainConfig()->get( 'ConstelMapMaxNodes' )
		);
	},
	'CasiopeaConstel.GraphCache' => static function ( MediaWikiServices $services ): WANObjectCache {
		$type = $services->getMainConfig()->get( 'ConstelGraphCache' );
		if ( $type === null ) {
			return $services->getMainWANObjectCache();
		}
		return new WANObjectCache( [ 'cache' => $services->getObjectCacheFactory()->getInstance( $type ) ] );
	},
	'CasiopeaConstel.GraphVersion' => static function ( MediaWikiServices $services ): GraphVersion {
		return new GraphVersion( $services->get( 'CasiopeaConstel.GraphCache' ) );
	},
	'CasiopeaConstel.ModerationLog' => static function ( MediaWikiServices $services ): ModerationLog {
		return new ModerationLog(
			$services->getPageStore(),
			$services->getActorStore(),
			$services->getConnectionProvider()
		);
	},
	'CasiopeaConstel.ReaderDirectory' => static function ( MediaWikiServices $services ): ReaderDirectory {
		return new ReaderDirectory(
			$services->getConnectionProvider(),
			$services->getActorStore(),
			$services->getUserFactory(),
			$services->get( 'CasiopeaConstel.ConceptNormalizer' ),
			$services->getMainConfig()
		);
	},
	'CasiopeaConstel.RenderedTextProvider' => static function ( MediaWikiServices $services ): RenderedTextProvider {
		return new RenderedTextProvider(
			$services->getParserOutputAccess(),
			$services->getMainWANObjectCache(),
			$services->get( 'CasiopeaConstel.CanonicalText' )
		);
	},
	'CasiopeaConstel.ThemeStore' => static function ( MediaWikiServices $services ): ThemeStore {
		return new ThemeStore( $services->getConnectionProvider() );
	},
];
