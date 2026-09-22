<?php

namespace MediaWiki\Extension\CasiopeaConstel\Store;

/**
 * Un concepto del vocabulario global. `label` es la forma canónica: identidad
 * y rótulo visible a la vez.
 */
final class ConceptRecord {

	public function __construct(
		public readonly int $id,
		public readonly string $label
	) {
	}
}
