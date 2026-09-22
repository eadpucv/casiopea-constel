<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use MediaWiki\Api\ApiQuery;
use MediaWiki\Api\ApiQueryBase;
use MediaWiki\Extension\CasiopeaConstel\Map\GraphBuilder;
use MediaWiki\User\ActorNormalization;
use Wikimedia\ParamValidator\ParamValidator;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * list=constelgraph — el mapa de conceptos (spec: ConceptMap): nodos con sus
 * frecuencias y aristas co_excerpt / overlap con su peso. Lectura pública:
 * los anónimos ven el mapa (spec: ReadOnlyForAnonymous).
 */
class ApiQueryConstelGraph extends ApiQueryBase {

	public function __construct(
		ApiQuery $query,
		string $moduleName,
		private readonly GraphBuilder $graphBuilder,
		private readonly ActorNormalization $actorNormalization,
		private readonly IConnectionProvider $dbProvider
	) {
		parent::__construct( $query, $moduleName, 'cg' );
	}

	public function execute() {
		$params = $this->extractRequestParams();
		$user = $this->getUser();
		$viewer = $user->isRegistered()
			? $this->actorNormalization->findActorId( $user, $this->dbProvider->getReplicaDatabase() )
			: null;
		if ( $params['scope'] === 'mine' && !$user->isNamed() ) {
			$this->dieWithError( 'apierror-constel-notnamed', 'notnamed' );
		}
		$onlyActor = $params['scope'] === 'mine' ? ( $viewer ?? -1 ) : null;

		$graph = $this->graphBuilder->build( $onlyActor, $params['pageid'], $viewer );
		$result = $this->getResult();
		$result->addValue( [ 'query', $this->getModuleName() ], 'nodes', $graph['nodes'] );
		$result->addValue( [ 'query', $this->getModuleName() ], 'links', $graph['links'] );
		$result->addIndexedTagName( [ 'query', $this->getModuleName(), 'nodes' ], 'node' );
		$result->addIndexedTagName( [ 'query', $this->getModuleName(), 'links' ], 'link' );
	}

	/** @inheritDoc */
	public function getCacheMode( $params ) {
		// "mine" y la marca de aporte dependen de quién mira.
		return 'anon-public-user-private';
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'scope' => [
				ParamValidator::PARAM_TYPE => [ 'everyone', 'mine' ],
				ParamValidator::PARAM_DEFAULT => 'everyone',
			],
			'pageid' => [ ParamValidator::PARAM_TYPE => 'integer' ],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=query&list=constelgraph' => 'apihelp-query+constelgraph-example-all',
			'action=query&list=constelgraph&cgscope=mine' => 'apihelp-query+constelgraph-example-mine',
		];
	}
}
