import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

// 使用固定种子确保主线程与 Worker 逻辑一致
const seed = 12345;
function alea(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const biomeNoise = createNoise2D(alea(seed + 1));

/**
 * 核心体素数据模型
 */
export class VoxelWorld {
  constructor(chunkSize = 16, chunkHeight = 256) {
    this.chunkSize = chunkSize;
    this.chunkHeight = chunkHeight;
    const volume = this.chunkSize * this.chunkHeight * this.chunkSize;
    this.data = new Uint8Array(volume);
  }

  computeVoxelIndex(x, y, z) {
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
}

/**
 * 外部查询工具：根据全局世界坐标返回真实的群落名称
 */
export function getBiomeAt(worldX, worldZ) {
  const biomeScale = 0.005;
  const bNoise = biomeNoise(worldX * biomeScale, worldZ * biomeScale);
  
  if (bNoise < -0.4) return 'SNOWY (积雪高山)';
  if (bNoise > 0.4) return 'DESERT (热带沙漠)';
  return 'GRASS (温带平原)';
}