# 避坑指南与 Debug 日志 (Troubleshooting)

## 1. 渲染：基础世界不加载 (Invisible World)
*   **症状**：进入游戏只看到纯色背景或黑屏，按 ESC 退出后能看到相机在空中，但地面为空白。
*   **原因**：`WorldManager.update()` 被错误地包裹在 `if (controls.isLocked)` 判断内。由于世界未加载，`findSafeSpawn` 永远找不到地面，玩家一直处于 `hasSpawned = false` 的挂起状态，不触发初始加载。
*   **修复**：将世界更新逻辑移出锁定判断。即使在锁定前，也允许区块异步加载与渲染。

## 2. 交互：控制台按键冲突
*   **症状**：按 T 键打开控制台后，输入字符会触发游戏的快捷栏切换 (1-8)，或者按下 E 键无法关闭控制台反而打开了背包。
*   **修复**：
    1.  在全局 `keydown` 监听器中增加 `if (isConsoleOpen) return;` 阻断非控制台逻辑。
    2.  引入 `isOpeningConsole` 标记位，确保 Pointer Lock 的 `unlock` 事件能正确路由到“开启控制台 UI”而非“显示主菜单”。

## 3. 架构：初始化 ReferenceError (TDZ)
*   **症状**：页面加载后控制台报错 `ReferenceError: Cannot access 'blockData' before initialization`。
*   **原因**：ES 模块中变量声明顺序问题。在 `blockData` 被定义前就尝试执行 `new InventoryUI(blockData)`。
*   **修复**：提升静态配置数据（如 `blockData`）至文件最顶部，确保所有类实例化时依赖已就位。

## 4. 渲染：贪婪网格化 (Greedy Meshing) 几何爆炸
*   **症状**：屏幕出现跨越空间的黑色拉伸三角形。
*   **修复**：当前已回滚至稳定版。总结教训：必须严格校验法线与 UV 数组的对齐长度。

## 5. 物理：出生点判定歧义
*   **原因**：`getHighestBlock` 在没找到地表时返回 0，与真实高度 0 产生冲突。
*   **修复**：将“未找到”状态显式修改为返回 **`null`**。

## 6. 交互：背包满载丢物品
*   **修复**：
    1. 挖掘前校验 `addItem`。若失败则拦截破坏流程。
    2. 关闭背包时校验 `addItem`。若失败则通过 `controls.unlock()` 强制拦截 UI 关闭，防止手持物品直接消失。

## 7. 存储：持久化失效与 Forced Air 丢失
*   **症状**：修改了视距外的方块没有保存；或者在地形生成前挖掉的方块重载后又恢复了。
*   **修复**：
    1.  **全域持久化**：重构 `WorldManager.setBlock`，将 `saveChunkDelta` 移出 `if (chunk)` 判断，确保非内存区块修改也能写入 IndexedDB。
    2.  **强制空气持久化**：在持久化时使用计算后的 `finalType`（包含 ID 255），确保“预挖”标记能够跨会话生效。

## 8. 世界生成：地形非确定性漂移
*   **原因**：`simplex-noise` 未固定种子。
*   **修复**：引入 `alea` 确定性随机生成器并同步给主线程与 Worker。

## 9. 交互：无限手长
*   **修复**：在射线检测中增加 `if (intersect.distance > MAX_REACH) return;` 限制（默认 5 格）。
