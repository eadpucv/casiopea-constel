<?php

namespace MediaWiki\Extension\CasiopeaConstel\Export;

use MediaWiki\Extension\CasiopeaConstel\Domain\AnchorLocator;
use MediaWiki\Extension\CasiopeaConstel\Page\RenderedTextProvider;
use MediaWiki\Extension\CasiopeaConstel\Store\ConceptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ExcerptStore;
use MediaWiki\Extension\CasiopeaConstel\Store\ThemeStore;
use MediaWiki\Page\PageStore;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Title\TitleFormatter;
use RuntimeException;
use ZipArchive;

/**
 * Exporta la lectura de un lector al formato del constel standalone
 * (spec: ReaderExportsReading): un ZIP con constel-db.json (version 1) y un
 * corpus/<página>.txt por página, que el "Importar" de constel v0.2.x abre.
 *
 * Diferencias de medida que hay que traducir:
 *  - constel mide en unidades UTF-16 (índices de string JS); aquí, en code points.
 *  - constel lee el cuerpo del .txt sin frontmatter y con trim(): los offsets
 *    se recalculan sobre ese cuerpo.
 * Los §§ perdidos no se exportan: no tienen texto vigente donde ubicarse.
 */
class ExportBuilder {

	/** La paleta de temas de constel (state.js), para que el mapa se vea igual allá. */
	private const THEME_COLORS = [
		'#2d6a5a', '#6366f1', '#d97706', '#dc2626', '#7c3aed', '#0891b2',
		'#65a30d', '#be185d', '#0d9488', '#4338ca', '#ea580c', '#9333ea',
	];

	public function __construct(
		private readonly ExcerptStore $excerpts,
		private readonly ConceptStore $concepts,
		private readonly ThemeStore $themes,
		private readonly PageStore $pageStore,
		private readonly RevisionLookup $revisionLookup,
		private readonly RenderedTextProvider $renderedText,
		private readonly AnchorLocator $locator,
		private readonly TitleFormatter $titleFormatter
	) {
	}

