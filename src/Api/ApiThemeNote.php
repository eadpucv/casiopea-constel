<?php

namespace MediaWiki\Extension\CasiopeaConstel\Api;

use Wikimedia\ParamValidator\ParamValidator;

/**
 * action=constel-themenote — escribe, edita o borra una nota de desarrollo de
 * un tema propio (spec: ReaderWritesThemeNote, ReaderEditsThemeNote,
 * ReaderDeletesThemeNote).
 */
class ApiThemeNote extends ApiThemeWriteBase {

	public function execute() {
		$params = $this->extractRequestParams();
		$actorId = $this->requireAnnotator();
		$result = [ 'op' => $params['op'] ];

		if ( $params['op'] === 'create' ) {
			$theme = $this->requireOwnTheme( $params['theme'], $actorId );
			$text = $this->requireText( $params['text'], 'text', 'ConstelNoteMaxLength' );
			$result['note'] = $this->themes->addNote( $theme->id, $text )->id;
		} else {
			$note = $params['note'] === null ? null : $this->themes->getNote( $params['note'] );
			if ( !$note ) {
				$this->dieWithError( [ 'apierror-constel-nonote', $params['note'] ?? 0 ], 'nonote' );
			}
			$this->requireOwnTheme( $note->themeId, $actorId );
			if ( $params['op'] === 'edit' ) {
				$text = $this->requireText( $params['text'], 'text', 'ConstelNoteMaxLength' );
				$this->themes->editNote( $note->id, $text );
			} else {
				$this->themes->deleteNote( $note->id );
			}
			$result['note'] = $note->id;
		}
		$this->getResult()->addValue( null, $this->getModuleName(), $result );
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'op' => [
				ParamValidator::PARAM_TYPE => [ 'create', 'edit', 'delete' ],
				ParamValidator::PARAM_REQUIRED => true,
			],
			'theme' => [ ParamValidator::PARAM_TYPE => 'integer' ],
			'note' => [ ParamValidator::PARAM_TYPE => 'integer' ],
			'text' => [ ParamValidator::PARAM_TYPE => 'text' ],
		];
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=constel-themenote&op=create&theme=1&text=Síntesis&token=123ABC'
				=> 'apihelp-constel-themenote-example-1',
		];
	}
}
