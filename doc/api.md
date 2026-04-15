# 技术参考与核心 API (Tech Reference)

## 1. Chunk 模块
* **职责**：管理单一 16x256x16 区域的数据和网格。
* **核心方法**：
    * `setBlock(x, y, z, id)`：安全设置局部坐标的方块数据。
    * `getBlock(x, y, z)`：获取局部坐标的方块 ID，需包含越界保护。
    * `buildMesh()`：执行面剔除算法，生成并返回可渲染的 Three.js Mesh 对象。

## 2. 植被系统 (Vegetation)
* **`generateTree(world, x, y, z)`**
    * **树干**：以指定坐标为原点，向上生成连续 5 个 `WOOD` (木头) 方块。
    * **树叶**：在树干顶部区域（如 y+3 到 y+5），生成一个 3x3x3 的 `LEAF` (树叶) 立方体网络。
    * **安全机制**：放置前必须检查目标坐标是否为 `AIR`，避免覆盖已生成的地形。

## 3. 物理与碰撞 (Physics & Collision)
* **AABB 碰撞**：将玩家抽象为一个高 1.8、宽 0.6 的包围盒。
* **重力循环**：`requestAnimationFrame` 中不断累加向下的 `velocity.y`。
* **触地逻辑**：向下射线/AABB 检测到非空方块时，强制修正 `position.y` 吸附到方块表面，并且**必须将 `velocity.y` 设为 0**，触发 `isGrounded = true`。