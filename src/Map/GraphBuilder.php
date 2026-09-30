<?php

namespace MediaWiki\Extension\CasiopeaConstel\Map;

use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptRecord;
use Wikimedia\ObjectCache\WANObjectCache;
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
 *
 * El resultado se guarda en WANObjectCache por conjunto de lectores, de
 * páginas y de grados pedidos, y se descarta con la clave de contacto de
 * GraphVersion (spec: GraphIsCached). Lo que depende de quien mira (la marca
 * `mine`) se calcula aparte, sobre el grafo guardado.
 *
 * Forma empaquetada (la que se guarda y viaja en la respuesta compacta):
 *  - nodes: lista de {id, label, excerpts, pages}, ordenada por id. Si el
 *    filtro nombra a dos o más lectores, cada nodo trae además `by`: cuántos
 *    §§ aporta cada lector filtrado (actor => cantidad).
 *  - total: cuántos conceptos había antes del tope (ConstelMapMaxNodes);
 *    `nodes` trae los más frecuentes si eran más que el tope.
 *  - runs: por grado, una cadena de enteros separados por comas que lista
 *    tramos «i,n,j1,w1,…,jn,wn»: la arista entre el nodo de índice i y cada
 *    uno de los n nodos j (con i < j) con su peso w. Los índices son
 *    posiciones en `nodes`. Va como cadena y no como lista porque
 *    ApiResult recorre cada elemento de cada lista al serializar (unos 2,5 µs
 *    por entero: con cientos de miles de aristas, el grueso de la respuesta).
 */
class GraphBuilder {

	public const KINDS = [ 'co_excerpt', 'overlap', 'co_page' ];

	/** Versión del formato guardado: subirla descarta lo cacheado. */
	private const CACHE_VERSION = 2;

	/**
	 * Base para empaquetar un par de ids (a < b) en el entero a·base + b: el
	 * mayor id de concepto más uno. Con una base cercana a los ids, los bits
	 * bajos de la clave varían con ambos; con una potencia de dos grande,
	 * dependen sólo de b y la tabla hash de PHP colisiona casi siempre.
	 */
	private int $pairBase = 1;

	public function __construct(
		private readonly IConnectionProvider $dbProvider,
		private readonly WANObjectCache $cache,
		private readonly GraphVersion $version,
		private readonly int $overlapMaxPerPage = 0,
		private readonly int $maxNodes = 0
	) {
	}

	/**
	 * El grafo expandido: aristas como objetos {source, target, kind, weight}
	 * con ids de concepto.
	 *
	 * @param int[]|null $actors sólo los §§ de estos lectores (null o vacío = todos)
	 * @param int[]|null $pages sólo los §§ de estas páginas (null o vacío = todas)
	 * @param int|null $viewerActor para marcar los conceptos a los que aportó quien mira
	 * @param string[]|null $kinds sólo estos grados de arista (null = los tres)
	 * @return array{nodes: array, links: array, total: int}
	 */
	public function build( ?array $actors, ?array $pages, ?int $viewerActor, ?array $kinds = null ): array {
		$packed = $this->buildPacked( $actors, $pages, $viewerActor, $kinds );
		$ids = array_column( $packed['nodes'], 'id' );
		$links = [];
		foreach ( $packed['runs'] as $kind => $text ) {
			$run = $text === '' ? [] : array_map( 'intval', explode( ',', $text ) );
			$count = count( $run );
			for ( $p = 0; $p < $count; ) {
				$source = $ids[$run[$p]];
				$n = $run[$p + 1];
				for ( $q = $p + 2, $end = $p + 2 + 2 * $n; $q < $end; $q += 2 ) {
					$links[] = [
						'source' => $source,
						'target' => $ids[$run[$q]],
						'kind' => $kind,
						'weight' => $run[$q + 1],
					];
				}
				$p = $end;
			}
		}
		return [ 'nodes' => $packed['nodes'], 'links' => $links, 'total' => $packed['total'] ];
	}

