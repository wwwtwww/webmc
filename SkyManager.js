import * as THREE from 'three';

export class SkyManager {
  constructor(scene, ambientLight, directionalLight) {
    this.scene = scene;
    this.ambientLight = ambientLight;
    this.directionalLight = directionalLight;
    
    this.timeOfDay = 0.5; // 0.0 to 1.0 (0.5 = noon, 0.0/1.0 = midnight)
    
    this.colors = {
      noon: new THREE.Color(0xadd8e6),
      sunset: new THREE.Color(0xffa07a),
      midnight: new THREE.Color(0x191970)
    };
  }

  /**
   * 设置世界时间
   * @param {number} t 0.0 到 1.0
   */
  setTime(t) {
    this.timeOfDay = Math.max(0, Math.min(1, t));
    this.update();
  }

  update() {
    let lerpColor = new THREE.Color();
    let intensity = 1.0;
    
    // 简化的昼夜插值逻辑
    if (this.timeOfDay >= 0.25 && this.timeOfDay <= 0.75) {
      // 白天
      const t = (this.timeOfDay - 0.25) / 0.5; // 0 to 1
      const factor = 1 - Math.abs(t - 0.5) * 2; // peaks at 0.5 (noon)
      lerpColor.copy(this.colors.noon).lerp(this.colors.sunset, 1 - factor);
      intensity = 0.3 + 0.7 * factor;
    } else {
      // 晚上
      lerpColor.copy(this.colors.midnight);
      intensity = 0.2;
    }

    this.scene.background = lerpColor;
    if (this.scene.fog) {
      this.scene.fog.color.copy(lerpColor);
    }
    
    this.ambientLight.intensity = 0.6 * intensity;
    this.directionalLight.intensity = 1.0 * intensity;
    
    // 旋转太阳 (绕 X 轴)
    const angle = (this.timeOfDay * Math.PI * 2) + Math.PI;
    this.directionalLight.position.set(
      Math.sin(angle) * 20,
      Math.cos(angle) * 20,
      10
    );
  }
}
