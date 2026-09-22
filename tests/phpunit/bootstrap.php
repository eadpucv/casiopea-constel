<?php
/**
 * Bootstrap de los tests UNITARIOS (dominio puro, sin BBDD ni servicios).
 *
 * Corren con el PHPUnit de la extensión (`composer phpunit`), sin levantar
 * MediaWiki. Sólo toman del core las librerías de vendor/ que el dominio usa
 * (RemexHtml). Los tests de integración (stores, API, job) se corren desde el
 * core con MediaWikiIntegrationTestCase.
 */

require_once dirname( __DIR__, 2 ) . '/vendor/autoload.php';

$repo = dirname( __DIR__, 2 );
$candidates = array_filter( [
	getenv( 'MW_INSTALL_PATH' ) ?: null,
	// Instalación estándar: <mw>/extensions/casiopea-constel
	dirname( $repo, 2 ),
	// Réplica local Casiopea: ~/Sites/casiopea/{extensions/casiopea-constel,w}
	dirname( $repo, 2 ) . '/w',
] );
foreach ( $candidates as $mw ) {
	if ( is_file( "$mw/vendor/autoload.php" ) && is_file( "$mw/includes/Setup.php" ) ) {
		require_once "$mw/vendor/autoload.php";
		break;
	}
}

spl_autoload_register( static function ( string $class ) use ( $repo ): void {
	$prefix = 'MediaWiki\\Extension\\CasiopeaConstel\\';
	if ( str_starts_with( $class, $prefix ) ) {
		$file = "$repo/src/" . str_replace( '\\', '/', substr( $class, strlen( $prefix ) ) ) . '.php';
		if ( is_file( $file ) ) {
			require_once $file;
		}
	}
} );
