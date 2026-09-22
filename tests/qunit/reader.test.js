/**
 * Lógica pura del cliente: debe medir y ubicar exactamente como el servidor
 * (AnchorLocatorTest / TextAnchorTest en PHP).
 */
QUnit.module( 'ext.constel.reader', () => {
	const { canonical, locate } = require( 'ext.constel.reader' );

	const anchorOf = ( text, exact, nth, context ) => {
		const index = new canonical.TextIndex( text );
		let unit = -1;
		for ( let i = 0; i <= ( nth || 0 ); i++ ) {
			unit = text.indexOf( exact, unit + 1 );
		}
		const start = index.cpOf( unit );
		const end = start + Array.from( exact ).length;
		return {
			exact,
			prefix: index.slice( Math.max( 0, start - context ), start ),
			suffix: index.slice( end, Math.min( index.length, end + context ) ),
			start
		};
	};

	QUnit.test( 'TextIndex mide en code points', ( assert ) => {
		const index = new canonical.TextIndex( 'a😀ño' );
		assert.strictEqual( index.length, 4, 'un emoji es un code point' );
		assert.strictEqual( index.slice( 1, 3 ), '😀ñ' );
		assert.strictEqual( index.cpOf( 3 ), 2, 'la unidad UTF-16 3 cae en el code point 2' );
	} );

	QUnit.test( 'sigue el pasaje cuando se inserta texto antes', ( assert ) => {
		const anchor = anchorOf( 'La travesía abre el espacio.', 'travesía', 0, 8 );
		const text = 'Un prólogo nuevo. La travesía abre el espacio.';
		const found = locate( anchor, new canonical.TextIndex( text ) );
		assert.strictEqual( found.start, Array.from( text.slice( 0, text.indexOf( 'travesía' ) ) ).length );
	} );

	QUnit.test( 'el contexto desambigua un pasaje repetido', ( assert ) => {
		const old = 'el mar abre. Luego el mar cierra.';
		const anchor = anchorOf( old, 'el mar', 1, 8 );
		const text = 'Primero: el mar abre. Luego el mar cierra.';
		assert.strictEqual( locate( anchor, new canonical.TextIndex( text ) ).start, text.indexOf( 'el mar', 12 ) );
	} );

	QUnit.test( 'un pasaje borrado o ambiguo no se ubica', ( assert ) => {
		const anchor = anchorOf( 'aaaaaaaa la ronda bbbbbbbb', 'la ronda', 0, 8 );
		assert.strictEqual( locate( anchor, new canonical.TextIndex( 'otra cosa' ) ), null );
		assert.strictEqual(
			locate( anchor, new canonical.TextIndex( 'cccccccc la ronda dddddddd la ronda eeeeeeee' ) ),
			null
		);
	} );

	QUnit.test( 'el texto canónico salta lo excluido', ( assert ) => {
		const root = document.createElement( 'div' );
		root.innerHTML = '<p>uno<span class="mw-editsection">[editar]</span> dos' +
			'<span class="constel-ui">§</span><style>.x{}</style></p>';
		assert.strictEqual( canonical.read( root ).index.text, 'uno dos' );
	} );
} );
