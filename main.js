import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { WorldManager } from './WorldManager.js';

// 0. 配置常量
const skyColor = 0x87ceeb; // 天空蓝
const renderDistance = 3;  // 渲染距离 (区块半径)
const chunkSize = 16;      // 区块大小

// 1. 初始化场景 (Init scene)
const scene = new THREE.Scene();
scene.background = new THREE.Color(skyColor);

// 添加线性雾，掩盖远处区块的瞬间消失/出现
const fogFar = renderDistance * chunkSize;
const fogNear = fogFar * 0.7;
scene.fog = new THREE.Fog(skyColor, fogNear, fogFar);

// 2. 初始化透视相机
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
// 设置初始位置在第一个区块正上方
camera.position.set(8, 15, 8);

// 3. 初始化 WebGL 渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('app').appendChild(renderer.domElement);

// 十字准星
const crosshair = document.createElement('div');
crosshair.style.position = 'absolute';
crosshair.style.top = '50%';
crosshair.style.left = '50%';
crosshair.style.width = '20px';
crosshair.style.height = '20px';
crosshair.style.transform = 'translate(-50%, -50%)';
crosshair.style.pointerEvents = 'none';
crosshair.innerHTML = `
  <div style="position: absolute; top: 9px; left: 0; width: 20px; height: 2px; background: white;"></div>
  <div style="position: absolute; top: 0; left: 9px; width: 2px; height: 20px; background: white;"></div>
`;
document.body.appendChild(crosshair);

// 指示界面
const instructions = document.createElement('div');
instructions.style.position = 'absolute';
instructions.style.top = '50%';
instructions.style.width = '100%';
instructions.style.textAlign = 'center';
instructions.style.color = 'white';
instructions.style.cursor = 'pointer';
instructions.style.backgroundColor = 'rgba(0,0,0,0.5)';
instructions.style.padding = '20px 0';
instructions.style.transform = 'translateY(-50%)';
instructions.style.zIndex = '10';
instructions.innerHTML = `
  <span style="font-size: 24px">点击屏幕开始游戏</span><br/><br/>
  W, A, S, D = 移动<br/>
  鼠标移动 = 视角<br/>
  左键点击 = 挖掘<br/>
  右键点击 = 放置
`;
document.body.appendChild(instructions);

// 4. 添加光照
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// 5. 初始化世界管理器 (动态加载)
const worldManager = new WorldManager(scene, 3, 16);
// 初始加载
worldManager.update(camera.position);

// 6. 第一人称控制 (PointerLockControls)
const controls = new PointerLockControls(camera, document.body);

instructions.addEventListener('click', () => {
  controls.lock();
});
controls.addEventListener('lock', () => {
  instructions.style.display = 'none';
});
controls.addEventListener('unlock', () => {
  instructions.style.display = 'block';
});
scene.add(controls.getObject());

// 7. 移动逻辑 (WASD)
const moveState = { forward: false, backward: false, left: false, right: false };
document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': moveState.forward = true; break;
    case 'KeyS': moveState.backward = true; break;
    case 'KeyA': moveState.left = true; break;
    case 'KeyD': moveState.right = true; break;
  }
});
document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': moveState.forward = false; break;
    case 'KeyS': moveState.backward = false; break;
    case 'KeyA': moveState.left = false; break;
    case 'KeyD': moveState.right = false; break;
  }
});

// 8. 射线检测 (挖掘与放置)
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

