import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { Mob } from '../Mob.js';
import { MobManager } from '../MobManager.js';
import { Pathfinder } from '../Pathfinder.js';

describe('Mob Behavior', () => {
  it('updates zombie AI without crashing or teleporting away', () => {
    const scene = new THREE.Scene();
    const worldManager = {
      getBlock: () => 1,
      getHighestBlock: () => 10,
    };
    
    const mob = new Mob(1, 'zombie', new THREE.Vector3(0, 10, 0));
    const playerPos = new THREE.Vector3(0, 10, 5);
    
    // distToPlayer = 5 (< 15), so it should chase!
    mob.update(0.016, worldManager, playerPos);
    
    expect(mob.group.position.y).toBeGreaterThan(0);
    expect(mob.group.position.x).not.toBeNaN();
    expect(mob.group.position.z).not.toBeNaN();
  });
});
