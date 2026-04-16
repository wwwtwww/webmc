import * as THREE from 'three';
import { VoxelWorld } from './VoxelWorld.js';

// 创建全局 Worker 实例
const worker = new Worker(new URL('./chunkWorker.js', import.meta.url), { type: 'module' });

export class Chunk {
  constructor(scene, chunkX, chunkZ, chunkSize = 16, chunkHeight = 256) {
    this.scene = scene;
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.chunkSize = chunkSize;
    this.chunkHeight = chunkHeight;

    this.world = new VoxelWorld(this.chunkSize, this.chunkHeight);
    this.world.generateTerrain(this.chunkX, this.chunkZ); 

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

    // 初次加载不需要 paddedData (因为邻居可能还没加载)，或者由 WorldManager 统一调度
  }

  /**
   * 接收来自 Worker 的顶点数据并应用到几何体
   */
  applyGeometry(geoData) {
    const { positions, normals, uvs, colors, indices } = geoData;
    const geometry = this.mesh.geometry;

    if (geometry.index) geometry.setIndex(null);
    Object.keys(geometry.attributes).forEach(key => geometry.deleteAttribute(key));

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
  constructor(scene, renderDistance = 3, chunkSize = 16, chunkHeight = 256) {
    this.scene = scene;
    this.chunkSize = chunkSize;
    this.chunkHeight = chunkHeight;
    this.renderDistance = renderDistance;
    this.chunks = new Map();
    this.lastChunkX = null;
    this.lastChunkZ = null;

    worker.onmessage = (e) => {
      const { chunkX, chunkZ, ...geoData } = e.data;
      const key = `${chunkX},${chunkZ}`;
      const chunk = this.chunks.get(key);
      if (chunk) {
        chunk.applyGeometry(geoData);
      }
    };
  }

  getBlock(worldX, worldY, worldZ) {
    const chunkX = Math.floor(worldX / this.chunkSize);
    const chunkZ = Math.floor(worldZ / this.chunkSize);
    const key = `${chunkX},${chunkZ}`;
    const chunk = this.chunks.get(key);
    if (!chunk) return 0;
    const localX = Math.floor(worldX - chunkX * this.chunkSize);
    const localY = Math.floor(worldY);
    const localZ = Math.floor(worldZ - chunkZ * this.chunkSize);
    return chunk.world.getBlock(localX, localY, localZ);
  }

  setBlock(worldX, worldY, worldZ, type) {
    const chunkX = Math.floor(worldX / this.chunkSize);
    const chunkZ = Math.floor(worldZ / this.chunkSize);
    const key = `${chunkX},${chunkZ}`;
    
    const chunk = this.chunks.get(key);
    if (chunk) {
      const localX = Math.floor(worldX - chunkX * this.chunkSize);
      const localY = Math.floor(worldY);
      const localZ = Math.floor(worldZ - chunkZ * this.chunkSize);
      
      chunk.world.setBlock(localX, localY, localZ, type);
      
      // 更新当前区块
      this.buildMesh(chunkX, chunkZ);

      // 如果修改了边界方块，触发相邻区块更新
      if (localX === 0) this.buildMesh(chunkX - 1, chunkZ);
      if (localX === this.chunkSize - 1) this.buildMesh(chunkX + 1, chunkZ);
      if (localZ === 0) this.buildMesh(chunkX, chunkZ - 1);
      if (localZ === this.chunkSize - 1) this.buildMesh(chunkX, chunkZ + 1);
    }
  }

  /**
   * 构造 18x256x18 的数据发送给 Worker
   */
  buildMesh(chunkX, chunkZ) {
    const key = `${chunkX},${chunkZ}`;
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    const pSize = this.chunkSize + 2;
    const paddedData = new Uint8Array(pSize * this.chunkHeight * pSize);

    // 填充数据：采样自身和 邻居
    for (let y = 0; y < this.chunkHeight; y++) {
      for (let pz = 0; pz < pSize; pz++) {
        for (let px = 0; px < pSize; px++) {
          const worldX = chunkX * this.chunkSize + (px - 1);
          const worldZ = chunkZ * this.chunkSize + (pz - 1);
          
          const voxel = this.getBlock(worldX, y, worldZ);
          const pIndex = y * pSize * pSize + pz * pSize + px;
          paddedData[pIndex] = voxel;
        }
      }
    }

    worker.postMessage({
      paddedData,
      chunkSize: this.chunkSize,
      chunkHeight: this.chunkHeight,
      chunkX,
      chunkZ
    }, [paddedData.buffer]);
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
          const newChunk = new Chunk(this.scene, chunkX, chunkZ, this.chunkSize, this.chunkHeight);
          this.chunks.set(key, newChunk);
          // 初始加载网格
          this.buildMesh(chunkX, chunkZ);
          
          // 同时触发邻居更新（因为新区块的出现可能让邻居的某些面需要剔除）
          this.buildMesh(chunkX - 1, chunkZ);
          this.buildMesh(chunkX + 1, chunkZ);
          this.buildMesh(chunkX, chunkZ - 1);
          this.buildMesh(chunkX, chunkZ + 1);
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