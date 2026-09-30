/**
 * Lógica pura del grafo 2D: las cajas (de rótulo o de círculo) chocan y
 * ninguna queda pisando a otra (spec: ConceptMap.LabelsNeverOverlapIn2D).
 */
QUnit.module( 'ext.constel.map', () => {
	const { graph } = require( 'ext.constel.map' );

	const overlap = ( nodes, boxes ) => {
		let pairs = 0;
		for ( let i = 0; i < nodes.length; i++ ) {
			for ( let j = i + 1; j < nodes.length; j++ ) {
				const a = boxes.get( nodes[ i ].id );
				const b = boxes.get( nodes[ j ].id );
				if ( Math.abs( nodes[ i ].x - nodes[ j ].x ) < a.w + b.w &&
					Math.abs( nodes[ i ].y - nodes[ j ].y ) < a.h + b.h ) {
					pairs++;
				}
			}
		}
		return pairs;
	};

	// Una pequeña rejilla de puntos casi encimados, con cajas anchas (rótulos)
	// y cuadradas (círculos, sin rótulo).
	const scene = ( square ) => {
		const nodes = [];
		const boxes = new Map();
		for ( let i = 0; i < 30; i++ ) {
			nodes.push( { id: i, x: ( i % 6 ) * 3, y: Math.floor( i / 6 ) * 3 } );
			boxes.set( i, square ? { w: 8, h: 8 } : { w: 40, h: 7 } );
		}
		return { nodes, boxes };
	};

	QUnit.test( 'separate() deja las cajas de rótulo sin traslapes', ( assert ) => {
		const { nodes, boxes } = scene( false );
		assert.true( overlap( nodes, boxes ) > 0, 'parten traslapadas' );
		graph.separate( nodes, boxes );
		assert.strictEqual( overlap( nodes, boxes ), 0 );
	} );

	QUnit.test( 'separate() deja los círculos sin traslapes', ( assert ) => {
		const { nodes, boxes } = scene( true );
		graph.separate( nodes, boxes );
		assert.strictEqual( overlap( nodes, boxes ), 0 );
	} );

	QUnit.test( 'un concepto fijo no se aparta', ( assert ) => {
		const nodes = [ { id: 1, x: 0, y: 0 }, { id: 2, x: 2, y: 0 } ];
		const boxes = new Map( [ [ 1, { w: 10, h: 5 } ], [ 2, { w: 10, h: 5 } ] ] );
		graph.collide( nodes, boxes, nodes[ 0 ], 1 );
		assert.strictEqual( nodes[ 0 ].x, 0, 'el retenido queda' );
		assert.true(
			nodes[ 1 ].x >= 20 || Math.abs( nodes[ 1 ].y ) >= 10,
			'el otro se aparta lo justo'
		);
	} );
} );
