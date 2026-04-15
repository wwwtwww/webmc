import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

// 定义六个面的顶点、法线和 UV 坐标
// 强制采用逆时针（CCW）绕序，保证 WebGL 背面剔除（Back-face Culling）正常工作。
// 视角：从方块外部看向该面
// 顶点顺序统一为: 0:左下(BL), 1:右下(BR), 2:右上(TR), 3:左上(TL)
// 拆分的两个三角形索引为: [0, 1, 2] 和 [2, 3, 0]，这能确保形成逆时针。
const faces = [
  { // 左面 (-x)
    dir: [ -1,  0,  0, ],
    corners: [
      { pos: [ 0, 0, 0 ], uv: [ 0, 0 ] }, // 0: 左下
      { pos: [ 0, 0, 1 ], uv: [ 1, 0 ] }, // 1: 右下
      { pos: [ 0, 1, 1 ], uv: [ 1, 1 ] }, // 2: 右上
      { pos: [ 0, 1, 0 ], uv: [ 0, 1 ] }, // 3: 左上
    ],
  },
  { // 右面 (+x)
    dir: [  1,  0,  0, ],
    corners: [
      { pos: [ 1, 0, 1 ], uv: [ 0, 0 ] }, // 0: 左下
      { pos: [ 1, 0, 0 ], uv: [ 1, 0 ] }, // 1: 右下
      { pos: [ 1, 1, 0 ], uv: [ 1, 1 ] }, // 2: 右上
      { pos: [ 1, 1, 1 ], uv: [ 0, 1 ] }, // 3: 左上
    ],
  },
  { // 下面 (-y)
    dir: [  0, -1,  0, ],
    corners: [
      { pos: [ 0, 0, 0 ], uv: [ 0, 0 ] }, // 0: 左下
      { pos: [ 1, 0, 0 ], uv: [ 1, 0 ] }, // 1: 右下
      { pos: [ 1, 0, 1 ], uv: [ 1, 1 ] }, // 2: 右上
      { pos: [ 0, 0, 1 ], uv: [ 0, 1 ] }, // 3: 左上
    ],
  },
  { // 上面 (+y)
    dir: [  0,  1,  0, ],
    corners: [
      { pos: [ 0, 1, 1 ], uv: [ 0, 0 ] }, // 0: 左下
      { pos: [ 1, 1, 1 ], uv: [ 1, 0 ] }, // 1: 右下
      { pos: [ 1, 1, 0 ], uv: [ 1, 1 ] }, // 2: 右上
      { pos: [ 0, 1, 0 ], uv: [ 0, 1 ] }, // 3: 左上
    ],
  },
  { // 后面 (-z)
    dir: [  0,  0, -1, ],
    corners: [
      { pos: [ 1, 0, 0 ], uv: [ 0, 0 ] }, // 0: 左下
      { pos: [ 0, 0, 0 ], uv: [ 1, 0 ] }, // 1: 右下
      { pos: [ 0, 1, 0 ], uv: [ 1, 1 ] }, // 2: 右上
      { pos: [ 1, 1, 0 ], uv: [ 0, 1 ] }, // 3: 左上
    ],
  },
  { // 前面 (+z)
    dir: [  0,  0,  1, ],
    corners: [
      { pos: [ 0, 0, 1 ], uv: [ 0, 0 ] }, // 0: 左下
      { pos: [ 1, 0, 1 ], uv: [ 1, 0 ] }, // 1: 右下
      { pos: [ 1, 1, 1 ], uv: [ 1, 1 ] }, // 2: 右上
      { pos: [ 0, 1, 1 ], uv: [ 0, 1 ] }, // 3: 左上
    ],
  },
];

// 树木生成逻辑：传入区块世界实例、根部生长的起始坐标 (x, y, z)
export function generateTree(world, x, y, z) {
  const trunkHeight = 5;
  const woodType = 4; // 木头 ID
  const leafType = 5; // 树叶 ID

  // 1. 生成树干 (向上 5 格)
  for (let i = 0; i < trunkHeight; i++) {
    const targetY = y + i;
    // 冲突检查：目标坐标必须是空气，才放置木头
    if (world.getVoxel(x, targetY, z) === 0) {
      world.setVoxel(x, targetY, z, woodType);
    }
  }

  // 2. 生成树冠 (在 [y+3, y+5] 的 3x3x3 范围)
  for (let ly = y + 3; ly <= y + 5; ly++) {
    for (let lz = z - 1; lz <= z + 1; lz++) {
      for (let lx = x - 1; lx <= x + 1; lx++) {
        // 削去树冠的最外围 8 个角，让树木显得更圆润 (可选)
        const isCorner = Math.abs(lx - x) === 1 && Math.abs(lz - z) === 1;
        if (isCorner && (ly === y + 5 || Math.random() < 0.3)) {
          continue; 
        }
        
        // 冲突检查：只有空气才放置树叶，避免覆盖中间刚生成的树干
        if (world.getVoxel(lx, ly, lz) === 0) {
          world.setVoxel(lx, ly, lz, leafType);
        }
      }
    }
  }
}

// 全局唯一的噪声生成器实例，确保所有区块使用相同的随机种子
const noise2D = createNoise2D(() => 0.5); // 使用固定种子实现确定性生成

export class VoxelWorld {
  constructor(chunkSize = 16) {
    this.chunkSize = chunkSize;
    const volume = this.chunkSize * this.chunkSize * this.chunkSize;
    this.data = new Uint8Array(volume);
  }

