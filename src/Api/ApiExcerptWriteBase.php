<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use MediaWiki\Api\ApiMain;
use MediaWiki\Extension\CasiopeaConstel\Domain\ConceptNormalizer;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptRecord;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptStore;
use MediaWiki\User\ActorNormalization;
use Wikimedia\ParamValidator\ParamValidator;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * Base de los módulos de escritura sobre §§ y conceptos.
 */
abstract class ApiExcerptWriteBase extends ApiConstelWriteBase {

	public function __construct(
		ApiMain $main,
		string $action,
		ActorNormalization $actorNormalization,
		IConnectionProvider $dbProvider,
		protected readonly ConceptStore $concepts,
		protected readonly ExcerptStore $excerpts,
		protected readonly ConceptNormalizer $normalizer
	) {
		parent::__construct( $main, $action, $actorNormalization, $dbProvider );
	}

	/**
	 * Carga un § que el lector puede modificar: el propio o, si $allowModerator,
	 * cualquiera para quien tenga constel-moderate.
	 */
	protected function requireOwnExcerpt( int $excerptId, int $actorId, bool $allowModerator = false ): ExcerptRecord {
		$excerpt = $this->excerpts->get( $excerptId, true );
		if ( !$excerpt ) {
			$this->dieWithError( [ 'apierror-constel-noexcerpt', $excerptId ], 'noexcerpt' );
		}
		$isModerator = $allowModerator && $this->getAuthority()->isAllowed( self::RIGHT_MODERATE );
		if ( $excerpt->actorId !== $actorId && !$isModerator ) {
			$this->dieWithError( 'apierror-constel-notyours', 'notyours' );
		}
		return $excerpt;
	}

	/**
	 * Valida un rótulo de concepto y devuelve su forma canónica.
	 */
	protected function requireConceptLabel( string $label ): string {
		$canonical = $this->normalizer->canonical( $label );
		$max = $this->getConfig()->get( 'ConstelConceptMaxLength' );
		if ( $canonical === '' ) {
			$this->dieWithError( 'apierror-constel-emptyconcept', 'emptyconcept' );
		}
		if ( mb_strlen( $canonical ) > $max ) {
			$this->dieWithError( [ 'apierror-constel-toolong', $max ], 'toolong' );
		}
		return $canonical;
	}

	/**
	 * Valida una glosa: vacía = sin glosa (null).
	 */
	protected function normaliseGloss( ?string $gloss ): ?string {
		$gloss = trim( $gloss ?? '' );
		if ( $gloss === '' ) {
			return null;
		}
		$max = $this->getConfig()->get( 'ConstelGlossMaxLength' );
		if ( mb_strlen( $gloss ) > $max ) {
			$this->dieWithError( [ 'apierror-constel-toolong', $max ], 'toolong' );
		}
		return $gloss;
	}

	/**
	 * Si el concepto es nuevo pero hay variantes (misma palabra con otras
	 * tildes, mayúsculas o espacios), exige confirmación explícita
	 * (spec: SelectionPopup.VariantsSteered). La identidad sigue siendo
	 * estricta: esto sólo evita crear una variante sin querer.
	 */
	protected function rejectUnconfirmedVariant( string $canonical, bool $allowVariant ): void {
		if ( $allowVariant || $this->concepts->getByLabel( $canonical ) ) {
			return;
		}
		$variants = $this->concepts->findVariants( $canonical );
		if ( $variants ) {
			$labels = array_map( static fn ( $c ) => $c->label, $variants );
			$this->dieWithError(
				[ 'apierror-constel-variants', wfEscapeWikiText( $canonical ), count( $labels ),
					$this->getLanguage()->commaList( array_map( 'wfEscapeWikiText', $labels ) ) ],
				'variants',
				[ 'variants' => $labels ]
			);
		}
	}

	/**
	 * @return array Parámetros de rótulo de concepto, comunes a varios módulos.
	 */
	protected static function conceptParams(): array {
		return [
			'concept' => [ ParamValidator::PARAM_TYPE => 'string', ParamValidator::PARAM_REQUIRED => true ],
			'allowvariant' => [ ParamValidator::PARAM_TYPE => 'boolean', ParamValidator::PARAM_DEFAULT => false ],
		];
	}
}
