import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { WorldManager } from './WorldManager.js';
import { getBiomeAt } from './VoxelWorld.js';
import { AudioManager } from './AudioManager.js';
import { InventoryManager } from './InventoryManager.js';
import { InventoryUI } from './InventoryUI.js';
import { CraftingManager } from './CraftingManager.js';

// 初始化音效管理器
const audioManager = new AudioManager();
audioManager.loadSounds();

// 0. 配置常量
const skyColor = 0xadd8e6; // 更亮的天空蓝
const renderDistance = 6;  // 增加渲染距离到 6，视野更开阔
const chunkSize = 16;      // 区块大小

// --- 数据定义 ---
const blockData = {
  1: { name: '草地', color: '#3dad3d' },
  2: { name: '泥土', color: '#7d542a' },
  3: { name: '水源', color: '#1a66e6' },
  4: { name: '木头', color: '#663300' },
  5: { name: '树叶', color: '#1a801a' },
  6: { name: '沙子', color: '#e6cc80' },
  7: { name: '积雪', color: '#f2f2ff' },
  8: { name: '玻璃', color: '#aaddff' },
  9: { name: '木板', color: '#a67d3d' },
  10: { name: '木棍', color: '#7d5e2a' },
  11: { name: '工作台', color: '#d9a066' }
};

// --- 背包与合成系统初始化 ---
const inventoryManager = new InventoryManager();
const craftingManager = new CraftingManager();
const inventoryUI = new InventoryUI(blockData, craftingManager);
let isInventoryOpen = false;
let isOpeningInventory = false; // 用于区分是 E 键打开还是 ESC 退出

// 初始赠送少量原木用于测试合成
inventoryManager.addItem(4, 16); 

/**
 * 核心交互逻辑：处理背包/合成位点击
 */
inventoryUI.onSlotClick = (index, type) => {
  const targetArray = (type === 'inventory') ? inventoryManager.slots : inventoryUI.craftingSlots;
  
  if (type === 'result') {
    handleResultClick();
    return;
  }

  const clickedItem = targetArray[index];
  const holdingItem = inventoryUI.holdingItem;

  if (!holdingItem && clickedItem) {
    // 1. 拿起 (Pick Up)
    inventoryUI.holdingItem = { ...clickedItem };
    targetArray[index] = null;
  } else if (holdingItem && !clickedItem) {
    // 2. 放下 (Place)
    targetArray[index] = { ...holdingItem };
    inventoryUI.holdingItem = null;
  } else if (holdingItem && clickedItem) {
    if (holdingItem.id === clickedItem.id) {
      // 3. 堆叠 (Stack)
      const canAdd = 64 - clickedItem.count;
      const toAdd = Math.min(canAdd, holdingItem.count);
      clickedItem.count += toAdd;
      holdingItem.count -= toAdd;
      if (holdingItem.count <= 0) inventoryUI.holdingItem = null;
    } else {
      // 4. 交换 (Swap)
      const temp = { ...clickedItem };
      targetArray[index] = { ...holdingItem };
      inventoryUI.holdingItem = temp;
    }
  }

  // 合成联动：如果操作了合成区，更新预览
  if (type === 'craft') {
    inventoryUI.updateCrafting();
  }

  // 刷新 UI
  inventoryUI.render(inventoryManager);
  inventoryUI.updateDragCursor();
  initHotbarUI(); // 同步更新 3D 快捷栏
};

function handleResultClick() {
  if (!inventoryUI.craftingResult) return;
  const result = inventoryUI.craftingResult;
  const holding = inventoryUI.holdingItem;

  if (!holding || (holding.id === result.id && holding.count + result.count <= 64)) {
    if (!holding) {
      inventoryUI.holdingItem = { ...result };
    } else {
      inventoryUI.holdingItem.count += result.count;
    }

    for (let i = 0; i < 4; i++) {
      if (inventoryUI.craftingSlots[i]) {
        inventoryUI.craftingSlots[i].count--;
        if (inventoryUI.craftingSlots[i].count <= 0) inventoryUI.craftingSlots[i] = null;
      }
    }

    inventoryUI.updateCrafting();
    inventoryUI.render(inventoryManager);
    inventoryUI.updateDragCursor();
    initHotbarUI();
  }
}

