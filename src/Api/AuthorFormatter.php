<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use MediaWiki\Permissions\Authority;
use MediaWiki\User\ActorStore;
use MediaWiki\User\UserFactory;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * Nombre visible del autor de un §, tema o nota (spec: ReadingIsPublicData):
 * se muestra el nombre de usuario, salvo que el core lo tenga suprimido
 * (hideuser) y quien mira no pueda verlo.
 */
class AuthorFormatter {

	/** @var array<int,array{name:?string,hidden:bool}> */
	private array $cache = [];

	public function __construct(
		private readonly ActorStore $actorStore,
		private readonly UserFactory $userFactory,
		private readonly IConnectionProvider $dbProvider,
		private readonly Authority $viewer
	) {
	}

	/**
	 * @return array{name:?string,hidden:bool}
	 */
	public function format( int $actorId ): array {
		if ( !isset( $this->cache[$actorId] ) ) {
			$identity = $this->actorStore->getActorById( $actorId, $this->dbProvider->getReplicaDatabase() );
			$hidden = $identity && $this->userFactory->newFromUserIdentity( $identity )->isHidden();
			$visible = $identity && ( !$hidden || $this->viewer->isAllowed( 'hideuser' ) );
			$this->cache[$actorId] = [
				'name' => $visible ? $identity->getName() : null,
				'hidden' => $hidden,
			];
		}
		return $this->cache[$actorId];
	}
}
