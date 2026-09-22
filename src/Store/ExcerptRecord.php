<?php

namespace MediaWiki\Extension\CasiopeaConstel\Store;

use MediaWiki\Extension\CasiopeaConstel\Domain\TextAnchor;

/**
 * Un § tal como está guardado.
 */
final class ExcerptRecord {

	public const STATUS_ANCHORED = 0;
	public const STATUS_LOST = 1;

	public function __construct(
		public readonly int $id,
		public readonly int $actorId,
		public readonly int $pageId,
		public readonly int $revId,
		public readonly TextAnchor $anchor,
		public readonly int $status,
		public readonly string $created,
		public readonly ?string $lost,
		public readonly ?string $gloss = null
	) {
	}

	public function isAnchored(): bool {
		return $this->status === self::STATUS_ANCHORED;
	}
}
