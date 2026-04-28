import { describe, it, expect, vi } from 'vitest';
import { ItemDrop } from '../ItemDrop.js';
import * as THREE from 'three';

describe('ItemDrop', () => {
  it('should not jitter physically when resting on the ground', () => {
    const scene = new THREE.Scene();
    const colorMap = { 1: 0xffffff };
    const itemDrop = new ItemDrop(scene, 0, 2, 0, 1, 1, colorMap);
    
    // mock worldManager
    const worldManager = {
      getBlock: vi.fn((x, y, z) => {
        if (y <= 0) return 1; // Solid floor at y=0 (so block occupies y=0 to y=1)
        return 0; // Air
      })
    };

    // Wait until it drops
    for (let i = 0; i < 100; i++) {
      itemDrop.update(0.016, worldManager);
    }
    
    // Should rest on the ground
    // floor is at y=0, which means block top is at y=1
    // The collision check in ItemDrop drops it into y=1 block bounds and uses Math.floor(nextY - 0.125)
    // resting height should be 1.125 so nextY-0.125 > 1 doesn't clip
    const restingY = itemDrop.group.position.y;
    
    // It should stay there!
    for (let i = 0; i < 10; i++) {
        itemDrop.update(0.016, worldManager);
        expect(itemDrop.group.position.y).toBeCloseTo(restingY, 2);
    }
    
    // Visually, the mesh should be high enough so bottom does not clip into y=1 block
    // Mesh minimum height relative to group is expected to be offset by 0.1
    // group.position.y = 1.125
    // mesh min y = 1.125 + (-0.1) + offset = 1.125 - 0.1 + 0.1 = 1.125 > 1.0 (doesn't clip)
  });
});
