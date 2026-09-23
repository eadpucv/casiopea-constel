<?php

namespace MediaWiki\Extension\CasiopeaConstel\Readers;

use MediaWiki\Config\Config;
use MediaWiki\Extension\CasiopeaConstel\Domain\ConceptNormalizer;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\MainConfigNames;
use MediaWiki\Permissions\Authority;
use MediaWiki\User\ActorStore;
use MediaWiki\User\UserFactory;
use MediaWiki\User\UserIdentity;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * Los lectores de con§tel (quienes tienen secciones o temas) y cómo se los
 * nombra en la interfaz: su nombre real si lo definieron en sus preferencias
 * y el sitio no lo oculta ($wgHiddenPrefs), si no su nombre de usuario.
 *
 * Sólo lectores de con§tel, no todos los usuarios de la wiki: es la lista
 * que tiene sentido para filtrar el mapa, y expone menos. Los usuarios
 * ocultos (hideuser) quedan fuera salvo para quien puede verlos.
 */
class ReaderDirectory {

	public function __construct(
		private readonly IConnectionProvider $dbProvider,
		private readonly ActorStore $actorStore,
		private readonly UserFactory $userFactory,
		private readonly ConceptNormalizer $normalizer,
		private readonly Config $config
	) {
	}

	/**
	 * Nombre visible: nombre real o, si no hay, nombre de usuario.
	 */
	public function displayName( UserIdentity $user ): string {
		if ( in_array( 'realname', $this->config->get( MainConfigNames::HiddenPrefs ), true ) ) {
			return $user->getName();
		}
		$real = trim( $this->userFactory->newFromUserIdentity( $user )->getRealName() );
		return $real !== '' ? $real : $user->getName();
	}

	/**
	 * Lectores cuyo nombre real o de usuario contiene lo escrito (sin
	 * distinguir tildes ni mayúsculas); los que coinciden al inicio, primero.
	 *
	 * @return array<int,array{name:string,display:string}>
	 */
	public function search( string $typed, Authority $viewer, int $limit ): array {
		$needle = $this->normalizer->fold( $typed );
		$hits = [];
		foreach ( $this->readers( $viewer ) as $reader ) {
			$display = $this->displayName( $reader );
			$scores = array_filter( array_map(
				static fn ( $hay ) => $needle === '' ? 0 : mb_strpos( $hay, $needle ),
				[ $this->normalizer->fold( $display ), $this->normalizer->fold( $reader->getName() ) ]
			), static fn ( $pos ) => $pos !== false );
			if ( $scores ) {
				$hits[] = [
					'rank' => min( $scores ) === 0 ? 0 : 1,
					'name' => $reader->getName(),
					'display' => $display,
				];
			}
		}
		usort( $hits, static fn ( $a, $b ) => [ $a['rank'], $a['display'] ] <=> [ $b['rank'], $b['display'] ] );
		return array_map(
			static fn ( $h ) => [ 'name' => $h['name'], 'display' => $h['display'] ],
			array_slice( $hits, 0, $limit )
		);
	}

	/**
	 * Nombres visibles de usuarios dados por nombre (existan o no como lectores).
	 *
	 * @param string[] $names
	 * @return array<int,array{name:string,display:string}>
	 */
	public function describe( array $names, Authority $viewer ): array {
		$out = [];
		foreach ( $names as $name ) {
			$user = $this->userFactory->newFromName( $name );
			if ( !$user || !$user->isRegistered() ) {
				continue;
			}
			$hidden = $user->isHidden() && !$viewer->isAllowed( 'hideuser' );
			$out[] = [
				'name' => $user->getName(),
				'display' => $hidden ? $user->getName() : $this->displayName( $user ),
			];
		}
		return $out;
	}

	/**
	 * @return UserIdentity[] quienes tienen al menos una sección o un tema
	 */
	private function readers( Authority $viewer ): array {
		$db = $this->dbProvider->getReplicaDatabase( ConceptStore::DOMAIN );
		$actors = array_unique( array_merge(
			$db->newSelectQueryBuilder()->select( 'ce_actor' )->distinct()->from( 'constel_excerpt' )
				->caller( __METHOD__ )->fetchFieldValues(),
			$db->newSelectQueryBuilder()->select( 'ct_actor' )->distinct()->from( 'constel_theme' )
				->caller( __METHOD__ )->fetchFieldValues()
		) );
		$core = $this->dbProvider->getReplicaDatabase();
		$readers = [];
		foreach ( $actors as $actorId ) {
			$identity = $this->actorStore->getActorById( (int)$actorId, $core );
			if ( !$identity ) {
				continue;
			}
			$user = $this->userFactory->newFromUserIdentity( $identity );
			if ( $user->isHidden() && !$viewer->isAllowed( 'hideuser' ) ) {
				continue;
			}
			$readers[] = $identity;
		}
		return $readers;
	}
}
