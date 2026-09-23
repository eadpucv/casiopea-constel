<?php

namespace MediaWiki\Extension\CasiopeaConstel\Page;

use LogEventsList;
use LogPage;
use MediaWiki\CommentStore\CommentStore;
use MediaWiki\Permissions\Authority;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\SelectQueryBuilder;

/**
 * Qué se sabe del borrado de una página, según Especial:Registro/delete y lo
 * que quien mira puede ver de él (título y motivo pueden estar ocultos). Un
 * borrado suprimido no está en ese registro: no se sabe nada.
 */
class DeletionLog {

	public function __construct(
		private readonly IConnectionProvider $dbProvider,
		private readonly CommentStore $commentStore
	) {
	}

	/**
	 * @param int[] $pageIds page_id que tenían las páginas al borrarse
	 * @return array<int,array{title:?Title,reason:?string,timestamp:string}>
	 *  el último borrado de cada página que figure en el registro
	 */
	public function lastDeletions( array $pageIds, Authority $viewer ): array {
		if ( !$pageIds ) {
			return [];
		}
		$res = $this->dbProvider->getReplicaDatabase()->newSelectQueryBuilder()
			->select( [ 'log_page', 'log_namespace', 'log_title', 'log_timestamp', 'log_deleted' ] )
			->from( 'logging' )
			->queryInfo( $this->commentStore->getJoin( 'log_comment' ) )
			->where( [
				'log_type' => 'delete',
				'log_action' => 'delete',
				'log_page' => array_values( array_unique( $pageIds ) ),
			] )
			->orderBy( [ 'log_timestamp', 'log_id' ], SelectQueryBuilder::SORT_DESC )
			->caller( __METHOD__ )->fetchResultSet();

		$out = [];
		foreach ( $res as $row ) {
			$pageId = (int)$row->log_page;
			if ( isset( $out[$pageId] ) ) {
				continue;
			}
			$bits = (int)$row->log_deleted;
			$reason = LogEventsList::userCanBitfield( $bits, LogPage::DELETED_COMMENT, $viewer )
				? trim( $this->commentStore->getComment( 'log_comment', $row )->text )
				: null;
			$out[$pageId] = [
				'title' => LogEventsList::userCanBitfield( $bits, LogPage::DELETED_ACTION, $viewer )
					? Title::makeTitle( (int)$row->log_namespace, $row->log_title )
					: null,
				'reason' => $reason === '' ? null : $reason,
				'timestamp' => $row->log_timestamp,
			];
		}
		return $out;
	}
}
