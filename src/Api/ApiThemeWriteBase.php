<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ThemeRecord;
use MediaWiki\Extension\CasiopeaConstel\Store\ThemeStore;
use MediaWiki\User\ActorNormalization;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * Base de los módulos de escritura sobre temas y notas: los temas son
 * personales, así que sólo su dueño los modifica (spec: ThemesPanel.OthersReadOnly).
 */
abstract class ApiThemeWriteBase extends ApiConstelWriteBase {

	public function __construct(
		ApiMain $main,
		string $action,
		ActorNormalization $actorNormalization,
		IConnectionProvider $dbProvider,
		protected readonly ConceptStore $concepts,
		protected readonly ThemeStore $themes
	) {
		parent::__construct( $main, $action, $actorNormalization, $dbProvider );
	}

	protected function requireOwnTheme( ?int $themeId, int $actorId ): ThemeRecord {
		$theme = $themeId === null ? null : $this->themes->get( $themeId );
		if ( !$theme ) {
			$this->dieWithError( [ 'apierror-constel-notheme', $themeId ?? 0 ], 'notheme' );
		}
		if ( $theme->actorId !== $actorId ) {
			$this->dieWithError( 'apierror-constel-notyours', 'notyours' );
		}
		return $theme;
	}

	/**
	 * Valida un texto obligatorio con largo máximo configurable.
	 */
	protected function requireText( ?string $text, string $param, string $maxConfig ): string {
		$text = trim( $text ?? '' );
		if ( $text === '' ) {
			$this->dieWithError( [ 'apierror-missingparam', $param ], "missing$param" );
		}
		$max = $this->getConfig()->get( $maxConfig );
		if ( mb_strlen( $text ) > $max ) {
			$this->dieWithError( [ 'apierror-constel-toolong', $max ], 'toolong' );
		}
		return $text;
	}
}
