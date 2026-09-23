<?php

namespace MediaWiki\Extension\CasiopeaConstel\Specials;

use MediaWiki\Extension\CasiopeaConstel\Map\GraphBuilder;
use MediaWiki\Html\Html;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\User\ActorNormalization;
use Wikimedia\Rdbms\IConnectionProvider;

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
		private readonly GraphBuilder $graphBuilder,
		private readonly ActorNormalization $actorNormalization,
		private readonly IConnectionProvider $dbProvider
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
		] );
		$out->addModuleStyles( [ 'ext.constel.map.styles' ] );
		// Pantalla completa: el mapa posee el viewport (barra arriba; grafo y
		// panel mitad y mitad). Stella Nova lo trata como __PANTALLACOMPLETA__
		// (misma propiedad de OutputPage) y absorbe constel-full en su
		// skinStyles; en otros skins el mapa llena la columna de contenido.
		$out->setProperty( 'stellanova-fullscreen', true );
		$out->addBodyClasses( [ 'constel-wide', 'constel-full' ] );
		$out->addModules( [ 'ext.constel.map' ] );

		$viewer = $user->isRegistered()
			? $this->actorNormalization->findActorId( $user, $this->dbProvider->getReplicaDatabase() )
			: null;
		$graph = $this->graphBuilder->build( null, null, $viewer );
		$out->addHTML( Html::rawElement(
			'div',
			[ 'id' => 'constel-map', 'class' => 'constel-map' ],
			$this->fallbackList( $graph )
		) );
	}

	/**
	 * Lista de conceptos por frecuencia: alternativa textual del grafo.
	 */
	private function fallbackList( array $graph ): string {
		if ( !$graph['nodes'] ) {
			return Html::element( 'p', [ 'class' => 'constel-map__empty' ],
				$this->msg( 'constellation-empty' )->text() );
		}
		$nodes = $graph['nodes'];
		usort( $nodes, static fn ( $a, $b ) => [ $b['excerpts'], $a['label'] ] <=> [ $a['excerpts'], $b['label'] ] );
		$items = '';
		foreach ( $nodes as $node ) {
			$items .= Html::rawElement( 'li', [],
				Html::element( 'span', [ 'class' => 'constel-map__label' ], $node['label'] ) . ' ' .
				Html::element( 'span', [ 'class' => 'constel-map__count' ],
					$this->msg( 'constellation-counts' )->numParams( $node['excerpts'], $node['pages'] )->text() )
			);
		}
		return Html::rawElement( 'ol', [ 'class' => 'constel-map__fallback' ], $items );
	}

	/** @inheritDoc */
	protected function getGroupName() {
		return 'pages';
	}
}
