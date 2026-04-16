import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

// 定义六个面的顶点、法线和 UV 坐标
// 视角：从方块外部看向该面
// 顶点顺序统一为: 0:左下(BL), 1:右下(BR), 2:右上(TR), 3:左上(TL)
const faces = [
  { dir: [ -1,  0,  0, ], corners: [ { pos: [ 0, 0, 0 ], uv: [ 0, 0 ] }, { pos: [ 0, 0, 1 ], uv: [ 1, 0 ] }, { pos: [ 0, 1, 1 ], uv: [ 1, 1 ] }, { pos: [ 0, 1, 0 ], uv: [ 0, 1 ] } ] },
  { dir: [  1,  0,  0, ], corners: [ { pos: [ 1, 0, 1 ], uv: [ 0, 0 ] }, { pos: [ 1, 0, 0 ], uv: [ 1, 0 ] }, { pos: [ 1, 1, 0 ], uv: [ 1, 1 ] }, { pos: [ 1, 1, 1 ], uv: [ 0, 1 ] } ] },
  { dir: [  0, -1,  0, ], corners: [ { pos: [ 0, 0, 0 ], uv: [ 0, 0 ] }, { pos: [ 1, 0, 0 ], uv: [ 1, 0 ] }, { pos: [ 1, 0, 1 ], uv: [ 1, 1 ] }, { pos: [ 0, 0, 1 ], uv: [ 0, 1 ] } ] },
  { dir: [  0,  1,  0, ], corners: [ { pos: [ 0, 1, 1 ], uv: [ 0, 0 ] }, { pos: [ 1, 1, 1 ], uv: [ 1, 0 ] }, { pos: [ 1, 1, 0 ], uv: [ 1, 1 ] }, { pos: [ 0, 1, 0 ], uv: [ 0, 1 ] } ] },
  { dir: [  0,  0, -1, ], corners: [ { pos: [ 1, 0, 0 ], uv: [ 0, 0 ] }, { pos: [ 0, 0, 0 ], uv: [ 1, 0 ] }, { pos: [ 0, 1, 0 ], uv: [ 1, 1 ] }, { pos: [ 1, 1, 0 ], uv: [ 0, 1 ] } ] },
  { dir: [  0,  0,  1, ], corners: [ { pos: [ 0, 0, 1 ], uv: [ 0, 0 ] }, { pos: [ 1, 0, 1 ], uv: [ 1, 0 ] }, { pos: [ 1, 1, 1 ], uv: [ 1, 1 ] }, { pos: [ 0, 1, 1 ], uv: [ 0, 1 ] } ] },
];

export function generateTree(world, x, y, z) {
  const trunkHeight = 5;
  const woodType = 4; 
  const leafType = 5; 

  for (let i = 0; i < trunkHeight; i++) {
    const targetY = y + i;
    if (world.getBlock(x, targetY, z) === 0) {
      world.setBlock(x, targetY, z, woodType);
    }
  }

  for (let ly = y + 3; ly <= y + 5; ly++) {
    for (let lz = z - 1; lz <= z + 1; lz++) {
      for (let lx = x - 1; lx <= x + 1; lx++) {
        const isCorner = Math.abs(lx - x) === 1 && Math.abs(lz - z) === 1;
        if (isCorner && (ly === y + 5 || Math.random() < 0.3)) continue; 
        if (world.getBlock(lx, ly, lz) === 0) {
          world.setBlock(lx, ly, lz, leafType);
        }
      }
    }
  }
}

const heightNoise = createNoise2D(() => 0.5);
const biomeNoise = createNoise2D(() => 0.8);

/**
 * 外部查询工具：根据全局世界坐标返回群落名称
 */
export function getBiomeAt(worldX, worldZ) {
  const biomeScale = 0.01;
  const bNoise = biomeNoise(worldX * biomeScale, worldZ * biomeScale);
  if (bNoise < -0.4) return 'SNOWY (积雪高山)';
  if (bNoise > 0.4) return 'DESERT (热带沙漠)';
  return 'GRASS (温带平原)';
}

export class VoxelWorld {
  constructor(chunkSize = 16, chunkHeight = 256) {
    this.chunkSize = chunkSize;
    this.chunkHeight = chunkHeight;
    const volume = this.chunkSize * this.chunkHeight * this.chunkSize;
    this.data = new Uint8Array(volume);
  }

  computeVoxelIndex(x, y, z) {
    // 采用 y-z-x 存储顺序
    return y * this.chunkSize * this.chunkSize + z * this.chunkSize + x;
  }

