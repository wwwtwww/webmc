import * as THREE from 'three';
import { ItemDrop } from './ItemDrop.js';

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
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      
      // 1. 物理与动画更新
      drop.update(deltaTime, this.worldManager);

      // 2. 吸附逻辑
      const dist = drop.mesh.position.distanceTo(playerPosition);
      
      if (dist < 2.5) {
        // 触发吸附：取消重力
        drop.isMagnetic = true;
        
        // 加速飞向玩家中心 (Y 偏移 0.5 对应玩家中心)
        const target = playerPosition.clone().setY(playerPosition.y - 1.0); 
        drop.mesh.position.lerp(target, deltaTime * 8.0);
      } else {
        drop.isMagnetic = false;
      }

      // 3. 完成拾取
      if (dist < 0.5) {
        const added = this.inventoryManager.addItem(drop.itemId, drop.amount);
        if (added > 0) {
          drop.amount -= added;
          if (drop.amount <= 0) {
            drop.remove();
            this.drops.splice(i, 1);
          }
          // 触发 UI 刷新
          if (window.refreshInventoryUI) window.refreshInventoryUI();
        } else {
          // 背包满了，取消吸附让其落下
          drop.isMagnetic = false;
        }
      }

    }
  }
}
