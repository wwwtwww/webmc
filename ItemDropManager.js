import * as THREE from 'three';
import { ItemDrop } from './ItemDrop.js';

// --- 核心优化：预分配模块级临时变量，规避 GC 压力 (Bug 47) ---
const _playerCenter = new THREE.Vector3();

/**
 * ItemDropManager.js
 * 维护掉落物生命周期：生成、物理更新、磁力吸附与拾取
 */
export class ItemDropManager {
  constructor(scene, worldManager, inventoryManager, colorMap) {
    this.scene = scene;
    this.worldManager = worldManager;
    this.inventoryManager = inventoryManager;
    this.colorMap = colorMap;
    this.drops = [];
  }

  spawn(x, y, z, itemId, amount = 1) {
    const MAX_DROPS = 200;

    // 核心修复: 优先尝试与附近同类掉落物合并，避免达到上限时静默丢弃 (Bug 85)
    for (const drop of this.drops) {
      if (drop.itemId === itemId && drop.amount < 64) {
        // 计算新掉落物位置与该掉落物的距离平方
        const dx = drop.group.position.x - x;
        const dy = drop.group.position.y - y;
        const dz = drop.group.position.z - z;
        if (dx * dx + dy * dy + dz * dz < 9.0) { // 3 个方块半径内
          const space = 64 - drop.amount;
          if (space >= amount) {
            drop.amount += amount;
            return drop; // 已全部合并
          } else {
            drop.amount = 64;
            amount -= space; // 剩余的继续生成新的
          }
        }
      }
    }

    if (this.drops.length >= MAX_DROPS) {
      // 核心修复: 达到上限时，强制合并任何同类型掉落物以腾出空间 (Bug 85)
      let condensed = false;
      for (let i = 0; i < this.drops.length; i++) {
        for (let j = i + 1; j < this.drops.length; j++) {
          if (this.drops[i].itemId === this.drops[j].itemId) {
            // 核心修复: 增加距离校验，防止跨地图瞬移合并 (Bug 88)
            const distSq = this.drops[i].group.position.distanceToSquared(this.drops[j].group.position);
            if (distSq < 1024) { // 32 格半径内
              this.drops[i].amount += this.drops[j].amount;
              this.drops[j].remove();
              this.drops.splice(j, 1);
              condensed = true;
              break;
            }
          }
        }
        if (condensed) break;
      }
      // 如果 200 个都是完全不同种类的物品（理论极难发生），只能丢弃最老的一个
      if (!condensed) {
        const oldest = this.drops.shift();
        if (oldest) oldest.remove();
      }
    }

    const drop = new ItemDrop(this.scene, x, y, z, itemId, amount, this.colorMap);
    this.drops.push(drop);
    return drop;
  }

  update(deltaTime, playerPosition) {
    // 核心修复：计算玩家身体中心点 (playerPosition 是头部/相机位置)
    // 假设眼睛高度为 1.6，中心点下移 0.8 到腰部位置
    _playerCenter.copy(playerPosition).setY(playerPosition.y - 0.8);

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      
      // 1. 物理与动画更新 (传入玩家中心以处理磁力吸附碰撞, Bug 69)
      drop.update(deltaTime, this.worldManager, _playerCenter);

      // 2. 吸附逻辑判定：计算到中心点的距离
      const dist = drop.group.position.distanceTo(_playerCenter);
      
      // 核心修复：仅在背包有空间时才触发吸附逻辑 (Bug 26)
      if (dist < 2.5 && this.inventoryManager.canAddItem(drop.itemId)) {
        drop.isMagnetic = true;
      } else {
        drop.isMagnetic = false;
      }

      // 3. 完成拾取：现在判定点和飞行目标点一致了
      if (dist < 0.5) {
        const added = this.inventoryManager.addItem(drop.itemId, drop.amount);
        if (added > 0) {
          drop.amount -= added;
          if (drop.amount <= 0) {
            drop.remove();
            this.drops.splice(i, 1);
          }
          if (window.refreshInventoryUI) window.refreshInventoryUI();
        } else {
          drop.isMagnetic = false;
        }
      }
    }
  }
}
