<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\CasiopeaConstel\Domain\ConceptNormalizer;
use MediaWiki\Extension\CasiopeaConstel\Moderation\ModerationLog;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\User\ActorNormalization;
use Wikimedia\ParamValidator\ParamValidator;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * action=constel-moderate — renombrar o fusionar conceptos del vocabulario
 * compartido (spec: ModeratorRenamesConcept, ModeratorMergesConcepts).
 * Exige constel-moderate (administradores) y queda en Special:Log/constel.
 */
class ApiModerateConcept extends ApiConstelWriteBase {

	public function __construct(
		ApiMain $main,
		string $action,
		ActorNormalization $actorNormalization,
		IConnectionProvider $dbProvider,
		private readonly ConceptStore $concepts,
		private readonly ConceptNormalizer $normalizer,
		private readonly ModerationLog $log
	) {
		parent::__construct( $main, $action, $actorNormalization, $dbProvider );
	}

	public function execute() {
		$params = $this->extractRequestParams();
		$this->requireModerator();

		$concept = $this->concepts->getById( $params['concept'] );
		if ( !$concept ) {
			$this->dieWithError( [ 'apierror-constel-noconcept', $params['concept'] ], 'noconcept' );
		}

		if ( $params['op'] === 'rename' ) {
			$label = $this->normalizer->canonical( $params['label'] ?? '' );
			$max = $this->getConfig()->get( 'ConstelConceptMaxLength' );
			if ( $label === '' ) {
				$this->dieWithError( 'apierror-constel-emptyconcept', 'emptyconcept' );
			}
			if ( mb_strlen( $label ) > $max ) {
				$this->dieWithError( [ 'apierror-constel-toolong', $max ], 'toolong' );
			}
			if ( !$this->concepts->rename( $concept->id, $label ) ) {
				// El rótulo ya es de otro concepto: eso es una fusión.
				$this->dieWithError( [ 'apierror-constel-labeltaken', wfEscapeWikiText( $label ) ], 'labeltaken' );
			}
			if ( $label !== $concept->label ) {
				$this->log->rename( $this->getUser(), $concept->label, $label );
			}
			$result = [ 'concept' => $concept->id, 'label' => $label ];
		} else {
			$keep = $params['into'] === null ? null : $this->concepts->getById( $params['into'] );
			if ( !$keep ) {
				$this->dieWithError( [ 'apierror-constel-noconcept', $params['into'] ?? 0 ], 'noconcept' );
			}
			if ( $keep->id === $concept->id ) {
				$this->dieWithError( 'apierror-constel-mergeself', 'mergeself' );
			}
			$this->concepts->merge( $keep->id, $concept->id );
			$this->log->merge( $this->getUser(), $concept->label, $keep->label );
			$result = [ 'concept' => $keep->id, 'label' => $keep->label, 'absorbed' => $concept->id ];
		}
		$this->getResult()->addValue( null, $this->getModuleName(), [ 'op' => $params['op'] ] + $result );
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'op' => [
				ParamValidator::PARAM_TYPE => [ 'rename', 'merge' ],
				ParamValidator::PARAM_REQUIRED => true,
			],
			'concept' => [ ParamValidator::PARAM_TYPE => 'integer', ParamValidator::PARAM_REQUIRED => true ],
			'label' => [ ParamValidator::PARAM_TYPE => 'string' ],
			'into' => [ ParamValidator::PARAM_TYPE => 'integer' ],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=constel-moderate&op=rename&concept=2&label=Diseño&token=123ABC'
				=> 'apihelp-constel-moderate-example-rename',
			'action=constel-moderate&op=merge&concept=3&into=2&token=123ABC'
				=> 'apihelp-constel-moderate-example-merge',
		];
	}
}
