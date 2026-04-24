import * as THREE from 'three';

/**
 * ItemDrop.js
 * 掉落物实体：包含旋转、浮动、重力与碰撞逻辑
 */
export class ItemDrop {
  constructor(scene, x, y, z, itemId, amount, colorMap) {
    this.scene = scene;
    this.itemId = itemId;
    this.amount = amount;
    
    // 1. 创建微缩方块 (尺寸 0.25)
    const geometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    
    // 根据 itemId 决定颜色
    let color = 0xffffff;
    if (colorMap[itemId]) {
      // 支持 16 进制字符串、RGB 数组或 Three.js 颜色
      const c = colorMap[itemId].color || colorMap[itemId];
      color = new THREE.Color(c);
    }

    const material = new THREE.MeshStandardMaterial({ color: color });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(x, y, z);
    this.scene.add(this.mesh);

    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2, // 初始随机散开
      4.0, 
      (Math.random() - 0.5) * 2
    );
    this.isMagnetic = false;
    this.time = Math.random() * Math.PI * 2; // 随机相位
  }

  update(deltaTime, worldManager) {
    this.time += deltaTime * 2;

    // 1. 经典动画：自转 + 漂浮
    this.mesh.rotation.y += deltaTime * 2;
    this.mesh.position.y += Math.sin(this.time) * 0.005;

    // 2. 简单物理 (如果不处于吸附状态)
    if (!this.isMagnetic) {
      this.velocity.y -= 20.0 * deltaTime; // 重力
      
      const nextPos = this.mesh.position.clone().add(this.velocity.clone().multiplyScalar(deltaTime));
      
      // 地面碰撞检测 (简化版)
      const blockX = Math.floor(nextPos.x);
      const blockY = Math.floor(nextPos.y);
      const blockZ = Math.floor(nextPos.z);
      
      const voxel = worldManager.getBlock(blockX, blockY, blockZ);
      if (voxel !== 0 && voxel !== 3) {
        // 碰到方块，停止下落
        this.velocity.set(0, 0, 0);
        this.mesh.position.y = blockY + 1.2; // 稍微悬浮在地面上
      } else {
        this.mesh.position.copy(nextPos);
      }
    }
  }

  remove() {
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) this.mesh.material.dispose();
    this.scene.remove(this.mesh);
  }
}
