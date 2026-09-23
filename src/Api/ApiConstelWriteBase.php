<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\User\ActorNormalization;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * Base de los módulos de escritura de con§tel.
 *
 * El servidor es la autoridad (spec: WritesAreTokenProtected): todo módulo es
 * POST, exige token CSRF y re-comprueba identidad, derecho y bloqueo antes de
 * tocar datos, aunque el cliente ya haya ocultado la afordancia.
 */
abstract class ApiConstelWriteBase extends ApiBase {

	public const RIGHT_ANNOTATE = 'constel-annotate';
	public const RIGHT_MODERATE = 'constel-moderate';

	public function __construct(
		ApiMain $main,
		string $action,
		protected readonly ActorNormalization $actorNormalization,
		protected readonly IConnectionProvider $dbProvider
	) {
		parent::__construct( $main, $action );
	}

	/** @inheritDoc */
	public function mustBePosted() {
		return true;
	}

	/** @inheritDoc */
	public function isWriteMode() {
		return true;
	}

	/** @inheritDoc */
	public function needsToken() {
		return 'csrf';
	}

	/**
	 * Exige un lector habilitado: cuenta registrada (no anónimo ni temporal),
	 * con el derecho y sin bloqueo sitewide. Los bloqueos parciales sobre una
	 * página se comprueban aparte (checkTitleUserPermissions).
	 *
	 * @return int actor id del lector
	 */
	protected function requireAnnotator(): int {
		if ( !$this->getUser()->isNamed() ) {
			$this->dieWithError( 'apierror-constel-notnamed', 'notnamed' );
		}
		$this->checkUserRightsAny( self::RIGHT_ANNOTATE );
		return $this->requireReader();
	}

	/**
	 * Exige un lector, con o sin el derecho de anotar: cuenta registrada y sin
	 * bloqueo sitewide. Basta para BORRAR lo propio (y, con constel-moderate,
	 * lo ajeno): quien pierde el derecho no queda atrapado con su lectura
	 * pública y firmada (spec: RightToWithdraw).
	 *
	 * @return int actor id del lector
	 */
	protected function requireReader(): int {
		$user = $this->getUser();
		if ( !$user->isNamed() ) {
			$this->dieWithError( 'apierror-constel-notnamed', 'notnamed' );
		}
		$block = $user->getBlock();
		if ( $block && $block->isSitewide() ) {
			$this->dieBlocked( $block );
		}
		return $this->actorNormalization->acquireActorId( $user, $this->dbProvider->getPrimaryDatabase() );
	}

	/**
	 * Exige un moderador del vocabulario: cuenta registrada, con
	 * constel-moderate y sin bloqueo sitewide.
	 */
	protected function requireModerator(): void {
		$user = $this->getUser();
		if ( !$user->isNamed() ) {
			$this->dieWithError( 'apierror-constel-notnamed', 'notnamed' );
		}
		$this->checkUserRightsAny( self::RIGHT_MODERATE );
		$block = $user->getBlock();
		if ( $block && $block->isSitewide() ) {
			$this->dieBlocked( $block );
		}
	}
}