	/**
	 * El grafo en forma empaquetada, con `mine` en cada nodo.
	 *
	 * @param int[]|null $actors
	 * @param int[]|null $pages
	 * @param int|null $viewerActor
	 * @param string[]|null $kinds
	 * @return array{nodes: array, runs: array<string,string>, total: int}
	 */
	public function buildPacked( ?array $actors, ?array $pages, ?int $viewerActor, ?array $kinds = null ): array {
		$actors = $actors ? array_values( array_unique( $actors ) ) : null;
		$pages = $pages ? array_values( array_unique( $pages ) ) : null;
		$kinds = $this->normalizeKinds( $kinds );
		if ( $actors ) {
			sort( $actors );
		}
		if ( $pages ) {
			sort( $pages );
		}

		$packed = $this->cache->getWithSetCallback(
			$this->cache->makeKey(
				'casiopea-constel', 'graph',
				md5( json_encode( [ $actors, $pages, $kinds, $this->overlapMaxPerPage, $this->maxNodes ] ) )
			),
			WANObjectCache::TTL_DAY,
			fn () => $this->compute( $actors, $pages, $kinds ),
			[
				'checkKeys' => [ $this->version->checkKey() ],
				'lockTSE' => 5,
				'version' => self::CACHE_VERSION,
			]
		);

		$mine = $viewerActor !== null && ( !$actors || in_array( $viewerActor, $actors, true ) ) ?
			array_flip( $this->viewerConcepts( $viewerActor, $pages ) ) :
			[];
		foreach ( $packed['nodes'] as &$node ) {
			$node['mine'] = isset( $mine[$node['id']] );
		}
		unset( $node );
		return $packed;
	}

	/**
	 * Conceptos con su frecuencia, sin aristas: lo que necesita la lista
	 * alternativa de Especial:Constelación (spec: AccessibleAlternative) sin
	 * armar el grafo. Más usados primero.
	 *
	 * @return array<int,array{id:int,label:string,excerpts:int,pages:int}>
	 */
	public function conceptCounts(): array {
		return $this->cache->getWithSetCallback(
			$this->cache->makeKey( 'casiopea-constel', 'concept-counts' ),
			WANObjectCache::TTL_DAY,
			fn () => $this->computeConceptCounts(),
			[
				'checkKeys' => [ $this->version->checkKey() ],
				'lockTSE' => 5,
				'version' => self::CACHE_VERSION,
			]
		);
	}

	/**
	 * @return array<int,array{id:int,label:string,excerpts:int,pages:int}>
	 */
	private function computeConceptCounts(): array {
		$db = $this->dbProvider->getReplicaDatabase( ConceptStore::DOMAIN );
		$res = $db->newSelectQueryBuilder()
			->select( [
				'id' => 'cc_id',
				'label' => 'cc_key',
				'excerpts' => 'COUNT(DISTINCT ccd_excerpt)',
				'pages' => 'COUNT(DISTINCT ce_page)',
			] )
			->from( 'constel_coding' )
			->join( 'constel_excerpt', null, 'ce_id = ccd_excerpt' )
			->join( 'constel_concept', null, 'cc_id = ccd_concept' )
			->where( $db->expr( 'ce_status', '!=', ExcerptRecord::STATUS_FROZEN ) )
			->groupBy( [ 'cc_id', 'cc_key' ] )
			->orderBy( [ 'excerpts DESC', 'cc_key' ] )
			->caller( __METHOD__ )->fetchResultSet();
		$out = [];
		foreach ( $res as $row ) {
			$out[] = [
				'id' => (int)$row->id,
				'label' => $row->label,
				'excerpts' => (int)$row->excerpts,
				'pages' => (int)$row->pages,
			];
		}
		return $out;
	}

	/**
	 * @param string[]|null $kinds
	 * @return string[] los grados pedidos, válidos y en orden canónico
	 */
	private function normalizeKinds( ?array $kinds ): array {
		if ( $kinds === null ) {
			return self::KINDS;
		}
		return array_values( array_intersect( self::KINDS, $kinds ) );
	}

