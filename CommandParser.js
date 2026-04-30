import * as THREE from 'three';

/**
 * CommandParser.js
 * 解析并执行开发者控制台指令
 */
export class CommandParser {
  constructor(context) {
    /**
     * context 应该包含：
     * - inventoryManager
     * - skyManager
     * - camera (用于 tp)
     * - onUpdateUI (通知主线程刷新 UI)
     */
    this.ctx = context;
  }

  /**
   * 解析指令
   * @param {string} input 
   * @returns {string} 指令反馈
   */
  parse(input) {
    if (!input.startsWith('/')) {
      return '指令必须以 / 开头';
    }

    const parts = input.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case '/time':
        return this.handleTime(args);
      case '/give':
        return this.handleGive(args);
      case '/tp':
        return this.handleTeleport(args);
      case '/clear-mobs':
        return this.handleClearMobs();
      case '/spawn':
        return this.handleSpawnMob(args);
      default:
        return `未知指令: ${command}`;
    }
  }

  handleSpawnMob(args) {
    if (!this.ctx.mobManager) return '错误: 生物管理器未就绪';
    
    const type = args[0] ? args[0].toLowerCase() : 'zombie';
    if (type !== 'zombie' && type !== 'pig') {
      return `错误: 未知生物类型 '${type}'。可选: zombie, pig`;
    }

    const pos = this.ctx.camera.position.clone();
    
    // 在玩家视线前方 3 格处生成
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.ctx.camera.quaternion);
    pos.add(dir.multiplyScalar(3));
    
    // 尽量生成在地面上，防止卡墙里
    const sy = this.ctx.mobManager.worldManager.getHighestBlock(pos.x, pos.z);
    if (sy !== null) {
      pos.y = sy + 1;
    }
    
    this.ctx.mobManager.spawn(type, pos);
    
    return `已在前方生成 1 只 ${type === 'zombie' ? '僵尸' : '猪'}`;
  }

  handleClearMobs() {
    if (!this.ctx.mobManager) return '错误: 生物管理器未就绪';
    const count = this.ctx.mobManager.mobs.size;
    this.ctx.mobManager.clearAll();
    return `已清理 ${count} 个生物`;
  }

  handleTime(args) {
    let t = parseFloat(args[0]);
    if (isNaN(t)) return '用法: /time [0.0 ~ 24.0]';
    
    // 自动环绕：例如输入 25 变为 1.0，输入 -1 变为 23.0
    t = ((t % 24) + 24) % 24;
    
    this.ctx.skyManager.setTime(t);
    
    // 格式化输出为 HH:MM
    const hours = Math.floor(t);
    const minutes = Math.floor((t - hours) * 60);
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    return `时间已设置为 ${timeStr}`;
  }

  handleGive(args) {
    const id = parseInt(args[0]);
    const amount = parseInt(args[1] || 1);
    if (isNaN(id) || isNaN(amount) || amount <= 0) return '用法: /give [id] [数量(必须为正)]';
    
    // 核心修复：校验物品 ID 是否存在 (Bug 27)
    if (!this.ctx.blockData[id]) {
      return `错误: 物品 ID ${id} 不存在。`;
    }

    const added = this.ctx.inventoryManager.addItem(id, amount);
    this.ctx.onUpdateUI(); // 通知刷新界面
    
    if (added > 0) {
      return `已给予物品 ${this.ctx.blockData[id].name} (ID:${id}) 数量:${added}`;
    } else {
      return `警告: 背包已满，物品未被给予。`;
    }
  }

  handleTeleport(args) {
    // 简易版：/tp [高度位移] 或 /tp [x] [y] [z]
    if (args.length === 1) {
      const y = parseFloat(args[0]);
      if (isNaN(y)) return '用法: /tp [高度]';
      
      // 核心修复: 单参数模式增加世界高度检查 (Bug 83)
      const newY = this.ctx.camera.position.y + y;
      if (newY < 0 || newY > 255) {
        return `错误: 目标高度 ${newY.toFixed(1)} 超出世界边界 (0-255)`;
      }
      
      this.ctx.camera.position.y = newY;
      return `已向上位移 ${y} 格`;
    } else if (args.length === 3) {
      const x = parseFloat(args[0]);
      const y = parseFloat(args[1]);
      const z = parseFloat(args[2]);
      if (isNaN(x) || isNaN(y) || isNaN(z)) return '用法: /tp [x] [y] [z]';
      
      // 核心修复：增加世界边界检查 (Bug 71)
      if (y < 0 || y > 255) {
        return `错误: 传送高度 ${y.toFixed(1)} 超出世界边界 (0-255)`;
      }

      this.ctx.camera.position.set(x, y, z);
      return `已传送到 ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`;
    }
    return '用法: /tp [高度] 或 /tp [x] [y] [z]';
  }
}
