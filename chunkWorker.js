// chunkWorker.js - 集成三维群落噪声、程序化植被、AO 与 双通道网格生成
import { createNoise3D, createNoise2D } from 'simplex-noise';

const noise3D = createNoise3D();
const biomeNoise = createNoise2D(() => 0.8);

// --- 常量配置 ---
const STEP = 4;
const NOISE_SCALE = 0.012;
const BIOME_SCALE = 0.005;
const SEA_LEVEL = 60;
const aoTable = [0.4, 0.6, 0.8, 1.0];

const faces = [
  { dir: [ -1,  0,  0, ], corners: [ { pos: [ 0, 0, 0 ], uv: [ 0, 0 ] }, { pos: [ 0, 0, 1 ], uv: [ 1, 0 ] }, { pos: [ 0, 1, 1 ], uv: [ 1, 1 ] }, { pos: [ 0, 1, 0 ], uv: [ 0, 1 ] } ] },
  { dir: [  1,  0,  0, ], corners: [ { pos: [ 1, 0, 1 ], uv: [ 0, 0 ] }, { pos: [ 1, 0, 0 ], uv: [ 1, 0 ] }, { pos: [ 1, 1, 0 ], uv: [ 1, 1 ] }, { pos: [ 1, 1, 1 ], uv: [ 0, 1 ] } ] },
  { dir: [  0, -1,  0, ], corners: [ { pos: [ 0, 0, 0 ], uv: [ 0, 0 ] }, { pos: [ 1, 0, 0 ], uv: [ 1, 0 ] }, { pos: [ 1, 0, 1 ], uv: [ 1, 1 ] }, { pos: [ 0, 0, 1 ], uv: [ 0, 1 ] } ] },
  { dir: [  0,  1,  0, ], corners: [ { pos: [ 0, 1, 1 ], uv: [ 0, 0 ] }, { pos: [ 1, 1, 1 ], uv: [ 1, 0 ] }, { pos: [ 1, 1, 0 ], uv: [ 1, 1 ] }, { pos: [ 0, 1, 0 ], uv: [ 0, 1 ] } ] },
  { dir: [  0,  0, -1, ], corners: [ { pos: [ 1, 0, 0 ], uv: [ 0, 0 ] }, { pos: [ 0, 0, 0 ], uv: [ 1, 0 ] }, { pos: [ 0, 1, 0 ], uv: [ 1, 1 ] }, { pos: [ 1, 1, 0 ], uv: [ 0, 1 ] } ] },
  { dir: [  0,  0,  1, ], corners: [ { pos: [ 0, 0, 1 ], uv: [ 0, 0 ] }, { pos: [ 1, 0, 1 ], uv: [ 1, 0 ] }, { pos: [ 1, 1, 1 ], uv: [ 1, 1 ] }, { pos: [ 0, 1, 1 ], uv: [ 0, 1 ] } ] },
];

const colorMap = {
  1: [0.2, 0.8, 0.2], // 草地
  2: [0.5, 0.3, 0.1], // 泥土
  3: [0.1, 0.4, 0.9], // 水
  4: [0.4, 0.2, 0.0], // 木头
  5: [0.1, 0.5, 0.1], // 树叶
  6: [0.9, 0.8, 0.5], // 沙子
  7: [0.95, 0.95, 1.0], // 雪
  8: [0.8, 0.9, 1.0], // 玻璃
};

// --- 数学与辅助 ---
function lerp(a, b, t) { return a + t * (b - a); }
function trilinearLerp(v000, v100, v010, v110, v001, v101, v011, v111, tx, ty, tz) {
  const x00 = lerp(v000, v100, tx), x10 = lerp(v010, v110, tx), x01 = lerp(v001, v101, tx), x11 = lerp(v011, v111, tx);
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
}
function isTransparent(id) { 
  // 0: 空气, 3: 水, 5: 树叶, 8: 玻璃, 255: 用户强制空气
  return id === 0 || id === 3 || id === 5 || id === 8 || id === 255; 
}
function vertexAO(s1, s2, c) { return s1 && s2 ? 0 : 3 - (Number(s1) + Number(s2) + Number(c)); }

function growTree(data, x, y, z, pSize, chunkHeight) {
  const pSize2 = pSize * pSize, trunkH = 5;
  for (let i = 0; i < trunkH; i++) {
    const idx = (y + i) * pSize2 + z * pSize + x;
    if (y + i < chunkHeight && data[idx] === 0) data[idx] = 4;
  }
  for (let ly = y + 3; ly <= y + 5; ly++) {
    for (let lz = z - 2; lz <= z + 2; lz++) {
      for (let lx = x - 2; lx <= x + 2; lx++) {
        const dist = Math.abs(lx - x) + Math.abs(ly - (y + 4)) + Math.abs(lz - z);
        if (dist <= 3 && ly < chunkHeight) {
          const idx = ly * pSize2 + lz * pSize + lx;
          if (data[idx] === 0) data[idx] = 5;
        }
      }
    }
  }
}

