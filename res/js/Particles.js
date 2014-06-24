function Particles( size, renderer ) {
	this.size = size;
	this.renderer = renderer;
	this.numParticles = this.size * this.size;


	this.simulationRenderer = new THREE.SimulationRenderer( size, renderer );

	this.particleGeometry = new THREE.Geometry();
	this.particleAttributes = {};
	this.particleMaterial = null;
	this.particleSystem = null;

	this.createVertices();
	this.createParticleSystem();
	this.addVelocityShader();
	this.addPositionShader();
}

Particles.prototype = {

	_getShader: function( type, name ) {
		return Particles.shaders[ type ][ name ];
	},

	createVertices: function() {
		this.particleAttributes.reference = { type: 'v2', value: [] };

		var x = 0, y = 0;

		for( var i = 0; i < this.numParticles; ++i ) {
			this.particleGeometry.vertices.push( new THREE.Vector3(
				Math.random() * 150 - 300,
				Math.random() * 150 - 300,
				Math.random() * 150 - 300
			) );

			this.particleAttributes.reference.value.push( new THREE.Vector2(x/this.size, y/this.size) );

			if( (++x) > this.size - 1 ) {
				x = 0;
				++y;
			}
		}
	},

	createParticleSystem: function() {
		this.particleMaterial = new THREE.ShaderMaterial( {
			uniforms: {
				texturePosition: { type: 't', value: null },
				resolution: { type: "v2", value: new THREE.Vector2( this.size, this.size ) },
			},
			attributes: this.particleAttributes,

			vertexShader: this._getShader( 'vertex', 'draw' ),
			fragmentShader: this._getShader( 'fragment', 'draw' )
		} );

		this.particleSystem = new THREE.ParticleSystem( this.particleGeometry, this.particleMaterial );
	},

	addPositionShader: function() {
		this.positionShader = new THREE.ShaderMaterial( {
            uniforms: {
                time: { type: "f", value: 0.0 },
                delta: { type: "f", value: 0.0 },
                resolution: { type: "v2", value: new THREE.Vector2( this.size, this.size ) },
                texturePosition: { type: "t", value: null },
                textureVelocity: { type: 't', value: null },
                maxAge: { type: 't', value: 5.0 },
                sourceTexture: { type: 't', value: null },
            },
            vertexShader: this._getShader( 'vertex', 'passThru' ),
            fragmentShader: this._getShader( 'fragment', 'position' )
        } );

        this.simulationRenderer.addRenderable(
            'texturePosition',
            THREE.RGBAFormat,
            this.positionShader,
            {
                uniforms: [ 'time', 'delta', 'textureVelocity', 'texturePosition' ]
            },
            function( dataArray, i, length ) {
                dataArray[ i + 0 ] = 0;
                dataArray[ i + 1 ] = 0;
                dataArray[ i + 2 ] = 0;
                dataArray[ i + 3 ] = 1;
            }
        );
	},

	addVelocityShader: function() {
		var shader = new THREE.ShaderMaterial( {
            uniforms: {
                time: { type: "f", value: 1.0 },
                delta: { type: "f", value: 0.0 },
                resolution: { type: "v2", value: new THREE.Vector2( this.size, this.size ) },
                texturePosition: { type: "t", value: null },
                textureVelocity: { type: 't', value: null },
                sourceTexture: { type: 't', value: null },
            },
            vertexShader: this._getShader( 'vertex', 'passThru' ),
            fragmentShader: this._getShader( 'fragment', 'velocity' )
        } );

        this.simulationRenderer.addRenderable(
            'textureVelocity',
            THREE.RGBAFormat,
            shader,
            {
                uniforms: [ 'time', 'delta', 'textureVelocity', 'texturePosition' ]
            },
            function( dataArray, i, length ) {
                dataArray[ i + 0 ] = 100 - Math.random() * 200;
                dataArray[ i + 1 ] = 10 * Math.random() - 5;
                dataArray[ i + 2 ] = 100 - Math.random() * 200;
                dataArray[ i + 3 ] = 0;
            }
        );
	},

	render: function( delta ) {
		this.simulationRenderer.render( delta );
		this.particleMaterial.uniforms.texturePosition.value = this.simulationRenderer.getTexture( 'texturePosition' );
	}
};



Particles.shaders = {
	vertex: {
		passThru: [
			'void main() {',
                'gl_Position = vec4( position, 1.0 );',
            '}'
		].join( '\n' ),

		draw: [
			'uniform sampler2D texturePosition;',
			'uniform vec2 resolution;',

			'attribute vec2 reference;',

			'void main() {',
				'vec4 pos = texture2D( texturePosition, reference );',
				'pos = projectionMatrix * modelViewMatrix * vec4( pos.xyz, 1.0 );',
				'gl_PointSize = 2.0 * ( 300.0 / length( pos.xyz ) );',
				'gl_Position = pos;',
			'}'
		].join( '\n' )
	},
	fragment: {
		position: [
			'uniform vec2 resolution;',
            'uniform float time;',
            'uniform float delta;',
            // 'uniform sampler2D sourceTexture;',
            'uniform sampler2D texturePosition;',
            'uniform sampler2D textureVelocity;',

            'void main() {',
            	'vec2 uv = gl_FragCoord.xy / resolution.xy;',
                'vec4 pos = texture2D( texturePosition, uv );',
                'vec4 velocity = texture2D( textureVelocity, uv );',

                'velocity *= delta;',

            	'pos += velocity;',

          //   	'if( length( pos ) > 400.0 ) {',
	        	// 	'pos = texture2D( sourceTexture, uv );',
        		// '}',

            	'gl_FragColor = vec4( pos.xyz, 1.0 );',
            '}'
		].join( '\n' ),

		velocity: [
			'uniform vec2 resolution;',
            'uniform float time;',
            'uniform float delta;',
            // 'uniform sampler2D sourceTexture;',
            'uniform sampler2D texturePosition;',
            'uniform sampler2D textureVelocity;',

            'void main() {',
                'vec2 uv = gl_FragCoord.xy / resolution.xy;',
                'vec4 pos = texture2D( texturePosition, uv );',
                'vec4 velocity = texture2D( textureVelocity, uv );',

          //       'velocity += vec4(0.0, -0.2, 0.0, 0.0);',

          //       'if( length( pos ) > 400.0 ) {',
	        	// 	'velocity = texture2D( sourceTexture, uv );',
        		// '}',

            	'gl_FragColor = vec4( velocity.xyz, 0.0 );',
            '}'
		].join( '\n' ),

		draw: [
			'void main() {',
				'gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 );',
			'}'
		].join( '\n' )
	}
};