	/**
	 * @param int[]|null $actors
	 * @param int[]|null $pages
	 * @param string[] $kinds
	 * @return array{nodes: array, runs: array<string,string>, total: int}
	 */
	private function compute( ?array $actors, ?array $pages, array $kinds ): array {
		$excerpts = $this->loadExcerpts( $actors, $pages );
		$want = array_fill_keys( $kinds, true );

		$nodes = [];
		$edges = array_fill_keys( $kinds, [] );
		$byPage = [];
		$conceptsByPage = [];
		// Con varios lectores filtrados, quién aporta cada concepto.
		$trackReaders = $actors !== null && count( $actors ) >= 2;
		foreach ( $excerpts as $e ) {
			foreach ( $e['concepts'] as $c ) {
				$nodes[$c] ??= [ 'id' => $c, 'label' => '', 'excerpts' => 0, 'pages' => [], 'by' => [] ];
				$nodes[$c]['excerpts']++;
				$nodes[$c]['pages'][$e['page']] = true;
				if ( $trackReaders ) {
					$nodes[$c]['by'][$e['actor']] = ( $nodes[$c]['by'][$e['actor']] ?? 0 ) + 1;
				}
			}
		}
		// Tope de conceptos (spec: MapHasLoadLimits): con más que el tope se
		// quedan los más frecuentes y las aristas se calculan sólo entre ellos,
		// antes de los bucles de pares, que son los que crecen con el cuadrado.
		$total = count( $nodes );
		if ( $this->maxNodes > 0 && $total > $this->maxNodes ) {
			uasort( $nodes, static fn ( $a, $b ) => [ $b['excerpts'], count( $b['pages'] ), $a['id'] ]
				<=> [ $a['excerpts'], count( $a['pages'] ), $b['id'] ] );
			$nodes = array_slice( $nodes, 0, $this->maxNodes, true );
			foreach ( $excerpts as &$e ) {
				$e['concepts'] = array_values( array_filter(
					$e['concepts'], static fn ( $c ) => isset( $nodes[$c] )
				) );
			}
			unset( $e );
		}
		foreach ( $excerpts as $e ) {
			if ( !$e['concepts'] ) {
				continue;
			}
			if ( isset( $want['overlap'] ) && $e['status'] === ExcerptRecord::STATUS_ANCHORED ) {
				$byPage[$e['page']][] = $e;
			}
			if ( isset( $want['co_page'] ) ) {
				foreach ( $e['concepts'] as $c ) {
					$conceptsByPage[$e['page']][$c] = true;
				}
			}
		}
		$this->pairBase = $nodes ? max( array_keys( $nodes ) ) + 1 : 1;

		// Misma sección: cada par de conceptos de un mismo §.
		if ( isset( $want['co_excerpt'] ) ) {
			foreach ( $excerpts as $e ) {
				$concepts = $e['concepts'];
				$n = count( $concepts );
				for ( $i = 0; $i < $n; $i++ ) {
					for ( $j = $i + 1; $j < $n; $j++ ) {
						$this->add( $edges['co_excerpt'], $concepts[$i], $concepts[$j] );
					}
				}
			}
		}
		unset( $excerpts );

		// Misma página: cada par de conceptos distintos, una vez por página.
		// Es el bucle más caliente (millones de pares): con los ids ordenados
		// el par ya viene como (menor, mayor), y el incremento va en línea.
		foreach ( $conceptsByPage as $pageConcepts ) {
			$ids = array_keys( $pageConcepts );
			sort( $ids );
			$count = count( $ids );
			$copage = &$edges['co_page'];
			for ( $i = 0; $i < $count; $i++ ) {
				$base = $ids[$i] * $this->pairBase;
				for ( $j = $i + 1; $j < $count; $j++ ) {
					$key = $base + $ids[$j];
					$copage[$key] = ( $copage[$key] ?? 0 ) + 1;
				}
			}
			unset( $copage );
		}
		unset( $conceptsByPage );

		// Solapamientos: por página, barrido por inicio.
		foreach ( $byPage as $pageExcerpts ) {
			$this->overlaps( $pageExcerpts, $edges['overlap'] );
		}

		foreach ( $this->labels( array_keys( $nodes ) ) as $id => $label ) {
			$nodes[$id]['label'] = $label;
		}
		ksort( $nodes );
		$index = [];
		$list = [];
		foreach ( $nodes as $id => $node ) {
			$index[$id] = count( $list );
			$entry = [
				'id' => $id,
				'label' => $node['label'],
				'excerpts' => $node['excerpts'],
				'pages' => count( $node['pages'] ),
			];
			if ( $trackReaders ) {
				$entry['by'] = $node['by'];
			}
			$list[] = $entry;
		}

		$runs = [];
		foreach ( $kinds as $kind ) {
			$runs[$kind] = $this->pack( $edges[$kind], $index );
		}
		return [ 'nodes' => $list, 'runs' => $runs, 'total' => $total ];
	}

