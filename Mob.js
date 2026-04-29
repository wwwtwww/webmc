import * as THREE from 'three';
import { Pathfinder } from './Pathfinder.js';

// --- 核心优化：预分配模块级临时变量，规避 GC 压力 (Bug 47) ---
const _tempVec = new THREE.Vector3();
const _tempForward = new THREE.Vector3(0, 0, 1);
const _tempUp = new THREE.Vector3(0, 1, 0);
const _tempPos = new THREE.Vector3();

/**
 * Mob.js
 * 基础生物类 - 包含受击反馈与死亡逻辑
 */
export class Mob {
  constructor(id, type, position) {
    this.id = id;
    this.type = type; // 'pig', 'zombie'
    this.group = new THREE.Group();
    this.group.position.copy(position);

    this.velocity = new THREE.Vector3();
    this.rotation = 0;
    
    // AI 状态
    this.state = 'idle'; // 'idle', 'walking', 'chasing'
    this.stateTimer = 0;
    this.targetRotation = 0;
    this.path = [];
    this.pathUpdateTimer = 0;

    // --- 属性配置 ---
    if (type === 'zombie') {
      this.hp = 20;
      this.maxHp = 20;
      this.moveSpeed = 3.5;
      // 核心修复: 改用更亮/更明显的绿色，防止在夜间的阴影中彻底隐形
      this.originalColor = new THREE.Color(0x4caf50); 
      this.snoutColor = new THREE.Color(0x388e3c);
    } else {
      this.hp = 10;
      this.maxHp = 10;
      this.moveSpeed = 2.0;
      this.originalColor = new THREE.Color(0xffafb0);
      this.snoutColor = new THREE.Color(0xff8f90);
    }

    this.isDead = false;
    // 每个生物持有独立的材质实例，防止全员闪红
    this.material = new THREE.MeshStandardMaterial({ color: this.originalColor });
    this.snoutMaterial = new THREE.MeshStandardMaterial({ color: this.snoutColor });
    
    // 外部钩子：当生物彻底消失时触发（由 MobManager 移除）
    this.onRemove = null;
    this.onDie = null;

    this.initModel();
  }

  initModel() {
    if (this.type === 'zombie') {
      // 人形外观 (Zombie)
      // 身体
      const bodyGeo = new THREE.BoxGeometry(0.5, 0.75, 0.25);
      const body = new THREE.Mesh(bodyGeo, this.material);
      body.position.y = 1.125; 
      this.group.add(body);

      // 头部
      const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const head = new THREE.Mesh(headGeo, this.material);
      head.position.set(0, 1.75, 0);
      
      // 添加僵尸眼睛，明确标示正面朝向 (+Z 方向)
      const eyeGeo = new THREE.BoxGeometry(0.3, 0.1, 0.05);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const eyes = new THREE.Mesh(eyeGeo, eyeMat);
      eyes.position.set(0, 0.05, 0.26);
      head.add(eyes);
      
      this.group.add(head);

      // 四肢的动画锚点
      this.leftArm = new THREE.Group();
      this.leftArm.position.set(0.35, 1.5, 0);
      const armGeo = new THREE.BoxGeometry(0.2, 0.75, 0.2);
      const lArmMesh = new THREE.Mesh(armGeo, this.material);
      lArmMesh.position.y = -0.375; // 锚点在肩膀，Mesh 往下偏
      this.leftArm.add(lArmMesh);
      // 僵尸手臂默认前伸 (向 +Z 方向，使用 -Math.PI/2)
      this.leftArm.rotation.x = -Math.PI / 2;
      this.group.add(this.leftArm);

      this.rightArm = new THREE.Group();
      this.rightArm.position.set(-0.35, 1.5, 0);
      const rArmMesh = new THREE.Mesh(armGeo, this.material);
      rArmMesh.position.y = -0.375;
      this.rightArm.add(rArmMesh);
      this.rightArm.rotation.x = -Math.PI / 2;
      this.group.add(this.rightArm);

      this.leftLeg = new THREE.Group();
      this.leftLeg.position.set(0.15, 0.75, 0);
      const legGeo = new THREE.BoxGeometry(0.2, 0.75, 0.2);
      const lLegMesh = new THREE.Mesh(legGeo, this.material);
      lLegMesh.position.y = -0.375;
      this.leftLeg.add(lLegMesh);
      this.group.add(this.leftLeg);

      this.rightLeg = new THREE.Group();
      this.rightLeg.position.set(-0.15, 0.75, 0);
      const rLegMesh = new THREE.Mesh(legGeo, this.material);
      rLegMesh.position.y = -0.375;
      this.rightLeg.add(rLegMesh);
      this.group.add(this.rightLeg);

      this.walkAnimTime = 0;
    } else {
      // 简单的长方体身体 (猪)
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
      const snout = new THREE.Mesh(snoutGeo, this.snoutMaterial);
      snout.position.set(0, 0.75, 0.96);
      this.group.add(snout);
    }
  }

