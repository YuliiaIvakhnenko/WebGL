'use strict';

function ModelDrop(name, uCount = 50, vCount = 50, uMax = 4, vMax = 4) {
    this.name = name;

    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;

    function dropSurface(u, v) {
        let r = Math.sqrt(u*u + v*v);
        let z = (r === 0 ? 1 : Math.sin(4*r) / r);
        return [u/2, -z/2, v/2];
    }

    function generateSurface() {
        let vertices = [];
        let normals = [];
        let indices = [];

        let du = (2 * uMax) / (uCount - 1);
        let dv = (2 * vMax) / (vCount - 1);

        let tempNormals = Array(uCount * vCount).fill(0).map(() => [0,0,0]);

        for (let j = 0; j < vCount; j++) {
            let v = -vMax + j * dv;
            for (let i = 0; i < uCount; i++) {
                let u = -uMax + i * du;
                let p = dropSurface(u, v);
                vertices.push(p[0], p[1], p[2]);
            }
        }

        for (let j = 0; j < vCount - 1; j++) {
            for (let i = 0; i < uCount - 1; i++) {

                let i0 = j * uCount + i;
                let i1 = i0 + 1;
                let i2 = i0 + uCount;
                let i3 = i2 + 1;

                let tris = [
                    [i0, i1, i2],
                    [i1, i3, i2]
                ];

                for (let t of tris) {
                    let p0 = vertices.slice(t[0]*3, t[0]*3 + 3);
                    let p1 = vertices.slice(t[1]*3, t[1]*3 + 3);
                    let p2 = vertices.slice(t[2]*3, t[2]*3 + 3);

                    let e1 = [p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]];
                    let e2 = [p2[0]-p0[0], p2[1]-p0[1], p2[2]-p0[2]];

                    let nx = e1[1]*e2[2] - e1[2]*e2[1];
                    let ny = e1[2]*e2[0] - e1[0]*e2[2];
                    let nz = e1[0]*e2[1] - e1[1]*e2[0];

                    for (let idx of t) {
                        tempNormals[idx][0] += nx;
                        tempNormals[idx][1] += ny;
                        tempNormals[idx][2] += nz;
                    }
                }

                indices.push(i0, i1, i2);
                indices.push(i1, i3, i2);
            }
        }

        for (let i = 0; i < tempNormals.length; i++) {
            let n = tempNormals[i];
            let L = Math.sqrt(n[0]*n[0] + n[1]*n[1] + n[2]*n[2]);

            if (L < 1e-6) {
                normals.push(0, 1, 0);
                continue;
            }

            n[0] /= L; 
            n[1] /= L;
            n[2] /= L;

            let vx = vertices[i*3 + 0];
            let vy = vertices[i*3 + 1];
            let vz = vertices[i*3 + 2];

            let dot = vx*n[0] + vy*n[1] + vz*n[2];

            if (dot < 0) {
                n[0] = -n[0];
                n[1] = -n[1];
                n[2] = -n[2];
            }

            normals.push(n[0], n[1], n[2]);
        }

        return {vertices, normals, indices};
    }

    this.BufferData = function() {
        let surf = generateSurface();

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surf.vertices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surf.normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(surf.indices), gl.STATIC_DRAW);

        this.count = surf.indices.length;
    };

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    };

    this.BufferData();
}
