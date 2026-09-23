<?php

namespace MediaWiki\Extension\CasiopeaConstel\Specials;

use MediaWiki\Extension\CasiopeaConstel\Domain\SvgExport;
use MediaWiki\SpecialPage\UnlistedSpecialPage;

/**
 * Especial:ConstellationSvg — devuelve como archivo adjunto el SVG del mapa
 * que el cliente ya dibujó y serializó (ext.constel.map, «Exportar SVG»).
 *
 * La descarga la hace el servidor, no una URL blob:/data: del navegador:
 * algunos navegadores (Chrome en macOS, con «preguntar dónde guardar» o sobre
 * http) guardaban esas descargas truncas y sin extensión. Con una respuesta
 * HTTP común el nombre y el tipo los fija Content-Disposition.
 *
 * Sólo POST; qué se acepta y con qué nombre, en Domain\SvgExport. Se sirve
 * como adjunto, con nosniff y CSP sandbox: nunca se muestra inline.
 */
class SpecialConstellationSvg extends UnlistedSpecialPage {

	public function __construct() {
		parent::__construct( 'ConstellationSvg' );
	}

	/** @inheritDoc */
	public function execute( $subPage ) {
		$request = $this->getRequest();
		$svg = $request->wasPosted() ? $request->getText( 'svg' ) : '';
		if ( !SvgExport::isSvg( $svg ) ) {
			$this->getOutput()->setStatusCode( 400 );
			$this->setHeaders();
			$this->getOutput()->addWikiMsg( 'constellation-svg-invalid' );
			return;
		}
		$name = SvgExport::fileName( $request->getText( 'filename' ) );

		$this->getOutput()->disable();
		$response = $request->response();
		$response->header( 'Content-Type: image/svg+xml; charset=utf-8' );
		$response->header( 'Content-Disposition: attachment; filename="' . $name . '"' );
		$response->header( 'Content-Length: ' . strlen( $svg ) );
		$response->header( 'X-Content-Type-Options: nosniff' );
		$response->header( "Content-Security-Policy: default-src 'none'; sandbox" );
		$response->header( 'Cache-Control: private, no-store' );
		print $svg;
	}
}
