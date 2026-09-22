<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use Wikimedia\ParamValidator\ParamValidator;

/**
 * action=constel-codeexcerpt — agrega un concepto a un § propio
 * (spec: ReaderCodesExcerpt). También sobre §§ perdidos.
 */
class ApiCodeExcerpt extends ApiExcerptWriteBase {

	public function execute() {
		$params = $this->extractRequestParams();
		$actorId = $this->requireAnnotator();
		$excerpt = $this->requireOwnExcerpt( $params['excerpt'], $actorId );
		$label = $this->requireConceptLabel( $params['concept'] );
		$this->rejectUnconfirmedVariant( $label, $params['allowvariant'] );

		$concept = $this->excerpts->code( $excerpt->id, $label );
		if ( !$concept ) {
			$this->dieWithError( 'apierror-constel-alreadycoded', 'alreadycoded' );
		}
		$this->getResult()->addValue( null, $this->getModuleName(), [
			'excerpt' => $excerpt->id,
			'concept' => [ 'id' => $concept->id, 'label' => $concept->label ],
		] );
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'excerpt' => [ ParamValidator::PARAM_TYPE => 'integer', ParamValidator::PARAM_REQUIRED => true ],
		] + self::conceptParams();
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=constel-codeexcerpt&excerpt=1&concept=Acto&token=123ABC'
				=> 'apihelp-constel-codeexcerpt-example-1',
		];
	}
}
