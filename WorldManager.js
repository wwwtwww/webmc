import * as THREE from 'three';
import { VoxelWorld } from './VoxelWorld.js';
import { saveChunkDelta, getChunkDelta } from './db.js';

const worker = new Worker(new URL('./chunkWorker.js', import.meta.url), { type: 'module' });

export class Chunk {
  constructor(scene, chunkX, chunkZ, chunkSize = 16, chunkHeight = 256) {
    this.scene = scene;
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.chunkSize = chunkSize;
    this.chunkHeight = chunkHeight;
    this.generated = false; 
    this.lastRequestId = -1; // 记录本实例最后一次发出的请求 ID

    this.world = new VoxelWorld(this.chunkSize, this.chunkHeight);

    const opaqueGeometry = new THREE.BufferGeometry();
    const opaqueMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1 });
    this.opaqueMesh = new THREE.Mesh(opaqueGeometry, opaqueMaterial);
    this.opaqueMesh.position.set(this.chunkX * this.chunkSize, 0, this.chunkZ * this.chunkSize);
    this.scene.add(this.opaqueMesh);

    const transGeometry = new THREE.BufferGeometry();
    const transMaterial = new THREE.MeshStandardMaterial({ 
      vertexColors: true, roughness: 0.5, metalness: 0.1, transparent: true, opacity: 0.7, side: THREE.FrontSide, depthWrite: false
    });
    this.transparentMesh = new THREE.Mesh(transGeometry, transMaterial);
    this.transparentMesh.position.set(this.chunkX * this.chunkSize, 0, this.chunkZ * this.chunkSize);
    this.scene.add(this.transparentMesh);
  }

  applyGeometry(opaqueData, transparentData) {
    this._updateMeshGeometry(this.opaqueMesh, opaqueData);
    this._updateMeshGeometry(this.transparentMesh, transparentData);
  }

  _updateMeshGeometry(mesh, data) {
    const { positions, normals, uvs, colors, indices } = data;
    const geometry = mesh.geometry;
    if (geometry.index) geometry.setIndex(null);
    Object.keys(geometry.attributes).forEach(key => geometry.deleteAttribute(key));
    if (positions && positions.length > 0) {
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeBoundingSphere();
      mesh.visible = true;
    } else {
      mesh.visible = false;
    }
  }

  dispose() {
    [this.opaqueMesh, this.transparentMesh].forEach(mesh => {
      if (mesh) {
        if (this.scene) this.scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
      }
    });
    this.world = null;
  }
}

export class WorldManager {
  constructor(scene, renderDistance = 3, chunkSize = 16, chunkHeight = 256) {
    this.scene = scene;
    this.chunkSize = chunkSize;
    this.chunkHeight = chunkHeight;
    this.renderDistance = renderDistance;
    this.chunks = new Map();
    
    // 核心修复：单调递增全局 ID，取代 Per-Chunk Map，消除内存泄漏
    this.nextRequestId = 0; 

    this.dirtyChunks = new Set();

    worker.onmessage = (e) => {
      const { chunkX, chunkZ, version, opaque, transparent, voxels } = e.data;
      const key = `${chunkX},${chunkZ}`;
      const chunk = this.chunks.get(key);
      
      // 核心修复：只接受本实例发出的、最新的那次请求结果
      if (!chunk || version !== chunk.lastRequestId) return;

      if (voxels && !chunk.generated) {
        const data = chunk.world.data;
        for (let i = 0; i < voxels.length; i++) {
          if (data[i] === 0) data[i] = voxels[i];
        }
        chunk.generated = true;
        this.markDirty(chunkX - 1, chunkZ);
        this.markDirty(chunkX + 1, chunkZ);
        this.markDirty(chunkX, chunkZ - 1);
        this.markDirty(chunkX, chunkZ + 1);
      }
      chunk.applyGeometry(opaque, transparent);
    };
  }

  getBlock(worldX, worldY, worldZ) {
    const chunkX = Math.floor(worldX / this.chunkSize), chunkZ = Math.floor(worldZ / this.chunkSize);
    const chunk = this.chunks.get(`${chunkX},${chunkZ}`);
    if (!chunk) return 0;
    const val = chunk.world.getBlock(Math.floor(worldX - chunkX * this.chunkSize), Math.floor(worldY), Math.floor(worldZ - chunkZ * this.chunkSize));
    return val === 255 ? 0 : val;
  }
  setBlock(worldX, worldY, worldZ, type) {
    const chunkX = Math.floor(worldX / this.chunkSize), chunkZ = Math.floor(worldZ / this.chunkSize);
    const key = `${chunkX},${chunkZ}`;
    const chunk = this.chunks.get(key);
    
    const lx = Math.floor(worldX - chunkX * this.chunkSize);
    const ly = Math.floor(worldY);
    const lz = Math.floor(worldZ - chunkZ * this.chunkSize);

    // 确定最终存储的 ID。如果是在尚未生成的区域挖掘（type=0），使用 ID 255 (Forced Air)
    // 即使 chunk 实例不存在，我们也根据其是否在 this.chunks 中以及 generated 状态判定
    const isGenerated = chunk ? chunk.generated : false; 
    const finalType = (type === 0 && !isGenerated) ? 255 : type;

    if (chunk) {
      chunk.world.setBlock(lx, ly, lz, finalType);

      this.markDirty(chunkX, chunkZ);
      if (lx === 0) this.markDirty(chunkX - 1, chunkZ);
      if (lx === this.chunkSize - 1) this.markDirty(chunkX + 1, chunkZ);
      if (lz === 0) this.markDirty(chunkX, chunkZ - 1);
      if (lz === this.chunkSize - 1) this.markDirty(chunkX, chunkZ + 1);
    }

    // 始终异步持久化增量修改，确保非内存区块也能保存。使用 finalType 确保 Forced Air 标记不丢失。
    saveChunkDelta(key, lx, ly, lz, finalType).catch(err => console.error("Save failed:", err));
    }
  markDirty(chunkX, chunkZ) { this.dirtyChunks.add(`${chunkX},${chunkZ}`); }

