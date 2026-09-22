<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use MediaWiki\Api\ApiQuery;
use MediaWiki\Api\ApiQueryBase;
use MediaWiki\Extension\CasiopeaConstel\Map\GraphBuilder;
use MediaWiki\User\ActorStore;
use Wikimedia\ParamValidator\ParamValidator;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * list=constelgraph — el mapa de conceptos (spec: ConceptMap): nodos con sus
 * frecuencias y aristas co_excerpt / overlap / co_page con su peso.
 * Filtros por lectores y por páginas; vacío = todos (spec:
 * ReaderAndPageFilters). Lectura pública: los anónimos ven el mapa
 * (spec: ReadOnlyForAnonymous).
 */
class ApiQueryConstelGraph extends ApiQueryBase {

	public function __construct(
		ApiQuery $query,
		string $moduleName,
		private readonly GraphBuilder $graphBuilder,
		private readonly ActorStore $actorStore,
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

		$graph = $this->graphBuilder->build( $actors, $params['pageids'] ?: null, $viewer );
		$result = $this->getResult();
		$path = [ 'query', $this->getModuleName() ];
		$result->addValue( $path, 'nodes', $graph['nodes'] );
		$result->addValue( $path, 'links', $graph['links'] );
		$result->addIndexedTagName( [ ...$path, 'nodes' ], 'node' );
		$result->addIndexedTagName( [ ...$path, 'links' ], 'link' );
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
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=query&list=constelgraph' => 'apihelp-query+constelgraph-example-all',
			'action=query&list=constelgraph&cgusers=Example' => 'apihelp-query+constelgraph-example-users',
		];
	}
}