  /**
   * 受击逻辑
   */
  takeDamage(amount, attackerPos = null) {
    if (this.isDead) return;

    this.hp -= amount;
    
    // 1. 视觉反馈：瞬间闪红
    this.material.color.set(0xff0000);
    this.snoutMaterial.color.set(0xff0000);
    
    // 2. 200ms 后恢复颜色
    setTimeout(() => {
      if (!this.isDead) {
        this.material.color.copy(this.originalColor);
        this.snoutMaterial.color.copy(this.snoutColor);
      }
    }, 200);

    // 3. 击退效果
    this.velocity.y = 5.0;
    if (attackerPos) {
      const dx = this.group.position.x - attackerPos.x;
      const dz = this.group.position.z - attackerPos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist > 0.01) {
        this.velocity.x = (dx / dist) * 8.0;
        this.velocity.z = (dz / dist) * 8.0;
      }
    } else {
      const backward = _tempVec.copy(_tempForward).negate().applyAxisAngle(_tempUp, this.rotation);
      this.velocity.x = backward.x * 5.0;
      this.velocity.z = backward.z * 5.0;
    }
    this.knockbackTimer = 0.4;

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
    
    // 触发死亡钩子 (用于掉落物生成)
    if (this.onDie) this.onDie(this.group.position.x, this.group.position.y, this.group.position.z);

    // 视觉反馈：变红并倾倒
    this.material.color.set(0xff0000);
    this.snoutMaterial.color.set(0xff0000);
    this.group.rotation.z = Math.PI / 2; // 侧翻 90 度
    this.group.position.y -= 0.3; // 贴地

