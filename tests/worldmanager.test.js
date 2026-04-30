const saveChunkDeltaMock = vi.hoisted(() => vi.fn());
const getChunkDeltaMock = vi.hoisted(() => vi.fn());
const saveBulkChunkDeltasMock = vi.hoisted(() => vi.fn());

vi.mock('../db.js', () => ({
  saveChunkDelta: saveChunkDeltaMock,
  getChunkDelta: getChunkDeltaMock,
  saveBulkChunkDeltas: saveBulkChunkDeltasMock,
}));

const workerInstances = [];

class MockWorker {
  constructor() {
    this.onmessage = null;
    this.postMessage = vi.fn();
    workerInstances.push(this);
  }
}

describe('WorldManager', () => {
  let WorldManager;
  let Chunk;

  beforeEach(async () => {
    vi.resetModules();
    workerInstances.length = 0;
    saveChunkDeltaMock.mockReset();
    getChunkDeltaMock.mockReset();
    saveBulkChunkDeltasMock.mockReset();
    saveChunkDeltaMock.mockResolvedValue(undefined);
    getChunkDeltaMock.mockResolvedValue({});
    saveBulkChunkDeltasMock.mockResolvedValue(undefined);
    vi.stubGlobal('Worker', MockWorker);

    ({ WorldManager, Chunk } = await import('../WorldManager.js'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createScene() {
    return {
      added: [],
      removed: [],
      add(obj) {
        this.added.push(obj);
      },
      remove(obj) {
        this.removed.push(obj);
      },
    };
  }

  it('creates chunk meshes and disposes them cleanly', () => {
    const scene = createScene();
    const chunk = new Chunk(scene, 2, 3, 16, 256);

    expect(scene.added).toHaveLength(2);
    expect(chunk.opaqueMesh.position.x).toBe(32);
    expect(chunk.transparentMesh.position.z).toBe(48);

    const opaqueDispose = vi.spyOn(chunk.opaqueMesh.geometry, 'dispose');
    const transparentDispose = vi.spyOn(chunk.transparentMesh.geometry, 'dispose');

    chunk.dispose();

    expect(scene.removed).toHaveLength(2);
    expect(opaqueDispose).toHaveBeenCalled();
    expect(transparentDispose).toHaveBeenCalled();
    expect(chunk.world).toBeNull();
  });

  it('maps forced air back to air on getBlock', () => {
    const scene = createScene();
    const manager = new WorldManager(scene, 1, 16, 256);
    const chunk = new Chunk(scene, 0, 0, 16, 256);
    chunk.world.setBlock(1, 2, 3, 255);
    manager.chunks.set('0,0', chunk);

    expect(manager.getBlock(1, 2, 3)).toBe(0);
  });

  it('marks the expected chunk and neighbors dirty when setting a block', () => {
    const scene = createScene();
    const manager = new WorldManager(scene, 1, 16, 256);
    const chunk = new Chunk(scene, 0, 0, 16, 256);
    manager.chunks.set('0,0', chunk);

    manager.setBlock(0, 4, 0, 0);

    expect(chunk.world.getBlock(0, 4, 0)).toBe(255);
    expect(manager.dirtyChunks.has('0,0')).toBe(true);
    expect(manager.dirtyChunks.has('-1,0')).toBe(true);
    expect(manager.dirtyChunks.has('0,-1')).toBe(true);
    
    // Check persistence buffer since saveBulkChunkDeltas is async via timeout
    expect(manager.persistenceBuffer.has('0,0')).toBe(true);
    expect(manager.persistenceBuffer.get('0,0').get('0_4_0')).toBe(255);
  });

  it('ignores stale worker responses and accepts matching ones', () => {
    const scene = createScene();
    const manager = new WorldManager(scene, 1, 16, 256);
    const chunk = new Chunk(scene, 0, 0, 16, 256);
    chunk.lastRequestId = 2;
    chunk.applyGeometry = vi.fn();
    manager.chunks.set('0,0', chunk);

    const worker = workerInstances[0];

    worker.onmessage({
      data: {
        chunkX: 0,
        chunkZ: 0,
        version: 1,
        opaque: { positions: new Float32Array(), normals: new Float32Array(), uvs: new Float32Array(), colors: new Float32Array(), indices: new Uint32Array() },
        transparent: { positions: new Float32Array(), normals: new Float32Array(), uvs: new Float32Array(), colors: new Float32Array(), indices: new Uint32Array() },
        voxels: new Uint8Array(16 * 256 * 16),
      },
    });

    expect(chunk.generated).toBe(false);
    expect(chunk.applyGeometry).not.toHaveBeenCalled();

    worker.onmessage({
      data: {
        chunkX: 0,
        chunkZ: 0,
        version: 2,
        opaque: { positions: new Float32Array([1]), normals: new Float32Array([0]), uvs: new Float32Array([0]), colors: new Float32Array([1]), indices: new Uint32Array([0]) },
        transparent: { positions: new Float32Array(), normals: new Float32Array(), uvs: new Float32Array(), colors: new Float32Array(), indices: new Uint32Array() },
        voxels: new Uint8Array(16 * 256 * 16),
      },
    });

    expect(chunk.generated).toBe(true);
    expect(chunk.applyGeometry).toHaveBeenCalled();
    expect(manager.dirtyChunks.has('1,0')).toBe(true);
  });

  it('creates chunks around the current player chunk during update', () => {
    const scene = createScene();
    const manager = new WorldManager(scene, 1, 16, 256);
    manager._buildMesh = vi.fn();

    manager.update({ x: 0, y: 0, z: 0 });

    expect(manager.chunks.size).toBe(9);
    expect(manager._buildMesh).toHaveBeenCalled();
  });
});