function toggleInventory() {
  if (!hasSpawned) return;

  if (isInventoryOpen) {
    controls.lock(); // 关闭
  } else {
    isOpeningInventory = true;
    controls.unlock(); // 尝试打开
  }
}

// --- 调试面板逻辑 (F3) ---
let showDebug = false;
const debugPanel = document.getElementById('debug-panel');
const debugFps = document.getElementById('debug-fps');
const debugPos = document.getElementById('debug-pos');
const debugChunk = document.getElementById('debug-chunk');
const debugBiome = document.getElementById('debug-biome');
const debugMode = document.getElementById('debug-mode');

let frameCount = 0;
let lastFpsUpdate = 0;

function updateDebugPanel() {
  if (!showDebug) return;

  // 更新坐标与区块信息
  const pos = camera.position;
  debugPos.innerText = `${pos.x.toFixed(2)} / ${pos.y.toFixed(2)} / ${pos.z.toFixed(2)}`;
  
  const cx = Math.floor(pos.x / chunkSize);
  const cz = Math.floor(pos.z / chunkSize);
  debugChunk.innerText = `${cx}, ${cz}`;

  // 更新群落信息
  debugBiome.innerText = getBiomeAt(pos.x, pos.z);

  // 更新模式信息
  debugMode.innerText = isFlying ? 'GOD MODE (上帝飞行)' : 'SURVIVAL (生存物理)';
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'F3') {
    e.preventDefault();
    showDebug = !showDebug;
    debugPanel.style.display = showDebug ? 'block' : 'none';
  }
});
// -----------------------

// --- 快捷栏逻辑 (优先初始化以确保可见) ---
const hotbarItems = [1, 2, 4, 5, 3, 6, 7, 8, 0]; 
let selectedSlot = 0;

function initHotbarUI() {
  const hotbar = document.getElementById('hotbar');
  if (!hotbar) {
    console.error('找不到 #hotbar 元素');
    return;
  }
  hotbar.innerHTML = ''; 

  hotbarItems.forEach((id, index) => {
    const slot = document.createElement('div');
    slot.className = `slot ${index === selectedSlot ? 'selected' : ''}`;
    slot.dataset.index = index;

    if (id !== 0) {
      const info = blockData[id];
      slot.innerHTML = `
        <div class="cube-icon">
          <div class="face top" style="background-color: ${info.color}"></div>
          <div class="face front" style="background-color: ${info.color}"></div>
          <div class="face right" style="background-color: ${info.color}"></div>
        </div>
        <div class="slot-text">${info.name}</div>
      `;
    }
    hotbar.appendChild(slot);
  });
}

function updateHotbarUI() {
  const slots = document.querySelectorAll('.slot');
  slots.forEach((slot, index) => {
    if (index === selectedSlot) {
      slot.classList.add('selected');
    } else {
      slot.classList.remove('selected');
    }
  });
}

// 立即运行 UI 初始化
initHotbarUI();

window.addEventListener('keydown', (e) => {
  if (e.code.startsWith('Digit')) {
    const num = parseInt(e.code.replace('Digit', '')) - 1;
    if (num >= 0 && num <= 8) {
      selectedSlot = num;
      updateHotbarUI();
    }
  }
});
// ---------------------------------------

// 1. 初始化场景 (Init scene)
const scene = new THREE.Scene();
scene.background = new THREE.Color(skyColor);

// 推远雾气：让视野更清晰
const fogFar = renderDistance * chunkSize * 1.2; // 约 115 单位
const fogNear = fogFar * 0.4;
scene.fog = new THREE.Fog(skyColor, fogNear, fogFar);

// 2. 初始化透视相机
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
// 初始设置一个较高的位置，防止在地形加载前掉落
camera.position.set(16, 120, 16);
camera.lookAt(16, 40, 48);

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
crosshair.style.zIndex = '50';
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
instructions.style.zIndex = '1000'; // 确保在最前面
instructions.innerHTML = `
  <span style="font-size: 24px">点击屏幕开始游戏</span><br/><br/>
  W, A, S, D = 移动<br/>
  鼠标移动 = 视角<br/>
  左键点击 = 挖掘<br/>
  右键点击 = 放置<br/>
  数字键 1-8 = 切换方块<br/>
  F = 切换飞行模式 (GOD MODE)<br/>
  空格/Shift = 飞行升降
`;
document.body.appendChild(instructions);

