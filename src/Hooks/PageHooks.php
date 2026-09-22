<?php

namespace MediaWiki\Extension\CasiopeaConstel\Hooks;

use MediaWiki\Context\IContextSource;
use MediaWiki\Hook\SkinTemplateNavigation__UniversalHook;
use MediaWiki\Output\Hook\BeforePageDisplayHook;
use MediaWiki\Output\OutputPage;
use MediaWiki\Permissions\PermissionManager;
use MediaWiki\Preferences\Hook\GetPreferencesHook;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Title\NamespaceInfo;
use MediaWiki\User\Options\UserOptionsLookup;
use Skin;

/**
 * Pone con§tel sobre la página que se lee (spec: SelectionPopup, PageReading)
 * y sus controles en el menú de usuario (ReadingControlsReachable).
 *
 * Todo ocurre en la salida, nunca en el parseo: el HTML cacheado de la
 * página no cambia (spec: ContentUntouched).
 */
class PageHooks implements
	BeforePageDisplayHook,
	GetPreferencesHook,
	SkinTemplateNavigation__UniversalHook
{

	/**
	 * Preferencia: con§tel activado en las páginas. Desactivada por defecto:
	 * cada lector la activa en su pestaña de preferencias (o el sitio cambia
	 * el default con $wgDefaultUserOptions['constel-enabled']).
	 */
	public const PREF_ENABLED = 'constel-enabled';
	/** Preferencia oculta: el lector ya vio que sus anotaciones son públicas. */
	public const PREF_PUBLIC_ACK = 'constel-public-ack';

	public function __construct(
		private readonly NamespaceInfo $namespaceInfo,
		private readonly PermissionManager $permissionManager,
		private readonly UserOptionsLookup $userOptionsLookup
	) {
	}

	/**
	 * ¿Esta vista lleva la lectura con§tel? Sólo cuentas registradas que no
	 * la desactivaron, en la vista de la revisión vigente de una página de
	 * contenido (spec: NothingForAnonymous, DisabledByPreference).
	 */
	private function isReaderView( IContextSource $context ): bool {
		$user = $context->getUser();
		$title = $context->getTitle();
		$out = $context->getOutput();
		return $user->isNamed()
			&& $this->userOptionsLookup->getBoolOption( $user, self::PREF_ENABLED )
			&& $title
			&& $context->getActionName() === 'view'
			&& !$context->getRequest()->getCheck( 'diff' )
			&& $title->exists() && !$title->isRedirect()
			&& $this->namespaceInfo->isContent( $title->getNamespace() )
			// Los §§ se anclan a la revisión vigente: nada en revisiones viejas.
			&& $out->isRevisionCurrent();
	}

	/**
	 * @param OutputPage $out
	 * @param Skin $skin
	 */
	public function onBeforePageDisplay( $out, $skin ): void {
		if ( !$this->isReaderView( $out->getContext() ) ) {
			return;
		}
		$user = $out->getUser();
		$title = $out->getTitle();
		$canAnnotate = $this->permissionManager->userCan(
			'constel-annotate', $user, $title, PermissionManager::RIGOR_FULL
		);
		$out->addJsConfigVars( 'wgConstel', [
			'pageId' => $title->getArticleID(),
			'revId' => $title->getLatestRevID(),
			'canAnnotate' => $canAnnotate,
			'canModerate' => $this->permissionManager->userHasRight( $user, 'constel-moderate' ),
		] );
		$out->addModuleStyles( [ 'ext.constel.reader.styles' ] );
		$out->addModules( [ 'ext.constel.reader' ] );
	}

	/**
	 * Controles de lectura y accesos en el menú de usuario, antes de "Salir".
	 * Los controles funcionan con JS (ext.constel.reader); sin JS se ocultan.
	 *
	 * @inheritDoc
	 */
	public function onSkinTemplateNavigation__Universal( $sktemplate, &$links ): void {
		$user = $sktemplate->getUser();
		// Con con§tel desactivado en las preferencias, el menú no lo menciona.
		if ( !$user->isNamed() || !isset( $links['user-menu'] )
			|| !$this->userOptionsLookup->getBoolOption( $user, self::PREF_ENABLED )
		) {
			return;
		}
		$items = [];
		if ( $this->isReaderView( $sktemplate ) ) {
			foreach ( [ 'constel-mine', 'constel-everyone', 'constel-marks' ] as $key ) {
				$items[$key] = [
					'text' => $sktemplate->msg( "$key-menu" )->text(),
					'href' => '#',
					'class' => 'constel-menu-toggle',
				];
			}
		}
		$items['constel-map'] = [
			'text' => $sktemplate->msg( 'constellation' )->text(),
			'href' => SpecialPage::getTitleFor( 'Constellation' )->getLocalURL(),
		];
		$items['constel-myconstel'] = [
			'text' => $sktemplate->msg( 'myconstel' )->text(),
			'href' => SpecialPage::getTitleFor( 'MyConstel' )->getLocalURL(),
		];

		$menu = [];
		foreach ( $links['user-menu'] as $key => $item ) {
			if ( $key === 'logout' ) {
				$menu += $items;
			}
			$menu[$key] = $item;
		}
		$links['user-menu'] = $menu + $items;
	}

	/**
	 * @inheritDoc
	 */
	public function onGetPreferences( $user, &$preferences ) {
		$preferences[self::PREF_ENABLED] = [
			'type' => 'toggle',
			// Pestaña propia: no es una opción de apariencia.
			'section' => 'constel/constel-activation',
			'label-message' => 'constel-pref-enabled',
			'help-message' => 'constel-pref-enabled-help',
		];
		$preferences[self::PREF_PUBLIC_ACK] = [ 'type' => 'api' ];
	}
}