	/**
	 * Suma 1 a la arista (a, b) de un grado.
	 *
	 * @param array<int,int> &$edges
	 */
	private function add( array &$edges, int $a, int $b ): void {
		if ( $a === $b ) {
			return;
		}
		$key = $a < $b ? $a * $this->pairBase + $b : $b * $this->pairBase + $a;
		$edges[$key] = ( $edges[$key] ?? 0 ) + 1;
	}

	/**
	 * Solapamientos de una página: cada par de §§ anclados de lectores
	 * distintos que comparten un carácter suma un par a cada combinación de
	 * sus conceptos. Con un tope por página (config), sólo cuentan los
	 * primeros §§ por id: el barrido crece con el cuadrado de los solapados.
	 *
	 * @param array[] $pageExcerpts
	 * @param array<int,int> &$edges
	 */
	private function overlaps( array $pageExcerpts, array &$edges ): void {
		if ( $this->overlapMaxPerPage > 0 && count( $pageExcerpts ) > $this->overlapMaxPerPage ) {
			usort( $pageExcerpts, static fn ( $x, $y ) => $x['id'] <=> $y['id'] );
			$pageExcerpts = array_slice( $pageExcerpts, 0, $this->overlapMaxPerPage );
		}
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
						$this->add( $edges, $ca, $cb );
					}
				}
			}
		}
	}

	/**
	 * Aristas de un grado a tramos [i, n, j1, w1, …] (ver la forma
	 * empaquetada, arriba), ordenadas por i y luego por j.
	 *
	 * @param array<int,int> $edges clave empaquetada → peso
	 * @param array<int,int> $index id de concepto → posición en nodes
	 * @return string enteros separados por comas
	 */
	private function pack( array $edges, array $index ): string {
		ksort( $edges );
		$runs = [];
		$head = -1;
		$size = 0;
		$open = 0;
		foreach ( $edges as $key => $weight ) {
			$a = intdiv( $key, $this->pairBase );
			if ( $a !== $head ) {
				if ( $head !== -1 ) {
					$runs[$open + 1] = $size;
				}
				$head = $a;
				$open = count( $runs );
				$runs[] = $index[$a];
				$runs[] = 0;
				$size = 0;
			}
			$runs[] = $index[$key % $this->pairBase];
			$runs[] = $weight;
			$size++;
		}
		if ( $head !== -1 ) {
			$runs[$open + 1] = $size;
		}
		return implode( ',', $runs );
	}

	/**
	 * Conceptos a los que aportó un lector (sus §§ vigentes, dentro de las
	 * páginas del filtro): la marca `mine` de quien mira.
	 *
	 * @param int $actor
	 * @param int[]|null $pages
	 * @return int[]
	 */
	private function viewerConcepts( int $actor, ?array $pages ): array {
		$db = $this->dbProvider->getReplicaDatabase( ConceptStore::DOMAIN );
		$query = $db->newSelectQueryBuilder()
			->select( 'ccd_concept' )
			->distinct()
			->from( 'constel_coding' )
			->join( 'constel_excerpt', null, 'ce_id = ccd_excerpt' )
			->where( [ 'ce_actor' => $actor ] )
			->where( $db->expr( 'ce_status', '!=', ExcerptRecord::STATUS_FROZEN ) );
		if ( $pages ) {
			$query->where( [ 'ce_page' => $pages ] );
		}
		return array_map( 'intval', $query->caller( __METHOD__ )->fetchFieldValues() );
	}

	/**
	 * @return array<int,array{id:int,actor:int,page:int,status:int,start:int,end:int,concepts:int[]}>
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
		if ( $actors ) {
			$query->where( [ 'ce_actor' => array_values( $actors ) ] );
		}
		if ( $pages ) {
			$query->where( [ 'ce_page' => array_values( $pages ) ] );
		}
		$excerpts = [];
		foreach ( $query->caller( __METHOD__ )->fetchResultSet() as $row ) {
			$id = (int)$row->ccd_excerpt;
			$excerpts[$id] ??= [
				'id' => $id,
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
