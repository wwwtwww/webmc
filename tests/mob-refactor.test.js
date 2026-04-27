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
});
