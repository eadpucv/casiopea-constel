<?php

namespace MediaWiki\Extension\CasiopeaConstel\Domain;

use DOMElement;
use DOMNode;
use Wikimedia\RemexHtml\DOM\DOMBuilder;
use Wikimedia\RemexHtml\HTMLData;
use Wikimedia\RemexHtml\Tokenizer\Tokenizer;
use Wikimedia\RemexHtml\TreeBuilder\Dispatcher;
use Wikimedia\RemexHtml\TreeBuilder\TreeBuilder;

/**
 * El texto canónico de una página: la base común de todas las posiciones de
 * anclaje (docs/ARCHITECTURE.md § Anclaje).
 *
 * Es la concatenación, en orden de documento, de los nodos de texto del
 * cuerpo renderizado, saltando los subárboles excluidos. El cliente recorre
 * el DOM con EXACTAMENTE la misma regla y la misma lista, que se le exporta
 * desde aquí (exclusions()), para que servidor y navegador midan igual.
 */
class CanonicalText {

	/** Elementos cuyo contenido nunca es texto de lectura. */
	private const EXCLUDED_TAGS = [ 'script', 'style', 'noscript', 'template' ];

	/**
	 * Clases de chrome dentro del cuerpo: enlaces de edición de sección, y lo
	 * que añaden scripts del cliente (conmutadores de colapsables, flechas de
	 * tablas ordenables) y que el HTML del servidor no trae.
	 */
	private const EXCLUDED_CLASSES = [
		'mw-editsection',
		'mw-cite-backlink',
		'mw-empty-elt',
		'mw-collapsible-toggle',
		'mw-collapsible-toggle-placeholder',
		// Índice clásico (skins legacy); los skins modernos lo sacan del cuerpo.
		'toc',
		'constel-ui',
	];

	/**
	 * @return array{tags:string[],classes:string[]} Para exportar al cliente.
	 */
	public static function exclusions(): array {
		return [
			'tags' => self::EXCLUDED_TAGS,
			'classes' => self::EXCLUDED_CLASSES,
		];
	}

	/**
	 * @param string $html HTML del cuerpo (contenido de .mw-parser-output).
	 */
	public function fromHtml( string $html ): string {
		$domBuilder = new DOMBuilder( [ 'suppressHtmlNamespace' => true ] );
		$treeBuilder = new TreeBuilder( $domBuilder, [ 'ignoreErrors' => true ] );
		$tokenizer = new Tokenizer( new Dispatcher( $treeBuilder ), $html, [ 'ignoreErrors' => true ] );
		$tokenizer->execute( [
			'fragmentNamespace' => HTMLData::NS_HTML,
			'fragmentName' => 'body',
		] );
		$buffer = '';
		$this->collect( $domBuilder->getFragment(), $buffer );
		return $buffer;
	}

	private function collect( DOMNode $node, string &$buffer ): void {
		foreach ( $node->childNodes as $child ) {
			if ( $child->nodeType === XML_TEXT_NODE || $child->nodeType === XML_CDATA_SECTION_NODE ) {
				$buffer .= $child->nodeValue;
			} elseif ( $child instanceof DOMElement && !$this->isExcluded( $child ) ) {
				$this->collect( $child, $buffer );
			}
		}
	}

	private function isExcluded( DOMElement $element ): bool {
		if ( in_array( strtolower( $element->tagName ), self::EXCLUDED_TAGS, true ) ) {
			return true;
		}
		$class = $element->getAttribute( 'class' );
		if ( $class === '' ) {
			return false;
		}
		$classes = preg_split( '/\s+/', trim( $class ) );
		return (bool)array_intersect( $classes, self::EXCLUDED_CLASSES );
	}
}
