<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use MediaWiki\Api\ApiQuery;
use MediaWiki\Api\ApiQueryBase;
use MediaWiki\Api\ApiResult;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ThemeRecord;
use MediaWiki\Extension\CasiopeaConstel\Store\ThemeStore;
use MediaWiki\User\ActorStore;
use MediaWiki\User\UserFactory;
use Wikimedia\ParamValidator\ParamValidator;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * list=constelthemes — temas de un lector con sus conceptos y notas. Los
 * temas son personales pero visibles para todos (spec: ThemesPanel).
 */
class ApiQueryConstelThemes extends ApiQueryBase {

	public function __construct(
		ApiQuery $query,
		string $moduleName,
		private readonly ThemeStore $themes,
		private readonly ConceptStore $concepts,
		private readonly ActorStore $actorStore,
		private readonly UserFactory $userFactory,
		private readonly IConnectionProvider $dbProvider
	) {
		parent::__construct( $query, $moduleName, 'ct' );
	}

	public function execute() {
		$params = $this->extractRequestParams();
		$this->requireOnlyOneParameter( $params, 'user', 'ids' );

		if ( $params['user'] !== null ) {
			$actorId = $this->actorStore->findActorIdByName(
				$params['user'], $this->dbProvider->getReplicaDatabase()
			);
			$records = $actorId ? $this->themes->listForActor( $actorId ) : [];
		} else {
			$records = array_filter( array_map( [ $this->themes, 'get' ], $params['ids'] ) );
		}

		$authors = new AuthorFormatter(
			$this->actorStore, $this->userFactory, $this->dbProvider, $this->getAuthority()
		);
		$path = [ 'query', $this->getModuleName() ];
		foreach ( $records as $theme ) {
			$this->getResult()->addValue( $path, null, $this->format( $theme, $authors ) );
		}
		$this->getResult()->addIndexedTagName( $path, 'theme' );
	}

	private function format( ThemeRecord $theme, AuthorFormatter $authors ): array {
		$author = $authors->format( $theme->actorId );
		$entry = [
			'id' => $theme->id,
			'label' => $theme->label,
			'author' => $author['name'],
			'userhidden' => $author['hidden'],
			'created' => wfTimestamp( TS_ISO_8601, $theme->created ),
			'concepts' => [],
			'notes' => [],
		];
		foreach ( $this->concepts->getByIds( $this->themes->conceptIds( $theme->id ) ) as $concept ) {
			$entry['concepts'][] = [ 'id' => $concept->id, 'label' => $concept->label ];
		}
		foreach ( $this->themes->listNotes( $theme->id ) as $note ) {
			$entry['notes'][] = [
				'id' => $note->id,
				'text' => $note->text,
				'updated' => wfTimestamp( TS_ISO_8601, $note->updated ),
			];
		}
		ApiResult::setIndexedTagName( $entry['concepts'], 'concept' );
		ApiResult::setIndexedTagName( $entry['notes'], 'note' );
		return $entry;
	}

	/** @inheritDoc */
	public function getCacheMode( $params ) {
		return 'anon-public-user-private';
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'user' => [ ParamValidator::PARAM_TYPE => 'user', 'user-must-exist' => true ],
			'ids' => [ ParamValidator::PARAM_TYPE => 'integer', ParamValidator::PARAM_ISMULTI => true ],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=query&list=constelthemes&ctuser=Example' => 'apihelp-query+constelthemes-example-user',
		];
	}
}
