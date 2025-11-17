'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let lightBall;

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

function transformPoint(m, v) {
    let x = v[0], y = v[1], z = v[2], w = v[3];
    return [
        m[0] * x + m[4] * y + m[8]  * z + m[12] * w,
        m[1] * x + m[5] * y + m[9]  * z + m[13] * w,
        m[2] * x + m[6] * y + m[10] * z + m[14] * w,
        m[3] * x + m[7] * y + m[11] * z + m[15] * w
    ];
}

// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        this.count = vertices.length/3;
    }

    this.Draw = function() {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
   
        gl.drawArrays(gl.LINE_STRIP, 0, this.count);
    }
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    this.iAttribVertex = gl.getAttribLocation(program, "vertex");
    this.iAttribNormal = gl.getAttribLocation(program, "normal");

    this.iModelViewProjectionMatrix = gl.getUniformLocation(program, "ModelViewProjectionMatrix");
    this.iModelViewMatrix = gl.getUniformLocation(program, "ModelViewMatrix");
    this.iNormalMatrix = gl.getUniformLocation(program, "NormalMatrix");

    this.iLightPos = gl.getUniformLocation(program, "lightPos");
    this.iColor = gl.getUniformLocation(program, "color");

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function drawLightBall(lightWorld, modelViewMatrix, projection) {
    let T = m4.translation(lightWorld[0], lightWorld[1], lightWorld[2]);
    let mv = m4.multiply(modelViewMatrix, T);
    let mvp = m4.multiply(projection, mv);

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, mv);
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, mvp);

    let normalMatrix = m4.transpose(m4.inverse(mv));
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);

    lightBall.Draw();
}

function draw() { 
    gl.clearColor(1,1,1,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI / 5, 1, 4, 20);

    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();
    let translate = m4.translation(0,0,-10);
    let modelViewMatrix = m4.multiply(translate, modelView);

    let mvp = m4.multiply(projection, modelViewMatrix);
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, mvp);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewMatrix);

    let normalMatrix = m4.transpose(m4.inverse(modelViewMatrix));
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);

    let t = performance.now() * 0.001;
    let lightWorld = [
        4 * Math.cos(t),
        2 + Math.sin(t * 0.6) * 1.5,
        4 * Math.sin(t)
    ];

    let lightWorld4 = [lightWorld[0], lightWorld[1], lightWorld[2], 1.0];
    let lightEye4 = transformPoint(modelViewMatrix, lightWorld4);
    let lightEye = [
        lightEye4[0] / lightEye4[3],
        lightEye4[1] / lightEye4[3],
        lightEye4[2] / lightEye4[3]
    ];

    gl.uniform3fv(shProgram.iLightPos, new Float32Array(lightEye));

    surface.Draw();

    drawLightBall(lightWorld, modelViewMatrix, projection);

    requestAnimationFrame(draw);
}


function CreateSurfaceData()
{
    let vertexList = [];

    for (let i=0; i<360; i+=5) {
        vertexList.push( Math.sin(deg2rad(i)), 1, Math.cos(deg2rad(i)) );
        vertexList.push( Math.sin(deg2rad(i)), 0, Math.cos(deg2rad(i)) );
    }

    return vertexList;
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    surface = new ModelDrop('DropSurface');
    lightBall = new LightSphere(0.15, 16, 16);

    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    document.getElementById("uSlider").addEventListener("input", function() {
        let u = Number(this.value);
        let v = Number(document.getElementById("vSlider").value);
        surface = new ModelDrop("Drop", u, v);
    });

    document.getElementById("vSlider").addEventListener("input", function() {
        let u = Number(document.getElementById("uSlider").value);
        let v = Number(this.value);
        surface = new ModelDrop("Drop", u, v);
    });

    draw();
}
