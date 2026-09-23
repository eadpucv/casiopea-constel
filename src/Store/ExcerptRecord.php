<?php

namespace MediaWiki\Extension\CasiopeaConstel\Store;

use MediaWiki\Extension\CasiopeaConstel\Domain\TextAnchor;

/**
 * Un § tal como está guardado.
 */
final class ExcerptRecord {

	public const STATUS_ANCHORED = 0;
	public const STATUS_LOST = 1;
	/** Su página fue borrada: sólo se puede borrar; restaurarla lo re-ancla. */
	public const STATUS_FROZEN = 2;

	private const STATUS_NAMES = [
		self::STATUS_ANCHORED => 'anchored',
		self::STATUS_LOST => 'lost',
		self::STATUS_FROZEN => 'frozen',
	];

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

	public function isFrozen(): bool {
		return $this->status === self::STATUS_FROZEN;
	}

	/**
	 * @return string anchored | lost | frozen (API, clases CSS, mensajes)
	 */
	public function statusName(): string {
		return self::STATUS_NAMES[$this->status];
	}
}
