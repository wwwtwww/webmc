// chunkWorker.js - 集成三维群落噪声、程序化植被、AO 与 双通道网格生成
import { createNoise3D, createNoise2D } from 'simplex-noise';

// 使用固定种子确保世界生成的确定性
const seed = 12345;
function alea(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const noise3D = createNoise3D(alea(seed));
const biomeNoise = createNoise2D(alea(seed + 1));

// --- 常量配置 ---
const STEP = 4;
const NOISE_SCALE = 0.012;
const BIOME_SCALE = 0.005;
const SEA_LEVEL = 60;
const aoTable = [0.4, 0.6, 0.8, 1.0];

// 安全区参数
const SPAWN_RADIUS = 30;
const BLEND_RADIUS = 20;
const SAFE_HEIGHT = 64;

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
  50: [1.0, 0.68, 0.69], // 生猪肉 (粉色)
};

// --- 数学与辅助 ---
function lerp(a, b, t) { return a + t * (b - a); }
function isTransparent(id) { 
  return id === 0 || id === 3 || id === 5 || id === 8 || id === 255; 
}
function vertexAO(s1, s2, c) { return s1 && s2 ? 0 : 3 - (Number(s1) + Number(s2) + Number(c)); }

function pseudoRandom(x, z) {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453123;
  return n - Math.floor(n);
}

// 核心修复：增加边界检查防止 1D 数组索引越界/环绕 (Bug 2)
function growTree(data, x, y, z, pSize, chunkHeight) {
  const pSize2 = pSize * pSize, trunkH = 5;
  const setVoxel = (vx, vy, vz, id) => {
    if (vx < 0 || vx >= pSize || vy < 0 || vy >= chunkHeight || vz < 0 || vz >= pSize) return;
    const idx = vy * pSize2 + vz * pSize + vx;
    if (data[idx] === 0) data[idx] = id;
  };

  for (let i = 0; i < trunkH; i++) {
    setVoxel(x, y + i, z, 4);
  }
  for (let ly = y + 3; ly <= y + 5; ly++) {
    for (let lz = z - 2; lz <= z + 2; lz++) {
      for (let lx = x - 2; lx <= x + 2; lx++) {
        const dist = Math.abs(lx - x) + Math.abs(ly - (y + 4)) + Math.abs(lz - z);
        if (dist <= 3) {
          setVoxel(lx, ly, lz, 5);
        }
      }
    }
  }
}