	/**
	 * @return array{db: array, files: array<string,string>} la base y los textos
	 */
	public function build( int $actorId, string $server ): array {
		$now = gmdate( 'Y-m-d\TH:i:s\Z' );
		$db = [
			'version' => 1, 'updatedAt' => $now, 'sessionId' => '',
			'sources' => [], 'excerpts' => [], 'concepts' => [], 'themes' => [], 'notes' => [],
		];
		$files = [];

		// Temas propios y la pertenencia concepto→tema de este lector.
		$themeOf = [];
		foreach ( $this->themes->listForActor( $actorId ) as $i => $theme ) {
			$db['themes']["thm_{$theme->id}"] = [
				'id' => "thm_{$theme->id}",
				'label' => $theme->label,
				'color' => self::THEME_COLORS[$i % count( self::THEME_COLORS )],
				'sortOrder' => $i,
				'createdAt' => $this->iso( $theme->created ),
			];
			foreach ( $this->themes->conceptIds( $theme->id ) as $conceptId ) {
				$themeOf[$conceptId] = "thm_{$theme->id}";
			}
			foreach ( $this->themes->listNotes( $theme->id ) as $note ) {
				$db['notes']["note_{$note->id}"] = [
					'id' => "note_{$note->id}",
					'themeId' => "thm_{$theme->id}",
					'text' => $note->text,
					'updatedAt' => $this->iso( $note->updated ),
				];
			}
		}

		// §§ anclados, agrupados por página.
		$byPage = [];
		foreach ( $this->excerpts->listForActor( $actorId, 100000 ) as $excerpt ) {
			if ( $excerpt->isAnchored() ) {
				$byPage[$excerpt->pageId][] = $excerpt;
			}
		}
		$usedConcepts = array_keys( $themeOf );
		$names = [];
		foreach ( $byPage as $pageId => $pageExcerpts ) {
			$page = $this->pageStore->getPageById( $pageId );
			$revision = $page ? $this->revisionLookup->getRevisionById( $page->getLatest() ) : null;
			$text = $revision ? $this->renderedText->forRevision( $page, $revision ) : null;
			if ( $text === null ) {
				continue;
			}
			$title = $this->titleFormatter->getPrefixedText( $page );
			$filename = $this->filename( $title, $pageId, $names );
			$body = trim( $text );
			$lead = mb_strlen( $text ) - mb_strlen( ltrim( $text ) );

			$sourceId = "src_$pageId";
			$db['sources'][$sourceId] = [
				'id' => $sourceId,
				'filename' => $filename,
				'title' => $title,
				'author' => '',
				'date' => substr( $revision->getTimestamp(), 0, 4 ) . '-' . substr( $revision->getTimestamp(), 4, 2 )
					. '-' . substr( $revision->getTimestamp(), 6, 2 ),
				'wordCount' => count( preg_split( '/\s+/u', $body, -1, PREG_SPLIT_NO_EMPTY ) ),
				'addedAt' => $now,
			];
			$files["corpus/$filename"] = "---\ntitle: $title\nurl: $server/index.php?curid=$pageId\n---\n\n$body\n";

			foreach ( $pageExcerpts as $excerpt ) {
				$anchor = $excerpt->revId === $revision->getId()
					? $excerpt->anchor
					: $this->locator->locate( $excerpt->anchor, $text );
				if ( !$anchor ) {
					continue;
				}
				$conceptIds = $this->excerpts->conceptIds( $excerpt->id );
				array_push( $usedConcepts, ...$conceptIds );
				$db['excerpts']["exc_{$excerpt->id}"] = [
					'id' => "exc_{$excerpt->id}",
					'sourceId' => $sourceId,
					'text' => $anchor->exact,
					'start' => $this->utf16Offset( $body, $anchor->start - $lead ),
					'end' => $this->utf16Offset( $body, $anchor->end - $lead ),
					'conceptIds' => array_map( static fn ( $c ) => "con_$c", $conceptIds ),
					// Campo propio de Casiopea-Con§tel; constel lo conserva al importar.
					'gloss' => $excerpt->gloss,
					'createdAt' => $this->iso( $excerpt->created ),
				];
			}
		}

		foreach ( $this->concepts->getByIds( $usedConcepts ) as $concept ) {
			$db['concepts']["con_{$concept->id}"] = [
				'id' => "con_{$concept->id}",
				'label' => $concept->label,
				'themeId' => $themeOf[$concept->id] ?? null,
				'createdAt' => $now,
			];
		}
		return [ 'db' => $db, 'files' => $files ];
	}

	/**
	 * @return string el ZIP en bytes
	 */
	public function zip( array $export ): string {
		$path = tempnam( sys_get_temp_dir(), 'constel' );
		$zip = new ZipArchive();
		if ( $zip->open( $path, ZipArchive::OVERWRITE ) !== true ) {
			throw new RuntimeException( 'No se pudo crear el ZIP de exportación' );
		}
		$zip->addFromString(
			'constel-db.json',
			json_encode( $export['db'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES )
		);
		foreach ( $export['files'] as $name => $content ) {
			$zip->addFromString( $name, $content );
		}
		$zip->close();
		$bytes = file_get_contents( $path );
		unlink( $path );
		return $bytes;
	}

	/**
	 * Offset en unidades UTF-16 (lo que usa constel) de un code point.
	 */
	private function utf16Offset( string $text, int $codePoint ): int {
		$prefix = mb_substr( $text, 0, max( 0, $codePoint ) );
		return intdiv( strlen( mb_convert_encoding( $prefix, 'UTF-16LE', 'UTF-8' ) ), 2 );
	}

	/**
	 * @param string $title
	 * @param int $pageId
	 * @param array<string,bool> &$taken
	 */
	private function filename( string $title, int $pageId, array &$taken ): string {
		$base = trim( preg_replace( '/[\/\\\\:*?"<>|]+/u', '-', $title ) ) ?: "pagina-$pageId";
		$name = "$base.txt";
		if ( isset( $taken[$name] ) ) {
			$name = "$base ($pageId).txt";
		}
		$taken[$name] = true;
		return $name;
	}

	private function iso( string $mwTimestamp ): string {
		return wfTimestamp( TS_ISO_8601, $mwTimestamp );
	}
}
