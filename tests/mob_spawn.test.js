import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { Mob } from '../Mob.js';
import { MobManager } from '../MobManager.js';

describe('Mob Spawn Check', () => {
  it('spawns a zombie using the logic from CommandParser', () => {
    const scene = new THREE.Scene();
    const worldManager = {
      getBlock: () => 1,
      getHighestBlock: () => 10,
    };
    const mobManager = new MobManager(scene, worldManager, null, null);
    
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 10, 0);
    // looking along -Z
    
    const type = 'zombie';
    const pos = camera.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    pos.add(dir.multiplyScalar(3));
    
    const spawnedMob = mobManager.spawn(type, pos);
    
    expect(spawnedMob).toBeDefined();
    expect(spawnedMob.group.position.x).toBeCloseTo(0);
    expect(spawnedMob.group.position.y).toBeCloseTo(10);
    expect(spawnedMob.group.position.z).toBeCloseTo(-3);
    
    expect(scene.children.length).toBeGreaterThan(0);
    
    // Simulate one frame update
    mobManager.update(0.016, camera.position);
    
    expect(spawnedMob.group.position.y).toBeGreaterThan(-10);
  });
});
