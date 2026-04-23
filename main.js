import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { WorldManager } from './WorldManager.js';
import { getBiomeAt } from './VoxelWorld.js';
import { AudioManager } from './AudioManager.js';
import { InventoryManager } from './InventoryManager.js';
import { InventoryUI } from './InventoryUI.js';
import { CraftingManager } from './CraftingManager.js';
import { SkyManager } from './SkyManager.js';
import { CommandParser } from './CommandParser.js';

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
let isOpeningInventory = false; 

// --- 场景组件：天空与灯光管理器 ---
let skyManager; 
let commandParser;

// --- 开发者控制台逻辑 ---
let isConsoleOpen = false;
let isOpeningConsole = false; 
const consoleUI = document.getElementById('console-ui');
const consoleInput = document.getElementById('console-input');
const consoleLog = document.getElementById('console-log');

function addConsoleMsg(text, color = '#fff') {
  if (!consoleLog) return;
  const msg = document.createElement('div');
  msg.innerText = text;
  msg.style.color = color;
  consoleLog.appendChild(msg);
  // 保持滚动到底部
  consoleLog.scrollTop = consoleLog.scrollHeight;
  // 限制消息条数
  while (consoleLog.children.length > 50) {
    consoleLog.removeChild(consoleLog.firstChild);
  }
}

function toggleConsole() {
  if (!hasSpawned) return;

  if (isConsoleOpen) {
    controls.lock(); 
  } else {
    isOpeningConsole = true;
    controls.unlock(); 
  }
}

consoleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const input = consoleInput.value;
    if (input && commandParser) {
      addConsoleMsg(`> ${input}`, '#00ffcc');
      const response = commandParser.parse(input);
      addConsoleMsg(response);
    }
    toggleConsole();
  } else if (e.key === 'Escape') {
    toggleConsole();
  }
});
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
  if (!hasSpawned || isConsoleOpen) return; 

  if (isInventoryOpen) {
    controls.lock(); 
  } else {
    isOpeningInventory = true;
    controls.unlock(); 
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

  const pos = camera.position;
  debugPos.innerText = `${pos.x.toFixed(2)} / ${pos.y.toFixed(2)} / ${pos.z.toFixed(2)}`;
  
  const cx = Math.floor(pos.x / chunkSize);
  const cz = Math.floor(pos.z / chunkSize);
  debugChunk.innerText = `${cx}, ${cz}`;
  debugBiome.innerText = getBiomeAt(pos.x, pos.z);
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

// --- 快捷栏逻辑 ---
const hotbarItems = [1, 2, 4, 5, 3, 6, 7, 8, 0]; 
let selectedSlot = 0;

function initHotbarUI() {
  const hotbar = document.getElementById('hotbar');
  if (!hotbar) return;
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

// 1. 初始化场景
const scene = new THREE.Scene();
scene.background = new THREE.Color(skyColor);
const fogFar = renderDistance * chunkSize * 1.2;
const fogNear = fogFar * 0.4;
scene.fog = new THREE.Fog(skyColor, fogNear, fogFar);

// 2. 初始化透视相机
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
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
instructions.style.zIndex = '1000';
instructions.innerHTML = `
  <span style="font-size: 24px">点击屏幕开始游戏</span><br/><br/>
  W, A, S, D = 移动 | T = 指令<br/>
  鼠标移动 = 视角 | E = 背包<br/>
  左键长按 = 挖掘 | 右键 = 放置<br/>
  数字键 1-8 = 切换方块 | F = 飞行模式
`;
document.body.appendChild(instructions);

// 4. 添加光照
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// 初始化天空管理器与指令解析器
skyManager = new SkyManager(scene, ambientLight, directionalLight);
commandParser = new CommandParser({
  inventoryManager, skyManager, camera,
  onUpdateUI: () => { inventoryUI.render(inventoryManager); initHotbarUI(); }
});

// 5. 初始化世界管理器
const worldManager = new WorldManager(scene, renderDistance, chunkSize);
worldManager.update(camera.position);

// 6. 第一人称控制
const controls = new PointerLockControls(camera, document.body);
instructions.addEventListener('click', () => { controls.lock(); audioManager.init(camera); });

controls.addEventListener('lock', () => {
  instructions.style.display = 'none';
  if (isInventoryOpen) {
    if (inventoryUI.holdingItem) {
      const added = inventoryManager.addItem(inventoryUI.holdingItem.id, inventoryUI.holdingItem.count);
      if (!added) { controls.unlock(); return; }
      inventoryUI.holdingItem = null;
      inventoryUI.updateDragCursor();
    }
    isInventoryOpen = false;
    inventoryUI.uiContainer.style.display = 'none';
    initHotbarUI();
  }
  if (isConsoleOpen) {
    isConsoleOpen = false;
    consoleUI.style.display = 'none';
    consoleInput.value = '';
  }
});

controls.addEventListener('unlock', () => {
  if (isOpeningInventory) {
    isInventoryOpen = true;
    isOpeningInventory = false;
    inventoryUI.uiContainer.style.display = 'flex';
    inventoryUI.render(inventoryManager);
  } else if (isOpeningConsole) {
    isConsoleOpen = true;
    isOpeningConsole = false;
    consoleUI.style.display = 'block';
    setTimeout(() => consoleInput.focus(), 10);
  } else {
    instructions.style.display = 'block';
  }
});
scene.add(controls.getObject());

// 7. 移动逻辑
const moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };
let isFlying = false;

document.addEventListener('keydown', (e) => {
  if (isConsoleOpen && e.code !== 'Escape' && e.code !== 'Enter') return;
  switch (e.code) {
    case 'KeyW': moveState.forward = true; break;
    case 'KeyS': moveState.backward = true; break;
    case 'KeyA': moveState.left = true; break;
    case 'KeyD': moveState.right = true; break;
    case 'Space': moveState.up = true; break;
    case 'ShiftLeft': moveState.down = true; break;
    case 'KeyF': if (controls.isLocked) { isFlying = !isFlying; velocity.set(0, 0, 0); } break;
    case 'KeyE': case 'Tab': e.preventDefault(); toggleInventory(); break;
    case 'KeyT': case 'Backquote': e.preventDefault(); toggleConsole(); break;
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

// 8. 射线检测
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const MAX_REACH = 5;
let isMining = false, miningProgress = 0, targetBlock = null;
const miningProgressContainer = document.getElementById('mining-progress-container');
const miningProgressBar = document.getElementById('mining-progress');

document.addEventListener('mousedown', (e) => {
  if (!controls.isLocked) return;
  raycaster.setFromCamera(center, camera);
  const chunkMeshes = Array.from(worldManager.chunks.values()).flatMap(c => [c.opaqueMesh, c.transparentMesh]);
  const intersects = raycaster.intersectObjects(chunkMeshes);
  if (intersects.length > 0) {
    const intersect = intersects[0];
    if (intersect.distance > MAX_REACH) return;
    const normal = intersect.face.normal.clone();
    let voxelPos = e.button === 0 ? intersect.point.clone().sub(normal.multiplyScalar(0.5)) : intersect.point.clone().add(normal.multiplyScalar(0.5));
    if (e.button === 0) {
      isMining = true; miningProgress = 0;
      targetBlock = { x: Math.floor(voxelPos.x), y: Math.floor(voxelPos.y), z: Math.floor(voxelPos.z) };
      if (miningProgressContainer) miningProgressContainer.style.display = 'block';
    } else {
      const blockType = hotbarItems[selectedSlot];
      if (blockType !== 0) { worldManager.setBlock(voxelPos.x, voxelPos.y, voxelPos.z, blockType); audioManager.playSound('place'); }
    }
  }
});
document.addEventListener('mouseup', (e) => { if (e.button === 0) { isMining = false; miningProgress = 0; targetBlock = null; if (miningProgressContainer) miningProgressContainer.style.display = 'none'; } });
document.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

// 10. 物理与动画循环
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const playerRadius = 0.3, playerHeight = 1.8, eyeHeight = 1.6, gravity = 30.0, jumpSpeed = 10.0;
let isGrounded = false, lastFootstepTime = 0, hasSpawned = false;
const spawnX = 16, spawnZ = 16; 

function checkCollision(pos) {
  if (isFlying) return false;
  const minX = Math.floor(pos.x - playerRadius), maxX = Math.floor(pos.x + playerRadius);
  const minY = Math.floor(pos.y - eyeHeight + 0.01), maxY = Math.floor(pos.y - eyeHeight + playerHeight);
  const minZ = Math.floor(pos.z - playerRadius), maxZ = Math.floor(pos.z + playerRadius);
  for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
    const voxel = worldManager.getBlock(x, y, z);
    if (voxel !== 0 && voxel !== 3) return true;
  }
  return false;
}

function findSafeSpawn() {
  const currentChunkX = Math.floor(spawnX / chunkSize), currentChunkZ = Math.floor(spawnZ / chunkSize);
  const chunk = worldManager.chunks.get(`${currentChunkX},${currentChunkZ}`);
  if (chunk && chunk.generated) {
    const y = worldManager.getHighestBlock(spawnX, spawnZ);
    if (y !== null) { camera.position.set(spawnX, y + 1 + eyeHeight, spawnZ); hasSpawned = true; }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const time = performance.now(), delta = Math.min((time - prevTime) / 1000, 0.1);
  
  // 始终更新世界加载与环境光影，无论是否锁定鼠标
  worldManager.update(camera.position);
  if (skyManager) skyManager.update(delta);

  if (controls.isLocked) {
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
          if (Math.floor(voxelPos.x) === targetBlock.x && Math.floor(voxelPos.y) === targetBlock.y && Math.floor(voxelPos.z) === targetBlock.z) hitSameBlock = true;
        }
      }
      if (hitSameBlock) {
        miningProgress += delta * 0.25;
        if (miningProgressBar) miningProgressBar.style.width = `${Math.min(miningProgress * 100, 100)}%`;
        if (miningProgress >= 1.0) {
          const blockId = worldManager.getBlock(targetBlock.x, targetBlock.y, targetBlock.z);
          if (blockId !== 0) {
            if (!inventoryManager.addItem(blockId, 1)) { controls.unlock(); return; }
            inventoryUI.render(inventoryManager); initHotbarUI();
          }
          worldManager.setBlock(targetBlock.x, targetBlock.y, targetBlock.z, 0); audioManager.playSound('dig');
          isMining = false; miningProgress = 0; targetBlock = null; if (miningProgressContainer) miningProgressContainer.style.display = 'none';
        }
      } else { miningProgress = 0; if (miningProgressBar) miningProgressBar.style.width = '0%'; }
    }
    if (!hasSpawned && !isFlying) { findSafeSpawn(); velocity.y = 0; }
    const isReady = worldManager.chunks.get(`${Math.floor(camera.position.x/chunkSize)},${Math.floor(camera.position.z/chunkSize)}`)?.generated;
    updateDebugPanel();
    const speed = isFlying ? 80.0 : 40.0, friction = 10.0;
    velocity.x -= velocity.x * friction * delta; velocity.z -= velocity.z * friction * delta;
    if (isFlying) { velocity.y -= velocity.y * friction * delta; if (moveState.up || moveState.down) velocity.y += (Number(moveState.up)-Number(moveState.down)) * speed * delta; }
    else { if (isReady) velocity.y -= gravity * delta; else velocity.y = 0; if (moveState.up && isGrounded) { velocity.y = jumpSpeed; isGrounded = false; } }
    if (moveState.forward || moveState.backward) velocity.z -= (Number(moveState.forward)-Number(moveState.backward)) * speed * delta;
    if (moveState.left || moveState.right) velocity.x -= (Number(moveState.right)-Number(moveState.left)) * speed * delta;
    const right = new THREE.Vector3(); right.setFromMatrixColumn(camera.matrix, 0); right.y = 0; right.normalize();
    const forward = new THREE.Vector3(); forward.crossVectors(camera.up, right); forward.y = 0; forward.normalize();
    const deltaPos = new THREE.Vector3().addScaledVector(right, -velocity.x * delta).addScaledVector(forward, -velocity.z * delta);
    deltaPos.y = velocity.y * delta;
    let hitGround = false;
    camera.position.y += deltaPos.y;
    if (checkCollision(camera.position)) { if (velocity.y < 0) { hitGround = true; camera.position.y = Math.floor(camera.position.y - eyeHeight + 1) + eyeHeight; } else camera.position.y -= deltaPos.y; velocity.y = 0; }
    if (!isFlying && !hitGround && velocity.y <= 0) { const probe = camera.position.clone(); probe.y -= 0.05; if (checkCollision(probe)) { hitGround = true; velocity.y = 0; } }
    isGrounded = hitGround;
    camera.position.x += deltaPos.x; if (checkCollision(camera.position)) { camera.position.x -= deltaPos.x; velocity.x = 0; }
    camera.position.z += deltaPos.z; if (checkCollision(camera.position)) { camera.position.z -= deltaPos.z; velocity.z = 0; }
    if (!isFlying && camera.position.y < -20) { camera.position.set(8, 100, 8); velocity.set(0, 0, 0); }
    if (isGrounded && !isFlying && (velocity.x*velocity.x + velocity.z*velocity.z) > 1.0 && time - lastFootstepTime > 400) { audioManager.playSound('footstep', 0.3); lastFootstepTime = time; }
  }
  prevTime = time; renderer.render(scene, camera);
}
animate();
