'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let lightBall;

let diffuseTexture;
let specularTexture;
let normalTexture;

let texRotationAngle = 0.0;  
let texRotationBase  = 0.0;

const TWO_PI = Math.PI * 2.0;

let keysDown = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };
let shiftDown = false;

let texCenterU = 0.5;
let texCenterV = 0.5;
let texScaleU = 1.0;
let texScaleV = 1.0;

let texPivotBall;
let texPivotPos = [0, 0, 0];

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

function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
}

function LoadTexture(url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([200, 200, 200, 255])
    );

    const image = new Image();
    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    image.src = url;

    return texture;
}


function wrap01(x) {
    x = x % 1.0;
    return (x < 0.0) ? (x + 1.0) : x;
}

function wrapAngle(angle) {
    angle = angle % TWO_PI;
    return (angle < 0.0) ? (angle + TWO_PI) : angle;
}

function updateTexRuntime(dt) {
    let moved = false;
    const speed = shiftDown ? 0.60 : 0.25;
    const step = speed * dt;

    let rotDir = 0;

    if (keysDown.KeyA) { texCenterU -= step; moved = true; }
    if (keysDown.KeyD) { texCenterU += step; moved = true; }
    if (keysDown.KeyW) { texCenterV += step; moved = true; }
    if (keysDown.KeyS) { texCenterV -= step; moved = true; }

    if (keysDown.KeyA) rotDir -= 1;
    if (keysDown.KeyD) rotDir += 1;
    if (keysDown.KeyW) rotDir += 1;
    if (keysDown.KeyS) rotDir -= 1;

    if (moved) {
        texCenterU = wrap01(texCenterU);
        texCenterV = wrap01(texCenterV);
        if (window._syncTexCenterUI) window._syncTexCenterUI();
    }

    if (rotDir !== 0) {
        const rotSpeed = shiftDown ? 3.0 : 1.2;
        texRotationBase = wrapAngle(texRotationBase + rotDir * rotSpeed * dt);

        const angleSlider = document.getElementById('texAngle');
        if (angleSlider) angleSlider.value = texRotationBase;
    }

    texRotationAngle = texRotationBase;

    const angDisp = document.getElementById('texAngleDisp');
    if (angDisp) angDisp.textContent = texRotationAngle.toFixed(2);
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
    this.iAttribTexCoord = gl.getAttribLocation(program, "texCoord");
    this.iAttribTangent = gl.getAttribLocation(program, "tangent");

    this.iModelViewProjectionMatrix = gl.getUniformLocation(program, "ModelViewProjectionMatrix");
    this.iModelViewMatrix = gl.getUniformLocation(program, "ModelViewMatrix");
    this.iNormalMatrix = gl.getUniformLocation(program, "NormalMatrix");

    this.iLightPos = gl.getUniformLocation(program, "lightPos");

    this.iDiffuseMap = gl.getUniformLocation(program, "diffuseMap");
    this.iSpecularMap = gl.getUniformLocation(program, "specularMap");
    this.iNormalMap = gl.getUniformLocation(program, "normalMap");

    this.iUseDiffuseMap  = gl.getUniformLocation(program, "useDiffuseMap");
    this.iUseSpecularMap = gl.getUniformLocation(program, "useSpecularMap");
    this.iUseNormalMap   = gl.getUniformLocation(program, "useNormalMap");

    this.uTexRotationAngle = gl.getUniformLocation(program, "u_texRotationAngle");
    this.uTexCenterPoint   = gl.getUniformLocation(program, "u_texCenterPoint");
    this.uTexScale         = gl.getUniformLocation(program, "u_texScale");

    this.uUseObjectColor = gl.getUniformLocation(program, "u_useObjectColor");
    this.uObjectColor    = gl.getUniformLocation(program, "u_objectColor");

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

    gl.uniform1i(shProgram.iUseDiffuseMap, 0);
    gl.uniform1i(shProgram.iUseSpecularMap, 0);
    gl.uniform1i(shProgram.iUseNormalMap, 0);

    lightBall.Draw();
}