  isWithinBounds(x, y, z) {
    return (
      x >= 0 && x < this.chunkSize &&
      y >= 0 && y < this.chunkHeight &&
      z >= 0 && z < this.chunkSize
    );
  }

  setBlock(x, y, z, type) {
    if (!this.isWithinBounds(x, y, z)) return;
    const index = this.computeVoxelIndex(x, y, z);
    this.data[index] = type;
  }

  getBlock(x, y, z) {
    if (!this.isWithinBounds(x, y, z)) return 0;
    const index = this.computeVoxelIndex(x, y, z);
    return this.data[index];
  }

  generateTerrain(chunkX = 0, chunkZ = 0) {
    const heightScale = 0.04; // 稍微降低频率，使地形更开阔
    const biomeScale = 0.01;  // 群落尺度变大，方便大范围观察
    const seaLevel = 60;
    const treeCandidates = [];

    for (let z = 0; z < this.chunkSize; ++z) {
      for (let x = 0; x < this.chunkSize; ++x) {
        const worldX = chunkX * this.chunkSize + x;
        const worldZ = chunkZ * this.chunkSize + z;

        // 1. 采样群落噪声 [-1, 1]
        const bNoise = biomeNoise(worldX * biomeScale, worldZ * biomeScale);
        
        // 2. 基于群落噪声平滑插值地形参数 (Lerp)
        // 锚点定义：
        // 积雪高山 (bNoise = -1.0): Base 85, Amp 70 (更高更陡)
        // 温带平原 (bNoise = 0.0):  Base 66, Amp 4  (极平，利于肉眼辨识)
        // 热带沙漠 (bNoise = 1.0):  Base 64, Amp 2  (几乎水平)
        
        let finalBase, finalAmp, biomeType;
        if (bNoise < 0) {
          // 从雪山 (-1) 过渡到平原 (0)
          const t = bNoise + 1; 
          finalBase = 85 + (66 - 85) * t;
          finalAmp = 70 + (4 - 70) * t;
          biomeType = bNoise < -0.4 ? 'SNOWY' : 'GRASS';
        } else {
          // 从平原 (0) 过渡到沙漠 (1)
          const t = bNoise; 
          finalBase = 66 + (64 - 66) * t;
          finalAmp = 4 + (2 - 4) * t;
          biomeType = bNoise > 0.4 ? 'DESERT' : 'GRASS';
        }

        // 3. 采样高度噪声并应用当前坐标的插值参数
        const hNoise = heightNoise(worldX * heightScale, worldZ * heightScale) * 0.5 + 0.5;
        const terrainHeight = Math.floor(finalBase + hNoise * finalAmp);

        for (let y = 0; y < this.chunkHeight; ++y) {
          if (y < terrainHeight) {
            if (y === terrainHeight - 1) {
              if (y < seaLevel) {
                this.setBlock(x, y, z, 6); // 水底/浅滩统一为沙子
              } else {
                if (biomeType === 'DESERT') {
                  this.setBlock(x, y, z, 6); // 沙子
                } else if (biomeType === 'SNOWY') {
                  this.setBlock(x, y, z, 7); // 雪
                } else {
                  this.setBlock(x, y, z, 1); // 草地
                  if (x > 1 && x < this.chunkSize - 2 && z > 1 && z < this.chunkSize - 2) {
                    const pseudoRandom = Math.abs(Math.sin(worldX * 12.9898 + worldZ * 78.233)) * 43758.5453;
                    if ((pseudoRandom % 1) < 0.02) {
                      treeCandidates.push({ x, y: y + 1, z });
                    }
                  }
                }
              }
            } else {
              this.setBlock(x, y, z, 2); // 内部泥土
            }
          } else if (y < seaLevel) {
            this.setBlock(x, y, z, 3); // 海水
          }
        }
      }
    }
    
    for (const pos of treeCandidates) {
      generateTree(this, pos.x, pos.y, pos.z);
    }
  }

  // 为旧代码保留兼容性，但内部调用新 API
  setVoxel(x, y, z, type) { this.setBlock(x, y, z, type); }
  getVoxel(x, y, z) { return this.getBlock(x, y, z); }

  generateGeometryData() {
    // 该方法逻辑由于迁移至 Worker，这里仅保留本地测试用的精简版或直接抛错提示
    console.warn('VoxelWorld.generateGeometryData is deprecated. Use chunkWorker.js instead.');
    return { positions:[], normals:[], uvs:[], indices:[], colors:[] };
  }

  generateGeometry() {
    return new THREE.BufferGeometry();
  }
}