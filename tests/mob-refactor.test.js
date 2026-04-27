import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Mob } from '../Mob.js';

describe('Mob Refactor', () => {
  it('initializes a pig with default properties', () => {
    const mob = new Mob(1, 'pig', new THREE.Vector3(0, 0, 0));
    expect(mob.type).toBe('pig');
    expect(mob.hp).toBe(10);
    expect(mob.maxHp).toBe(10);
    expect(mob.moveSpeed).toBe(2.0);
    expect(mob.originalColor.getHex()).toBe(0xffafb0);
  });

  it('initializes a zombie with specific properties', () => {
    const mob = new Mob(2, 'zombie', new THREE.Vector3(0, 0, 0));
    expect(mob.type).toBe('zombie');
    expect(mob.hp).toBe(20);
    expect(mob.maxHp).toBe(20);
    expect(mob.moveSpeed).toBe(3.5);
    expect(mob.originalColor.getHex()).toBe(0x2d4d2d);
  });

  it('enters chasing state when zombie is near player', () => {
    const worldManager = { 
      getBlock: (x, y, z) => y < 0 ? 1 : 0 
    };
    const playerPos = new THREE.Vector3(5, 0, 0);
    const mob = new Mob(3, 'zombie', new THREE.Vector3(0, 0, 0));
    
    // Force pathUpdateTimer to 0 to trigger pathfinding
    mob.pathUpdateTimer = 0;
    
    mob.update(0.1, worldManager, playerPos);
    
    expect(mob.state).toBe('chasing');
    expect(mob.moveSpeed).toBe(3.5);
    expect(mob.path.length).toBeGreaterThan(0);
  });

  it('pig stays in idle or walking state even if player is near', () => {
    const worldManager = { 
      getBlock: () => 0 
    };
    const playerPos = new THREE.Vector3(5, 0, 0);
    const mob = new Mob(4, 'pig', new THREE.Vector3(0, 0, 0));
    
    mob.update(0.1, worldManager, playerPos);
    
    expect(mob.state).not.toBe('chasing');
    expect(mob.moveSpeed).toBe(2.0);
  });
});
