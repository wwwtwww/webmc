import * as THREE from 'three';

/**
 * SkyManager.js
 * 负责驱动场景的 24 小时昼夜循环
 */
export class SkyManager {
  constructor(scene, ambientLight, directionalLight) {
    this.scene = scene;
    this.ambientLight = ambientLight;
    this.directionalLight = directionalLight;
    
    // 24 小时制时间 (0.0 = 午夜, 12.0 = 正午)
    this.timeOfDay = 8.0; 
    this.dayDuration = 1200; // 一个完整的昼夜循环需要 1200 秒 (20 分钟)
    this.isTimeFlowing = true;
    
    this.colors = {
      noon: new THREE.Color(0xadd8e6),     // 正午清澈蓝
      dawn: new THREE.Color(0xffa07a),     // 黎明/黄昏橘
      midnight: new THREE.Color(0x0a0a2a), // 深夜蓝
    };
  }

  /**
   * 强制设置时间 (例如由指令 /time 调用)
   * @param {number} t 0.0 到 24.0
   */
  setTime(t) {
    this.timeOfDay = ((t % 24) + 24) % 24;
    this.update(0); // 立即刷新
  }

  /**
   * 每一帧推进时间并更新渲染
   * @param {number} deltaTime 距离上一帧经过的时间（秒）
   */
  update(deltaTime = 0) {
    // 1. 自动流逝逻辑
    if (this.isTimeFlowing) {
      this.timeOfDay += (deltaTime / this.dayDuration) * 24;
      this.timeOfDay %= 24;
    }

    // 2. 核心渲染插值计算
    // 将 0-24 映射到 0.0-1.0 用于旧逻辑适配或计算
    const normalizedTime = this.timeOfDay / 24; 
    
    let lerpColor = new THREE.Color();
    let intensity = 1.0;
    let ambientBase = 0.4;

    // 分段光影模型 (5-7 黎明, 7-17 白天, 17-19 黄昏, 19-5 深夜)
    const hour = this.timeOfDay;
    if (hour >= 7 && hour < 17) {
      // --- 白天 ---
      lerpColor.copy(this.colors.noon);
      intensity = 1.2;
      ambientBase = 0.7;
    } else if (hour >= 5 && hour < 7) {
      // --- 黎明 ---
      const t = (hour - 5) / 2;
      lerpColor.copy(this.colors.midnight).lerp(this.colors.dawn, t).lerp(this.colors.noon, t * t);
      intensity = THREE.MathUtils.lerp(0.2, 1.2, t);
      ambientBase = THREE.MathUtils.lerp(0.2, 0.7, t);
    } else if (hour >= 17 && hour < 19) {
      // --- 黄昏 ---
      const t = (hour - 17) / 2;
      lerpColor.copy(this.colors.noon).lerp(this.colors.dawn, t).lerp(this.colors.midnight, t * t);
      intensity = THREE.MathUtils.lerp(1.2, 0.2, t);
      ambientBase = THREE.MathUtils.lerp(0.7, 0.2, t);
    } else {
      // --- 深夜 ---
      lerpColor.copy(this.colors.midnight);
      intensity = 0.15;
      ambientBase = 0.2;
    }

    // 3. 应用至场景组件
    this.scene.background = lerpColor;
    if (this.scene.fog) {
      this.scene.fog.color.copy(lerpColor);
    }
    
    this.ambientLight.intensity = ambientBase;
    this.directionalLight.intensity = intensity;
    
    // 计算太阳角度 (12:00 时在最高点)
    const angle = (normalizedTime * Math.PI * 2) - Math.PI / 2;
    this.directionalLight.position.set(
      -Math.cos(angle) * 50,
      Math.abs(Math.sin(angle)) * 50, // 核心修复：夜间将光源翻转至天空 (Bug 28)
      20
    );

    // 动态调整太阳颜色
    const sunHeight = Math.sin(angle);
    if (sunHeight > 0 && sunHeight < 0.3) {
      this.directionalLight.color.setHSL(0.1, 0.8, 0.7); // 暖色调
    } else {
      this.directionalLight.color.set(0xffffff); // 纯白
    }
  }
}
