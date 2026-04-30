# 🌍 WebMC: High-Performance Voxel Engine

[![Vite](https://img.shields.io/badge/bundler-Vite-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/render-Three.js-black?style=flat-square&logo=three.js)](https://threejs.org/)
[![Vitest](https://img.shields.io/badge/test-Vitest-6E9F18?style=flat-square&logo=vitest)](https://vitest.dev/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

**WebMC** 是一款基于 **Three.js** 开发的、专注于极致 Web 端体验的类 Minecraft 体素引擎。它利用现代浏览器的前沿技术（Web Workers, Structured Clone, IndexedDB），在确保 60FPS 流畅度的同时，提供了一个无限生成的、具备完整物理与交互逻辑的 3D 体素世界。

---

## 🔗 Live Demo

您可以直接在浏览器中体验本项目：**[https://webmc-eqc.pages.dev/](https://webmc-eqc.pages.dev/)**

---

## ✨ 核心功能亮点

*   **⚡ 多线程 Chunk 生成系统**：地形生成与网格化逻辑完全移交给 **Web Worker** 线程。主线程通过消息传递进行零阻塞通信，彻底消除了地形加载时的画面卡顿。
*   **🌅 动态环境系统**：具备实时的昼夜交替流逝逻辑。天空盒颜色、光照强度与雾效会随游戏时间自然平滑过渡。
*   **🧟 智能生物 AI 系统**：
    *   基于有限状态机（FSM）的漫游与追踪逻辑。
    *   **A* 寻路算法**：支持僵尸避障、跳跃和跨越复杂地形的 3D 空间寻路。
    *   完整的 AABB 碰撞检测、重力感应、受击伤害反馈以及死亡掉落逻辑。
*   **🧲 掉落物与背包系统**：
    *   **磁力吸附**：掉落物品会自动感知玩家位置并加速飞向玩家。
    *   **原子化入包**：严密的背包数据管理，支持 2x2 合成预览、快捷栏同步以及持久化存储。
*   **🏗️ 高级地形算法**：基于 **3D Simplex Noise** 算法，支持草地、沙漠、雪山等多种生物群落的平滑过渡，并具备程序化植被（树木）生成。

---

## 🎮 操作指南

| 按键 | 功能描述 |
| :--- | :--- |
| **W / A / S / D** | 角色移动 |
| **鼠标控制** | 旋转视角 |
| **鼠标左键 (长按)** | 挖掘方块 / 攻击生物 |
| **鼠标右键** | 放置方块 |
| **E / Tab** | 打开/关闭 背包界面 |
| **T / `** | 呼出 开发者控制台 |
| **F** | 切换 飞行模式 (God Mode) |
| **1 - 8** | 快捷栏槽位切换 |
| **F3** | 切换 调试信息面板 |

---

## 💻 开发者控制台 (Console)

游戏内置了轻量级的开发者指令系统，便于调试与场景控制。在游戏中按下 **`T`** 或 **波浪号 (`)** 键即可唤出控制台输入框。

**支持的指令列表：**

*   `/time [0.0 - 24.0]`
    *   **说明**：设置世界的当前时间，立即改变天空与光照（如：`/time 12` 设为正午，`/time 0` 设为午夜）。
*   `/give [方块ID] [数量]`
    *   **说明**：给予玩家指定数量的物品（如：`/give 4 64` 给予 64 个木头，`/give 11 1` 给予 1 个工作台）。
*   `/tp [x] [y] [z]` 或 `/tp [高度位移]`
    *   **说明**：将玩家传送到指定坐标，或在当前位置向上位移指定的格数（如：`/tp 10` 向上传送 10 格防止卡入地下）。
*   `/spawn [生物类型]`
    *   **说明**：在玩家前方生成指定的生物（目前支持 `zombie` 和 `pig`）。
*   `/clear-mobs`
    *   **说明**：强制清除当前世界中生成的所有生物实例。

---

## 🚀 安装与部署

确保你的环境中已安装 [Node.js](https://nodejs.org/)。

1.  **克隆仓库**
    ```bash
    git clone https://github.com/wwwtwww/webmc.git
    cd webmc
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **启动开发服务器**
    ```bash
    npm run dev
    ```
    访问 `http://localhost:5173` 即可开始探索。

4.  **运行单元测试**
    ```bash
    npm run test
    ```

---

## 🛠️ 技术栈

*   **渲染层**: [Three.js](https://threejs.org/) (使用 BufferGeometry 优化显存)
*   **构建层**: [Vite](https://vitejs.dev/) (高性能 ESM 构建)
*   **并行计算**: Web Workers (用于异步地形生成)
*   **数据持久化**: Dexie.js (基于 IndexedDB 存储玩家修改的世界数据)
*   **测试框架**: Vitest (驱动核心逻辑的稳定性)

---

## 🗺️ 开发路线图 (Roadmap)

- [x] 基础地形生成与 AABB 物理碰撞
- [x] 掉落物系统与磁力吸附
- [x] Web Worker 网格化加速
- [x] **敌对生物与寻路**：加入敌对生物（如僵尸）与具备三维移动能力的复杂路径搜索（A*）
- [x] **性能优化重构**：优化每帧射线检测 (DDA)、A* 队列时间复杂度以及内存 GC 碎片
- [x] **UI 与交互**：完整的 HUD 血条、工作台合成以及开发者指令系统
- [ ] **Greedy Meshing**：重构网格化算法，减少 60% 以上的顶点数量
- [ ] **LOD (Level of Detail)**：进一步优化远景渲染，支持 16+ 区块视距
- [ ] **联机功能**：基于 WebSockets / WebRTC 的多人协作模式

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源。欢迎所有开发者参与贡献与讨论！

---
⭐ *如果你喜欢这个项目，请给它一个 Star！这对我来说是最大的鼓励！*