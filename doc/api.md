# 技术参考与核心 API (Tech Reference)

## 1. WorldManager 模块 (世界入口)
* **职责**：调度无限区块的加载、卸载，并提供跨区块的统一方块读写。
* **核心方法**：
    * `getBlock(worldX, worldY, worldZ)`：获取世界坐标下的方块 ID。
    * `setBlock(worldX, worldY, worldZ, id)`：修改方块并自动触发当前及相邻区块的网格更新。
    * `update(playerPos)`：根据玩家位置动态管理区块的生命周期。

## 2. Chunk 模块 (区块单元)
* **职责**：管理 16x256x16 区域的原始数据。
* **属性**：
    * `world`：内部 `VoxelWorld` 实例。
    * `mesh`：Three.js Mesh 对象。
* **核心方法**：
    * `buildMesh()`：构造包含邻居数据的 18x256x18 扩展包，发送至 Worker 进行异步网格计算。
    * `dispose()`：严谨释放 GPU 几何体、材质以及 CPU 端的 TypedArray。

## 3. 植被系统 (Vegetation)
* **`generateTree(world, x, y, z)`**
    * **树干**：向上生成 5 个 `WOOD` 方块。
    * **树冠**：在顶部生成 3x3x3 的 `LEAF` 立方体。
    * **安全机制**：具备高度越界检查（支持 256 高度）和空气替换检测。

## 4. 渲染优化 (Rendering)
* **Worker 并行化**：网格生成逻辑全量迁移至 `chunkWorker.js`。
* **面剔除 (Culling)**：支持跨区块剔面，接触面不会重复生成顶点。
* **顶点颜色**：基于世界坐标计算 10% 明暗差，实现零开销棋盘格效果。