<?php

namespace MediaWiki\Extension\CasiopeaConstel\Map;

use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptRecord;
use Wikimedia\Rdbms\IConnectionProvider;

/**
 * El grafo del mapa de conceptos (spec: ConceptMap, concept_links).
 *
 * Nodos: conceptos con al menos un §. Aristas:
 *  - co_excerpt: dos conceptos codificados en el MISMO §; peso = nº de §§.
 *  - overlap: conceptos de §§ ANCLADOS de lectores DISTINTOS, en la misma
 *    página, cuyos rangos comparten al menos un carácter; peso = nº de pares.
 *    Es sólo una relación: nunca identifica ni fusiona conceptos
 *    (spec: OverlapNeverConverges).
 *  - co_page: dos conceptos anotados en la MISMA página; peso = nº de
 *    páginas compartidas.
 */
class GraphBuilder {

	public function __construct(
		private readonly IConnectionProvider $dbProvider
	) {
	}

	/**
	 * @param int[]|null $actors sólo los §§ de estos lectores (null o vacío = todos)
	 * @param int[]|null $pages sólo los §§ de estas páginas (null o vacío = todas)
	 * @param int|null $viewerActor para marcar los conceptos a los que aportó quien mira
	 * @return array{nodes: array, links: array}
	 */
	public function build( ?array $actors, ?array $pages, ?int $viewerActor ): array {
		$excerpts = $this->loadExcerpts( $actors ?: null, $pages ?: null );

		$nodes = [];
		$links = [];
		$link = static function ( int $a, int $b, string $kind ) use ( &$links ): void {
			if ( $a === $b ) {
				return;
			}
			[ $a, $b ] = $a < $b ? [ $a, $b ] : [ $b, $a ];
			$key = "$kind:$a:$b";
			$links[$key] ??= [ 'source' => $a, 'target' => $b, 'kind' => $kind, 'weight' => 0 ];
			$links[$key]['weight']++;
		};

		$byPage = [];
		$conceptsByPage = [];
		foreach ( $excerpts as $e ) {
			foreach ( $e['concepts'] as $c ) {
				$nodes[$c] ??= [ 'id' => $c, 'label' => '', 'excerpts' => 0, 'pages' => [], 'mine' => false ];
				$nodes[$c]['excerpts']++;
				$nodes[$c]['pages'][$e['page']] = true;
				if ( $viewerActor !== null && $e['actor'] === $viewerActor ) {
					$nodes[$c]['mine'] = true;
				}
			}
			$n = count( $e['concepts'] );
			for ( $i = 0; $i < $n; $i++ ) {
				for ( $j = $i + 1; $j < $n; $j++ ) {
					$link( $e['concepts'][$i], $e['concepts'][$j], 'co_excerpt' );
				}
			}
			if ( $e['status'] === ExcerptRecord::STATUS_ANCHORED ) {
				$byPage[$e['page']][] = $e;
			}
			foreach ( $e['concepts'] as $c ) {
				$conceptsByPage[$e['page']][$c] = true;
			}
		}

		// Misma página: cada par de conceptos distintos, una vez por página.
		foreach ( $conceptsByPage as $pageConcepts ) {
			$ids = array_keys( $pageConcepts );
			sort( $ids );
			$count = count( $ids );
			for ( $i = 0; $i < $count; $i++ ) {
				for ( $j = $i + 1; $j < $count; $j++ ) {
					$link( $ids[$i], $ids[$j], 'co_page' );
				}
			}
		}

		// Solapamientos: por página, barrido por inicio.
		foreach ( $byPage as $pageExcerpts ) {
			usort( $pageExcerpts, static fn ( $x, $y ) => $x['start'] <=> $y['start'] );
			$count = count( $pageExcerpts );
			for ( $i = 0; $i < $count; $i++ ) {
				$a = $pageExcerpts[$i];
				for ( $j = $i + 1; $j < $count && $pageExcerpts[$j]['start'] < $a['end']; $j++ ) {
					$b = $pageExcerpts[$j];
					if ( $a['actor'] === $b['actor'] ) {
						continue;
					}
					foreach ( $a['concepts'] as $ca ) {
						foreach ( $b['concepts'] as $cb ) {
							$link( $ca, $cb, 'overlap' );
						}
					}
				}
			}
		}

		foreach ( $this->labels( array_keys( $nodes ) ) as $id => $label ) {
			$nodes[$id]['label'] = $label;
		}
		foreach ( $nodes as &$node ) {
			$node['pages'] = count( $node['pages'] );
		}
		unset( $node );

		return [ 'nodes' => array_values( $nodes ), 'links' => array_values( $links ) ];
	}

	/**
	 * @return array<int,array{actor:int,page:int,status:int,start:int,end:int,concepts:int[]}>
	 */
	private function loadExcerpts( ?array $actors, ?array $pages ): array {
		$db = $this->dbProvider->getReplicaDatabase( ConceptStore::DOMAIN );
		$query = $db->newSelectQueryBuilder()
			->select( [ 'ccd_excerpt', 'ccd_concept', 'ce_actor', 'ce_page', 'ce_status', 'ce_start', 'ce_end' ] )
			->from( 'constel_coding' )
			->join( 'constel_excerpt', null, 'ce_id = ccd_excerpt' )
			// Los congelados (página borrada) no cuentan mientras dure el
			// congelamiento (spec: FrozenIsPrivate).
			->where( $db->expr( 'ce_status', '!=', ExcerptRecord::STATUS_FROZEN ) )
			->orderBy( [ 'ccd_excerpt', 'ccd_timestamp' ] );
		if ( $actors !== null ) {
			$query->where( [ 'ce_actor' => array_values( $actors ) ] );
		}
		if ( $pages !== null ) {
			$query->where( [ 'ce_page' => array_values( $pages ) ] );
		}
		$excerpts = [];
		foreach ( $query->caller( __METHOD__ )->fetchResultSet() as $row ) {
			$id = (int)$row->ccd_excerpt;
			$excerpts[$id] ??= [
				'actor' => (int)$row->ce_actor,
				'page' => (int)$row->ce_page,
				'status' => (int)$row->ce_status,
				'start' => (int)$row->ce_start,
				'end' => (int)$row->ce_end,
				'concepts' => [],
			];
			$excerpts[$id]['concepts'][] = (int)$row->ccd_concept;
		}
		return $excerpts;
	}

	/**
	 * @param int[] $ids
	 * @return array<int,string>
	 */
	private function labels( array $ids ): array {
		if ( !$ids ) {
			return [];
		}
		$db = $this->dbProvider->getReplicaDatabase( ConceptStore::DOMAIN );
		$res = $db->newSelectQueryBuilder()
			->select( [ 'cc_id', 'cc_key' ] )
			->from( 'constel_concept' )
			->where( [ 'cc_id' => $ids ] )
			->caller( __METHOD__ )->fetchResultSet();
		$labels = [];
		foreach ( $res as $row ) {
			$labels[(int)$row->cc_id] = $row->cc_key;
		}
		return $labels;
	}
}
