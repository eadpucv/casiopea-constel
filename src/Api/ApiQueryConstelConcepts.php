<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use MediaWiki\Api\ApiQuery;
use MediaWiki\Api\ApiQueryBase;
use MediaWiki\Api\ApiResult;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ThemeStore;
use MediaWiki\User\ActorStore;
use MediaWiki\User\UserFactory;
use Wikimedia\ParamValidator\ParamValidator;
use Wikimedia\ParamValidator\TypeDef\IntegerDef;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * list=constelconcepts — el vocabulario compartido.
 *
 *  - ccsearch: autocompletado del popup (spec: SharedVocabularyAutocomplete),
 *    tolerante a tildes y mayúsculas, los más usados primero.
 *  - ccvariantsof: variantes de un rótulo (spec: VariantsSteered).
 *  - ccids: conceptos por id.
 */
class ApiQueryConstelConcepts extends ApiQueryBase {

	public function __construct(
		ApiQuery $query,
		string $moduleName,
		private readonly ConceptStore $concepts,
		private readonly ThemeStore $themes,
		private readonly ActorStore $actorStore,
		private readonly UserFactory $userFactory,
		private readonly IConnectionProvider $dbProvider
	) {
		parent::__construct( $query, $moduleName, 'cc' );
	}

	public function execute() {
		$params = $this->extractRequestParams();
		$this->requireOnlyOneParameter( $params, 'search', 'variantsof', 'ids' );

		$rows = [];
		if ( $params['search'] !== null ) {
			foreach ( $this->concepts->search( $params['search'], $params['limit'] ) as $hit ) {
				$rows[] = [ 'id' => $hit['concept']->id, 'label' => $hit['concept']->label, 'uses' => $hit['uses'] ];
			}
		} elseif ( $params['variantsof'] !== null ) {
			foreach ( $this->concepts->findVariants( $params['variantsof'], $params['limit'] ) as $concept ) {
				$rows[] = [ 'id' => $concept->id, 'label' => $concept->label ];
			}
		} else {
			foreach ( $this->concepts->getByIds( $params['ids'] ) as $concept ) {
				$rows[] = [ 'id' => $concept->id, 'label' => $concept->label ];
			}
		}

		if ( $params['themes'] ) {
			$authors = new AuthorFormatter(
				$this->actorStore, $this->userFactory, $this->dbProvider, $this->getAuthority()
			);
			foreach ( $rows as &$row ) {
				$row['themes'] = [];
				foreach ( $this->themes->listByConcept( $row['id'] ) as $theme ) {
					$author = $authors->format( $theme->actorId );
					$row['themes'][] = [ 'id' => $theme->id, 'label' => $theme->label, 'author' => $author['name'] ];
				}
				ApiResult::setIndexedTagName( $row['themes'], 'theme' );
			}
			unset( $row );
		}

		$path = [ 'query', $this->getModuleName() ];
		foreach ( $rows as $row ) {
			$this->getResult()->addValue( $path, null, $row );
		}
		$this->getResult()->addIndexedTagName( $path, 'concept' );
	}

	/** @inheritDoc */
	public function getCacheMode( $params ) {
		// Con temas, el nombre de un autor oculto depende de quién mira.
		return $params['themes'] ? 'anon-public-user-private' : 'public';
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'search' => [ ParamValidator::PARAM_TYPE => 'string' ],
			'variantsof' => [ ParamValidator::PARAM_TYPE => 'string' ],
			'ids' => [ ParamValidator::PARAM_TYPE => 'integer', ParamValidator::PARAM_ISMULTI => true ],
			'themes' => [ ParamValidator::PARAM_TYPE => 'boolean', ParamValidator::PARAM_DEFAULT => false ],
			'limit' => [
				ParamValidator::PARAM_TYPE => 'limit',
				ParamValidator::PARAM_DEFAULT => 10,
				IntegerDef::PARAM_MIN => 1,
				IntegerDef::PARAM_MAX => ApiQueryBase::LIMIT_SML1,
				IntegerDef::PARAM_MAX2 => ApiQueryBase::LIMIT_SML2,
			],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=query&list=constelconcepts&ccsearch=trav' => 'apihelp-query+constelconcepts-example-search',
			'action=query&list=constelconcepts&ccvariantsof=Diseno' => 'apihelp-query+constelconcepts-example-variants',
		];
	}
}
