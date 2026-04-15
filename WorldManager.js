import * as THREE from 'three';
import { VoxelWorld } from './VoxelWorld.js';

// 创建全局 Worker 实例
// 在 Vite 中使用 new URL(...) 会自动处理 Worker 路径
const worker = new Worker(new URL('./chunkWorker.js', import.meta.url), { type: 'module' });

export class Chunk {
  constructor(scene, chunkX, chunkZ, chunkSize = 16) {
    this.scene = scene;
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.chunkSize = chunkSize;

    // 1. 初始化数据
    this.world = new VoxelWorld(this.chunkSize);
    this.world.generateTerrain(this.chunkX, this.chunkZ); 

    // 2. 创建一个空的 Mesh 占位
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.MeshStandardMaterial({ 
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.1,
      depthTest: true,
      depthWrite: true,
      transparent: false
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(this.chunkX * this.chunkSize, 0, this.chunkZ * this.chunkSize);
    this.scene.add(this.mesh);

    // 3. 异步生成网格
    this.updateMesh();
  }

  /**
   * 将数据发送给 Worker 进行异步并行计算
   */
  updateMesh() {
    worker.postMessage({
      data: this.world.data, // Uint8Array 会被拷贝 (保持主线程物理可用)
      chunkSize: this.chunkSize,
      chunkX: this.chunkX,
      chunkZ: this.chunkZ
    });
  }

  /**
   * 接收来自 Worker 的顶点数据并应用到几何体
   */
  applyGeometry(geoData) {
    const { positions, normals, uvs, colors, indices } = geoData;
    const geometry = this.mesh.geometry;

    // 清理旧属性
    if (geometry.index) geometry.setIndex(null);
    Object.keys(geometry.attributes).forEach(key => geometry.deleteAttribute(key));

    // 设置新属性
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    
    geometry.computeBoundingSphere();
  }

  dispose() {
    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh);
    }
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) {
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(mat => mat.dispose());
      } else {
        this.mesh.material.dispose();
      }
    }
    this.world = null;
    this.mesh = null;
  }
}

export class WorldManager {
  constructor(scene, renderDistance = 3, chunkSize = 16) {
    this.scene = scene;
    this.chunkSize = chunkSize;
    this.renderDistance = renderDistance;
    this.chunks = new Map();
    this.lastChunkX = null;
    this.lastChunkZ = null;

    // 全局监听 Worker 回传
    worker.onmessage = (e) => {
      const { chunkX, chunkZ, ...geoData } = e.data;
      const key = `${chunkX},${chunkZ}`;
      const chunk = this.chunks.get(key);
      if (chunk) {
        chunk.applyGeometry(geoData);
      }
    };
  }

  getVoxel(worldX, worldY, worldZ) {
    const chunkX = Math.floor(worldX / this.chunkSize);
    const chunkZ = Math.floor(worldZ / this.chunkSize);
    const key = `${chunkX},${chunkZ}`;
    const chunk = this.chunks.get(key);
    if (!chunk) return 0;
    const localX = Math.floor(worldX - chunkX * this.chunkSize);
    const localY = Math.floor(worldY);
    const localZ = Math.floor(worldZ - chunkZ * this.chunkSize);
    return chunk.world.getVoxel(localX, localY, localZ);
  }

  setVoxel(worldX, worldY, worldZ, type) {
    const chunkX = Math.floor(worldX / this.chunkSize);
    const chunkZ = Math.floor(worldZ / this.chunkSize);
    const key = `${chunkX},${chunkZ}`;
    const chunk = this.chunks.get(key);
    if (chunk) {
      const localX = Math.floor(worldX - chunkX * this.chunkSize);
      const localY = Math.floor(worldY);
      const localZ = Math.floor(worldZ - chunkZ * this.chunkSize);
      chunk.world.setVoxel(localX, localY, localZ, type);
      chunk.updateMesh();
    }
  }

  update(playerPos) {
    const currentChunkX = Math.floor(playerPos.x / this.chunkSize);
    const currentChunkZ = Math.floor(playerPos.z / this.chunkSize);
    if (this.lastChunkX === currentChunkX && this.lastChunkZ === currentChunkZ) return;
    this.lastChunkX = currentChunkX;
    this.lastChunkZ = currentChunkZ;

    const expectedKeys = new Set();
    for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
      for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
        const chunkX = currentChunkX + dx;
        const chunkZ = currentChunkZ + dz;
        const key = `${chunkX},${chunkZ}`;
        expectedKeys.add(key);
        if (!this.chunks.has(key)) {
          this.chunks.set(key, new Chunk(this.scene, chunkX, chunkZ, this.chunkSize));
        }
      }
    }
    for (const [key, chunk] of this.chunks.entries()) {
      if (!expectedKeys.has(key)) {
        chunk.dispose();
        this.chunks.delete(key);
      }
    }
  }
}