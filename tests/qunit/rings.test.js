/**
 * Lógica pura de la vista de anillos (spec: ConceptMap.RingsView): a qué
 * anillo va cada vecino, el cupo de cada uno y el orden angular.
 */
QUnit.module( 'ext.constel.map.rings', () => {
	const { rings } = require( 'ext.constel.map' );

	const node = ( id ) => ( { id, label: 'C' + id, excerpts: 1, pages: 1 } );
	const world = ( count ) => {
		const nodes = [];
		for ( let i = 0; i <= count; i++ ) {
			nodes.push( node( i ) );
		}
		return new Map( nodes.map( ( n ) => [ n.id, n ] ) );
	};
	const link = ( source, target, kind, weight ) => ( { source, target, kind, weight } );

	QUnit.test( 'un vecino con varios grados va al anillo del más fuerte', ( assert ) => {
		const links = [
			link( 0, 1, 'co_page', 9 ),
			link( 0, 1, 'overlap', 1 ),
			link( 0, 1, 'co_excerpt', 1 ),
			link( 0, 2, 'co_page', 5 ),
			link( 0, 2, 'overlap', 2 ),
			link( 0, 3, 'co_page', 1 )
		];
		const byRing = rings.neighboursByRing( 0, links, world( 3 ) );
		const ids = byRing.map( ( ring ) => ring.map( ( i ) => i.node.id ) );
		assert.deepEqual( ids, [ [ 1 ], [ 2 ], [ 3 ] ] );
	} );

	QUnit.test( 'dentro de un anillo, de mayor a menor peso', ( assert ) => {
		const links = [
			link( 0, 1, 'co_excerpt', 1 ), link( 0, 2, 'co_excerpt', 5 ), link( 0, 3, 'co_excerpt', 3 )
		];
		const [ first ] = rings.neighboursByRing( 0, links, world( 3 ) );
		assert.deepEqual( first.map( ( i ) => i.node.id ), [ 2, 3, 1 ] );
	} );

	QUnit.test( 'cada anillo respeta su cupo y el resto queda en la lista', ( assert ) => {
		const links = [];
		for ( let i = 1; i <= 30; i++ ) {
			links.push( link( 0, i, 'co_excerpt', 100 - i ) );
		}
		const layout = rings.arrange( 0, links, world( 30 ) );
		const placed = Array.from( layout.places.values() ).filter( ( p ) => p.ring === 0 );
		assert.strictEqual( placed.length, rings.RING_QUOTAS[ 0 ] );
		assert.strictEqual( layout.more[ 0 ].length, 30 - rings.RING_QUOTAS[ 0 ] );
		assert.strictEqual( layout.all[ 0 ].length, 30, 'la lista alternativa los trae todos' );
		assert.strictEqual( layout.places.get( 0 ).ring, -1, 'el concepto elegido va al centro' );
		placed.forEach( ( p ) => {
			assert.true( Math.abs( Math.hypot( p.x, p.y ) - rings.RING_RADII[ 0 ] ) < 1e-6, 'radio discreto' );
		} );
	} );

	QUnit.test( 'la seriación deja contiguos a los próximos entre sí', ( assert ) => {
		const items = [ 1, 2, 3, 4 ].map( ( id ) => ( { node: node( id ), weight: 10 - id } ) );
		// 1 se parece a 3 y 2 a 4: deben quedar de a pares.
		const mutual = new Map( [ [ '1:3', 5 ], [ '2:4', 5 ] ] );
		const order = rings.seriate( items, mutual ).map( ( i ) => i.node.id );
		assert.deepEqual( order, [ 1, 3, 2, 4 ] );
	} );
} );
