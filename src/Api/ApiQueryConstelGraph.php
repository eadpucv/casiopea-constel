<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use MediaWiki\Api\ApiQuery;
use MediaWiki\Api\ApiQueryBase;
use MediaWiki\Api\ApiResult;
use MediaWiki\Extension\CasiopeaConstel\Map\GraphBuilder;
use MediaWiki\User\ActorStore;
use MediaWiki\User\UserFactory;
use Wikimedia\ParamValidator\ParamValidator;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * list=constelgraph — el mapa de conceptos (spec: ConceptMap): nodos con sus
 * frecuencias y aristas co_excerpt / overlap / co_page con su peso.
 * Filtros por lectores y por páginas; vacío = todos (spec:
 * ReaderAndPageFilters). Lectura pública: los anónimos ven el mapa
 * (spec: ReadOnlyForAnonymous).
 *
 * cgkinds pide sólo algunos grados de arista (el cliente sólo pide los que
 * tienen fuerza). cgcompact entrega las aristas empaquetadas en tramos por
 * grado (ver GraphBuilder): unas seis veces menos JSON, y sin que ApiResult
 * valide una a una decenas de miles de aristas.
 */
class ApiQueryConstelGraph extends ApiQueryBase {

	public function __construct(
		ApiQuery $query,
		string $moduleName,
		private readonly GraphBuilder $graphBuilder,
		private readonly ActorStore $actorStore,
		private readonly UserFactory $userFactory,
		private readonly IConnectionProvider $dbProvider
	) {
		parent::__construct( $query, $moduleName, 'cg' );
	}

	public function execute() {
		$params = $this->extractRequestParams();
		$db = $this->dbProvider->getReplicaDatabase();
		$user = $this->getUser();
		$viewer = $user->isRegistered() ? $this->actorStore->findActorId( $user, $db ) : null;

		$actors = null;
		if ( $params['users'] ) {
			// Lectores sin actor (nunca anotaron nada) no aportan §§.
			$actors = array_values( array_filter( array_map(
				fn ( $name ) => $this->actorStore->findActorIdByName( $name, $db ),
				$params['users']
			) ) ) ?: [ -1 ];
		}

		$pages = $params['pageids'] ?: null;
		$kinds = $params['kinds'];
		$result = $this->getResult();
		$path = [ 'query', $this->getModuleName() ];
		if ( $params['compact'] ) {
			$graph = $this->graphBuilder->buildPacked( $actors, $pages, $viewer, $kinds );
			$result->addValue( $path, 'nodes', $this->withReaders( $graph['nodes'] ) );
			// Enteros y cadenas de la base: nada que validar ni normalizar.
			$result->addValue( $path, 'runs', $graph['runs'], ApiResult::NO_VALIDATE );
			$result->addValue( $path, 'total', $graph['total'] );
			$result->addIndexedTagName( [ ...$path, 'nodes' ], 'node' );
			return;
		}
		$graph = $this->graphBuilder->build( $actors, $pages, $viewer, $kinds );
		$result->addValue( $path, 'nodes', $this->withReaders( $graph['nodes'] ) );
		$result->addValue( $path, 'links', $graph['links'], ApiResult::NO_VALIDATE );
		$result->addValue( $path, 'total', $graph['total'] );
		$result->addIndexedTagName( [ ...$path, 'nodes' ], 'node' );
		$result->addIndexedTagName( [ ...$path, 'links' ], 'link' );
	}

	/**
	 * Con varios lectores filtrados, cada nodo dice cuántos §§ aporta cada uno
	 * (`readers`: nombre de usuario => cantidad). Los usuarios ocultos, para
	 * quien no puede verlos, no aparecen: su aporte sigue contando en los
	 * totales del concepto pero no se nombra (spec: ReadingIsPublicData).
	 *
	 * @param array[] $nodes con `by` (actor => cantidad) cuando hay varios lectores
	 * @return array[]
	 */
	private function withReaders( array $nodes ): array {
		$actorIds = [];
		foreach ( $nodes as $node ) {
			foreach ( array_keys( $node['by'] ?? [] ) as $actorId ) {
				$actorIds[$actorId] = true;
			}
		}
		if ( !$actorIds ) {
			return $nodes;
		}
		$authors = new AuthorFormatter(
			$this->actorStore, $this->userFactory, $this->dbProvider, $this->getAuthority()
		);
		$authors->preload( array_keys( $actorIds ) );
		foreach ( $nodes as &$node ) {
			if ( !isset( $node['by'] ) ) {
				continue;
			}
			$readers = [];
			foreach ( $node['by'] as $actorId => $count ) {
				$name = $authors->format( $actorId )['name'];
				if ( $name !== null ) {
					$readers[$name] = $count;
				}
			}
			ApiResult::setArrayType( $readers, 'assoc' );
			$node['readers'] = $readers;
			unset( $node['by'] );
		}
		return $nodes;
	}

	/** @inheritDoc */
	public function getCacheMode( $params ) {
		// La marca de aporte ("mine") depende de quién mira.
		return 'anon-public-user-private';
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'users' => [
				ParamValidator::PARAM_TYPE => 'user',
				ParamValidator::PARAM_ISMULTI => true,
			],
			'pageids' => [
				ParamValidator::PARAM_TYPE => 'integer',
				ParamValidator::PARAM_ISMULTI => true,
			],
			'kinds' => [
				ParamValidator::PARAM_TYPE => GraphBuilder::KINDS,
				ParamValidator::PARAM_ISMULTI => true,
				ParamValidator::PARAM_DEFAULT => implode( '|', GraphBuilder::KINDS ),
			],
			'compact' => [
				ParamValidator::PARAM_TYPE => 'boolean',
				ParamValidator::PARAM_DEFAULT => false,
			],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=query&list=constelgraph' => 'apihelp-query+constelgraph-example-all',
			'action=query&list=constelgraph&cgusers=Example' => 'apihelp-query+constelgraph-example-users',
			'action=query&list=constelgraph&cgkinds=co_excerpt|overlap&cgcompact=1' =>
				'apihelp-query+constelgraph-example-compact',
		];
	}
}