  computeVoxelIndex(x, y, z) {
    return y * this.chunkSize * this.chunkSize + z * this.chunkSize + x;
  }

  isWithinBounds(x, y, z) {
    return (
      x >= 0 && x < this.chunkSize &&
      y >= 0 && y < this.chunkSize &&
      z >= 0 && z < this.chunkSize
    );
  }

  setVoxel(x, y, z, type) {
    if (!this.isWithinBounds(x, y, z)) return;
    const index = this.computeVoxelIndex(x, y, z);
    this.data[index] = type;
  }

  getVoxel(x, y, z) {
    if (!this.isWithinBounds(x, y, z)) return 0;
    const index = this.computeVoxelIndex(x, y, z);
    return this.data[index];
  }

  /**
   * 使用 2D 噪声生成地形高度，支持基于区块坐标 (chunkX, chunkZ) 的平滑衔接
   */
  generateTerrain(chunkX = 0, chunkZ = 0) {
    const scale = 0.05; // 降低缩放倍率，让山脉更平缓宏大
    
    const treeCandidates = [];

    for (let z = 0; z < this.chunkSize; ++z) {
      for (let x = 0; x < this.chunkSize; ++x) {
        // 计算全局世界坐标
        const worldX = chunkX * this.chunkSize + x;
        const worldZ = chunkZ * this.chunkSize + z;

        // 使用全局坐标进行噪声采样，确保边缘无缝
        const noiseValue = noise2D(worldX * scale, worldZ * scale) * 0.5 + 0.5;
        
        // 映射到 [3, 12] 的高度
        const height = Math.floor(noiseValue * 9) + 3;

        for (let y = 0; y < this.chunkSize; ++y) {
          if (y < height) {
            if (y === height - 1 && y >= 5) {
              this.setVoxel(x, y, z, 1); // 草地
              
              // 植被生成也改为基于世界坐标的确定性随机，防止每次加载位置不同
              if (x > 1 && x < this.chunkSize - 2 && z > 1 && z < this.chunkSize - 2) {
                // 使用简易哈希模拟基于坐标的确定性随机概率
                const pseudoRandom = Math.abs(Math.sin(worldX * 12.9898 + worldZ * 78.233)) * 43758.5453;
                if ((pseudoRandom % 1) < 0.02) {
                  treeCandidates.push({ x, y: y + 1, z });
                }
              }
            } else {
              this.setVoxel(x, y, z, 2); // 泥土
            }
          } else if (y < 5) {
            this.setVoxel(x, y, z, 3); // 水
          }
        }
      }
    }
    
    for (const pos of treeCandidates) {
      generateTree(this, pos.x, pos.y, pos.z);
    }
  }

  /**
   * 生成区块的网格数据 (Positions, Normals, UVs, Indices, Colors)
   * 支持面剔除和基于顶点颜色的方块渲染
   */
  generateGeometryData() {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const colors = [];

    // 定义不同类型的方块顶点颜色 [R, G, B]
    const colorMap = {
      1: [0.2, 0.8, 0.2], // 草地 (绿色)
      2: [0.5, 0.3, 0.1], // 泥土 (棕色)
      3: [0.1, 0.4, 0.9], // 水 (蓝色)
      4: [0.4, 0.2, 0.0], // 木头 (深褐色)
      5: [0.1, 0.5, 0.1], // 树叶 (深绿色)
    };

    for (let y = 0; y < this.chunkSize; ++y) {
      for (let z = 0; z < this.chunkSize; ++z) {
        for (let x = 0; x < this.chunkSize; ++x) {
          const voxel = this.getVoxel(x, y, z);
          if (voxel !== 0) { // 如果不是空气
            const baseColor = colorMap[voxel] || [1, 1, 1]; // 默认白色
            
            // 简单的棋盘格光影效果：计算坐标之和，如果为奇数，则将该方块各颜色通道变暗 10%
            const isEven = (x + y + z) % 2 === 0;
            const voxelColor = isEven 
              ? baseColor 
              : [baseColor[0] * 0.9, baseColor[1] * 0.9, baseColor[2] * 0.9];

            for (const { dir, corners } of faces) {
              const neighbor = this.getVoxel(
                x + dir[0],
                y + dir[1],
                z + dir[2]
              );
              
              // 面剔除：
              // 1. 如果相邻方块是空气 (0)，生成该面
              // 2. 为了防止水透视隐藏泥土，如果当前是泥土而相邻是水，泥土该面也应可见
              const isNeighborAir = neighbor === 0;
              const isNeighborWater = (voxel !== 3 && neighbor === 3);

              if (isNeighborAir || isNeighborWater) {
                const ndx = positions.length / 3;
                
                for (const { pos, uv } of corners) {
                  positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
                  normals.push(dir[0], dir[1], dir[2]);
                  uvs.push(uv[0], uv[1]); 
                  colors.push(...voxelColor); // 推入顶点颜色
                }
                
                indices.push(
                  ndx, ndx + 1, ndx + 2,
                  ndx + 2, ndx + 3, ndx
                );
              }
            }
          }
        }
      }
    }

    return { positions, normals, uvs, indices, colors };
  }

  /**
   * 返回 Three.js 可用的 BufferGeometry
   */
  generateGeometry() {
    const { positions, normals, uvs, indices, colors } = this.generateGeometryData();
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    geometry.setIndex(indices);
    
    return geometry;
  }
}