import * as THREE from 'three';

/**
 * Mob.js
 * 基础生物类
 */
export class Mob {
  constructor(id, type, position) {
    this.id = id;
    this.type = type; // 'pig'
    this.group = new THREE.Group();
    this.group.position.copy(position);

    this.velocity = new THREE.Vector3();
    this.rotation = 0;
    
    // AI 状态
    this.state = 'idle'; // 'idle', 'walking'
    this.stateTimer = 0;
    this.targetRotation = 0;
    this.moveSpeed = 2.0;

    this.initModel();
  }

  initModel() {
    // 简单的长方体身体 (粉色)
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.6, 1.2);
    const pigMat = new THREE.MeshStandardMaterial({ color: 0xffafb0 });
    const body = new THREE.Mesh(bodyGeo, pigMat);
    body.position.y = 0.6; // 离地高度
    this.group.add(body);

    // 头部
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const head = new THREE.Mesh(headGeo, pigMat);
    head.position.set(0, 0.8, 0.7);
    this.group.add(head);

    // 鼻子
    const snoutGeo = new THREE.BoxGeometry(0.2, 0.15, 0.1);
    const snoutMat = new THREE.MeshStandardMaterial({ color: 0xff8f90 });
    const snout = new THREE.Mesh(snoutGeo, snoutMat);
    snout.position.set(0, 0.75, 0.96);
    this.group.add(snout);
  }

  update(delta, worldManager) {
    this.stateTimer -= delta;

    if (this.stateTimer <= 0) {
      // 随机切换状态
      if (this.state === 'idle') {
        this.state = 'walking';
        this.stateTimer = 2 + Math.random() * 3;
        this.targetRotation = Math.random() * Math.PI * 2;
      } else {
        this.state = 'idle';
        this.stateTimer = 1 + Math.random() * 2;
      }
    }

    // 转向逻辑
    const angleDiff = this.targetRotation - this.rotation;
    this.rotation += angleDiff * delta * 2;
    this.group.rotation.y = this.rotation;

    if (this.state === 'walking') {
      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);
      this.velocity.x = forward.x * this.moveSpeed;
      this.velocity.z = forward.z * this.moveSpeed;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // 重力
    this.velocity.y -= 30.0 * delta;

    // 物理移动与简单的碰撞检查
    const nextPos = this.group.position.clone().add(this.velocity.clone().multiplyScalar(delta));
    
    // 检查脚下是否有方块
    const blockX = Math.floor(nextPos.x);
    const blockY = Math.floor(nextPos.y);
    const blockZ = Math.floor(nextPos.z);
    
    const groundVoxel = worldManager.getBlock(blockX, blockY, blockZ);
    const headVoxel = worldManager.getBlock(blockX, blockY + 1, blockZ);

    if (groundVoxel !== 0 && groundVoxel !== 3) {
      // 落地
      this.group.position.y = blockY + 1;
      this.velocity.y = 0;
      
      // 如果前方有墙，尝试跳跃
      if (headVoxel !== 0 && headVoxel !== 3) {
        this.velocity.y = 8.0;
      }
    } else {
      this.group.position.y = nextPos.y;
    }

    this.group.position.x = nextPos.x;
    this.group.position.z = nextPos.z;

    // 边界检查：掉落虚空重置
    if (this.group.position.y < -10) {
      this.group.position.set(16, 100, 16);
    }
  }
}