    // 1 秒后彻底从场景移除
    setTimeout(() => {
      if (this.onRemove) this.onRemove(this.id);
    }, 1000);
  }

  update(delta, worldManager, playerPos) {
    if (!this.isDead) {
      let isChasing = false;

      // 僵尸追踪 AI
      if (this.type === 'zombie' && playerPos) {
        this.pathUpdateTimer -= delta;
        const distToPlayer = this.group.position.distanceTo(playerPos);

        if (distToPlayer < 15) {
          if (this.pathUpdateTimer <= 0) {
            this.path = Pathfinder.findPath(this.group.position, playerPos, worldManager) || [];
            this.pathUpdateTimer = 1.0;
          }

          if (this.path.length > 0) {
            isChasing = true;
            this.state = 'chasing';
            this.moveSpeed = 3.5;

            let nextNode = this.path[0];
            // 目标点在方块中心
            let targetX = nextNode.x + 0.5;
            let targetZ = nextNode.z + 0.5;
            
            const distToNode = Math.sqrt(
              Math.pow(targetX - this.group.position.x, 2) +
              Math.pow(targetZ - this.group.position.z, 2)
            );

            if (distToNode < 0.5) {
              this.path.shift();
              if (this.path.length > 0) {
                nextNode = this.path[0];
                targetX = nextNode.x + 0.5;
                targetZ = nextNode.z + 0.5;
              }
            }
            
            this.targetRotation = Math.atan2(targetX - this.group.position.x, targetZ - this.group.position.z);
          }
        }
      }

      if (!isChasing) {
        if (this.type === 'zombie') this.moveSpeed = 2.0;
        else this.moveSpeed = 2.0;

        this.stateTimer -= delta;
        if (this.stateTimer <= 0) {
          if (this.state === 'idle' || this.state === 'chasing') {
            this.state = 'walking';
            this.stateTimer = 2 + Math.random() * 3;
            this.targetRotation = Math.random() * Math.PI * 2;
          } else {
            this.state = 'idle';
            this.stateTimer = 1 + Math.random() * 2;
          }
        }
      }

      let angleDiff = this.targetRotation - this.rotation;
      // 核心修复：弧度环绕补正，确保选择最短旋转路径 (Bug 31)
      angleDiff = ((angleDiff + Math.PI) % (Math.PI * 2) + (Math.PI * 2)) % (Math.PI * 2) - Math.PI;
      
      // 显著提高旋转速度 (从 2 提高到 10)，确保僵尸能快速转身面向玩家
      this.rotation += angleDiff * delta * 10;
      this.group.rotation.y = this.rotation;

      if (this.knockbackTimer > 0) {
        this.knockbackTimer -= delta;
        // 击退期间阻尼衰减水平速度，不应用 AI 的移动
        this.velocity.x -= this.velocity.x * 5.0 * delta;
        this.velocity.z -= this.velocity.z * 5.0 * delta;
        
        // 击退期间保持腿部静止
        if (this.type === 'zombie' && this.leftLeg) {
          this.leftLeg.rotation.x = 0;
          this.rightLeg.rotation.x = 0;
        }
      } else if (this.state === 'walking' || this.state === 'chasing') {
        const forward = _tempVec.copy(_tempForward).applyAxisAngle(_tempUp, this.rotation);
        this.velocity.x = forward.x * this.moveSpeed;
        this.velocity.z = forward.z * this.moveSpeed;

        if (this.type === 'zombie' && this.leftLeg) {
          this.walkAnimTime = (this.walkAnimTime || 0) + delta * this.moveSpeed * 2.5;
          this.leftLeg.rotation.x = Math.sin(this.walkAnimTime) * 0.8;
          this.rightLeg.rotation.x = Math.sin(this.walkAnimTime + Math.PI) * 0.8;
          this.leftArm.rotation.x = -Math.PI / 2 + Math.sin(this.walkAnimTime) * 0.1;
          this.rightArm.rotation.x = -Math.PI / 2 + Math.sin(this.walkAnimTime + Math.PI) * 0.1;
        }
      } else {
        this.velocity.x = 0;
        this.velocity.z = 0;

        if (this.type === 'zombie' && this.leftLeg) {
          this.leftLeg.rotation.x = 0;
          this.rightLeg.rotation.x = 0;
          this.leftArm.rotation.x = -Math.PI / 2;
          this.rightArm.rotation.x = -Math.PI / 2;
        }
      }
    } else {
      // 死亡后停止水平移动
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // 物理始终运行 (重力)
    this.velocity.y -= 30.0 * delta;

    const deltaPos = _tempVec.copy(this.velocity).multiplyScalar(delta);
    
    // --- 核心修复：基于 AABB 的生物碰撞系统 ---
    const radius = 0.35;
    const height = this.type === 'zombie' ? 1.8 : 0.8;
    
    // Y 轴移动与碰撞
    this.group.position.y += deltaPos.y;
    if (this.checkCollision(this.group.position, worldManager, radius, height)) {
      if (this.velocity.y < 0) {
        // 落地
        this.group.position.y = Math.floor(this.group.position.y) + 1;
        this.velocity.y = 0;
        
        // 自动跳跃避障逻辑
        if (this.state === 'walking' || this.state === 'chasing') {
          const probePos = _tempPos.copy(this.group.position);
          const forward = _tempVec.copy(_tempForward).applyAxisAngle(_tempUp, this.rotation);
          probePos.add(forward.multiplyScalar(radius + 0.1));
          if (this.checkCollision(probePos, worldManager, radius, height)) {
            this.velocity.y = 8.0;
          }
        }
      } else {
        this.group.position.y -= deltaPos.y;
        this.velocity.y = 0;
      }
    }

    // X 轴移动
    this.group.position.x += deltaPos.x;
    if (this.checkCollision(this.group.position, worldManager, radius, height)) {
      this.group.position.x -= deltaPos.x;
    }

    // Z 轴移动
    this.group.position.z += deltaPos.z;
    if (this.checkCollision(this.group.position, worldManager, radius, height)) {
      this.group.position.z -= deltaPos.z;
    }

    if (this.group.position.y < -10) {
      this.group.position.set(16, 100, 16);
    }
  }

  checkCollision(pos, worldManager, radius, height) {
    const minX = Math.floor(pos.x - radius), maxX = Math.floor(pos.x + radius);
    // 使用 0.05 的偏移量防止在站在方块顶部时误判为内部碰撞
    const minY = Math.floor(pos.y + 0.05), maxY = Math.floor(pos.y + height);
    const minZ = Math.floor(pos.z - radius), maxZ = Math.floor(pos.z + radius);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          const voxel = worldManager.getBlock(x, y, z);
          if (voxel !== 0 && voxel !== 3) return true;
        }
      }
    }
    return false;
  }

  dispose() {
    this.group.traverse(child => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }
}
