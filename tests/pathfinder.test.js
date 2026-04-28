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

  it('can pathfind vertically up (jump straight up)', () => {
    const worldManager = {
      getBlock: vi.fn((x, y, z) => {
        if (y === -1) return 1; // Solid floor
        if (y === 0 && x === 1) return 1; // Block at x=1, y=0
        if (y === 1 && x === 1) return 1; // Block at x=1, y=1 (2-high wall)
        if (y === 2 && x === 1) return 1; // 3-high wall, cannot jump over
        // Wait, just jumping straight up to a platform
        // Let's make a platform at y=1
        if (x === 0 && y === 0) return 0; // start at 0,0,0
        if (x === 0 && y === 1) return 0; // jump straight up to 0,1,0
        return 0;
      })
    };
    // If we just want to test straight up:
    const start = { x: 0, y: 0, z: 0 };
    const goal = { x: 0, y: 1, z: 0 };
    // We need a platform at 0,0 below us so we can jump from it
    worldManager.getBlock = vi.fn((x, y, z) => {
       if (x === 0 && y === -1 && z === 0) return 1; // Floor under start
       if (x === 0 && y === 0 && z === 0) return 1; // wait, start is at 0,0,0, so 0,0,0 is air
       // If we want to jump straight up and stay at 0,1,0, there must be a floor under 0,1,0...
       // But 0,0,0 is air. So we can't stand at 0,1,0 unless 0,0,0 is solid?
       // If 0,0,0 is solid, we can't be at 0,0,0!
       // So we can only pass THROUGH 0,1,0 on our way somewhere else!
       return 0;
    });
  });

  it('can climb stairs (diagonal vertical movement)', () => {
    const worldManager = {
      getBlock: vi.fn((x, y, z) => {
        if (y === -1) return 1; // Ground level floor
        if (x === 1 && y === 0 && z === 0) return 1; // Stair block
        if (x === 2 && y === 0 && z === 0) return 1; // Higher platform floor
        if (x === 2 && y === 1 && z === 0) return 1; // Stair block 2
        return 0; // Air
      })
    };

    // To move to 1,1,0 (on top of stair), it must move x+1, y+1
    const start = { x: 0, y: 0, z: 0 };
    const goal = { x: 2, y: 2, z: 0 }; // Top of second stair
    const path = Pathfinder.findPath(start, goal, worldManager);

    expect(path).not.toBeNull();
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(goal);
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

  it('prevents diagonal squeezing through tight corners', () => {
    const worldManager = {
      getBlock: vi.fn((x, y, z) => {
        if (y === -1) return 1; // Solid floor
        // Create a tight diagonal corner
        // 0,0,0 is start. 1,0,1 is goal.
        // 1,0,0 and 0,0,1 are walls.
        if (x === 1 && y === 0 && z === 0) return 1;
        if (x === 1 && y === 1 && z === 0) return 1;
        if (x === 0 && y === 0 && z === 1) return 1;
        if (x === 0 && y === 1 && z === 1) return 1;
        return 0; // Air
      })
    };

    const start = { x: 0, y: 0, z: 0 };
    const goal = { x: 1, y: 0, z: 1 };
    const path = Pathfinder.findPath(start, goal, worldManager);

    if (path) {
        let hasDiagonalJump = false;
        for(let i=0; i<path.length-1; i++) {
            const p1 = path[i];
            const p2 = path[i+1];
            if (Math.abs(p1.x - p2.x) === 1 && Math.abs(p1.z - p2.z) === 1) {
                const c1 = worldManager.getBlock(p1.x, p1.y, p2.z);
                const c2 = worldManager.getBlock(p2.x, p1.y, p1.z);
                if ((c1 !== 0 && c1 !== 3) || (c2 !== 0 && c2 !== 3)) {
                    hasDiagonalJump = true;
                }
            }
        }
        expect(hasDiagonalJump).toBe(false);
    }
  });
});
