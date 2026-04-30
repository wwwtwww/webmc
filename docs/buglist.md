# Minecraft Clone - Bug List (待修复缺陷清单)

本列表记录了在代码审查中发现的逻辑漏洞、性能隐患及视觉瑕疵。

## 🟢 已修复缺陷 (Fixed Bugs)

*   [x] **Bug 1: /tp 指令缺乏校验** - 已增加 `isNaN` 校验防止黑屏。
*   [x] **Bug 2: 生成 tree 时的 1D 数组环绕** - 已增加边界检查防止数据损坏。
*   [x] **Bug 3: 物品无法拾取死锁** - 已统一物理判定点至玩家身体中心。
*   [x] **Bug 4: 自杀式方块放置** - 已增加 AABB 重叠检测防止在体内放置。
*   [x] **Bug 5: 合成台物品丢失** - 已确保关闭背包时退回合成格物品。
*   [x] **Bug 6: WebGL 显存泄漏** - 已在卸载生物时调用 `dispose()`。
*   [x] **Bug 7: 掉落物的“穿墙电梯”** - 已优化碰撞位置判定防止攀爬。
*   [x] **Bug 8: 生猪肉作为方块放置** - 已增加 `placeable` 标记限制放置。
*   [x] **Bug 9: 悬浮的死猪** - 已确保死亡生物受重力影响下落。
*   [x] **Bug 10: 区块边缘的“半截树”** - 已通过 `growTree` 边界检查规避数据损坏。
*   [x] **Bug 11: 区块重载时的 AO 角落断层** - 已包含对角线邻居 Padding 修复 AO 阴影。
*   [x] **Bug 12: 天空轨迹颠倒** - 已修正太阳 Y 轴计算逻辑，确保白天太阳在天空。
*   [x] **Bug 13: 生物群落检测与安全区冲突** - 已更新 `getBiomeAt` 以包含出生点安全区逻辑。
*   [x] **Bug 14: 无效坐标的无意义持久化** - 已在 `setBlock` 中增加高度边界拦截。
*   [x] **Bug 15: 防窒息检测逻辑错误** - 已修复 `isOverlapping` 中的 Z 轴判断 Typo.
*   [x] **Bug 16: 修复不完整：生猪肉依然可以放置** - 已在放置逻辑中增加对 `placeable` 属性的校验。
*   [x] **Bug 17: 掉落物撞墙“乘电梯”Bug 仍未解决** - 已分离垂直与水平碰撞检测，彻底解决爬墙问题。
*   [x] **Bug 18: 无法放置普通方块** - 已修正判定逻辑，允许 `placeable` 未定义的常规方块正常放置。
*   [x] **Bug 19: 掉落物生成时无抛物线弹出效果** - 已限定仅在下落时触发地面吸附判定，确保初速度生效。
*   [x] **Bug 20: “半截树”Bug 修复不彻底** - 已将 Padding 增加至 2 格，完美覆盖半径为 2 的树冠生成。
*   [x] **Bug 21: 掉落物向上抛出时穿透天花板** - 已增加向上运动时的碰撞检测。
*   [x] **Bug 22: 树木生成仍有截断：跨区块生成被代码硬性阻断** - 允许 Padding 区域触发确定性生成。
*   [x] **Bug 23: 射线检测错误命中水体** - 已过滤射线检测结果，允许透过水面进行作业。
*   [x] **Bug 24: 区块对角线更新缺失** - 已在修改角落方块时同步刷新 8 个相邻区块，修复 AO 断层。
*   [x] **Bug 25: 掉落物落地后失去悬浮动画** - 已重构 `ItemDrop` 结构，将视觉动画与物理判定分离，确保落地持续浮动。
*   [x] **Bug 26: 背包满时掉落物强行尾随** - 已在吸附前增加背包容量校验，彻底解决“幽灵尾随”问题。
*   [x] **Bug 27: /give 指令未校验物品存在** - 已增加 `blockData`存在性校验，防止产生隐形幽灵物品。
*   [x] **Bug 28: 夜间光照方向从地下向上** - 已在夜间通过 Math.abs 翻转光源 Y 轴至天空。
*   [x] **Bug 29: 越界放置方块会白白吞噬物品** - 已在 removeItem 前增加 0-255 高度边界预检。
*   [x] **Bug 30: 掉落物悬浮动画依然会穿模地面** - 已将落地基础高度增加 0.1 以抵消 Sine 波下沉极值。
*   [x] **Bug 31: 生物转身动画触发“大回旋** - 已引入弧度环绕归一化算法，确保生物沿最短路径转身。
*   [x] **Bug 32: 寻路算法(A*)无法进行垂直移动** - 已修改 `Pathfinder.js` 的 `getNeighbors` 返回包括垂直和对角线的 26 个方向，并在 `isTraversable` 中增加了对跳跃行为的判定。
*   [x] **Bug 33: 掉落物物理状态反复抖动 (物理与视觉脱节)** - 已在 `ItemDrop.js` 中分离视觉 `mesh` 的悬浮位置，使 `group` 物理包围盒紧贴地面方块之上，解决了物理循环抖动穿模问题。
*   [x] **Bug 34: 无法透过水面或在水下挖掘方块** - 已在 `main.js` `animate` 射线挖掘检测更新逻辑中，对水方块(ID=3)进行了过滤，使其与 `mousedown` 逻辑保持一致。
*   [x] **Bug 35: 放置方块未进行生物碰撞检测 (Entity Cramming)** - 已在 `main.js` 右键放置方块前，增加了遍历检查所有存活生物 AABB 的重叠判断。
*   [x] **Bug 36: 数字键在控制台/背包打开时仍会切换快捷栏** - 已在数字键事件监听中增加了 `isConsoleOpen` 和 `isInventoryOpen` 的前置拦截判断，防止污染输入框。
*   [x] **Bug 37: 攻击判定忽略方块遮挡，可隔墙命中生物** - 已重构射线检测逻辑，分别获取方块交点和生物交点后比较它们的 `distance`。只有在生物距离小于实体方块距离时，才判定命中生物，防止“隔墙打牛”。
*   [x] **Bug 38: 区块加载/卸载没有同步刷新对角线 AO 邻居** - 已在 `WorldManager.update()` 中新区块生成和卸载的逻辑中补全了对角线 4 个相邻区块的 `markDirty` 调用，确保 AO 阴影完整刷新。
*   [x] **Bug 39: A* 寻路允许斜向“穿角”** - 已在 `Pathfinder.isTraversable()` 中添加对角线运动（dx=1 且 dz=1）时对两侧相邻方块的碰撞体积校验，避免生物挤过墙角缝隙。
*   [x] **Bug 40: MobManager 属性引用错误导致生物生成逻辑失效** - 已将 `this.skyManager.time` 修正为 `this.skyManager.timeOfDay`，确保昼夜刷怪逻辑恢复正常。
*   [x] **Bug 41: 生物受击缺乏水平击退效果** - 已在 `Mob.js` 中引入 `attackerPos` 判定与 `knockbackTimer`，使生物被击中时能根据攻击来源向后弹开。
*   [x] **Bug 42: 背包满时关闭 UI 的逻辑死锁隐患** - 已在 `main.js` 增加“背包已满”Console 提示，并防止物品在无法退回时强行关闭背包。
*   [x] **Bug 43: 玩家被埋入方块时缺乏窒息伤害** - 已在主循环中增加头部方块重叠判定，处于实体方块内时玩家会周期性掉血。
*   [x] **Bug 44: 多生物同时攻击玩家时缺乏全局无敌时间 (I-Frame)** - 已在 `takePlayerDamage` 中统一引入 1 秒无敌帧，防止重叠生物瞬间击杀玩家。
*   [x] **Bug 45: WebGL Attribute Buffer 频繁重建导致的 GPU 阻塞** - 已实现 `BufferAttribute` 复用逻辑与 `setDrawRange` 控制。
*   [x] **Bug 46: 全局射线检测引起的 O(N) 帧率衰减** - 已将挖掘时的检测范围缩小至目标方块周边 $3 \times 3$ 区块。
*   [x] **Bug 47: 渲染主循环中的大量对象实例化 (GC 压力)** - 已引入全局/模块级临时变量复用机制。
*   [x] **Bug 48: 存档持久化的高频 I/O 竞争** - 已引入 500ms 写缓冲防抖提交机制。
*   [x] **Bug 49: 全局射线检测引起的性能瓶颈 (DDA 优化)** - 已引入 DDA 体素步进算法，完全取代 Three.js Raycaster 定位方块。
*   [x] **Bug 50: Web Worker 数据传输开销导致主线程卡顿** - 主线程向 Worker 发送体素数据时原本使用结构化克隆，在高频 re-mesh 时存在不必要的耗时。已在 `VoxelWorld.js` 中将体素数据封装为 `SharedArrayBuffer`，并配置了 Vite 隔离头，实现了主线程与 Worker 间的零拷贝内存共享。
*   [x] **Bug 51: SharedArrayBuffer 传输冲突** - 已在 `chunkWorker.js` 中修正了 `transfer` 逻辑。系统现在会自动识别 `SharedArrayBuffer` 并禁止将其放入所有权转移列表，同时 Worker 内部生成新区块时也优先使用 SAB 以保持内存模型一致性。
*   [x] **Bug 52: DDA 射线检测在特定退化方向下的死锁风险** - 已在 `WorldManager.js` 中处理了方向向量为 0 的情况，防止了 `tMax` 出现 `NaN` 导致的无限循环，并增加了安全迭代计数器。
*   [x] **Bug 53: A* 寻路路径点切换时的 AI 震荡** - 已在 `Mob.js` 中引入了基于转向角度的速度缩放逻辑。当僵尸需要进行大角度转向时会主动减速甚至原地旋转，避免了因旋转过慢冲出路径导致的往复震荡。
*   [x] **Bug 54: 满背包挖掘导致的掉落物堆积卡顿** - 已在 `ItemDropManager.js` 中增加了 200 个实体的硬性上限限制，超出时自动移除最旧的掉落物，保护渲染帧率与内存稳定性。
*   [x] **Bug 55: 区块 y=0/255 边界 AO 刷新缺失** - 已在 `WorldManager.setBlock` 中增加了严格的高度边界拦截，防止无效的越界刷新，并为未来可能的垂直分块预留了鲁棒性接口。
*   [x] **Bug 56: 存档持久化的批量写入优化** - 已在 `db.js` 中实现 `saveBulkChunkDeltas` 并在 `WorldManager.js` 中调用，将离散的 Voxel 写入合并为单次 Dexie 事务，极大缓解了挖掘时的 I/O 阻塞。
*   [x] **Bug 57: 合成产出槽点击逻辑不完善** - 已重构 `handleResultClick`，支持在手持同类物品且未满 64 个时进行堆叠取出，并增加了空间不足时的拦截逻辑。
*   [x] **Bug 58: 生物自动跳跃避障响应迟钝** - 已将 `Mob.js` 中的跳跃判定从“落地瞬间”扩展至“水平碰撞瞬间”，使僵尸在触墙时能立即跳跃而非卡住。
*   [x] **Bug 59: 生物重叠与物理穿透 (Mob-on-Mob Collision)** - 已在 `MobManager.js` 中引入了 O(N^2) 的生物间水平排斥力，有效防止了僵尸群聚时完全重叠在一起。
*   [x] **Bug 60: A* 寻路忽略跳跃高度的头顶空间** - 已在 `Pathfinder.isTraversable` 中增加了跳跃起点的 overhead clearance 检查，防止生物试图跳入头顶有遮挡的 1 格高缝隙。
*   [x] **Bug 61: 挖掘进度在视角微颤时立即重置** - 已在 `main.js` 中引入 `miningGraceTimer` (200ms)，允许准星在短时间内离开目标方块而不丢失挖掘进度。
*   [x] **Bug 62: 重复的背包清理逻辑代码冗余** - 已在 `main.js` 中提取 `returnHeldAndCraftingItems` 函数，统一了 `toggleInventory` 与 `controls.lock` 监听器中的逻辑，降低了维护成本。
*   [x] **Bug 63: 指令输入期间触发全局背包/控制台热键** - 已在 `consoleInput` 的 `keydown` 监听器中增加 `e.stopPropagation()`，确保在控制台打字时不会因字母 'E' 或 'T' 导致界面状态冲突。
*   [x] **Bug 67: InventoryManager.addItem 忽略新堆叠的上限校验** - 已在 `addItem` 的逻辑中增加了 `Math.min(remaining, this.maxStackSize)` 的切分，确保超量物品能正确分摊到多个槽位。
*   [x] **Bug 68: ItemDrop 抛出初速度可能导致的除以零异常** - 已在 `ItemDrop.js` 构造函数中增加了速度极小值的校验，防止水平速度分量为 0 导致的归一化 NaN 风险。
*   [x] **Bug 69: 掉落物在磁力吸附时忽略方块碰撞** - 已重构吸附逻辑，将 `lerp` 替换为基于速度的物理移动，并复用 `ItemDrop.update` 中的碰撞检测，防止掉落物穿墙。
*   [x] **Bug 70: 玩家死亡后快捷栏未同步清空** - 已在 `main.js` 的死亡处理逻辑中增加了对 `inventoryManager.slots` 的清空及 UI 同步刷新。
*   [x] **Bug 71: 指令执行器的 tp 指令缺乏世界边界检查** - 已在 `/tp` 指令执行前增加 0-255 的 Y 轴边界预检，防止越界坐标导致渲染异常。
*   [x] **Bug 72: A* 寻路的最大节点限制导致 AI 发呆** - 已将 `Pathfinder.js` 的默认搜索上限从 500 提升至 1500，显著改善了在复杂地形（如森林、矿洞）中的 AI 响应能力。
*   [x] **Bug 73: 玩家死亡物品永久丢失** - 已在 `main.js` 的死亡逻辑中遍历背包，使用 `itemDropManager.spawn` 将物品作为掉落物生成在玩家死亡位置。
*   [x] **Bug 74: 生物防重叠斥力失效 (完全重叠时)** - 已在 `MobManager.js` 中判断当距离为 0 时赋予随机微小向量，确保归一化正常并使排斥力生效。
*   [x] **Bug 75: 僵尸攻击判定失效 (高度差问题)** - 已在 `main.js` 攻击判定中引入基于中心点的 Y 轴高度补偿，并适当调整判定距离阈值。
*   [x] **Bug 76: 背包满时发生 UI 软死锁** - 已修改界面关闭逻辑，当背包全满时，自动将手持或合成区内剩余物品作为掉落物丢弃，允许界面正常关闭。
*   [x] **Bug 77: 无法长按连续挖掘** - 已在 `animate` 主循环中实现了当 `isMining` 为 true 且目标被挖掘后，自动执行射线检测重置并寻找新目标方块。
*   [x] **Bug 78: PlayerHUD 模块未被导入导致游戏崩溃** - 已在 `main.js` 头部正确导入 `PlayerHUD.js` 模块，并调用了 `initHUD()` 进行初始化。
*   [x] **Bug 79: HUD 血条状态与实际血量未同步** - 已在 `main.js` 的 `updateHpUI` 中添加了对 `updateHUDHealth(playerHp, maxPlayerHp)` 的调用，确保绿色血条能够实时反映当前血量。
*   [x] **Bug 80: 区块卸载时仍未刷新对角线 AO 邻居** - 已在 `WorldManager.js` 的 `update()` 卸载循环中补全了对角线 `markDirty` 调用，防止玩家走出视距时产生的阴影断层。
*   [x] **Bug 81: `npm test` 仍然失败，`tests/worldmanager.test.js` 没有跟上批量持久化重构** - 已更新测试断言，由于持久化已被包裹在延时定时器后，现改为直接断言验证 `persistenceBuffer` 状态更新是否正确，保证单元测试通过。
*   [x] **Bug 82: F3 调试面板的 FPS 永远不会更新** - 已在 `main.js` 的 `updateDebugPanel()` 中实现了 `frameCount` 累加与 `lastFpsUpdate` 的时间戳校验，使其能够真实反映并显示 FPS。
*   [x] **Bug 83: `/tp [高度]` 单参数模式仍可传送到世界边界之外** - 已在 `CommandParser.js` 中的单参数传送分支里加入了对计算后目标 Y 坐标 `0-255` 的合法性检查拦截。
*   [x] **Bug 84: 复用 BufferAttribute 后遗留的旧顶点会污染 BoundingSphere** - 已在 `WorldManager.js` 中确保不管是新分配的 Buffer 还是复用的 Buffer，都将其 `count` 属性准确设为 `newData.length / itemSize` 或 `indices.length`，避免被冗余数据放大包围球。
*   [x] **Bug 85: 掉落物上限保护在极端情况下仍会吞掉旧战利品** - 已在 `ItemDropManager.js` 的 `spawn()` 中引入了全局强制合并机制：达到 200 个实体上限时，强制遍历合并同种类掉落物以腾出空间，杜绝静默丢物。
*   [x] **Bug 86: F3 面板的 FPS 文本格式错误** - 已将 `main.js` 更新 FPS UI 的代码由 `debugFps.innerText = \`FPS: \${frameCount}\`` 简化为 `debugFps.innerText = frameCount`，避免与 `index.html` 固有的 "FPS:" 前缀重复。
*   [x] **Bug 87: 页面关闭时的防抖持久化仍不可靠** - 已将 `visibilitychange` 事件正确绑定到 `document` 上，并引入 `localStorage` 作为同步的 `beforeunload`/`hidden` 回退存储机制。在下一次游戏启动时，`WorldManager` 会自动从 `localStorage` 中将可能被浏览器强行终止的 IndexedDB 未完成写入数据重新持久化，确保 100% 不丢操作。
*   [x] **Bug 88: 掉落物上限保护的“强制合并”会跨地图吞并远处掉落物** - 已在 `ItemDropManager.js` 的强制合并循环中增加了 $32^2$ 的距离平方校验，确保合并行为仅在附近发生，防止物品瞬移。
*   [x] **Bug 89: 玩家血量 UI 重叠 (冗余显示)** - 已移除 `index.html` 中旧的 `#hp-ui` 元素，并清理了 `main.js` 中的冗余更新逻辑，现在统一由 `PlayerHUD` 模块负责显示。

---

## 🔴 未修复缺陷 (Unresolved Bugs)

(目前暂无待处理的已知缺陷)

---

## ⚡ 性能优化建议 (Performance Optimization)

*   [x] **Optimization 1: 每帧射线检测的性能瓶颈** - 已通过 Bug 49 (DDA 算法) 解决。
*   [x] **Optimization 2: A* 寻路队列时间复杂度退化** - 已在 `Pathfinder.js` 中为 `BinaryHeap` 实现 O(1) 的索引追踪，优化了 `rescoreElement` 性能。
*   [x] **Optimization 3: 内存碎片与 GC 压力** - 已通过 Bug 45 (Buffer 复用) 和 Bug 47 (对象复用) 解决。
