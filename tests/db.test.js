const dexieState = vi.hoisted(() => {
  class FakeTable {
    constructor() {
      this.rows = new Map();
    }

    async get(key) {
      return this.rows.get(key) ?? null;
    }

    async put(entry) {
      this.rows.set(entry.chunkKey, JSON.parse(JSON.stringify(entry)));
      return entry.chunkKey;
    }

    clear() {
      this.rows.clear();
    }
  }

  class FakeDexie {
    constructor() {
      this.chunks = new FakeTable();
    }

    version() {
      return { stores: () => this };
    }

    async transaction(_mode, _table, fn) {
      return fn();
    }
  }

  return { FakeDexie };
});

vi.mock('dexie', () => ({
  default: dexieState.FakeDexie,
}));

import { db, saveChunkDelta, getChunkDelta } from '../db.js';

describe('Dexie helpers', () => {
  beforeEach(() => {
    db.chunks.clear();
  });

  it('stores chunk deltas by chunk key and voxel key', async () => {
    await saveChunkDelta('0,0', 1, 2, 3, 4);
    await saveChunkDelta('0,0', 4, 5, 6, 7);

    expect(await getChunkDelta('0,0')).toEqual({
      '1_2_3': 4,
      '4_5_6': 7,
    });
  });

  it('returns an empty object for missing chunks', async () => {
    expect(await getChunkDelta('9,9')).toEqual({});
  });
});
