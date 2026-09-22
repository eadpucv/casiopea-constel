<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use Wikimedia\ParamValidator\ParamValidator;

/**
 * action=constel-uncodeexcerpt — quita un concepto de un § propio
 * (spec: ReaderUncodesExcerpt). Si era el último, el § desaparece
 * (UncodedExcerptVanishes).
 */
class ApiUncodeExcerpt extends ApiExcerptWriteBase {

	public function execute() {
		$params = $this->extractRequestParams();
		$actorId = $this->requireAnnotator();
		$excerpt = $this->requireOwnExcerpt( $params['excerpt'], $actorId );
		if ( !in_array( $params['concept'], $this->excerpts->conceptIds( $excerpt->id ), true ) ) {
			$this->dieWithError( 'apierror-constel-notcoded', 'notcoded' );
		}
		$this->excerpts->uncode( $excerpt->id, $params['concept'] );
		$this->getResult()->addValue( null, $this->getModuleName(), [
			'excerpt' => $excerpt->id,
			'excerptremoved' => $this->excerpts->get( $excerpt->id, true ) === null,
		] );
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'excerpt' => [ ParamValidator::PARAM_TYPE => 'integer', ParamValidator::PARAM_REQUIRED => true ],
			'concept' => [ ParamValidator::PARAM_TYPE => 'integer', ParamValidator::PARAM_REQUIRED => true ],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=constel-uncodeexcerpt&excerpt=1&concept=2&token=123ABC'
				=> 'apihelp-constel-uncodeexcerpt-example-1',
		];
	}
}
