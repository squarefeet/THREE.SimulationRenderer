var THREE = THREE || {};

THREE.SimulationRenderer = function( size, renderer ) {
    this.size = size || 4;
    this.numParticles = this.size * this.size;
    this.renderer = renderer;


    // Init RTT stuff
    var gl = renderer.getContext();

    if( !gl.getExtension( "OES_texture_float" )) {
        alert( "No OES_texture_float support for float textures!" );
        return;
    }

    if( gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) == 0) {
        alert( "No support for vertex shader textures!" );
        return;
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();

    this.camera.position.z = 1;

    this.passThruMaterial = new THREE.ShaderMaterial( {
        uniforms: {
            resolution: { type: "v2", value: new THREE.Vector2( this.size, this.size ) },
            texture: { type: "t", value: null }
        },
        vertexShader: THREE.SimulationRenderer.shaders.vertex.passThru,
        fragmentShader: THREE.SimulationRenderer.shaders.fragment.passThru
    } );

    this.passThruMesh = new THREE.Mesh(
        new THREE.PlaneGeometry( 2, 2 ),
        this.passThruMaterial
    );

    this.scene.add( this.camera );
    this.scene.add( this.passThruMesh );

    this.renderables = {};
    this.renderOrder = [];
    this.deltaTime = 0.0;
}

THREE.SimulationRenderer.prototype = {
    createRenderTarget: function( type, name ) {
        var target = new THREE.WebGLRenderTarget( this.size, this.size, {
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: type,
            type: THREE.FloatType,
            stencilBuffer: false
        });
        target.name = name;

        return target;
    },

    generateTexture: function( format, iterator ) {
        var numComponents = format === THREE.RGBFormat ? 3 : 4,
            dataArray = new Float32Array( this.numParticles * numComponents ),
            texture;

        for ( var i = 0, il = dataArray.length; i < il; i += numComponents ) {
            iterator( dataArray, i, il );
        }

        texture = new THREE.DataTexture( dataArray, this.size, this.size, format, THREE.FloatType );
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.needsUpdate = true;
        texture.flipY = false;

        return texture;
    },

    renderToTexture: function( input, output ) {
        this.passThruMesh.material = this.passThruMaterial;
        this.passThruMaterial.uniforms.texture.value = input;
        this.renderer.render( this.scene, this.camera, output );
    },

    addRenderable: function( name, type, material, shaderValues, generativeIterator ) {
        var inputTarget = this.createRenderTarget( type, name + '-1' ),
            outputTarget = this.createRenderTarget( type, name + '-2' ),
            texture = this.generateTexture( type, generativeIterator ),
            renderable = {
                sourceTexture: texture,
                currentOutput: null,
                shaderMaterial: material,
                shaderValues: shaderValues,
                inputTarget: inputTarget,
                outputTarget: outputTarget
            };


        // Render current texture to both buffers
        this.renderToTexture( texture, inputTarget );
        this.renderToTexture( inputTarget, outputTarget );

        // Store initial output.
        renderable.currentOutput = outputTarget;

        // Save this renderable.
        this.renderables[ name ] = renderable;
        this.renderOrder.push( name );
    },

    swapBuffers: function( renderable ) {
        var tmp = renderable.inputTarget;
        renderable.inputTarget = renderable.outputTarget;
        renderable.outputTarget = tmp;
        renderable.currentOutput = renderable.outputTarget;
    },

    setSingleShaderValue: function( target, i ) {
        if( i === 'time' ) {
            target[ i ].value = performance.now();
        }
        else if( i === 'delta' ) {
            target[ i ].value = this.deltaTime;
        }
        else {
            target[ i ].value = this.renderables[ i ].inputTarget;
        }
    },

    setShaderValues: function( renderable ) {
        var uniforms = renderable.shaderValues.uniforms,
            attributes = renderable.shaderValues.attributes,
            material = renderable.shaderMaterial,
            i;

        if( uniforms ) {
            for( i = 0; i < uniforms.length; ++i ) {
                this.setSingleShaderValue( material.uniforms, uniforms[ i ] );
            }
        }

        if( attributes ) {
            for( i = 0; i < attributes.length; ++i ) {
                this.setSingleShaderValue( material.attributes, attributes[ i ] );
            }
        }
    },

    render: function( deltaTime ) {
        this.deltaTime = deltaTime;

        for( var i = 0, renderable; i < this.renderOrder.length; ++i ) {
            renderable = this.renderables[ this.renderOrder[ i ] ];

            this.swapBuffers( renderable );
            this.setShaderValues( renderable );
            this.passThruMesh.material = renderable.shaderMaterial;
            this.renderer.render( this.scene, this.camera, renderable.currentOutput );
        }
    },

    getTexture: function( name ) {
        return this.renderables[ name ].currentOutput;
    }
};


THREE.SimulationRenderer.shaders = {
    vertex: {
        passThru: [
            'void main() {',
                'gl_Position = vec4( position, 1.0 );',
            '}'
        ].join( '\n' )
    },

    fragment: {
        passThru: [
            'uniform vec2 resolution;',
            'uniform sampler2D texture;',

            'void main() {',
                'vec2 uv = gl_FragCoord.xy / resolution.xy;',
                'vec3 color = texture2D( texture, uv ).xyz;',
                'gl_FragColor = vec4( color, 1.0 );',
            '}'
        ].join( '\n' )
    }
};