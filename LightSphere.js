'use strict';

function LightSphere(radius = 0.15, rings = 16, sectors = 16) {
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;

    let vertices = [];
    let normals  = [];
    let indices  = [];

    for (let r = 0; r <= rings; r++) {
        let phi = Math.PI * r / rings;
        let y = Math.cos(phi);
        let s = Math.sin(phi);

        for (let sct = 0; sct <= sectors; sct++) {
            let theta = 2 * Math.PI * sct / sectors;

            let x = s * Math.cos(theta);
            let z = s * Math.sin(theta);

            vertices.push(x * radius, y * radius, z * radius);
            normals.push(x, y, z);
        }
    }

    for (let r = 0; r < rings; r++) {
        for (let sct = 0; sct < sectors; sct++) {
            let i0 = r * (sectors + 1) + sct;
            let i1 = i0 + 1;
            let i2 = i0 + (sectors + 1);
            let i3 = i2 + 1;

            indices.push(i0, i2, i1);
            indices.push(i1, i2, i3);
        }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    this.count = indices.length;

    this.Draw = () => {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);

        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    };
}
