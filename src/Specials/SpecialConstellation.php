<?php

namespace MediaWiki\Extension\CasiopeaConstel\Specials;

use MediaWiki\Extension\CasiopeaConstel\Map\GraphBuilder;
use MediaWiki\Html\Html;
use MediaWiki\SpecialPage\SpecialPage;

/**
 * Especial:Constelación — el mapa de conceptos de todos los lectores
 * (spec: ConceptMap, ThemesPanel, ConceptDetail).
 *
 * Pública: los anónimos ven el mapa y navegan, pero no operan nada
 * (spec: ReadOnlyForAnonymous). El servidor emite una lista navegable de
 * conceptos (spec: AccessibleAlternative, y respaldo sin JS); el cliente
 * dibuja el grafo encima.
 */
class SpecialConstellation extends SpecialPage {

	public function __construct(
		private readonly GraphBuilder $graphBuilder
	) {
		parent::__construct( 'Constellation' );
	}

	/** @inheritDoc */
	public function execute( $subPage ) {
		$this->setHeaders();
		$this->outputHeader( 'constellation-summary' );
		$out = $this->getOutput();
		$user = $this->getUser();

		$out->addJsConfigVars( 'wgConstelMap', [
			'canAnnotate' => $user->isNamed() && $this->getAuthority()->isAllowed( 'constel-annotate' ),
			'canModerate' => $this->getAuthority()->isAllowed( 'constel-moderate' ),
			'full' => true,
			'maxLabels' => max( 1, (int)$this->getConfig()->get( 'ConstelMapMaxLabels' ) ),
			'maxLinks' => max( 1, (int)$this->getConfig()->get( 'ConstelMapMaxDrawnLinks' ) ),
		] );
		$out->addModuleStyles( [ 'ext.constel.map.styles' ] );
		// Pantalla completa: el mapa posee el viewport (barra arriba; grafo y
		// panel mitad y mitad). Stella Nova lo trata como __PANTALLACOMPLETA__
		// (misma propiedad de OutputPage) y absorbe constel-full en su
		// skinStyles; en otros skins el mapa llena la columna de contenido.
		$out->setProperty( 'stellanova-fullscreen', true );
		$out->addBodyClasses( [ 'constel-wide', 'constel-full' ] );
		$out->addModules( [ 'ext.constel.map' ] );

		// La lista sólo necesita frecuencias: un conteo por concepto, sin armar
		// el grafo (el cliente lo pide a la API).
		$out->addHTML( Html::rawElement(
			'div',
			[ 'id' => 'constel-map', 'class' => 'constel-map' ],
			$this->fallbackList( $this->graphBuilder->conceptCounts() )
		) );
	}

	/**
	 * Lista de conceptos por frecuencia (ya vienen ordenados): alternativa
	 * textual del grafo.
	 *
	 * @param array<int,array{label:string,excerpts:int,pages:int}> $concepts
	 */
	private function fallbackList( array $concepts ): string {
		if ( !$concepts ) {
			return Html::element( 'p', [ 'class' => 'constel-map__empty' ],
				$this->msg( 'constellation-empty' )->text() );
		}
		$items = '';
		// Formatear el mensaje (con PLURAL) cuesta unos 0,2 ms; las frecuencias
		// se repiten mucho (pocos conceptos concentran los §§), así que se
		// formatea una vez por cada par distinto.
		$counts = [];
		foreach ( $concepts as $node ) {
			$counts["{$node['excerpts']}:{$node['pages']}"] ??= $this->msg( 'constellation-counts' )
				->numParams( $node['excerpts'], $node['pages'] )->text();
			$items .= Html::rawElement( 'li', [],
				Html::element( 'span', [ 'class' => 'constel-map__label' ], $node['label'] ) . ' ' .
				Html::element( 'span', [ 'class' => 'constel-map__count' ],
					$counts["{$node['excerpts']}:{$node['pages']}"] )
			);
		}
		return Html::rawElement( 'ol', [ 'class' => 'constel-map__fallback' ], $items );
	}

	/** @inheritDoc */
	protected function getGroupName() {
		return 'pages';
	}
}
