import * as THREE from 'three';
import { Mob } from './Mob.js';
import { getBiomeAt } from './VoxelWorld.js';

/**
 * MobManager.js
 * 负责生物的生成、卸载与更新
 */
export class MobManager {
  constructor(scene, worldManager, itemDropManager) {
    this.scene = scene;
    this.worldManager = worldManager;
    this.itemDropManager = itemDropManager;
    this.mobs = new Map();
    this.nextId = 0;
    
    this.spawnTimer = 0;
    this.maxMobs = 10;
    this.spawnRadius = 40;
  }

  update(delta, playerPos) {
    // 1. 更新所有存活生物
    for (const [id, mob] of this.mobs.entries()) {
      mob.update(delta, this.worldManager);

      // 距离玩家太远时自动卸载 (节省性能)
      const dist = mob.group.position.distanceTo(playerPos);
      if (dist > 64) {
        this.despawn(id);
      }
    }

    // 2. 尝试生成新生物
    this.spawnTimer += delta;
    if (this.spawnTimer > 5.0) { // 每 5 秒尝试一次生成
      this.spawnTimer = 0;
      if (this.mobs.size < this.maxMobs) {
        this.trySpawnAround(playerPos);
      }
    }
  }

  trySpawnAround(playerPos) {
    // 随机一个半径内的位置
    const angle = Math.random() * Math.PI * 2;
    const radius = 20 + Math.random() * this.spawnRadius;
    const sx = playerPos.x + Math.cos(angle) * radius;
    const sz = playerPos.z + Math.sin(angle) * radius;

    // 寻找该位置的地面高度
    const sy = this.worldManager.getHighestBlock(sx, sz);
    
    if (sy !== null) {
      // 检查群落：只在草地生成猪
      const biome = getBiomeAt(sx, sz);
      if (biome.includes('GRASS')) {
        this.spawn('pig', new THREE.Vector3(sx, sy + 1, sz));
      }
    }
  }

  spawn(type, position) {
    const id = this.nextId++;
    const mob = new Mob(id, type, position);
    
    // 监听死亡移除事件
    mob.onRemove = (mid) => {
      this.despawn(mid);
    };

    // 监听死亡掉落事件
    mob.onDie = (x, y, z) => {
      if (this.itemDropManager) {
        this.itemDropManager.spawn(x, y + 0.5, z, 50, 1);
      }
    };

    this.mobs.set(id, mob);
    this.scene.add(mob.group);
    console.log(`[Mob] Spawned ${type} at ${position.x.toFixed(1)}, ${position.z.toFixed(1)}`);
    return mob;
  }

  despawn(id) {
    const mob = this.mobs.get(id);
    if (mob) {
      this.scene.remove(mob.group);
      this.mobs.delete(id);
    }
  }

  clearAll() {
    for (const id of this.mobs.keys()) {
      this.despawn(id);
    }
  }
}