// 4. 添加光照
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// 5. 初始化世界管理器 (动态加载)
const worldManager = new WorldManager(scene, renderDistance, chunkSize);
worldManager.update(camera.position);

// 6. 第一人称控制 (PointerLockControls)
const controls = new PointerLockControls(camera, document.body);

instructions.addEventListener('click', () => {
  controls.lock();
  audioManager.init(camera);
});
controls.addEventListener('lock', () => {
  instructions.style.display = 'none';
  // 如果当前是开启状态，则尝试关闭
  if (isInventoryOpen) {
    // 尝试回收手持物品
    if (inventoryUI.holdingItem) {
      const added = inventoryManager.addItem(inventoryUI.holdingItem.id, inventoryUI.holdingItem.count);
      if (!added) {
        // 如果背包满了，强制保持背包开启状态，防止物品丢失
        controls.unlock(); 
        console.warn("背包已满，请先处理手持物品！");
        return;
      }
      inventoryUI.holdingItem = null;
      inventoryUI.updateDragCursor();
    }
    isInventoryOpen = false;
    inventoryUI.uiContainer.style.display = 'none';
    initHotbarUI();
  }
});
controls.addEventListener('unlock', () => {
  // 如果是因为按 E 打开背包，则不显示初始菜单
  if (isOpeningInventory) {
    isInventoryOpen = true;
    isOpeningInventory = false;
    inventoryUI.uiContainer.style.display = 'flex';
    inventoryUI.render(inventoryManager);
  } else {
    // 真正的 ESC 退出，显示主菜单
    instructions.style.display = 'block';
  }
});
scene.add(controls.getObject());

// 7. 移动逻辑 (WASD + Flight)
const moveState = { 
  forward: false, 
  backward: false, 
  left: false, 
  right: false,
  up: false,
  down: false
};
let isFlying = false;

document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': moveState.forward = true; break;
    case 'KeyS': moveState.backward = true; break;
    case 'KeyA': moveState.left = true; break;
    case 'KeyD': moveState.right = true; break;
    case 'Space': moveState.up = true; break;
    case 'ShiftLeft': moveState.down = true; break;
    case 'KeyF': 
      if (controls.isLocked) {
        isFlying = !isFlying;
        console.log(`飞行模式: ${isFlying ? '开启' : '关闭'}`);
        velocity.set(0, 0, 0); // 切换模式时重置速度
      }
      break;
    case 'KeyE':
    case 'Tab':
      e.preventDefault(); // 防止 Tab 键切换浏览器焦点
      toggleInventory();
      break;
  }
});
document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': moveState.forward = false; break;
    case 'KeyS': moveState.backward = false; break;
    case 'KeyA': moveState.left = false; break;
    case 'KeyD': moveState.right = false; break;
    case 'Space': moveState.up = false; break;
    case 'ShiftLeft': moveState.down = false; break;
  }
});

// 8. 射线检测 (挖掘与放置)
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const MAX_REACH = 5;

let isMining = false;
let miningProgress = 0;
let targetBlock = null;

const miningProgressContainer = document.getElementById('mining-progress-container');
const miningProgressBar = document.getElementById('mining-progress');

document.addEventListener('mousedown', (e) => {
  if (!controls.isLocked) return;
  if (e.button !== 0 && e.button !== 2) return;

  raycaster.setFromCamera(center, camera);
  const chunkMeshes = Array.from(worldManager.chunks.values()).flatMap(c => [c.opaqueMesh, c.transparentMesh]);
  const intersects = raycaster.intersectObjects(chunkMeshes);

  if (intersects.length > 0) {
    const intersect = intersects[0];
    if (intersect.distance > MAX_REACH) return; // 距离检测：超过 5 格则忽略

    const normal = intersect.face.normal.clone();
    
    let voxelPos;
    if (e.button === 0) {
      voxelPos = intersect.point.clone().sub(normal.multiplyScalar(0.5));
    } else {
      voxelPos = intersect.point.clone().add(normal.multiplyScalar(0.5));
    }

    if (e.button === 0) {
      // 开始挖掘逻辑
      isMining = true;
      miningProgress = 0;
      targetBlock = {
        x: Math.floor(voxelPos.x),
        y: Math.floor(voxelPos.y),
        z: Math.floor(voxelPos.z)
      };
      if (miningProgressContainer) miningProgressContainer.style.display = 'block';
      if (miningProgressBar) miningProgressBar.style.width = '0%';
    } else {
      const blockType = hotbarItems[selectedSlot];
      if (blockType !== 0) {
        worldManager.setBlock(voxelPos.x, voxelPos.y, voxelPos.z, blockType);
        audioManager.playSound('place');
      }
    }
  }
});

