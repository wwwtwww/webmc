/**
 * InventoryManager.js
 * 核心背包数据管理类
 */
export class InventoryManager {
  constructor(size = 36) {
    this.size = size;
    this.maxStackSize = 64;
    // 初始化指定数量的槽位，默认为 null
    this.slots = new Array(this.size).fill(null);
  }

  /**
   * 尝试将物品加入背包
   * @param {number} id 物品ID
   * @param {number} amount 数量
   * @returns {boolean} 是否添加成功
   */
  addItem(id, amount) {
    let remaining = amount;

    // 第一步：尝试在现有堆叠中增加数量
    for (let i = 0; i < this.size; i++) {
      const item = this.slots[i];
      if (item && item.id === id && item.count < this.maxStackSize) {
        const canAdd = Math.min(remaining, this.maxStackSize - item.count);
        item.count += canAdd;
        remaining -= canAdd;
      }
      if (remaining <= 0) return true;
    }

    // 第二步：如果还有剩余，寻找空位放置
    for (let i = 0; i < this.size; i++) {
      if (this.slots[i] === null) {
        const canAdd = Math.min(remaining, this.maxStackSize);
        this.slots[i] = { id, count: canAdd };
        remaining -= canAdd;
      }
      if (remaining <= 0) return true;
    }

    // 如果全部遍历完仍有剩余，说明背包满了（部分或全部添加失败）
    return remaining === 0;
  }

  /**
   * 从指定槽位扣除物品
   * @param {number} slotIndex 槽位索引
   * @param {number} amount 扣除数量
   * @returns {boolean} 是否扣除成功
   */
  removeItem(slotIndex, amount) {
    if (slotIndex < 0 || slotIndex >= this.size) return false;
    const item = this.slots[slotIndex];
    if (!item) return false;

    if (item.count <= amount) {
      // 扣除数量超过或等于现有数量，直接清空槽位
      this.slots[slotIndex] = null;
    } else {
      item.count -= amount;
    }
    return true;
  }

  /**
   * 交换两个槽位的数据
   * @param {number} index1 槽位1索引
   * @param {number} index2 槽位2索引
   */
  swapSlots(index1, index2) {
    if (index1 < 0 || index1 >= this.size || index2 < 0 || index2 >= this.size) return;
    const temp = this.slots[index1];
    this.slots[index1] = this.slots[index2];
    this.slots[index2] = temp;
  }

  /**
   * 获取指定槽位的数据（只读拷贝，防止外部直接修改 count 绕过逻辑）
   */
  getSlot(index) {
    if (index < 0 || index >= this.size) return null;
    const slot = this.slots[index];
    return slot ? { ...slot } : null;
  }
}
