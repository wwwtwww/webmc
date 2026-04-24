# Minecraft Clone API 文档

本文档描述了项目核心组件的接口与协作机制。

## 1. WorldManager (世界管理器)
负责区块的生命周期管理、视距调度以及主线程与 Worker 间的通信。

- `update(playerPos: THREE.Vector3)`: 每一帧调用。根据玩家位置加载/卸载区块。
- `setBlock(worldX, worldY, worldZ, type)`: 修改方块。**即使区块未加载也会同步保存至数据库**。如果在地形生成完成前挖掘（type=0），会设为 **ID 255 (Forced Air)**。
- `getBlock(worldX, worldY, worldZ)`: 查询方块 ID。内部会自动将 255 映射回 0（空气）。
- `getHighestBlock(x, z)`: 返回该坐标下的最高地表方块高度。若列中无方块，返回 **`null`** 以区分 Y=0 状态。

## 2. SkyManager (天空管理器)
统一驱动场景的环境光影效果。

- `setTime(t: number)`: 设置世界时间（0.0 到 1.0）。自动计算并平滑插值场景背景、雾气颜色和太阳高度。
- `update()`: 内部渲染同步方法，更新光源位置与强度。

## 3. CommandParser (指令解析器)
处理控制台输入。

- `parse(input: string)`: 解析以 `/` 开头的指令。
    - `/time [0-24]`: 改变世界时间（支持 24 小时制及自动溢出环绕）。
    - `/give [id] [count]`: 向背包添加物品。
    - `/tp [x] [y] [z]`: 传送。

## 4. InventoryManager (背包管理器)
纯数据驱动的物品管理系统。

- `addItem(id, amount)`: 自动寻找同类槽位堆叠（上限 64），溢出后寻找空位。返回是否添加成功。
- `removeItem(index, amount)`: 扣除指定槽位的物品。
- `swapSlots(idx1, idx2)`: 交换两个槽位的数据。

## 5. CraftingManager (合成管理器)
配方匹配逻辑引擎。

- `checkRecipe(grid2x2)`: 输入 2x2 的二维数组。返回匹配成功的 `result` 对象 `{id, count}` 或 `null`。

## 6. Chunk (区块)
代表 16x256x16 的空间单元。

- `generated`: 布尔值。标记该区块是否已完成初始地形生成。
- `lastRequestId`: 存储本实例发出的最后一个异步请求 ID，用于校验 Worker 返回消息的时效性。

## 7. VoxelWorld (体素数据模型)
纯数据容器。方块 ID 采用 Uint8Array 存储。

- **特殊 ID**:
    - `0`: 空气。
    - `255`: 强制空气（玩家在生成前预挖的标记）。

## 8. chunkWorker.js (计算核心)
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

## 9. AudioManager (音效管理器)
基于 THREE.AudioListener 和 THREE.Audio 的音频多轨道池化管理系统。

- `loadSounds()`: 异步预加载所有必须的 `.ogg` 音效文件。
- `playSound(name, volume)`: 支持 LRU 轮转与动态音调偏移。
