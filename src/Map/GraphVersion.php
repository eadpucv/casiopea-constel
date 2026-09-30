<?php

namespace MediaWiki\Extension\CasiopeaConstel\Map;

use Wikimedia\ObjectCache\WANObjectCache;
use Wikimedia\Rdbms\IDatabase;

/**
 * La marca de vigencia del grafo cacheado (spec: ConceptMap, GraphIsCached).
 *
 * Toda escritura que cambia lo que el mapa dibuja (§§, codificaciones,
 * anclas, estados y rótulos de concepto) toca esta clave de contacto; el
 * grafo guardado en WANObjectCache se descarta si es más viejo que el último
 * contacto. Se toca al resolverse la transacción, no antes: así nadie
 * vuelve a guardar el grafo viejo después del contacto.
 */
class GraphVersion {

	private bool $pending = false;

	public function __construct(
		private readonly WANObjectCache $cache
	) {
	}

	public function checkKey(): string {
		return $this->cache->makeKey( 'casiopea-constel', 'graph-touch' );
	}

	/**
	 * Marca el grafo como vencido cuando la transacción de $dbw se resuelva
	 * (se confirme o se revierta: tocar de más es inocuo, tocar de menos no).
	 */
	public function touch( IDatabase $dbw ): void {
		$touch = function () {
			$this->pending = false;
			$this->cache->touchCheckKey( $this->checkKey() );
		};
		if ( !$dbw->trxLevel() ) {
			// Sin transacción abierta la escritura ya está confirmada.
			$touch();
			return;
		}
		// Un solo contacto por transacción, aunque se escriban muchos §§
		// (el re-anclaje de una página recorre todos los suyos).
		if ( $this->pending ) {
			return;
		}
		$this->pending = true;
		$dbw->onTransactionResolution( $touch, __METHOD__ );
	}
}
