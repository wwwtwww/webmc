import { VoxelWorld, getBiomeAt } from '../VoxelWorld.js';

describe('VoxelWorld', () => {
  it('stores and reads blocks within bounds', () => {
    const world = new VoxelWorld(16, 256);

    world.setBlock(1, 2, 3, 7);

    expect(world.getBlock(1, 2, 3)).toBe(7);
  });

  it('ignores out-of-bounds writes', () => {
    const world = new VoxelWorld(16, 256);

    world.setBlock(-1, 0, 0, 9);

    expect(world.getBlock(-1, 0, 0)).toBe(0);
  });

  it('returns a stable biome label for the same coordinates', () => {
    const first = getBiomeAt(16, 16);
    const second = getBiomeAt(16, 16);

    expect(first).toBe(second);
    expect(['SNOWY (积雪高山)', 'DESERT (热带沙漠)', 'GRASS (温带平原)']).toContain(first);
  });
});
