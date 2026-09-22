<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use Wikimedia\ParamValidator\ParamValidator;

/**
 * action=constel-glossexcerpt — escribe, cambia o quita (vacía) la glosa de
 * un § propio (spec: ReaderGlossesExcerpt). También sobre §§ perdidos.
 */
class ApiGlossExcerpt extends ApiExcerptWriteBase {

	public function execute() {
		$params = $this->extractRequestParams();
		$actorId = $this->requireAnnotator();
		$excerpt = $this->requireOwnExcerpt( $params['excerpt'], $actorId );
		$gloss = $this->normaliseGloss( $params['gloss'] );
		$this->excerpts->setGloss( $excerpt->id, $gloss );
		$this->getResult()->addValue( null, $this->getModuleName(), [
			'excerpt' => $excerpt->id,
			'gloss' => $gloss,
		] );
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'excerpt' => [ ParamValidator::PARAM_TYPE => 'integer', ParamValidator::PARAM_REQUIRED => true ],
			'gloss' => [ ParamValidator::PARAM_TYPE => 'text', ParamValidator::PARAM_DEFAULT => '' ],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=constel-glossexcerpt&excerpt=1&gloss=Eco%20de%20la%20Eneida&token=123ABC'
				=> 'apihelp-constel-glossexcerpt-example-1',
		];
	}
}
