# Minecraft Clone API 文档

本文档描述了项目核心组件的接口与协作机制。

## 1. WorldManager (世界管理器)
负责区块的生命周期管理、视距调度以及主线程与 Worker 间的通信。

- `update(playerPos: THREE.Vector3)`: 每一帧调用。根据玩家位置加载/卸载区块。
- `setBlock(worldX, worldY, worldZ, type)`: 修改方块。
- `getBlock(worldX, worldY, worldZ)`: 查询方块 ID。
- `getHighestBlock(x, z)`: 返回该坐标下的最高地表方块高度。

## 2. MobManager (生物管理器)
负责生物的生命周期管理，包括生成、回收、碰撞排斥以及环境光照检测。

- `spawn(type, position)`: 在指定位置生成指定类型的生物（如 `zombie`, `pig`）。
- `update(delta, playerPos)`: 更新所有生物。包含基于距离的自动回收（超过 64 格）和生物间的水平排斥逻辑。
- `despawn(id)`: 手动卸载生物并清理显存。
- `clearAll()`: 清除场景中所有生物。

## 3. Mob (生物基类)
定义了生物的视觉表现、属性、AI 状态机以及物理碰撞。

- **AI 状态 (FSM)**:
  - `idle`: 随机原地等待。
  - `walking`: 随机游荡。
  - `chasing`: 追踪玩家（仅限僵尸）。
- **受击与死亡**:
  - `takeDamage(amount, attackerPos)`: 处理血量扣减、瞬间闪红反馈、击退效果及死亡判定。当玩家手持 **木剑** 攻击时，基础伤害由 2 提升至 4。
  - `die()`: 触发死亡动画（侧翻 90 度）及掉落物钩子，1 秒后移除。
- **物理与导航**:
  - 集成 `Pathfinder` (A*) 实现复杂地形下的寻路。
  - 具备自动跳跃避障能力。

## 4. SkyManager (天空管理器)
统一驱动场景的环境光影效果。

- `setTime(t: number)`: 设置世界时间（0.0 到 24.0）。
- `update(delta)`: 驱动自动昼夜流逝。

## 5. CommandParser (指令解析器)
处理控制台输入。

- `parse(input: string)`: 解析以 `/` 开头的指令。
- **支持的指令**:
  - `/time [0.0-24.0]`: 设置世界时间（如 12.0 为中午，18.0 为黄昏）。
  - `/give [id] [amount]`: 给予玩家指定 ID 和数量的物品。
  - `/tp [height]` 或 `/tp [x] [y] [z]`: 传送玩家。
  - `/spawn [type]`: 在玩家前方生成生物（支持 `zombie`, `pig`）。
  - `/clear-mobs`: 清理当前世界中的所有生物。

## 6. InventoryManager (背包管理器)
纯数据驱动的物品管理系统。

- `addItem(id, amount)`: 自动寻找同类槽位堆叠（上限 64），溢出后寻找空位。
- `canAddItem(id)`: 检查背包是否还有空间容纳指定物品。

## 7. CraftingManager (合成管理器)
配方匹配逻辑引擎。

- `checkRecipe(grid)`: 输入 2x2 或 3x3 的二维数组。自动执行“去空白”标准化后返回匹配成功的 `result` 对象。

## 8. InventoryUI (界面管理器)
- `setWorkbenchMode(isWorkbench)`: 动态切换 UI 布局，切换 2x2 或 3x3 合成格。
- `updateCrafting()`: 将当前的合成位数组格式化为 2D 矩阵并交由 `CraftingManager` 校验。

## 9. PlayerHUD (玩家状态栏)
- `initHUD()`: 动态生成左上角 UI，包括玩家名称和血条背景。
- `updateHUDHealth(hp, maxHp)`: 根据当前血量更新血条宽度。当血量低于 25% 时，血条会自动变红以示预警。

## 10. ItemDropManager (掉落物管理器)
负责掉落物的生命周期、物理更新与吸附逻辑。

- `spawn(x, y, z, itemId, amount)`: 在指定坐标生成掉落物。
- **性能优化机制**: 
  - 实体上限 200 个。
  - **强制合并**: 当达到上限或物品过于密集时，会自动合并 32 格内的同类掉落物。
- `update(delta, playerPos)`: 更新所有掉落物的旋转、悬浮动画、物理下落以及向玩家的磁力吸附。

## 11. ItemDrop (掉落物实体)
代表场景中的一个微缩方块掉落物。

- `update(delta, worldManager, playerPos)`: 处理自身的匀速旋转、简谐浮动以及带有碰撞检测的物理移动。支持磁力飞向玩家。

## 12. Chunk (区块)
代表 16x256x16 的空间单元。

## 13. VoxelWorld (体素数据模型)
纯数据容器。方块 ID 采用 Uint8Array 存储，支持 SharedArrayBuffer。

## 14. chunkWorker.js (计算核心)
运行在独立线程中的地形生成与网格化引擎。

## 15. AudioManager (音效管理器)
基于 THREE.AudioListener 和 THREE.Audio 的音频管理系统。

## 16. Pathfinder (寻路引擎)
基于 A* 算法的路径搜索工具。

- `findPath(start, goal, worldManager)`: 计算从起点到终点的最短可行路径。考虑了两格高度间隙、对角线穿角检测及跳跃避障。
