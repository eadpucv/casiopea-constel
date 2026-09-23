<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use Wikimedia\ParamValidator\ParamValidator;

/**
 * action=constel-theme — crea, renombra o borra un tema propio
 * (spec: ReaderCreatesTheme, ReaderRenamesTheme, ReaderDeletesTheme).
 */
class ApiTheme extends ApiThemeWriteBase {

	public function execute() {
		$params = $this->extractRequestParams();
		// Borrar el tema propio no pide el derecho de anotar (spec: RightToWithdraw).
		$actorId = $params['op'] === 'delete' ? $this->requireReader() : $this->requireAnnotator();
		$result = [ 'op' => $params['op'] ];

		switch ( $params['op'] ) {
			case 'create':
				$label = $this->requireText( $params['label'], 'label', 'ConstelThemeLabelMaxLength' );
				$result['theme'] = $this->themes->create( $actorId, $label )->id;
				break;
			case 'rename':
				$theme = $this->requireOwnTheme( $params['theme'], $actorId );
				$label = $this->requireText( $params['label'], 'label', 'ConstelThemeLabelMaxLength' );
				$this->themes->rename( $theme->id, $label );
				$result['theme'] = $theme->id;
				break;
			case 'delete':
				$theme = $this->requireOwnTheme( $params['theme'], $actorId );
				$this->themes->delete( $theme->id );
				$result['theme'] = $theme->id;
				break;
		}
		$this->getResult()->addValue( null, $this->getModuleName(), $result );
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'op' => [
				ParamValidator::PARAM_TYPE => [ 'create', 'rename', 'delete' ],
				ParamValidator::PARAM_REQUIRED => true,
			],
			'theme' => [ ParamValidator::PARAM_TYPE => 'integer' ],
			'label' => [ ParamValidator::PARAM_TYPE => 'string' ],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=constel-theme&op=create&label=Lugar&token=123ABC'
				=> 'apihelp-constel-theme-example-1',
		];
	}
}
