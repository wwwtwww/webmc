import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CommandParser } from '../CommandParser.js';

describe('CommandParser', () => {
  it('spawns zombie at correct position', () => {
    let spawnedMob = null;
    const ctx = {
      camera: new THREE.PerspectiveCamera(),
      mobManager: {
        worldManager: {
          getHighestBlock: (x, z) => 60
        },
        spawn: (type, pos) => {
          spawnedMob = { type, pos: pos.clone() };
        }
      }
    };
    ctx.camera.position.set(10, 65, 10);
    ctx.camera.quaternion.identity(); // looking down -Z
    
    const parser = new CommandParser(ctx);
    parser.parse('/spawn zombie');
    
    expect(spawnedMob).toBeDefined();
    expect(spawnedMob.type).toBe('zombie');
    expect(spawnedMob.pos.x).toBeCloseTo(10);
    expect(spawnedMob.pos.y).toBeCloseTo(61); // 60 + 1
    expect(spawnedMob.pos.z).toBeCloseTo(7);  // 10 - 3
  });
});