  getHighestBlock(worldX, worldZ) {
    const chunkX = Math.floor(worldX / this.chunkSize);
    const chunkZ = Math.floor(worldZ / this.chunkSize);
    const chunk = this.chunks.get(`${chunkX},${chunkZ}`);
    if (!chunk || !chunk.generated) return null;

    const lx = Math.floor(worldX - chunkX * this.chunkSize);
    const lz = Math.floor(worldZ - chunkZ * this.chunkSize);

    // 从天际向下查找第一个非空、非水方块
    for (let y = this.chunkHeight - 1; y >= 0; y--) {
      const voxel = chunk.world.getBlock(lx, y, lz);
      if (voxel !== 0 && voxel !== 3 && voxel !== 255) {
        return y;
      }
    }
    return null;
  }

  async _buildMesh(chunkX, chunkZ) {
    const key = `${chunkX},${chunkZ}`, chunk = this.chunks.get(key);
    if (!chunk) return;

    const rid = ++this.nextRequestId;
    chunk.lastRequestId = rid;

    let deltas = null;
    if (!chunk.generated) {
      try {
        deltas = await getChunkDelta(key);
        if (chunk.lastRequestId !== rid) return;
      } catch (err) {
        console.error("加载存档失败:", err);
      }
    }

    // 收集中心区块及其 4 个邻居的体素数据 (网格化只需要 X/Z 邻居，Y 轴由 256 高度覆盖)
    // 准备 5 个 Uint8Array: Center, Left, Right, Back, Front
    const getVoxels = (x, z) => {
      const c = this.chunks.get(`${x},${z}`);
      return c ? c.world.data : null;
    };

    const center = chunk.world.data;
    const neighborL = getVoxels(chunkX - 1, chunkZ);
    const neighborR = getVoxels(chunkX + 1, chunkZ);
    const neighborB = getVoxels(chunkX, chunkZ - 1);
    const neighborF = getVoxels(chunkX, chunkZ + 1);

    // 核心修复：移除 transfer 数组！
    // 不再转移 buffer 所有权，改用结构化克隆复制数据 (320KB 拷贝耗时极低)，
    // 确保主线程的 chunk.world.data 不会变为 Detached 状态。
    worker.postMessage({ 
      chunkSize: this.chunkSize, chunkHeight: this.chunkHeight, 
      chunkX, chunkZ, version: rid, needsGeneration: !chunk.generated,
      deltas,
      voxels: {
        center,
        neighborL, neighborR, neighborB, neighborF
      }
    });
  }

  update(playerPos) {
    const currentX = Math.floor(playerPos.x / this.chunkSize), currentZ = Math.floor(playerPos.z / this.chunkSize);
    if (this.lastChunkX !== currentX || this.lastChunkZ !== currentZ) {
      this.lastChunkX = currentX; this.lastChunkZ = currentZ;
      const expected = new Set();
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
        for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
          const cx = currentX + dx, cz = currentZ + dz, key = `${cx},${cz}`;
          expected.add(key);
          if (!this.chunks.has(key)) {
            this.chunks.set(key, new Chunk(this.scene, cx, cz, this.chunkSize, this.chunkHeight));
            this.markDirty(cx, cz);
            this.markDirty(cx - 1, cz); this.markDirty(cx + 1, cz);
            this.markDirty(cx, cz - 1); this.markDirty(cx, cz + 1);
          }
        }
      }
      for (const [key, chunk] of this.chunks.entries()) {
        if (!expected.has(key)) {
          const [cx, cz] = key.split(',').map(Number);
          this.markDirty(cx - 1, cz); this.markDirty(cx + 1, cz);
          this.markDirty(cx, cz - 1); this.markDirty(cx, cz + 1);
          chunk.dispose();
          this.chunks.delete(key);
          this.dirtyChunks.delete(key);
        }
      }
    }
    if (this.dirtyChunks.size > 0) {
      let count = 0;
      for (const key of this.dirtyChunks) {
        const [cx, cz] = key.split(',').map(Number);
        this._buildMesh(cx, cz);
        this.dirtyChunks.delete(key);
        if (++count >= 2) break;
      }
    }
  }
}