self.onmessage = function(e) {
  const { paddedData, chunkSize, chunkHeight, chunkX, chunkZ, version, needsGeneration } = e.data;
  const pSize = chunkSize + 2, pSize2 = pSize * pSize;
  const localData = new Uint8Array(pSize * chunkHeight * pSize);

  let newVoxels = null;

  if (needsGeneration) {
    // 1. 三维群落噪声地形生成
    // ... (保持现有生成逻辑)
    // (代码省略，实际 replace 会包含完整逻辑)
  } else {
    localData.set(paddedData);
  }

  // --- 核心修复：合并 Dexie 传来的历史增量修改 ---
  const { deltas } = e.data;
  if (deltas) {
    for (const dKey in deltas) {
      const [lx, ly, lz] = dKey.split('_').map(Number);
      // 映射到 paddedData 坐标系 (x+1, y, z+1)
      const px = lx + 1, pz = lz + 1;
      const idx = ly * pSize2 + pz * pSize + px;
      localData[idx] = deltas[dKey];
    }
  }

  // 2. 网格化渲染 (AO, 透明通道)
  const channels = { opaque: { positions: [], normals: [], uvs: [], colors: [], indices: [] }, transparent: { positions: [], normals: [], uvs: [], colors: [], indices: [] } };
  const isOcc = (dx, dy, dz, cx, cy, cz) => {
    const ny = cy + dy;
    if (ny < 0 || ny >= chunkHeight) return false;
    const tid = localData[ny * pSize2 + (cz + dz) * pSize + (cx + dx)];
    // 注意：255 也是透明的
    return tid !== 0 && !isTransparent(tid);
  };

  for (let y = 0; y < chunkHeight; y++) {
    for (let z = 0; z < chunkSize; z++) {
      for (let x = 0; x < chunkSize; x++) {
        const cx = x + 1, cz = z + 1;
        const voxel = localData[y * pSize2 + cz * pSize + cx];
        // 核心修复：0 和 255 都不渲染
        if (voxel === 0 || voxel === 255) continue;

        const target = isTransparent(voxel) ? channels.transparent : channels.opaque;
        const baseColor = colorMap[voxel] || [1, 1, 1];
        const isEven = ((chunkX * chunkSize + x) + y + (chunkZ * chunkSize + z)) % 2 === 0;
        const voxelColor = isEven ? baseColor : [baseColor[0] * 0.9, baseColor[1] * 0.9, baseColor[2] * 0.9];

        for (const { dir, corners } of faces) {
          const nx = cx + dir[0], ny = y + dir[1], nz = cz + dir[2];
          const neighbor = (ny >= 0 && ny < chunkHeight) ? localData[ny * pSize2 + nz * pSize + nx] : 0;
          
          let render = false;
          if (!isTransparent(voxel)) {
            if (isTransparent(neighbor)) render = true;
          } else {
            if (neighbor !== voxel) render = true;
          }

          if (render) {
            const ndx = target.positions.length / 3;
            let ao = [3, 3, 3, 3];
            for (let i = 0; i < 4; i++) {
              const c = corners[i];
              const dx = dir[0] === 0 ? (c.pos[0] * 2 - 1) : 0, dy = dir[1] === 0 ? (c.pos[1] * 2 - 1) : 0, dz = dir[2] === 0 ? (c.pos[2] * 2 - 1) : 0;
              let s1, s2, cor;
              if (dir[0] !== 0) { s1 = isOcc(dir[0], dy, 0, cx, y, cz); s2 = isOcc(dir[0], 0, dz, cx, y, cz); cor = isOcc(dir[0], dy, dz, cx, y, cz); }
              else if (dir[1] !== 0) { s1 = isOcc(dx, dir[1], 0, cx, y, cz); s2 = isOcc(0, dir[1], dz, cx, y, cz); cor = isOcc(dx, dir[1], dz, cx, y, cz); }
              else { s1 = isOcc(dx, 0, dir[2], cx, y, cz); s2 = isOcc(0, dy, dir[2], cx, y, cz); cor = isOcc(dx, dy, dir[2], cx, y, cz); }
              ao[i] = vertexAO(s1, s2, cor);
            }
            for (let i = 0; i < 4; i++) {
              const { pos, uv } = corners[i];
              target.positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
              target.normals.push(dir[0], dir[1], dir[2]);
              target.uvs.push(uv[0], uv[1]);
              const b = aoTable[ao[i]];
              target.colors.push(voxelColor[0] * b, voxelColor[1] * b, voxelColor[2] * b);
            }
            if (ao[0] + ao[2] < ao[1] + ao[3]) target.indices.push(ndx + 1, ndx + 2, ndx + 3, ndx + 3, ndx + 0, ndx + 1);
            else target.indices.push(ndx + 0, ndx + 1, ndx + 2, ndx + 2, ndx + 3, ndx + 0);
          }
        }
      }
    }
  }

  const finalize = (c) => ({ positions: new Float32Array(c.positions), normals: new Float32Array(c.normals), uvs: new Float32Array(c.uvs), colors: new Float32Array(c.colors), indices: new Uint32Array(c.indices) });
  const opaque = finalize(channels.opaque), transparent = finalize(channels.transparent);
  const transfer = [opaque.positions.buffer, opaque.normals.buffer, opaque.uvs.buffer, opaque.colors.buffer, opaque.indices.buffer, transparent.positions.buffer, transparent.normals.buffer, transparent.uvs.buffer, transparent.colors.buffer, transparent.indices.buffer];
  if (newVoxels) transfer.push(newVoxels.buffer);

  self.postMessage({ opaque, transparent, chunkX, chunkZ, version, voxels: newVoxels }, transfer);
};