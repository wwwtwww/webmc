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
      
      // 1. 物理与动画更新
      drop.update(deltaTime, this.worldManager);

      // 2. 吸附逻辑：计算到中心点的距离
      const dist = drop.group.position.distanceTo(_playerCenter);
      
      // 核心修复：仅在背包有空间时才触发吸附逻辑 (Bug 26)
      if (dist < 2.5 && this.inventoryManager.canAddItem(drop.itemId)) {
        // 触发吸附：取消重力
        drop.isMagnetic = true;
        
        // 加速飞向中心点
        drop.group.position.lerp(_playerCenter, deltaTime * 8.0);
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
