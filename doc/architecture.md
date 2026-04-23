# 架构设计 (Architecture)

## 1. 技术栈
* **核心环境**：Node.js
* **构建工具**：Vite
* **3D 渲染引擎**：Three.js
* **数据存储**：Dexie.js (IndexedDB 封装)，用于实现世界状态持久化。

## 2. 数据结构设计
* **Chunk (区块)**：核心单元为 16 x 256 x 16 的体素阵列。
* **存储策略**：
    * **主内存**：使用 `Uint8Array` 存储方块 ID。
    * **持久化**：采用 **Delta (增量) 存储模式**。仅记录玩家对世界进行的 `setBlock` 操作，数据库存储格式为 `{ chunkKey: "x,z", deltas: { "x_y_z": blockID } }`。
    * **离线写入**：`WorldManager` 能够直接向非活跃（未加载）区块发送 Delta 保存请求，实现全域一致性存储。

## 3. 异步并发管线
1. **渲染更新**：主线程根据视距调度区块加载。
2. **地形合并**：Worker 在地形生成算法产出的数据基础上，自动合并来自 Dexie 的历史修改 Deltas。
3. **网格化 (Meshing)**：Worker 执行基础表面剔除 (Naive Surface Culling)、AO 顶点计算。
4. **校验机制**：使用全局单调递增的 `version` ID，主线程仅接受版本号匹配的数据，彻底消除异步闪烁。

## 4. 关键子系统架构
* **天空与环境系统 (SkyManager)**：
  - **解耦驱动**：场景的 `background`、`fog` 以及 `DirectionalLight` 的颜色和位置均由 `SkyManager` 统一管理。
  - **光影映射**：提供 `setTime(0.0 ~ 1.0)` 接口，将抽象时间映射为具体的视觉氛围（黎明、正午、黄昏、深夜）。
* **开发者控制台 (CommandParser)**：
  - **指令路由**：通过简单的字符串解析支持快捷调试，可直接操作 `SkyManager`、`InventoryManager` 和 `Camera`。
* **背包与合成系统**：
  - **InventoryManager**：纯数据驱动的 36 槽位容器。负责处理物品堆叠、交换与拿起/放下逻辑。
  - **InventoryUI**：基于 CSS Grid 的 UI 层，通过 `onSlotClick` 钩子与主逻辑接线。
* **交互系统**：
  - **状态机挖掘**：基于 `requestAnimationFrame` 实现逐帧准星对齐检测。增加 5 格最大触及距离限制。
  - **指针接管逻辑**：引入 `isOpeningInventory` 与 `isOpeningConsole` 标记位，解决 Pointer Lock `unlock` 事件导致的 UI 显隐逻辑死循环。
* **物理引擎 (Physics Engine)**：
  - **混合模式**：支持 Noclip 飞行与基于 AABB 的地表碰撞。
  - **重力状态机**：通过 `isReady` 标志位确保只有在玩家脚下地形加载完成后才启用重力。
* **世界生成 (World Generation)**：
  - **3D Simplex Noise**：支持悬崖、洞穴与复杂的垂直结构。
  - **确定性哈希**：引入固定种子的 `alea` 随机数发生器，确保世界生成的稳定性。
  - **Smoothstep 平滑出生区**：在原点周围 30 格强制生成平原，并通过 S 曲线算法实现自然过渡。