function draw() { 
    gl.clearColor(1,1,1,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Set the values of the projection transformation */
    const now = performance.now();
    if (draw._lastTime === undefined) draw._lastTime = now;
    const dt = Math.min(0.05, (now - draw._lastTime) / 1000.0);
    draw._lastTime = now;
    updateTexRuntime(dt);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, diffuseTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, specularTexture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, normalTexture);

    let useDiffuse = document.getElementById("chkDiffuse").checked;
    let useSpecular = document.getElementById("chkSpecular").checked;
    let useNormal = document.getElementById("chkNormal").checked;

    gl.uniform1i(shProgram.iUseDiffuseMap,  useDiffuse ? 1 : 0);
    gl.uniform1i(shProgram.iUseSpecularMap, useSpecular ? 1 : 0);
    gl.uniform1i(shProgram.iUseNormalMap,   useNormal ? 1 : 0);

     gl.uniform1f(shProgram.uTexRotationAngle, texRotationAngle);
    gl.uniform2f(shProgram.uTexCenterPoint, texCenterU, texCenterV);
    gl.uniform2f(shProgram.uTexScale, texScaleU, texScaleV);

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

    updateTexPivotPoint();
    drawTexPivotBall(modelViewMatrix, projection);

    drawLightBall(lightWorld, modelViewMatrix, projection);

    requestAnimationFrame(draw);
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    surface = new ModelDrop('DropSurface');
    lightBall = new LightSphere(0.15, 16, 16);
    // Smaller marker to look like a "point" on the surface
    texPivotBall = new LightSphere(0.05, 14, 14);

    gl.enable(gl.DEPTH_TEST);

    diffuseTexture  = LoadTexture("textures/pedraStoneDiffuse.jpg");
    specularTexture = LoadTexture("textures/pedraStoneSpecular.jpg");
    normalTexture   = LoadTexture("textures/pedraStoneNormal.jpg");

    gl.uniform1i(shProgram.iDiffuseMap,  0);
    gl.uniform1i(shProgram.iSpecularMap, 1);
    gl.uniform1i(shProgram.iNormalMap,   2);
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

    function safeNumber(x, fallback = 0.0) {
        return (typeof x === 'number' && isFinite(x)) ? x : fallback;
    }

    
    function syncTexCenterUI() {
        texCenterU = wrap01(texCenterU);
        texCenterV = wrap01(texCenterV);

        const disp = document.getElementById("texCenterDisp");
        if (disp) disp.textContent = `Center UV: ${texCenterU.toFixed(2)}, ${texCenterV.toFixed(2)}`;

        const uInp = document.getElementById("texCenterUInput");
        const vInp = document.getElementById("texCenterVInput");
        if (uInp) uInp.value = texCenterU.toFixed(2);
        if (vInp) vInp.value = texCenterV.toFixed(2);
    }

    function setCenterFromInputs() {
        const uInp = document.getElementById("texCenterUInput");
        const vInp = document.getElementById("texCenterVInput");
        if (!uInp || !vInp) return;

        texCenterU = wrap01(safeNumber(parseFloat(uInp.value), texCenterU));
        texCenterV = wrap01(safeNumber(parseFloat(vInp.value), texCenterV));
        syncTexCenterUI();
    }

    (function initTexTransformUI() {
        const btn = document.getElementById("btnSetCenter");
        if (btn) btn.addEventListener("click", setCenterFromInputs);

        const uInp = document.getElementById("texCenterUInput");
        const vInp = document.getElementById("texCenterVInput");
        if (uInp) uInp.addEventListener("change", setCenterFromInputs);
        if (vInp) vInp.addEventListener("change", setCenterFromInputs);

        const angleSlider = document.getElementById("texAngle");
        const angleDisp = document.getElementById("texAngleDisp");
        if (angleSlider) {
            const onAngle = () => {
                texRotationBase = parseFloat(angleSlider.value);
                texRotationAngle = texRotationBase;
                if (angleDisp) angleDisp.textContent = texRotationAngle.toFixed(2);
};
            angleSlider.addEventListener("input", onAngle);
            onAngle();
        }

        const su = document.getElementById("texScaleU");
        const sv = document.getElementById("texScaleV");
        texScaleU = su ? parseFloat(su.value) : 1.0;
        texScaleV = sv ? parseFloat(sv.value) : 1.0;

        syncTexCenterUI();
    })();
    window.addEventListener('keydown', (event) => {
        const codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'];
        if (!codes.includes(event.code)) return;
        event.preventDefault();

        if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
            shiftDown = true;
            return;
        }

        keysDown[event.code] = true;

        const nudge = event.shiftKey ? 0.05 : 0.01;
        if (event.code === 'KeyA') texCenterU -= nudge;
        if (event.code === 'KeyD') texCenterU += nudge;
        if (event.code === 'KeyW') texCenterV += nudge;
        if (event.code === 'KeyS') texCenterV -= nudge;

        const rotNudge = event.shiftKey ? 0.25 : 0.10;
        if (event.code === 'KeyA' || event.code === 'KeyS') texRotationBase -= rotNudge;
        if (event.code === 'KeyD' || event.code === 'KeyW') texRotationBase += rotNudge;
        texRotationBase = wrapAngle(texRotationBase);

        const angleSlider = document.getElementById('texAngle');
        if (angleSlider) angleSlider.value = texRotationBase;

        syncTexCenterUI();
    });

    window.addEventListener('keyup', (event) => {
        const codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'];
        if (!codes.includes(event.code)) return;
        event.preventDefault();

        if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
            shiftDown = false;
            return;
        }

        keysDown[event.code] = false;
    });
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
function updateTexPivotPoint() {
    if (!surface || typeof surface.evalAtUV !== "function") return;

    const p = surface.evalAtUV(texCenterU, texCenterV);
    const n = surface.normalAtUV(texCenterU, texCenterV);

    const offset = 0.05;
    texPivotPos = [p[0] + n[0] * offset, p[1] + n[1] * offset, p[2] + n[2] * offset];
}

function drawTexPivotBall(modelViewMatrix, projection) {
    const T = m4.translation(texPivotPos[0], texPivotPos[1], texPivotPos[2]);
    const mv  = m4.multiply(modelViewMatrix, T);
    const mvp = m4.multiply(projection, mv);

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, mv);
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, mvp);

    const normalMatrix = m4.transpose(m4.inverse(mv));
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);

    gl.uniform1i(shProgram.iUseDiffuseMap, 0);
    gl.uniform1i(shProgram.iUseSpecularMap, 0);
    gl.uniform1i(shProgram.iUseNormalMap, 0);

    gl.uniform1i(shProgram.uUseObjectColor, 1);
    gl.uniform3f(shProgram.uObjectColor, 0.0, 1.0, 0.0);

    gl.disable(gl.DEPTH_TEST);
    texPivotBall.Draw();
    gl.enable(gl.DEPTH_TEST);

    gl.uniform1i(shProgram.uUseObjectColor, 0);
}

