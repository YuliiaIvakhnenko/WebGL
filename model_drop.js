'use strict';

function ModelDrop(name, uCount = 50, vCount = 50, uMax = 4, vMax = 4) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.count = 0;

    function dropSurface(u, v) {
        let r = Math.sqrt(u * u + v * v);
        let z = r === 0 ? 1 : Math.sin(4 * r) / r;
        return [u / 2, z / 2, v / 2]; 
    }


    function generateSurface() {
        let vertices = [];
        let du = (2 * uMax) / (uCount - 1);
        let dv = (2 * vMax) / (vCount - 1);

        for (let j = 0; j < vCount; j++) {
            let v = -vMax + j * dv;
            for (let i = 0; i < uCount; i++) {
                let u = -uMax + i * du;
                let p = dropSurface(u, v);
                vertices.push(p[0], p[1], p[2]);
            }
        }

        for (let i = 0; i < uCount; i++) {
            let u = -uMax + i * du;
            for (let j = 0; j < vCount; j++) {
                let v = -vMax + j * dv;
                let p = dropSurface(u, v);
                vertices.push(p[0], p[1], p[2]);
            }
        }

        return vertices;
    }

    this.BufferData = function() {
        let verts = generateSurface();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
        this.count = verts.length / 3;
    }

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.drawArrays(gl.LINE_STRIP, 0, this.count);
    }

    this.BufferData();
}
