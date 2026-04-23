import { AudioManager } from '../AudioManager.js';

function createFakeAudio(isPlaying = false) {
  return {
    isPlaying,
    stop: vi.fn(function () {
      this.isPlaying = false;
    }),
    setBuffer: vi.fn(),
    setVolume: vi.fn(),
    setDetune: vi.fn(),
    play: vi.fn(function () {
      this.isPlaying = true;
    }),
  };
}

describe('AudioManager', () => {
  it('rotates the pool and plays the first idle audio', () => {
    const manager = new AudioManager();
    manager.listener = {};

    const a = createFakeAudio(true);
    const b = createFakeAudio(false);
    manager.pools.set('dig', [a, b]);

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    manager.playSound('dig', 0.3);

    expect(b.setVolume).toHaveBeenCalledWith(0.3);
    expect(b.setDetune).toHaveBeenCalledWith(0);
    expect(b.play).toHaveBeenCalled();
    expect(manager.pools.get('dig')[1]).toBe(b);

    randomSpy.mockRestore();
  });

  it('stops the oldest audio when the pool is busy', () => {
    const manager = new AudioManager();
    manager.listener = {};

    const a = createFakeAudio(true);
    const b = createFakeAudio(true);
    manager.pools.set('place', [a, b]);

    manager.playSound('place', 0.8);

    expect(a.stop).toHaveBeenCalled();
    expect(a.setVolume).toHaveBeenCalledWith(0.8);
    expect(a.play).toHaveBeenCalled();
  });
});
