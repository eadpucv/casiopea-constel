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
	 * Carga de una vez los autores que se van a formatear: dos consultas
	 * (los actores y cuáles están ocultos) en vez de tres o más por autor.
	 *
	 * @param int[] $actorIds
	 */
	public function preload( array $actorIds ): void {
		$need = array_values( array_diff( array_unique( $actorIds ), array_keys( $this->cache ) ) );
		if ( !$need ) {
			return;
		}
		$db = $this->dbProvider->getReplicaDatabase();
		$hidden = [];
		foreach ( $this->actorStore->newSelectQueryBuilder( $db )
			->where( [ 'actor_id' => $need ] )
			->hidden( true )
			->fetchUserIdentities() as $identity
		) {
			$hidden[$this->actorStore->findActorId( $identity, $db )] = true;
		}
		$seesHidden = $this->viewer->isAllowed( 'hideuser' );
		foreach ( $this->actorStore->newSelectQueryBuilder( $db )
			->where( [ 'actor_id' => $need ] )
			->fetchUserIdentities() as $identity
		) {
			$id = $this->actorStore->findActorId( $identity, $db );
			$isHidden = isset( $hidden[$id] );
			$this->cache[$id] = [
				'name' => !$isHidden || $seesHidden ? $identity->getName() : null,
				'hidden' => $isHidden,
			];
		}
		// Actores que ya no existen: sin nombre y sin ocultar, como antes.
		foreach ( $need as $id ) {
			$this->cache[$id] ??= [ 'name' => null, 'hidden' => false ];
		}
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
