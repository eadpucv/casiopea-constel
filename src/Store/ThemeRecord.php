<?php

namespace MediaWiki\Extension\CasiopeaConstel\Store;

/**
 * Un tema: metacategoría personal de su dueño, visible para todos.
 */
final class ThemeRecord {

	public function __construct(
		public readonly int $id,
		public readonly int $actorId,
		public readonly string $label,
		public readonly string $created
	) {
	}
}
