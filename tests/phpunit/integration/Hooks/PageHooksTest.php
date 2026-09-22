<?php

namespace MediaWiki\Extension\CasiopeaConstel\Tests\Integration\Hooks;

use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\CasiopeaConstel\Hooks\PageHooks;
use MediaWiki\MainConfigNames;
use MediaWiki\Output\OutputPage;
use MediaWiki\Title\Title;
use MediaWiki\User\User;
use MediaWikiIntegrationTestCase;

/**
 * Quién ve con§tel sobre una página (spec: PageReading.NothingForAnonymous,
 * SelectionPopup.HiddenFromIneligible).
 *
 * @group Database
 * @covers \MediaWiki\Extension\CasiopeaConstel\Hooks\PageHooks
 */
class PageHooksTest extends MediaWikiIntegrationTestCase {

	protected function setUp(): void {
		parent::setUp();
		// SemanticMediaWiki aborta si el idioma de tests difiere del de la wiki.
		$this->overrideConfigValue( MainConfigNames::LanguageCode, 'es' );
	}

	private function display( User $user, Title $title, string $action = 'view' ): OutputPage {
		$context = new RequestContext();
		$context->setUser( $user );
		$context->setTitle( $title );
		$context->setActionName( $action );
		$out = $context->getOutput();
		$out->setRevisionId( $title->getLatestRevID() );
		$hooks = $this->hooks();
		$hooks->onBeforePageDisplay( $out, $context->getSkin() );
		return $out;
	}

	private function hooks(): PageHooks {
		return new PageHooks(
			$this->getServiceContainer()->getNamespaceInfo(),
			$this->getServiceContainer()->getPermissionManager(),
			$this->getServiceContainer()->getUserOptionsLookup()
		);
	}

	private function page(): Title {
		$title = Title::makeTitle( NS_MAIN, 'ConstelHookTest' );
		$this->editPage( $title, 'La travesía abre el espacio.' );
		return $title;
	}

	public function testRegisteredReaderGetsTheReader(): void {
		$title = $this->page();
		$out = $this->display( $this->getTestUser()->getUser(), $title );
		$this->assertContains( 'ext.constel.reader', $out->getModules() );
		$config = $out->getJsConfigVars()['wgConstel'];
		$this->assertSame( $title->getArticleID(), $config['pageId'] );
		$this->assertTrue( $config['canAnnotate'] );
		$this->assertFalse( $config['canModerate'] );
	}

	public function testAnonymousSeesNothingOnPages(): void {
		$anon = $this->getServiceContainer()->getUserFactory()->newAnonymous();
		$this->assertNotContains( 'ext.constel.reader', $this->display( $anon, $this->page() )->getModules() );
	}

	public function testNotOnEditOrNonContentPages(): void {
		$user = $this->getTestUser()->getUser();
		$this->assertNotContains( 'ext.constel.reader', $this->display( $user, $this->page(), 'edit' )->getModules() );
		$talk = Title::makeTitle( NS_TALK, 'ConstelHookTest' );
		$this->editPage( $talk, 'Una discusión.' );
		$this->assertNotContains( 'ext.constel.reader', $this->display( $user, $talk )->getModules() );
	}

	public function testUserWithoutTheRightReadsButCannotAnnotate(): void {
		$this->setGroupPermissions( 'user', 'constel-annotate', false );
		$out = $this->display( $this->getTestUser()->getUser(), $this->page() );
		$this->assertContains( 'ext.constel.reader', $out->getModules() );
		$this->assertFalse( $out->getJsConfigVars()['wgConstel']['canAnnotate'] );
	}

	public function testReaderWhoTurnedItOffSeesNothing(): void {
		$user = $this->getMutableTestUser()->getUser();
		$options = $this->getServiceContainer()->getUserOptionsManager();
		$options->setOption( $user, PageHooks::PREF_ENABLED, 0 );
		$options->saveOptions( $user );
		$this->assertNotContains( 'ext.constel.reader', $this->display( $user, $this->page() )->getModules() );
	}

	public function testUserMenuGetsReadingControlsAndLinks(): void {
		$title = $this->page();
		$context = new RequestContext();
		$context->setUser( $this->getTestUser()->getUser() );
		$context->setTitle( $title );
		$context->setActionName( 'view' );
		$context->getOutput()->setRevisionId( $title->getLatestRevID() );
		$links = [ 'user-menu' => [ 'preferences' => [ 'text' => 'P' ], 'logout' => [ 'text' => 'L' ] ] ];
		$skin = $context->getSkin();
		$skin->setContext( $context );

		$this->hooks()->onSkinTemplateNavigation__Universal( $skin, $links );

		$this->assertSame(
			[
				'preferences', 'constel-mine', 'constel-everyone', 'constel-marks',
				'constel-map', 'constel-myconstel', 'logout',
			],
			array_keys( $links['user-menu'] )
		);
	}

	public function testNoMenuEntriesWhenTurnedOff(): void {
		$user = $this->getMutableTestUser()->getUser();
		$options = $this->getServiceContainer()->getUserOptionsManager();
		$options->setOption( $user, PageHooks::PREF_ENABLED, 0 );
		$options->saveOptions( $user );
		$title = $this->page();
		$context = new RequestContext();
		$context->setUser( $user );
		$context->setTitle( $title );
		$context->setActionName( 'view' );
		$context->getOutput()->setRevisionId( $title->getLatestRevID() );
		$skin = $context->getSkin();
		$skin->setContext( $context );
		$links = [ 'user-menu' => [ 'preferences' => [ 'text' => 'P' ], 'logout' => [ 'text' => 'L' ] ] ];

		$this->hooks()->onSkinTemplateNavigation__Universal( $skin, $links );

		$this->assertSame( [ 'preferences', 'logout' ], array_keys( $links['user-menu'] ) );
	}
}
