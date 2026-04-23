describe('chunkWorker', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('self', {
      postMessage: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('applies deltas and emits voxel and mesh payloads', async () => {
    await import('../chunkWorker.js');

    const input = {
      paddedData: new Uint8Array((16 + 2) * 256 * (16 + 2)),
      chunkSize: 16,
      chunkHeight: 256,
      chunkX: 0,
      chunkZ: 0,
      version: 1,
      needsGeneration: true,
      deltas: {
        '0_255_0': 4,
      },
    };

    self.onmessage({ data: input });

    expect(self.postMessage).toHaveBeenCalledTimes(1);

    const payload = self.postMessage.mock.calls[0][0];
    expect(payload.chunkX).toBe(0);
    expect(payload.chunkZ).toBe(0);
    expect(payload.version).toBe(1);
    expect(payload.voxels).toBeInstanceOf(Uint8Array);
    expect(payload.voxels[255 * 16 * 16]).toBe(4);
    expect(payload.opaque).toHaveProperty('positions');
    expect(payload.transparent).toHaveProperty('indices');
  });
});
