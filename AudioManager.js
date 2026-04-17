import * as THREE from 'three';

export class AudioManager {
  constructor() {
    this.listener = null;
    this.audioLoader = new THREE.AudioLoader();
    this.buffers = new Map(); // 存储解析后的 AudioBuffer
    this.pools = new Map();   // 存储每个音效的对象池 (Array of THREE.Audio)
    
    // 每个音效最大并发播放数量（支持重叠播放）
    this.poolSize = 5; 
  }

  /**
   * 初始化音频监听器并绑定到相机
   * @param {THREE.Camera} camera 
   */
  init(camera) {
    if (this.listener) return;
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    console.log('[AudioManager] AudioListener initialized and attached to camera.');
  }

  /**
   * 预加载所有核心音效
   * 使用 Promise.all 并行加载，不阻塞主线程
   * @returns {Promise}
   */
  async loadSounds() {
    // 假设音效存放在 public/assets/sounds 目录下
    // 在真实应用中，如果文件不存在，这里做了容错处理
    const sounds = {
      'dig': 'assets/sounds/dig.ogg',
      'place': 'assets/sounds/place.ogg',
      'footstep': 'assets/sounds/footstep.ogg'
    };

    const loadPromises = Object.entries(sounds).map(([name, url]) => {
      return new Promise((resolve) => {
        this.audioLoader.load(
          url,
          (buffer) => {
            this.buffers.set(name, buffer);
            
            // 为该音效初始化对象池，以支持多轨道重叠播放
            const pool = [];
            for (let i = 0; i < this.poolSize; i++) {
               const audio = new THREE.Audio(this.listener);
               audio.setBuffer(buffer);
               pool.push(audio);
            }
            this.pools.set(name, pool);
            resolve(true);
          },
          undefined, // onProgress
          (error) => {
            console.warn(`[AudioManager] 无法加载音效文件 (占位提示): ${url}`);
            // 即使加载失败也 resolve，避免整个游戏因为缺少音效而卡死加载界面
            resolve(false); 
          }
        );
      });
    });

    await Promise.all(loadPromises);
    console.log('[AudioManager] All configured sounds processed.');
  }

  /**
   * 播放指定音效
   * @param {string} name 音效名称 ('dig', 'place', 'footstep')
   * @param {number} volume 音量大小 (0.0 - 1.0)
   */
  playSound(name, volume = 0.5) {
    if (!this.listener) return;
    
    const pool = this.pools.get(name);
    if (!pool || pool.length === 0) return; // 音效未加载或不存在

    // 1. 在池中寻找一个当前空闲（未在播放）的 Audio 对象
    let audioToPlay = pool.find(audio => !audio.isPlaying);

    // 2. 如果池子里的声音都在播放（例如连点挖掘极快），
    // 强制征用池子里的第一个声音打断重播。
    if (!audioToPlay) {
      audioToPlay = pool[0];
      if (audioToPlay.isPlaying) {
        audioToPlay.stop();
      }
    }

    // 3. 将选中的 Audio 对象移到数组末尾，实现简单的 LRU (最近最少使用) 轮转
    const index = pool.indexOf(audioToPlay);
    if (index > -1) {
      pool.push(pool.splice(index, 1)[0]);
    }

    // 4. 设置音量与随机音调 (Pitch) 变化，增加真实感（避免声音过于机械重复）
    audioToPlay.setVolume(volume);
    
    // 给挖掘和脚步声添加 ±100 cents (半个全音) 的随机音调微调
    const detune = (Math.random() - 0.5) * 200; 
    audioToPlay.setDetune(detune);

    // 5. 播放
    audioToPlay.play();
  }
}