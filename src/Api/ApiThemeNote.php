<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use Wikimedia\ParamValidator\ParamValidator;

/**
 * action=constel-themenote — escribe el desarrollo de un tema propio (uno por
 * tema); un texto vacío lo borra (spec: ReaderWritesThemeDevelopment).
 */
class ApiThemeNote extends ApiThemeWriteBase {

	public function execute() {
		$params = $this->extractRequestParams();
		$actorId = $this->requireAnnotator();
		$theme = $this->requireOwnTheme( $params['theme'], $actorId );
		$text = trim( $params['text'] ) === '' ? '' :
			$this->requireText( $params['text'], 'text', 'ConstelNoteMaxLength' );
		$note = $this->themes->setDevelopment( $theme->id, $text );
		$this->getResult()->addValue( null, $this->getModuleName(), [
			'theme' => $theme->id,
			'development' => $note ? $note->text : null,
		] );
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'theme' => [
				ParamValidator::PARAM_TYPE => 'integer',
				ParamValidator::PARAM_REQUIRED => true,
			],
			'text' => [
				ParamValidator::PARAM_TYPE => 'text',
				ParamValidator::PARAM_DEFAULT => '',
			],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=constel-themenote&theme=1&text=Síntesis&token=123ABC'
				=> 'apihelp-constel-themenote-example-1',
		];
	}
}
