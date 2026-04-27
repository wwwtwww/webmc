import { describe, it, expect, vi } from 'vitest';
import { Pathfinder } from '../Pathfinder.js';

describe('Pathfinder', () => {
  it('finds a path between two adjacent empty blocks with floor', () => {
    const worldManager = {
      getBlock: vi.fn((x, y, z) => {
        if (y === -1) return 1; // Solid floor
        return 0; // Air
      })
    };

    const start = { x: 0, y: 0, z: 0 };
    const goal = { x: 1, y: 0, z: 0 };
    const path = Pathfinder.findPath(start, goal, worldManager);

    expect(path).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 }
    ]);
  });

  it('finds a path around an obstacle', () => {
    const worldManager = {
      getBlock: vi.fn((x, y, z) => {
        if (y === -1) return 1; // Solid floor
        // Create a wall at x=1, y=0, z=0
        if (x === 1 && y === 0 && z === 0) return 1; // Stone
        return 0; // Air
      })
    };

    const start = { x: 0, y: 0, z: 0 };
    const goal = { x: 2, y: 0, z: 0 };
    const path = Pathfinder.findPath(start, goal, worldManager);

    expect(path).toBeDefined();
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(goal);
    // Path should not go through (1, 0, 0)
    path.forEach(node => {
        expect(!(node.x === 1 && node.y === 0 && node.z === 0)).toBe(true);
    });
  });

  it('allows paths through water (block type 3)', () => {
    const worldManager = {
      getBlock: vi.fn((x, y, z) => {
        if (y === -1) return 1; // Solid floor
        if (x === 1 && y === 0 && z === 0) return 3; // Water
        return 0; // Air
      })
    };

    const start = { x: 0, y: 0, z: 0 };
    const goal = { x: 2, y: 0, z: 0 };
    const path = Pathfinder.findPath(start, goal, worldManager);

    expect(path).toBeDefined();
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(goal);
    // Path could go through (1, 0, 0) because it's water
  });

  it('returns null when no path is found due to no floor', () => {
    const worldManager = {
      getBlock: vi.fn((x, y, z) => 0) // Everything is air, no floor
    };

    const start = { x: 0, y: 0, z: 0 };
    const goal = { x: 1, y: 0, z: 0 };
    const path = Pathfinder.findPath(start, goal, worldManager);

    expect(path).toBeNull();
  });

  it('limits search to max nodes', () => {
      const worldManager = {
        getBlock: vi.fn((x, y, z) => {
            if (y === -1) return 1;
            return 0;
        })
      };

      const start = { x: 0, y: 0, z: 0 };
      const goal = { x: 100, y: 100, z: 100 };
      // Goal is too far for 500 nodes search limit
      const path = Pathfinder.findPath(start, goal, worldManager, 10);

      expect(path).toBeNull();
  });

  it('requires 2-block height clearance', () => {
    const worldManager = {
      getBlock: vi.fn((x, y, z) => {
        if (y === -1) return 1; // Solid floor
        if (x === 1 && y === 1 && z === 0) return 1; // Low ceiling at x=1
        return 0; // Air
      })
    };

    const start = { x: 0, y: 0, z: 0 };
    const goal = { x: 2, y: 0, z: 0 };
    const path = Pathfinder.findPath(start, goal, worldManager);

    // Should go around (1, 0, 0) because (1, 1, 0) is blocked
    expect(path).toBeDefined();
    path.forEach(node => {
        expect(!(node.x === 1 && node.y === 0 && node.z === 0)).toBe(true);
    });
  });
});
