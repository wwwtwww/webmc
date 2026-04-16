# Minecraft Clone API 文档

本文档描述了项目核心组件的接口与协作机制。

## 1. WorldManager (世界管理器)
负责区块的生命周期管理、视距调度以及主线程与 Worker 间的通信。

- `update(playerPos: THREE.Vector3)`: 每一帧调用。根据玩家位置加载/卸载区块，并处理脏区块的重建。卸载时会触发邻居区块重绘以修复边界。
- `setBlock(worldX, worldY, worldZ, type)`: 修改方块。如果在地形生成完成前挖掘（type=0），会设为 **ID 255 (Forced Air)** 以防止被生成算法覆盖。
- `getBlock(worldX, worldY, worldZ)`: 查询方块 ID。内部会自动将 255 映射回 0（空气）。

## 2. Chunk (区块)
代表 16x256x16 的空间单元。

- `generated`: 布尔值。标记该区块是否已完成初始地形生成。
- `lastRequestId`: 存储本实例发出的最后一个异步请求 ID，用于校验 Worker 返回消息的时效性。

## 3. VoxelWorld (体素数据模型)
纯数据容器。方块 ID 采用 Uint8Array 存储。

- **特殊 ID**:
    - `0`: 空气。
    - `255`: 强制空气（玩家在生成前预挖的标记）。

## 4. chunkWorker.js (计算核心)
运行在独立线程中的地形生成与网格化引擎。支持 3D 噪声采样与三线性插值。

### 输入消息格式:
```javascript
{
  paddedData: Uint8Array, // 18x256x18 环境数据
  chunkSize: 16, chunkHeight: 256,
  chunkX, chunkZ,
  version: Number,        // 全局请求请求 ID
  needsGeneration: Boolean 
}
```

### 输出消息格式:
```javascript
{
  opaque: { positions, normals, uvs, colors, indices },
  transparent: { ... },
  voxels: Uint8Array | null, 
  chunkX, chunkZ, version
}
```

## 5. 协作流程
1. **生成与合并**: 当 `needsGeneration` 为 true 时，Worker 生成地形数据。
2. **非零保护合并**: 主线程接收到 `voxels` 后，遍历数据：仅当 `chunk.world.data[i] === 0` 时才写入。如果该位置已是玩家修改的值（含 255），则保持现状。
3. **时效校验**: 只有当返回消息的 `version === chunk.lastRequestId` 时，几何体才会被应用。这彻底解决了旧区块卸载后的消息冲突。
