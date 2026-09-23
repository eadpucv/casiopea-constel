<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\CasiopeaConstel\Domain\ConceptNormalizer;
use MediaWiki\Extension\CasiopeaConstel\Moderation\ModerationLog;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptStore;
use MediaWiki\User\ActorNormalization;
use Wikimedia\ParamValidator\ParamValidator;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * action=constel-deleteexcerpt — borra un § (spec: ReaderDeletesExcerpt):
 * el propio, o cualquiera con constel-moderate. Borrar el ajeno queda en
 * Special:Log/constel.
 */
class ApiDeleteExcerpt extends ApiExcerptWriteBase {

	public function __construct(
		ApiMain $main,
		string $action,
		ActorNormalization $actorNormalization,
		IConnectionProvider $dbProvider,
		ConceptStore $concepts,
		ExcerptStore $excerpts,
		ConceptNormalizer $normalizer,
		private readonly ModerationLog $log
	) {
		parent::__construct( $main, $action, $actorNormalization, $dbProvider, $concepts, $excerpts, $normalizer );
	}

	public function execute() {
		$params = $this->extractRequestParams();
		$actorId = $this->requireAnnotator();
		// Borrar es lo único que admite un § congelado.
		$excerpt = $this->requireOwnExcerpt( $params['excerpt'], $actorId, true, true );
		$this->excerpts->delete( $excerpt->id );
		if ( $excerpt->actorId !== $actorId ) {
			$this->log->deleteExcerpt( $this->getUser(), $excerpt );
		}
		$this->getResult()->addValue( null, $this->getModuleName(), [ 'excerpt' => $excerpt->id ] );
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'excerpt' => [ ParamValidator::PARAM_TYPE => 'integer', ParamValidator::PARAM_REQUIRED => true ],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=constel-deleteexcerpt&excerpt=1&token=123ABC'
				=> 'apihelp-constel-deleteexcerpt-example-1',
		];
	}
}
