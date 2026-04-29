import * as THREE from 'three';
import { Mob } from './Mob.js';
import { getBiomeAt } from './VoxelWorld.js';

/**
 * MobManager.js
 * 负责生物的生成、卸载与更新
 */
export class MobManager {
  constructor(scene, worldManager, itemDropManager, skyManager) {
    this.scene = scene;
    this.worldManager = worldManager;
    this.itemDropManager = itemDropManager;
    this.skyManager = skyManager;
    this.mobs = new Map();
    this.nextId = 0;
    
    this.spawnTimer = 0;
    this.maxMobs = 10;
    this.spawnRadius = 40;
  }

  update(delta, playerPos) {
    // 1. 更新所有存活生物
    for (const [id, mob] of this.mobs.entries()) {
      mob.update(delta, this.worldManager, playerPos);

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
      const time = this.skyManager ? this.skyManager.timeOfDay : 12; // 默认中午
      const isNight = time > 18 || time < 6;
      
      let spawnType = null;
      if (isNight) {
        // 夜晚：70% 僵尸，30% 猪
        if (Math.random() < 0.7) {
          spawnType = 'zombie';
        } else {
          // 猪只能在草地生成
          const biome = getBiomeAt(sx, sz);
          if (biome.includes('GRASS')) {
            spawnType = 'pig';
          }
        }
      } else {
        // 白天：100% 猪 (在草地)
        const biome = getBiomeAt(sx, sz);
        if (biome.includes('GRASS')) {
          spawnType = 'pig';
        }
      }

      if (spawnType) {
        this.spawn(spawnType, new THREE.Vector3(sx, sy + 1, sz));
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
        // 猪掉落生猪肉 (50)，僵尸暂时不掉落或掉落占位符
        if (type === 'pig') {
          this.itemDropManager.spawn(x, y + 0.5, z, 50, 1);
        }
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
      mob.dispose(); // 核心修复：清理显存
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