self.onmessage = function(e) {
  const { voxels, chunkSize, chunkHeight, chunkX, chunkZ, version, needsGeneration, deltas } = e.data;
  
  // 核心修复：将 Padding 从 1 增加到 2 (pSize = chunkSize + 4) 以容纳半径为 2 的树冠 (Bug 20)
  const pad = 2;
  const pSize = chunkSize + pad * 2, pSize2 = pSize * pSize;
  const localData = new Uint8Array(pSize * chunkHeight * pSize);

  let newVoxels = null;

  if (needsGeneration) {
    // 1. 地形生成
    for (let z = 0; z < pSize; z++) {
      for (let x = 0; x < pSize; x++) {
        const worldX = chunkX * chunkSize + x - pad;
        const worldZ = chunkZ * chunkSize + z - pad;

        const distance = Math.sqrt(worldX * worldX + worldZ * worldZ);
        let factor = 1.0;
        if (distance <= SPAWN_RADIUS) factor = 0.0;
        else if (distance < SPAWN_RADIUS + BLEND_RADIUS) {
          const t = (distance - SPAWN_RADIUS) / BLEND_RADIUS;
          factor = t * t * (3 - 2 * t);
        }

        const bNoise = biomeNoise(worldX * BIOME_SCALE, worldZ * BIOME_SCALE);
        let biome = 'GRASS';
        if (factor > 0) {
          if (bNoise < -0.4) biome = 'SNOWY';
          else if (bNoise > 0.4) biome = 'DESERT';
        }

        const hNoise = (noise3D(worldX * 0.005, 0, worldZ * 0.005) + 1) * 0.5;
        const randomBaseHeight = SEA_LEVEL + hNoise * 40;
        const baseHeight = lerp(SAFE_HEIGHT, randomBaseHeight, factor);

        for (let y = 0; y < chunkHeight; y++) {
          const idx = y * pSize2 + z * pSize + x;
          let density;
          if (factor === 0) density = (baseHeight - y);
          else {
            const dNoise = noise3D(worldX * NOISE_SCALE, y * NOISE_SCALE * 1.5, worldZ * NOISE_SCALE);
            density = lerp((baseHeight - y), dNoise + (randomBaseHeight - y) * 0.1, factor);
          }

          if (density > 0) {
            if (y > SEA_LEVEL + 30 && biome === 'SNOWY') localData[idx] = 7;
            else if (y < SEA_LEVEL + 2 && biome === 'DESERT') localData[idx] = 6;
            else {
              let surfDensity;
              if (factor === 0) surfDensity = baseHeight - (y + 1);
              else {
                const dNoiseNext = noise3D(worldX * NOISE_SCALE, (y + 1) * NOISE_SCALE * 1.5, worldZ * NOISE_SCALE);
                surfDensity = lerp((baseHeight - (y + 1)), dNoiseNext + (randomBaseHeight - (y + 1)) * 0.1, factor);
              }
              if (surfDensity <= 0) localData[idx] = (biome === 'DESERT') ? 6 : 1;
              else localData[idx] = (biome === 'DESERT') ? 6 : 2;
            }
          } else if (y < SEA_LEVEL && factor > 0) {
            localData[idx] = 3;
          }
        }

        // 核心修复：允许在所有区域（包括 Padding）通过确定性噪声发现树木 (Bug 22)
        if (biome === 'GRASS' && pseudoRandom(worldX, worldZ) < 0.01) {
          let surfaceY = -1;
          for (let y = chunkHeight - 1; y >= 0; y--) {
            const block = localData[y * pSize2 + z * pSize + x];
            if (block !== 0 && block !== 3) {
              if (block === 1) surfaceY = y;
              break;
            }
          }
          if (surfaceY > SEA_LEVEL && surfaceY < chunkHeight - 10) {
            growTree(localData, x, surfaceY + 1, z, pSize, chunkHeight);
          }
        }
      }
    }
  } else {
    // 2. 核心修复：组装 Padding 时包含 4 个对角线邻居，实现完美 AO (Bug 11)
    const { 
      center, 
      neighborL, neighborR, neighborB, neighborF,
      neighborLB, neighborLF, neighborRB, neighborRF 
    } = voxels;

    for (let y = 0; y < chunkHeight; y++) {
      const yOff = y * pSize2;
      const vyOff = y * chunkSize * chunkSize;

      // --- 中心块 ---
      for (let z = 0; z < chunkSize; z++) {
        for (let x = 0; x < chunkSize; x++) {
          localData[yOff + (z + pad) * pSize + (x + pad)] = center[vyOff + z * chunkSize + x];
        }
      }

      // --- 4 个侧面邻居 (仅拷贝靠近边界的 1 层即可，因为 re-mesh 只需 1 层 Padding 做 AO) ---
      if (neighborL) for (let z = 0; z < chunkSize; z++) localData[yOff + (z + pad) * pSize + (pad - 1)] = neighborL[vyOff + z * chunkSize + (chunkSize - 1)];
      if (neighborR) for (let z = 0; z < chunkSize; z++) localData[yOff + (z + pad) * pSize + (chunkSize + pad)] = neighborR[vyOff + z * chunkSize + 0];
      if (neighborB) for (let x = 0; x < chunkSize; x++) localData[yOff + (pad - 1) * pSize + (x + pad)] = neighborB[vyOff + (chunkSize - 1) * chunkSize + x];
      if (neighborF) for (let x = 0; x < chunkSize; x++) localData[yOff + (chunkSize + pad) * pSize + (x + pad)] = neighborF[vyOff + 0 * chunkSize + x];

      // --- 4 个对角线邻居 ---
      if (neighborLB) localData[yOff + (pad - 1) * pSize + (pad - 1)] = neighborLB[vyOff + (chunkSize - 1) * chunkSize + (chunkSize - 1)];
      if (neighborLF) localData[yOff + (chunkSize + pad) * pSize + (pad - 1)] = neighborLF[vyOff + 0 * chunkSize + (chunkSize - 1)];
      if (neighborRB) localData[yOff + (pad - 1) * pSize + (chunkSize + pad)] = neighborRB[vyOff + (chunkSize - 1) * chunkSize + 0];
      if (neighborRF) localData[yOff + (chunkSize + pad) * pSize + (chunkSize + pad)] = neighborRF[vyOff + 0 * chunkSize + 0];
    }
  }

  // 3. 应用存档增量
  if (deltas) {
    for (const dKey in deltas) {
      const [lx, ly, lz] = dKey.split('_').map(Number);
      localData[ly * pSize2 + (lz + pad) * pSize + (lx + pad)] = deltas[dKey];
    }
  }

  // 4. 如果是新生成的，提取中心 16x256x16 返回
  if (needsGeneration) {
    const volume = chunkSize * chunkHeight * chunkSize;
    // 核心优化：如果支持 SAB，则在 Worker 中也使用 SAB 创建新体素数组 (Bug 51)
    if (typeof SharedArrayBuffer !== 'undefined') {
      newVoxels = new Uint8Array(new SharedArrayBuffer(volume));
    } else {
      newVoxels = new Uint8Array(volume);
    }

    for (let y = 0; y < chunkHeight; y++) {
      for (let z = 0; z < chunkSize; z++) {
        for (let x = 0; x < chunkSize; x++) {
          newVoxels[y * chunkSize * chunkSize + z * chunkSize + x] = localData[y * pSize2 + (z + pad) * pSize + (x + pad)];
        }
      }
    }
  }

  // 5. 网格化渲染逻辑
  const channels = { opaque: { positions: [], normals: [], uvs: [], colors: [], indices: [] }, transparent: { positions: [], normals: [], uvs: [], colors: [], indices: [] } };
  const isOcc = (dx, dy, dz, cx, cy, cz) => {
    const ny = cy + dy;
    if (ny < 0 || ny >= chunkHeight) return false;
    const tid = localData[ny * pSize2 + (cz + dz) * pSize + (cx + dx)];
    return tid !== 0 && !isTransparent(tid);
  };

  for (let y = 0; y < chunkHeight; y++) {
    for (let z = 0; z < chunkSize; z++) {
      for (let x = 0; x < chunkSize; x++) {
        const cx = x + pad, cz = z + pad;
        const voxel = localData[y * pSize2 + cz * pSize + cx];
        if (voxel === 0 || voxel === 255) continue;

        const target = isTransparent(voxel) ? channels.transparent : channels.opaque;
        const baseColor = colorMap[voxel] || [1, 1, 1];
        const isEven = ((chunkX * chunkSize + x) + y + (chunkZ * chunkSize + z)) % 2 === 0;
        const voxelColor = isEven ? baseColor : [baseColor[0] * 0.9, baseColor[1] * 0.9, baseColor[2] * 0.9];

        for (const { dir, corners } of faces) {
          const nx = cx + dir[0], ny = y + dir[1], nz = cz + dir[2];
          const neighbor = (ny >= 0 && ny < chunkHeight) ? localData[ny * pSize2 + nz * pSize + nx] : 0;
          let render = false;
          if (!isTransparent(voxel)) { if (isTransparent(neighbor)) render = true; }
          else { if (neighbor !== voxel) render = true; }

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
  
  // 核心修复：如果是 SharedArrayBuffer，禁止放入 transfer 列表 (Bug 51)
  if (newVoxels && typeof SharedArrayBuffer !== 'undefined' && !(newVoxels.buffer instanceof SharedArrayBuffer)) {
    transfer.push(newVoxels.buffer);
  } else if (newVoxels && typeof SharedArrayBuffer === 'undefined') {
    transfer.push(newVoxels.buffer);
  }

  self.postMessage({ opaque, transparent, chunkX, chunkZ, version, voxels: newVoxels }, transfer);
};
