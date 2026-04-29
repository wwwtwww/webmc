import * as THREE from 'three';

// --- 核心优化：预分配模块级临时变量，规避 GC 压力 (Bug 47) ---
const _tempVec = new THREE.Vector3();

/**
 * ItemDrop.js
 * 掉落物实体：包含旋转、浮动、重力与碰撞逻辑
 */
export class ItemDrop {
  constructor(scene, x, y, z, itemId, amount, colorMap) {
    this.scene = scene;
    this.itemId = itemId;
    this.amount = amount;
    
    // 1. 创建容器 Group (负责物理坐标)
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);
    this.scene.add(this.group);

    // 2. 创建视觉 Mesh (尺寸 0.25, 负责自转与悬浮)
    const geometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    
    // 根据 itemId 决定颜色
    let color = 0xffffff;
    if (colorMap[itemId]) {
      const c = colorMap[itemId].color || colorMap[itemId];
      color = new THREE.Color(c);
    }

    const material = new THREE.MeshStandardMaterial({ color: color });
    this.mesh = new THREE.Mesh(geometry, material);
    this.group.add(this.mesh);

    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      4.0, 
      (Math.random() - 0.5) * 2
    );
    this.isMagnetic = false;
    this.time = Math.random() * Math.PI * 2; // 随机相位
  }

  update(deltaTime, worldManager) {
    this.time += deltaTime * 2;

    // 1. 经典视觉动画 (仅对 Mesh 生效，不影响 Group 物理判定)
    this.mesh.rotation.y += deltaTime * 2;
    this.mesh.position.y = Math.sin(this.time) * 0.1 + 0.1; // 增加 0.1 偏移避免底部穿模

    // 2. 简单物理 (如果不处于吸附状态，操作 Group 坐标)
    if (!this.isMagnetic) {
      this.velocity.y -= 20.0 * deltaTime; // 重力
      
      const deltaPos = _tempVec.copy(this.velocity).multiplyScalar(deltaTime);
      
      // 1. 尝试垂直移动 (Y 轴)
      let nextY = this.group.position.y + deltaPos.y;
      const blockX = Math.floor(this.group.position.x);
      const blockZ = Math.floor(this.group.position.z);
      
      // 核心修复：检测垂直方向碰撞 (Bug 19 & 21)
      if (deltaPos.y < 0) {
        // 落地检测
        const voxelBelow = worldManager.getBlock(blockX, Math.floor(nextY - 0.125), blockZ);
        if (voxelBelow !== 0 && voxelBelow !== 3) {
          this.velocity.y = 0;
          this.velocity.x *= 0.5; // 落地时水平减速
          this.velocity.z *= 0.5;
          // 物理坐标严格贴合方块表面 (方块顶部 + 0.125中心偏移)，视觉高度通过mesh.position.y处理
          this.group.position.y = Math.floor(nextY - 0.125) + 1.125;
        } else {
          this.group.position.y = nextY;
        }
      } else if (deltaPos.y > 0) {
        // 天花板检测 (Bug 21)
        const voxelAbove = worldManager.getBlock(blockX, Math.floor(nextY + 0.125), blockZ);
        if (voxelAbove !== 0 && voxelAbove !== 3) {
          this.velocity.y = 0; // 撞到天花板停止上升
        } else {
          this.group.position.y = nextY;
        }
      } else {
        this.group.position.y = nextY;
      }

      // 2. 尝试水平移动 (X 和 Z 轴)
      // 处理 X 轴
      let nextX = this.group.position.x + deltaPos.x;
      const voxelX = worldManager.getBlock(Math.floor(nextX + (deltaPos.x > 0 ? 0.125 : -0.125)), Math.floor(this.group.position.y), blockZ);
      if (voxelX !== 0 && voxelX !== 3) {
        this.velocity.x = 0;
      } else {
        this.group.position.x = nextX;
      }

      // 处理 Z 轴
      let nextZ = this.group.position.z + deltaPos.z;
      const voxelZ = worldManager.getBlock(Math.floor(this.group.position.x), Math.floor(this.group.position.y), Math.floor(nextZ + (deltaPos.z > 0 ? 0.125 : -0.125)));
      if (voxelZ !== 0 && voxelZ !== 3) {
        this.velocity.z = 0;
      } else {
        this.group.position.z = nextZ;
      }
    }
  }

  remove() {
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) this.mesh.material.dispose();
    this.scene.remove(this.group);
  }
}
