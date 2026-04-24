# Minecraft Clone API 文档

本文档描述了项目核心组件的接口与协作机制。

## 1. WorldManager (世界管理器)
负责区块的生命周期管理、视距调度以及主线程与 Worker 间的通信。

- `update(playerPos: THREE.Vector3)`: 每一帧调用。根据玩家位置加载/卸载区块。
- `setBlock(worldX, worldY, worldZ, type)`: 修改方块。
- `getBlock(worldX, worldY, worldZ)`: 查询方块 ID。
- `getHighestBlock(x, z)`: 返回该坐标下的最高地表方块高度。

## 2. MobManager (生物管理器)
负责生物的生命周期管理。

- `spawn(type, position)`: 在指定位置生成指定类型的生物。
- `update(delta, playerPos)`: 更新所有生物的 AI、物理并根据距离自动回收。
- `despawn(id)`: 手动卸载生物。

## 3. SkyManager (天空管理器)
统一驱动场景的环境光影效果。

- `setTime(t: number)`: 设置世界时间（0.0 到 24.0）。
- `update(delta)`: 驱动自动昼夜流逝。

## 4. CommandParser (指令解析器)
处理控制台输入。

- `parse(input: string)`: 解析以 `/` 开头的指令。

## 5. InventoryManager (背包管理器)
纯数据驱动的物品管理系统。

- `addItem(id, amount)`: 自动寻找同类槽位堆叠（上限 64），溢出后寻找空位。

## 6. CraftingManager (合成管理器)
配方匹配逻辑引擎。

- `checkRecipe(grid2x2)`: 输入 2x2 的二维数组。返回匹配成功的 `result` 对象。

## 7. Chunk (区块)
代表 16x256x16 的空间单元。

## 8. VoxelWorld (体素数据模型)
纯数据容器。方块 ID 采用 Uint8Array 存储。

## 9. chunkWorker.js (计算核心)
运行在独立线程中的地形生成与网格化引擎。

## 10. AudioManager (音效管理器)
基于 THREE.AudioListener 和 THREE.Audio 的音频管理系统。

## 11. ItemDropManager (掉落物管理器)
负责掉落物的生命周期、物理更新与吸附逻辑。

- `spawn(x, y, z, itemId, amount)`: 在指定坐标生成掉落物。
- `update(delta, playerPos)`: 更新所有掉落物的旋转、悬浮动画、物理下落以及向玩家的磁力吸附。

## 12. ItemDrop (掉落物实体)
代表场景中的一个微缩方块掉落物。

- `update(delta, worldManager)`: 处理自身的匀速旋转、简谐浮动以及与地面的基础碰撞。
