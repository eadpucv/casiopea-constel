<?php

namespace MediaWiki\Extension\CasiopeaConstel\Store;

/**
 * Una nota de desarrollo de un tema.
 */
final class NoteRecord {

	public function __construct(
		public readonly int $id,
		public readonly int $themeId,
		public readonly string $text,
		public readonly string $updated
	) {
	}
}
