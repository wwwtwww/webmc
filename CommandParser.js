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
      default:
        return `未知指令: ${command}`;
    }
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
    
    const added = this.ctx.inventoryManager.addItem(id, amount);
    this.ctx.onUpdateUI(); // 通知刷新界面
    
    if (added) {
      return `已给予物品 ID:${id} 数量:${amount}`;
    } else {
      return `警告: 背包已满，部分或全部物品未被给予。`;
    }
  }

  handleTeleport(args) {
    // 简易版：/tp [高度位移] 或 /tp [x] [y] [z]
    if (args.length === 1) {
      const y = parseFloat(args[0]);
      this.ctx.camera.position.y += y;
      return `已向上位移 ${y} 格`;
    } else if (args.length === 3) {
      const x = parseFloat(args[0]);
      const y = parseFloat(args[1]);
      const z = parseFloat(args[2]);
      this.ctx.camera.position.set(x, y, z);
      return `已传送到 ${x}, ${y}, ${z}`;
    }
    return '用法: /tp [高度] 或 /tp [x] [y] [z]';
  }
}
