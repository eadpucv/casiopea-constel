<?php

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
use MediaWiki\MainConfigNames;
use MediaWiki\MediaWikiServices;

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
			$services->get( 'CasiopeaConstel.ConceptNormalizer' )
		);
	},
	'CasiopeaConstel.ExcerptStore' => static function ( MediaWikiServices $services ): ExcerptStore {
		return new ExcerptStore(
			$services->getConnectionProvider(),
			$services->get( 'CasiopeaConstel.ConceptStore' )
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
	'CasiopeaConstel.GraphBuilder' => static function ( MediaWikiServices $services ): GraphBuilder {
		return new GraphBuilder( $services->getConnectionProvider() );
	},
	'CasiopeaConstel.ModerationLog' => static function ( MediaWikiServices $services ): ModerationLog {
		return new ModerationLog(
			$services->getPageStore(),
			$services->getActorStore(),
			$services->getConnectionProvider()
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
