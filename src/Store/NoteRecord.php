<?php

namespace MediaWiki\Extension\CasiopeaConstel\Store;

/**
 * El desarrollo de un tema (uno por tema; en el export de constel, una
 * «note» del tema).
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
