<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use MediaWiki\Api\ApiQuery;
use MediaWiki\Api\ApiQueryBase;
use MediaWiki\Extension\CasiopeaConstel\Readers\ReaderDirectory;
use Wikimedia\ParamValidator\ParamValidator;
use Wikimedia\ParamValidator\TypeDef\IntegerDef;

/**
 * list=constelreaders — los lectores de con§tel con su nombre visible
 * (nombre real si lo definieron, si no el de usuario), para los selectores
 * del mapa. crsearch busca por cualquiera de los dos; crnames describe
 * usuarios dados.
 */
class ApiQueryConstelReaders extends ApiQueryBase {

	public function __construct(
		ApiQuery $query,
		string $moduleName,
		private readonly ReaderDirectory $directory
	) {
		parent::__construct( $query, $moduleName, 'cr' );
	}

	public function execute() {
		$params = $this->extractRequestParams();
		$this->requireOnlyOneParameter( $params, 'search', 'names' );
		$rows = $params['search'] !== null
			? $this->directory->search( $params['search'], $this->getAuthority(), $params['limit'] )
			: $this->directory->describe( $params['names'], $this->getAuthority() );
		$path = [ 'query', $this->getModuleName() ];
		foreach ( $rows as $row ) {
			$this->getResult()->addValue( $path, null, $row );
		}
		$this->getResult()->addIndexedTagName( $path, 'reader' );
	}

	/** @inheritDoc */
	public function getCacheMode( $params ) {
		// Los usuarios ocultos dependen de quién mira.
		return 'anon-public-user-private';
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'search' => [ ParamValidator::PARAM_TYPE => 'string' ],
			'names' => [ ParamValidator::PARAM_TYPE => 'user', ParamValidator::PARAM_ISMULTI => true ],
			'limit' => [
				ParamValidator::PARAM_TYPE => 'limit',
				ParamValidator::PARAM_DEFAULT => 8,
				IntegerDef::PARAM_MIN => 1,
				IntegerDef::PARAM_MAX => ApiQueryBase::LIMIT_SML1,
				IntegerDef::PARAM_MAX2 => ApiQueryBase::LIMIT_SML2,
			],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=query&list=constelreaders&crsearch=herb' => 'apihelp-query+constelreaders-example-search',
		];
	}
}
