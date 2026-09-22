<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\CasiopeaConstel\Domain\AnchorLocator;
use MediaWiki\Extension\CasiopeaConstel\Domain\ConceptNormalizer;
use MediaWiki\Extension\CasiopeaConstel\Domain\TextAnchor;
use MediaWiki\Extension\CasiopeaConstel\Page\RenderedTextProvider;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptStore;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Title\NamespaceInfo;
use MediaWiki\User\ActorNormalization;
use Wikimedia\ParamValidator\ParamValidator;
use Wikimedia\ParamValidator\TypeDef\IntegerDef;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * action=constel-createexcerpt — crea un § con su primer concepto
 * (spec: ReaderCreatesExcerpt).
 *
 * El cliente propone el pasaje (exact + contexto + posición medidos sobre su
 * DOM); el servidor lo ubica en el texto canónico de la revisión vigente y
 * guarda SU propia medición. Si no lo encuentra, no crea nada.
 */
class ApiCreateExcerpt extends ApiExcerptWriteBase {

	public function __construct(
		ApiMain $main,
		string $action,
		ActorNormalization $actorNormalization,
		IConnectionProvider $dbProvider,
		ConceptStore $concepts,
		ExcerptStore $excerpts,
		ConceptNormalizer $normalizer,
		private readonly RevisionLookup $revisionLookup,
		private readonly NamespaceInfo $namespaceInfo,
		private readonly RenderedTextProvider $renderedText,
		private readonly AnchorLocator $locator
	) {
		parent::__construct( $main, $action, $actorNormalization, $dbProvider, $concepts, $excerpts, $normalizer );
	}

	public function execute() {
		$params = $this->extractRequestParams();
		$this->requireOnlyOneParameter( $params, 'title', 'pageid' );
		$actorId = $this->requireAnnotator();

		$page = $this->getTitleOrPageId( $params, 'fromdbmaster' );
		$record = $page->toPageRecord();
		if ( !$page->exists() || $page->isRedirect()
			|| !$this->namespaceInfo->isContent( $page->getNamespace() )
		) {
			$this->dieWithError( 'apierror-constel-notannotatable', 'notannotatable' );
		}
		// Bloqueos parciales sobre esta página.
		$this->checkTitleUserPermissions( $page, self::RIGHT_ANNOTATE );

		if ( $params['revid'] !== $page->getLatest() ) {
			$this->dieWithError( 'apierror-constel-staleview', 'staleview' );
		}

		$exact = $params['exact'];
		$config = $this->getConfig();
		$min = $config->get( 'ConstelSelectionMinLength' );
		$max = $config->get( 'ConstelSelectionMaxLength' );
		if ( mb_strlen( trim( $exact ) ) < $min ) {
			$this->dieWithError( [ 'apierror-constel-tooshort', $min ], 'tooshort' );
		}
		if ( mb_strlen( $exact ) > $max ) {
			$this->dieWithError( [ 'apierror-constel-toolong', $max ], 'toolong' );
		}
		$label = $this->requireConceptLabel( $params['concept'] );
		$this->rejectUnconfirmedVariant( $label, $params['allowvariant'] );
		$gloss = $this->normaliseGloss( $params['gloss'] );

		$revision = $this->revisionLookup->getRevisionById( $page->getLatest() );
		$text = $revision ? $this->renderedText->forRevision( $record, $revision ) : null;
		if ( $text === null ) {
			$this->dieWithError( 'apierror-constel-norender', 'norender' );
		}
		$proposed = new TextAnchor(
			$exact, $params['prefix'], $params['suffix'], $params['start'], $params['start'] + mb_strlen( $exact )
		);
		$anchor = $this->locator->locate( $proposed, $text );
		if ( !$anchor ) {
			$this->dieWithError( 'apierror-constel-anchornotfound', 'anchornotfound' );
		}

		$excerpt = $this->excerpts->create(
			$actorId, $page->getId(), $revision->getId(), $anchor, $label, $gloss
		);
		$concept = $this->concepts->getByLabel( $label );
		$this->getResult()->addValue( null, $this->getModuleName(), [
			'excerpt' => $excerpt->id,
			'pageid' => $page->getId(),
			'revid' => $revision->getId(),
			'start' => $anchor->start,
			'end' => $anchor->end,
			'concept' => [ 'id' => $concept->id, 'label' => $concept->label ],
		] );
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'title' => [ ParamValidator::PARAM_TYPE => 'string' ],
			'pageid' => [ ParamValidator::PARAM_TYPE => 'integer' ],
			'revid' => [ ParamValidator::PARAM_TYPE => 'integer', ParamValidator::PARAM_REQUIRED => true ],
			'exact' => [ ParamValidator::PARAM_TYPE => 'string', ParamValidator::PARAM_REQUIRED => true ],
			'prefix' => [ ParamValidator::PARAM_TYPE => 'string', ParamValidator::PARAM_DEFAULT => '' ],
			'suffix' => [ ParamValidator::PARAM_TYPE => 'string', ParamValidator::PARAM_DEFAULT => '' ],
			'gloss' => [ ParamValidator::PARAM_TYPE => 'text' ],
			'start' => [
				ParamValidator::PARAM_TYPE => 'integer',
				ParamValidator::PARAM_REQUIRED => true,
				IntegerDef::PARAM_MIN => 0,
			],
		] + self::conceptParams();
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=constel-createexcerpt&title=Amereida&revid=123&exact=la%20travesía&start=40'
				. '&concept=Travesía&token=123ABC'
				=> 'apihelp-constel-createexcerpt-example-1',
		];
	}
}
