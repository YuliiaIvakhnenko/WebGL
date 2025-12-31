'use strict';

function ModelDrop(name, uCount = 50, vCount = 50, uMax = 4, vMax = 4) {
    this.name = name;

    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iTexCoordBuffer = gl.createBuffer();
    this.iTangentBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;

    function dropSurface(u, v) {
        let r = Math.sqrt(u*u + v*v);
        let z = (r === 0 ? 1 : Math.sin(4*r) / r);
        return [u/2, -z/2, v/2];
    }

    this.evalAtUV = function(uTex, vTex) {
        const uParam = -uMax + uTex * (2 * uMax);
        const vParam = -vMax + vTex * (2 * vMax);
        return dropSurface(uParam, vParam);
    };

    this.normalAtUV = function(uTex, vTex) {
        const uParam = -uMax + uTex * (2 * uMax);
        const vParam = -vMax + vTex * (2 * vMax);

        const epsU = (2 * uMax) * 0.001;
        const epsV = (2 * vMax) * 0.001;

        const p  = dropSurface(uParam, vParam);
        const pu = dropSurface(uParam + epsU, vParam);
        const pv = dropSurface(uParam, vParam + epsV);

        const tu = [pu[0]-p[0], pu[1]-p[1], pu[2]-p[2]];
        const tv = [pv[0]-p[0], pv[1]-p[1], pv[2]-p[2]];

        let nx = tu[1]*tv[2] - tu[2]*tv[1];
        let ny = tu[2]*tv[0] - tu[0]*tv[2];
        let nz = tu[0]*tv[1] - tu[1]*tv[0];

        const len = Math.hypot(nx, ny, nz) || 1.0;
        return [nx/len, ny/len, nz/len];
    };


    function generateSurface() {
        let vertices = [];
        let normals = [];
        let texCoords = [];
        let tangents = [];
        let indices = [];

        let du = (2 * uMax) / (uCount - 1);
        let dv = (2 * vMax) / (vCount - 1);

        let tempNormals = Array(uCount * vCount).fill(0).map(() => [0,0,0]);

        let positions = [];

        for (let j = 0; j < vCount; j++) {
            let v = -vMax + j * dv;
            for (let i = 0; i < uCount; i++) {
                let u = -uMax + i * du;
                let p = dropSurface(u, v);
                vertices.push(p[0], p[1], p[2]);
                positions.push(p);

                let uTex = (u + uMax) / (2 * uMax);
                let vTex = (v + vMax) / (2 * vMax);
                texCoords.push(uTex, vTex);
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
                    let p0 = positions[t[0]];
                    let p1 = positions[t[1]];
                    let p2 = positions[t[2]];

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
            let L = Math.hypot(n[0], n[1], n[2]);

            if (L < 1e-6) {
                n = [0, 1, 0];
            } else {
                n[0] /= L;
                n[1] /= L;
                n[2] /= L;

                let vx = vertices[i * 3 + 0];
                let vy = vertices[i * 3 + 1];
                let vz = vertices[i * 3 + 2];

                let dot = vx * n[0] + vy * n[1] + vz * n[2];
                if (dot < 0) {
                    n[0] = -n[0];
                    n[1] = -n[1];
                    n[2] = -n[2];
                }
            }

            normals.push(n[0], n[1], n[2]);
        }

        for (let j = 0; j < vCount; j++) {
            for (let i = 0; i < uCount; i++) {
                let idx  = j * uCount + i;
                let idxL = (i > 0) ? idx - 1 : idx;
                let idxR = (i < uCount - 1) ? idx + 1 : idx;

                let pL = positions[idxL];
                let pR = positions[idxR];

                let tx = pR[0] - pL[0];
                let ty = pR[1] - pL[1];
                let tz = pR[2] - pL[2];

                let len = Math.hypot(tx, ty, tz);
                if (len < 1e-6) {
                    tx = 1; ty = 0; tz = 0;
                } else {
                    tx /= len; ty /= len; tz /= len;
                }

                tangents.push(tx, ty, tz);
            }
        }

        return {vertices, normals, texCoords, tangents, indices};
    }

    this.BufferData = function() {
        let surf = generateSurface();

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surf.vertices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surf.normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surf.texCoords), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surf.tangents), gl.STATIC_DRAW);

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

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexCoord);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTangent);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    };

    this.BufferData();
}
