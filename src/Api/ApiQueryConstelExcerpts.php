<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use MediaWiki\Api\ApiQuery;
use MediaWiki\Api\ApiQueryBase;
use MediaWiki\Api\ApiResult;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptRecord;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptStore;
use MediaWiki\Page\PageStore;
use MediaWiki\Title\TitleFormatter;
use MediaWiki\User\ActorStore;
use MediaWiki\User\UserFactory;
use Wikimedia\ParamValidator\ParamValidator;
use Wikimedia\ParamValidator\TypeDef\IntegerDef;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * list=constelexcerpts — §§ de una página (sólo anclados: lo que se dibuja
 * sobre el texto, spec: PageReading) o de un lector (incluidos los perdidos,
 * spec: MyReading). Lectura pública (spec: ReadingIsPublicData), salvo los
 * congelados, que sólo ven su autor y quien puede ver texto borrado.
 */
class ApiQueryConstelExcerpts extends ApiQueryBase {

	public function __construct(
		ApiQuery $query,
		string $moduleName,
		private readonly ExcerptStore $excerpts,
		private readonly ConceptStore $concepts,
		private readonly ActorStore $actorStore,
		private readonly UserFactory $userFactory,
		private readonly IConnectionProvider $dbProvider,
		private readonly PageStore $pageStore,
		private readonly TitleFormatter $titleFormatter
	) {
		parent::__construct( $query, $moduleName, 'ce' );
	}

	public function execute() {
		$params = $this->extractRequestParams();
		$this->requireOnlyOneParameter( $params, 'pageid', 'user', 'concept' );

		if ( $params['pageid'] !== null ) {
			$records = $this->excerpts->listAnchoredForPage( $params['pageid'] );
		} elseif ( $params['concept'] !== null ) {
			$records = $this->excerpts->listForConcept( $params['concept'], $params['limit'] );
		} else {
			$actorId = $this->actorStore->findActorIdByName(
				$params['user'], $this->dbProvider->getReplicaDatabase()
			);
			$records = $actorId ? $this->excerpts->listForActor( $actorId, $params['limit'] ) : [];
		}
		$records = array_values( array_filter( $records, $this->frozenVisibility() ) );

		$codings = $this->excerpts->conceptIdsForMany( array_map( static fn ( $e ) => $e->id, $records ) );
		$concepts = $this->concepts->getByIds( array_merge( [], ...array_values( $codings ) ) );
		$authors = new AuthorFormatter(
			$this->actorStore, $this->userFactory, $this->dbProvider, $this->getAuthority()
		);

		$titles = [];
		$pageIds = array_values( array_unique( array_map( static fn ( $e ) => $e->pageId, $records ) ) );
		foreach ( $this->pageStore->newSelectQueryBuilder()
			->wherePageIds( $pageIds ?: [ 0 ] )
			->fetchPageRecords() as $page
		) {
			$titles[$page->getId()] = $this->titleFormatter->getPrefixedText( $page );
		}

		$result = $this->getResult();
		$path = [ 'query', $this->getModuleName() ];
		foreach ( $records as $record ) {
			$entry = $this->format(
				$record, $codings[$record->id] ?? [], $concepts, $authors->format( $record->actorId )
			);
			$entry['title'] = $titles[$record->pageId] ?? null;
			$result->addValue( $path, null, $entry );
		}
		$result->addIndexedTagName( $path, 'excerpt' );
	}

	/**
	 * Un § congelado cita una página borrada: su pasaje y su glosa sólo los ven
	 * su autor y quienes pueden ver texto borrado (spec: FrozenIsPrivate).
	 *
	 * @return callable(ExcerptRecord):bool
	 */
	private function frozenVisibility(): callable {
		if ( $this->getAuthority()->isAllowed( 'deletedtext' ) ) {
			return static function ( ExcerptRecord $e ): bool {
				return true;
			};
		}
		$user = $this->getUser();
		$viewer = $user->isRegistered()
			? $this->actorStore->findActorId( $user, $this->dbProvider->getReplicaDatabase() )
			: null;
		return static function ( ExcerptRecord $e ) use ( $viewer ): bool {
			return !$e->isFrozen() || $e->actorId === $viewer;
		};
	}

	/**
	 * @param ExcerptRecord $e
	 * @param int[] $conceptIds
	 * @param array $concepts
	 * @param array $author
	 * @return array
	 */
	private function format( ExcerptRecord $e, array $conceptIds, array $concepts, array $author ): array {
		$entry = [
			'id' => $e->id,
			'pageid' => $e->pageId,
			'revid' => $e->revId,
			'status' => $e->statusName(),
			'exact' => $e->anchor->exact,
			'prefix' => $e->anchor->prefix,
			'suffix' => $e->anchor->suffix,
			'start' => $e->anchor->start,
			'end' => $e->anchor->end,
			'gloss' => $e->gloss,
			'author' => $author['name'],
			'userhidden' => $author['hidden'],
			'created' => wfTimestamp( TS_ISO_8601, $e->created ),
			'concepts' => [],
		];
		if ( $e->lost !== null ) {
			$entry['lost'] = wfTimestamp( TS_ISO_8601, $e->lost );
		}
		foreach ( $conceptIds as $id ) {
			if ( isset( $concepts[$id] ) ) {
				$entry['concepts'][] = [ 'id' => $id, 'label' => $concepts[$id]->label ];
			}
		}
		ApiResult::setIndexedTagName( $entry['concepts'], 'concept' );
		return $entry;
	}

	/** @inheritDoc */
	public function getCacheMode( $params ) {
		// El nombre de un usuario oculto depende de quién mira.
		return 'anon-public-user-private';
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'pageid' => [ ParamValidator::PARAM_TYPE => 'integer' ],
			'user' => [ ParamValidator::PARAM_TYPE => 'user', 'user-must-exist' => true ],
			'concept' => [ ParamValidator::PARAM_TYPE => 'integer' ],
			'limit' => [
				ParamValidator::PARAM_TYPE => 'limit',
				ParamValidator::PARAM_DEFAULT => 500,
				IntegerDef::PARAM_MIN => 1,
				IntegerDef::PARAM_MAX => ApiQueryBase::LIMIT_BIG1,
				IntegerDef::PARAM_MAX2 => ApiQueryBase::LIMIT_BIG2,
			],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=query&list=constelexcerpts&cepageid=1' => 'apihelp-query+constelexcerpts-example-page',
			'action=query&list=constelexcerpts&ceuser=Example' => 'apihelp-query+constelexcerpts-example-user',
		];
	}
}
