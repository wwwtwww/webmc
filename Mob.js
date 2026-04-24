import * as THREE from 'three';

/**
 * Mob.js
 * 基础生物类 - 包含受击反馈与死亡逻辑
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

    // --- 战斗系统属性 ---
    this.hp = 10;
    this.maxHp = 10;
    this.isDead = false;
    this.originalColor = new THREE.Color(0xffafb0);
    // 每个生物持有独立的材质实例，防止全员闪红
    this.material = new THREE.MeshStandardMaterial({ color: this.originalColor });
    
    // 外部钩子：当生物彻底消失时触发（由 MobManager 移除）
    this.onRemove = null;

    this.initModel();
  }

  initModel() {
    // 简单的长方体身体
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.6, 1.2);
    const body = new THREE.Mesh(bodyGeo, this.material);
    body.position.y = 0.6; 
    this.group.add(body);

    // 头部
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const head = new THREE.Mesh(headGeo, this.material);
    head.position.set(0, 0.8, 0.7);
    this.group.add(head);

    // 鼻子
    const snoutGeo = new THREE.BoxGeometry(0.2, 0.15, 0.1);
    const snoutMat = new THREE.MeshStandardMaterial({ color: 0xff8f90 }); // 鼻子用固定深粉色
    const snout = new THREE.Mesh(snoutGeo, snoutMat);
    snout.position.set(0, 0.75, 0.96);
    this.group.add(snout);
  }

  /**
   * 受击逻辑
   */
  takeDamage(amount) {
    if (this.isDead) return;

    this.hp -= amount;
    
    // 1. 视觉反馈：瞬间闪红
    this.material.color.set(0xff0000);
    
    // 2. 200ms 后恢复颜色
    setTimeout(() => {
      if (!this.isDead) {
        this.material.color.copy(this.originalColor);
      }
    }, 200);

    // 3. 击退效果 (简单地向后方跳一下)
    this.velocity.y = 4.0;

    // 4. 死亡判定
    if (this.hp <= 0) {
      this.die();
    }
  }

  /**
   * 死亡逻辑
   */
  die() {
    this.isDead = true;
    this.hp = 0;
    
    // 视觉反馈：变红并倾倒
    this.material.color.set(0xff0000);
    this.group.rotation.z = Math.PI / 2; // 侧翻 90 度
    this.group.position.y -= 0.3; // 贴地

    // 1 秒后彻底从场景移除
    setTimeout(() => {
      if (this.onRemove) this.onRemove(this.id);
    }, 1000);
  }

  update(delta, worldManager) {
    if (this.isDead) return; // 死亡后停止 AI 和物理

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
    
    const blockX = Math.floor(nextPos.x);
    const blockY = Math.floor(nextPos.y);
    const blockZ = Math.floor(nextPos.z);
    
    const groundVoxel = worldManager.getBlock(blockX, blockY, blockZ);
    const headVoxel = worldManager.getBlock(blockX, blockY + 1, blockZ);

    if (groundVoxel !== 0 && groundVoxel !== 3) {
      this.group.position.y = blockY + 1;
      this.velocity.y = 0;
      
      if (headVoxel !== 0 && headVoxel !== 3) {
        this.velocity.y = 8.0;
      }
    } else {
      this.group.position.y = nextPos.y;
    }

    this.group.position.x = nextPos.x;
    this.group.position.z = nextPos.z;

    if (this.group.position.y < -10) {
      this.group.position.set(16, 100, 16);
    }
  }
}