document.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    isMining = false;
    miningProgress = 0;
    targetBlock = null;
    if (miningProgressContainer) miningProgressContainer.style.display = 'none';
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
let lastFootstepTime = 0;

function checkCollision(pos) {
  // 飞行模式下禁用碰撞检测 (Noclip)
  if (isFlying) return false;

  const minX = Math.floor(pos.x - playerRadius);
  const maxX = Math.floor(pos.x + playerRadius);
  const minY = Math.floor(pos.y - eyeHeight + 0.01);
  const maxY = Math.floor(pos.y - eyeHeight + playerHeight);
  const minZ = Math.floor(pos.z - playerRadius);
  const maxZ = Math.floor(pos.z + playerRadius);

  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const voxel = worldManager.getBlock(x, y, z);
        if (voxel !== 0 && voxel !== 3) {
          return true;
        }
      }
    }
  }
  return false;
}
let hasSpawned = false;
const spawnX = 16, spawnZ = 16; 

function findSafeSpawn() {
  const currentChunkX = Math.floor(spawnX / chunkSize);
  const currentChunkZ = Math.floor(spawnZ / chunkSize);
  const chunk = worldManager.chunks.get(`${currentChunkX},${currentChunkZ}`);
  
  // 必须确保区块已经生成地形
  if (chunk && chunk.generated) {
    const y = worldManager.getHighestBlock(spawnX, spawnZ);
    if (y !== null) {
      // y 是最高实体方块的高度。玩家的脚应该放在 y + 1 的位置。
      camera.position.set(spawnX, y + 1 + eyeHeight, spawnZ);
      hasSpawned = true;
      console.log(`已找到安全出生点: 实体高度 y=${y}`);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = Math.min((time - prevTime) / 1000, 0.1);

  // 更新 FPS 计算
  frameCount++;
  if (time > lastFpsUpdate + 1000) {
    debugFps.innerText = Math.round((frameCount * 1000) / (time - lastFpsUpdate));
    frameCount = 0;
    lastFpsUpdate = time;
  }

  if (controls.isLocked) {
    // 动态更新世界区块
    worldManager.update(camera.position);

    // 持续挖掘逻辑
    if (isMining && targetBlock) {
      raycaster.setFromCamera(center, camera);
      const chunkMeshes = Array.from(worldManager.chunks.values()).flatMap(c => [c.opaqueMesh, c.transparentMesh]);
      const intersects = raycaster.intersectObjects(chunkMeshes);
      
      let hitSameBlock = false;
      if (intersects.length > 0) {
        const intersect = intersects[0];
        if (intersect.distance <= MAX_REACH) {
          const normal = intersect.face.normal.clone();
          const voxelPos = intersect.point.clone().sub(normal.multiplyScalar(0.5));
          const cx = Math.floor(voxelPos.x);
          const cy = Math.floor(voxelPos.y);
          const cz = Math.floor(voxelPos.z);

          if (cx === targetBlock.x && cy === targetBlock.y && cz === targetBlock.z) {
            hitSameBlock = true;
          }
        }
      }

      if (hitSameBlock) {
        // 增加进度：空手每秒 0.25 (4秒挖完)
        miningProgress += delta * 0.25;
        if (miningProgressBar) {
          miningProgressBar.style.width = `${Math.min(miningProgress * 100, 100)}%`;
        }

        if (miningProgress >= 1.0) {
          // 获取当前挖掘方块的类型，用于存入背包
          const blockId = worldManager.getBlock(targetBlock.x, targetBlock.y, targetBlock.z);
          if (blockId !== 0) {
            const added = inventoryManager.addItem(blockId, 1);
            if (!added) {
              console.warn("背包已满，无法挖掘该方块！");
              // 如果背包满了，停止挖掘且不破坏方块
              isMining = false;
              miningProgress = 0;
              targetBlock = null;
              if (miningProgressContainer) miningProgressContainer.style.display = 'none';
              return;
            }
            inventoryUI.render(inventoryManager);
            initHotbarUI(); // 同步更新 3D 快捷栏
          }

          worldManager.setBlock(targetBlock.x, targetBlock.y, targetBlock.z, 0);
          audioManager.playSound('dig');
          
          // 重置状态
          isMining = false;
          miningProgress = 0;
          targetBlock = null;
          if (miningProgressContainer) miningProgressContainer.style.display = 'none';
        }
      } else {
        // 如果玩家转头或超出距离，重置进度
        miningProgress = 0;
        if (miningProgressBar) miningProgressBar.style.width = '0%';
      }
    }

    // 1. 安全出生点查找逻辑
    if (!hasSpawned && !isFlying) {
      findSafeSpawn();
      // 在找到出生点前，强行将重力速度归零，实现“悬浮加载”
      velocity.y = 0;
    }

    // 检查玩家当前所在区块是否已经加载并生成地形
    const currentChunkX = Math.floor(camera.position.x / chunkSize);
    const currentChunkZ = Math.floor(camera.position.z / chunkSize);
    const currentChunk = worldManager.chunks.get(`${currentChunkX},${currentChunkZ}`);
    const isReady = currentChunk && currentChunk.generated;

    // 更新调试面板信息
    updateDebugPanel();

    // 计算移动方向
    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.y = Number(moveState.up) - Number(moveState.down);
    direction.normalize();

    // 物理参数
    const speed = isFlying ? 80.0 : 40.0; // 飞行速度更快
    const friction = 10.0;

    // 水平与垂直速度处理
    velocity.x -= velocity.x * friction * delta;
    velocity.z -= velocity.z * friction * delta;
    
    if (isFlying) {
      velocity.y -= velocity.y * friction * delta;
      if (moveState.up || moveState.down) velocity.y += direction.y * speed * delta;
    } else {
      // 只有当地形就绪时才应用重力
      if (isReady) {
        velocity.y -= gravity * delta;
      } else {
        velocity.y = 0; // 悬浮等待
      }
      
      // 普通模式跳跃逻辑
      if (moveState.up && isGrounded) {
        velocity.y = jumpSpeed;
        isGrounded = false;
      }
    }

    if (moveState.forward || moveState.backward) velocity.z -= direction.z * speed * delta;
    if (moveState.left || moveState.right) velocity.x -= direction.x * speed * delta;

    // 计算世界坐标系位移
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

    // Y轴位移与碰撞
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
    
    // 地面贴合检测 (非飞行模式)
    if (!isFlying && !hitGround && velocity.y <= 0) {
       const probe = camera.position.clone();
       probe.y -= 0.05;
       if (checkCollision(probe)) {
         hitGround = true;
         velocity.y = 0;
       }
    }
    isGrounded = hitGround;

    // X轴位移与碰撞
    camera.position.x += deltaPos.x;
    if (checkCollision(camera.position)) {
      camera.position.x -= deltaPos.x;
      velocity.x = 0;
    }

    // Z轴位移与碰撞
    camera.position.z += deltaPos.z;
    if (checkCollision(camera.position)) {
      camera.position.z -= deltaPos.z;
      velocity.z = 0;
    }

    // 虚空重置 (仅在非飞行模式)
    if (!isFlying && camera.position.y < -20) {
      camera.position.set(8, 100, 8);
      velocity.set(0, 0, 0);
    }

    // 脚步声逻辑
    if (isGrounded && !isFlying) {
      // 判断是否有显著的水平移动 (速度平方)
      const speedSq = velocity.x * velocity.x + velocity.z * velocity.z;
      if (speedSq > 1.0) { 
        if (time - lastFootstepTime > 400) { // 每隔 400ms 触发一次
          audioManager.playSound('footstep', 0.3); // 调低脚步声音量
          lastFootstepTime = time;
        }
      }
    }
  }

  prevTime = time;
  renderer.render(scene, camera);
}

animate();