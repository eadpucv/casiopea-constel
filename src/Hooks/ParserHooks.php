<?php

namespace MediaWiki\Extension\CasiopeaConstel\Hooks;

use MediaWiki\Hook\ParserFirstCallInitHook;
use MediaWiki\Html\Html;
use MediaWiki\Parser\Parser;

/**
 * {{#constel: …}} — inserta el mapa de conceptos, limpio (sin controles), en
 * cualquier página. Todos los parámetros son opcionales:
 *
 *   usuario=      lectores cuyas secciones se ven, separados por «;»
 *                 (por omisión, todos)
 *   concepto=     concepto de foco (se resalta y se centra)
 *   modo=         2d (por omisión) o 3d
 *   girar=        sí/no — gira solo (3d)
 *   aristas=      sí (por omisión) / no
 *   conceptos=    palabras (por omisión) o nodos
 *   paginas=      sólo las secciones de estas páginas, separadas por «;»
 *   alto=         alto del mapa (480px por omisión)
 *   class=        clases CSS que se suman al contenedor (p. ej. full-width)
 *   fuerza-seccion, fuerza-traslape, fuerza-pagina, fuerza-tema = 0–100
 *
 * El HTML sólo lleva los parámetros ya saneados en un data-*: el parser cache
 * lo conserva igual para todos y el cliente (ext.constel.embed) dibuja el
 * mapa, así que nada depende de quién mira.
 */
class ParserHooks implements ParserFirstCallInitHook {

	private const DEFAULT_HEIGHT = '480px';

	/** @inheritDoc */
	public function onParserFirstCallInit( $parser ) {
		$parser->setFunctionHook( 'constel', [ $this, 'render' ] );
	}

	/**
	 * @param Parser $parser
	 * @param string ...$args «clave=valor» (los sin «=» se ignoran)
	 * @return array
	 */
	public function render( Parser $parser, string ...$args ): array {
		$opts = [];
		foreach ( $args as $arg ) {
			if ( str_contains( $arg, '=' ) ) {
				[ $key, $value ] = explode( '=', $arg, 2 );
				$opts[mb_strtolower( trim( $key ) )] = trim( $value );
			}
		}

		$config = [
			'readers' => $this->list( $opts['usuario'] ?? '' ),
			'pages' => $this->list( $opts['paginas'] ?? '' ),
			'concept' => $opts['concepto'] ?? '',
			'mode' => ( $opts['modo'] ?? '' ) === '3d' ? '3d' : '2d',
			'autorotate' => $this->flag( $opts['girar'] ?? null, false ),
			'edges' => $this->flag( $opts['aristas'] ?? null, true ),
			'concepts' => ( $opts['conceptos'] ?? '' ) === 'nodos' ? 'nodes' : 'words',
		];
		$forces = [];
		foreach ( [
			'fuerza-seccion' => 'co_excerpt',
			'fuerza-traslape' => 'overlap',
			'fuerza-pagina' => 'co_page',
			'fuerza-tema' => 'theme',
		] as $name => $kind ) {
			if ( isset( $opts[$name] ) && is_numeric( $opts[$name] ) ) {
				$forces[$kind] = max( 0, min( 100, (float)$opts[$name] ) ) / 100;
			}
		}
		if ( $forces ) {
			$config['forces'] = $forces;
		}

		$height = $opts['alto'] ?? '';
		if ( !preg_match( '/^\d+(\.\d+)?(px|em|rem|vh|dvh|%)$/', $height ) ) {
			$height = self::DEFAULT_HEIGHT;
		}

		$classes = [ 'constel-embed' ];
		foreach ( preg_split( '/\s+/', $opts['class'] ?? '', -1, PREG_SPLIT_NO_EMPTY ) as $class ) {
			// Sólo nombres de clase razonables: nada que rompa el atributo.
			if ( preg_match( '/^[A-Za-z_][A-Za-z0-9_-]*$/', $class ) ) {
				$classes[] = $class;
			}
		}

		$out = $parser->getOutput();
		$out->addModuleStyles( [ 'ext.constel.map.styles' ] );
		$out->addModules( [ 'ext.constel.embed' ] );

		$html = Html::rawElement( 'div', [
			'class' => $classes,
			'style' => "height:$height",
			'data-constel' => json_encode( $config, JSON_UNESCAPED_UNICODE ),
		], Html::element( 'p', [ 'class' => 'constel-embed__fallback' ],
			wfMessage( 'constel-embed-nojs' )->inContentLanguage()->text() ) );

		return [ $html, 'noparse' => true, 'isHTML' => true ];
	}

	/** @return string[] */
	private function list( string $value ): array {
		return array_values( array_filter( array_map( 'trim', explode( ';', $value ) ),
			static fn ( string $v ) => $v !== '' ) );
	}

	private function flag( ?string $value, bool $default ): bool {
		if ( $value === null || $value === '' ) {
			return $default;
		}
		return !in_array( mb_strtolower( $value ), [ 'no', 'false', '0', 'off', 'não' ], true );
	}
}
