<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use Wikimedia\ParamValidator\ParamValidator;

/**
 * action=constel-groupconcept — pone un concepto en un tema propio, o lo saca
 * (spec: ReaderGroupsConcept, ReaderUngroupsConcept). Vale cualquier concepto
 * del vocabulario, no sólo los propios: el tema es la lente del lector.
 */
class ApiGroupConcept extends ApiThemeWriteBase {

	public function execute() {
		$params = $this->extractRequestParams();
		$actorId = $this->requireAnnotator();
		if ( !$this->concepts->getById( $params['concept'] ) ) {
			$this->dieWithError( [ 'apierror-constel-noconcept', $params['concept'] ], 'noconcept' );
		}

		if ( $params['op'] === 'group' ) {
			$theme = $this->requireOwnTheme( $params['theme'], $actorId );
			$this->themes->group( $actorId, $params['concept'], $theme->id );
		} else {
			$this->themes->ungroup( $actorId, $params['concept'] );
		}
		$this->getResult()->addValue( null, $this->getModuleName(), [
			'op' => $params['op'],
			'concept' => $params['concept'],
			'theme' => $this->themes->themeOf( $actorId, $params['concept'] ),
		] );
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'op' => [
				ParamValidator::PARAM_TYPE => [ 'group', 'ungroup' ],
				ParamValidator::PARAM_REQUIRED => true,
			],
			'concept' => [ ParamValidator::PARAM_TYPE => 'integer', ParamValidator::PARAM_REQUIRED => true ],
			'theme' => [ ParamValidator::PARAM_TYPE => 'integer' ],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=constel-groupconcept&op=group&concept=2&theme=1&token=123ABC'
				=> 'apihelp-constel-groupconcept-example-1',
		];
	}
}