document.addEventListener('mousedown', (e) => {
  if (!controls.isLocked) return;
  if (e.button !== 0 && e.button !== 2) return;

  raycaster.setFromCamera(center, camera);
  // 获取当前所有已加载区块的 Mesh 数组
  const chunkMeshes = Array.from(worldManager.chunks.values()).map(c => c.mesh);
  const intersects = raycaster.intersectObjects(chunkMeshes);

  if (intersects.length > 0) {
    const intersect = intersects[0];
    const normal = intersect.face.normal.clone();
    
    // 稍微偏移以确定方块内部或外部
    let voxelPos;
    if (e.button === 0) {
      voxelPos = intersect.point.clone().sub(normal.multiplyScalar(0.5));
    } else {
      voxelPos = intersect.point.clone().add(normal.multiplyScalar(0.5));
    }

    if (e.button === 0) {
      worldManager.setVoxel(voxelPos.x, voxelPos.y, voxelPos.z, 0);
    } else {
      worldManager.setVoxel(voxelPos.x, voxelPos.y, voxelPos.z, 2);
    }
  }
});

document.addEventListener('contextmenu', e => e.preventDefault());

// 9. 处理窗口尺寸调整
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 10. 物理与动画循环
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const playerRadius = 0.3;
const playerHeight = 1.8;
const eyeHeight = 1.6;
const gravity = 30.0;
const jumpSpeed = 10.0;
let isGrounded = false;

function checkCollision(pos) {
  const minX = Math.floor(pos.x - playerRadius);
  const maxX = Math.floor(pos.x + playerRadius);
  const minY = Math.floor(pos.y - eyeHeight + 0.01);
  const maxY = Math.floor(pos.y - eyeHeight + playerHeight);
  const minZ = Math.floor(pos.z - playerRadius);
  const maxZ = Math.floor(pos.z + playerRadius);

  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const voxel = worldManager.getVoxel(x, y, z);
        if (voxel !== 0 && voxel !== 3) {
          return true;
        }
      }
    }
  }
  return false;
}

// 增加跳跃按键监听
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && isGrounded && controls.isLocked) {
    velocity.y = jumpSpeed;
    isGrounded = false;
  }
});

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = Math.min((time - prevTime) / 1000, 0.1);

  if (controls.isLocked) {
    // 动态更新世界区块
    worldManager.update(camera.position);

    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.normalize();

    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= gravity * delta;

    const speed = 40.0;
    if (moveState.forward || moveState.backward) velocity.z -= direction.z * speed * delta;
    if (moveState.left || moveState.right) velocity.x -= direction.x * speed * delta;

    const right = new THREE.Vector3();
    right.setFromMatrixColumn(camera.matrix, 0);
    right.y = 0;
    right.normalize();

    const forward = new THREE.Vector3();
    forward.crossVectors(camera.up, right);
    forward.y = 0;
    forward.normalize();

    const deltaPos = new THREE.Vector3();
    deltaPos.addScaledVector(right, -velocity.x * delta);
    deltaPos.addScaledVector(forward, -velocity.z * delta);
    deltaPos.y = velocity.y * delta;

    let hitGround = false;

    // Y轴移动与碰撞
    camera.position.y += deltaPos.y;
    if (checkCollision(camera.position)) {
      if (velocity.y < 0) {
        hitGround = true;
        camera.position.y = Math.floor(camera.position.y - eyeHeight + 1) + eyeHeight;
      } else {
        camera.position.y -= deltaPos.y;
      }
      velocity.y = 0;
    }
    
    if (!hitGround && velocity.y <= 0) {
       const probe = camera.position.clone();
       probe.y -= 0.05;
       if (checkCollision(probe)) {
         hitGround = true;
         velocity.y = 0;
       }
    }
    isGrounded = hitGround;

    // X轴
    camera.position.x += deltaPos.x;
    if (checkCollision(camera.position)) {
      camera.position.x -= deltaPos.x;
      velocity.x = 0;
    }

    // Z轴
    camera.position.z += deltaPos.z;
    if (checkCollision(camera.position)) {
      camera.position.z -= deltaPos.z;
      velocity.z = 0;
    }

    if (camera.position.y < -20) {
      camera.position.set(8, 15, 8);
      velocity.set(0, 0, 0);
    }
  }

  prevTime = time;
  renderer.render(scene, camera);
}

animate();