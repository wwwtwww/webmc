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
import { MobManager } from './MobManager.js';
import { ItemDropManager } from './ItemDropManager.js';
import { initHelpOverlay } from './HelpOverlay.js';
import { initHUD, updateHUDHealth } from './PlayerHUD.js';

// 初始化音效管理器
const audioManager = new AudioManager();
audioManager.loadSounds();

// 0. 配置常量
const skyColor = 0xadd8e6; // 更亮的天空蓝
const renderDistance = 6;  // 增加渲染距离到 6，视野更开阔
const chunkSize = 16;      // 区块大小

// --- 数据定义 ---
const blockData = {
  1: { name: '草地', color: '#3dad3d', preferredTool: 'shovel' },
  2: { name: '泥土', color: '#7d542a', preferredTool: 'shovel' },
  3: { name: '水源', color: '#1a66e6' },
  4: { name: '木头', color: '#663300', preferredTool: 'axe' },
  5: { name: '树叶', color: '#1a801a' },
  6: { name: '沙子', color: '#e6cc80', preferredTool: 'shovel' },
  7: { name: '积雪', color: '#f2f2ff', preferredTool: 'shovel' },
  8: { name: '玻璃', color: '#aaddff' },
  9: { name: '木板', color: '#a67d3d', preferredTool: 'axe' },
  10: { name: '木棍', color: '#7d5e2a' },
  11: { name: '工作台', color: '#d9a066', placeable: true, preferredTool: 'axe' },
  15: { name: '石头', color: '#808080', preferredTool: 'pickaxe', minHarvestLevel: 1 },
  20: { name: '木镐', color: '#8b5a2b', isTool: true, toolType: 'pickaxe', toolLevel: 1 },
  21: { name: '木斧', color: '#8b5a2c', isTool: true, toolType: 'axe', toolLevel: 1 },
  22: { name: '木锹', color: '#8b5a2d', isTool: true, toolType: 'shovel', toolLevel: 1 },
  50: { name: '生猪肉', color: '#ffafb0', placeable: false }
};

// --- 背包与合成系统初始化 ---
const inventoryManager = new InventoryManager();
const craftingManager = new CraftingManager();
const inventoryUI = new InventoryUI(blockData, craftingManager);
let isInventoryOpen = false;
let isOpeningInventory = false; 

// --- 玩家生命值状态 ---
let playerHp = 20;
const maxPlayerHp = 20;
let lastDamageTime = 0;

function updateHpUI() {
  const hpElement = document.getElementById('hp-ui');
  if (hpElement) {
    hpElement.innerText = `HP: ${playerHp} / ${maxPlayerHp}`;
  }
  if (typeof updateHUDHealth === 'function') {
    updateHUDHealth(playerHp, maxPlayerHp);
  }
}

function takePlayerDamage(amount) {
  // Bug 44: 全局无敌时间 (I-Frame)
  if (performance.now() - lastDamageTime < 1000) return;
  lastDamageTime = performance.now();

  playerHp -= amount;
  updateHpUI();
  
  const flash = document.getElementById('damage-flash');
  if (flash) {
    flash.style.opacity = '0.5';
    setTimeout(() => {
      flash.style.opacity = '0';
    }, 100);
  }

  if (playerHp <= 0) {
    // 玩家死亡：重置位置并恢复生命
    playerHp = maxPlayerHp;
    updateHpUI();
    
    // 核心修复: 死亡清空背包并分散掉落物，避免碰撞叠加抖动
    for (let i = 0; i < inventoryManager.size; i++) {
      const item = inventoryManager.slots[i];
      if (item) {
        const offsetX = (Math.random() - 0.5) * 2.0;
        const offsetZ = (Math.random() - 0.5) * 2.0;
        itemDropManager.spawn(camera.position.x + offsetX, camera.position.y, camera.position.z + offsetZ, item.id, item.count);
      }
    }
    inventoryManager.slots.fill(null);
    initHotbarUI();
    if (isInventoryOpen) inventoryUI.render(inventoryManager);

    hasSpawned = false; // 触发重新寻找安全出生点
    camera.position.set(spawnX, 120, spawnZ);
    velocity.set(0, 0, 0);
    if (typeof addConsoleMsg === 'function') {
      addConsoleMsg("You died!", "red");
    }
  }
}

// --- 物理与状态常量 ---
let hasSpawned = false;
const velocity = new THREE.Vector3();
const playerRadius = 0.3, playerHeight = 1.8, eyeHeight = 1.6, gravity = 30.0, jumpSpeed = 10.0;
let isGrounded = false, lastFootstepTime = 0;
const spawnX = 16, spawnZ = 16; 

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
  e.stopPropagation(); // 核心修复: 防止输入指令时触发全局热键 (Bug 63)
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

  // 核心修复: 如果手持物品为空，或者手持物品与产出一致且未达到堆叠上限 (Bug 57)
  if (!holding || (holding.id === result.id && holding.count < 64)) {
    if (!holding) {
      inventoryUI.holdingItem = { ...result };
    } else {
      // 允许堆叠，但产出固定作为一个整体取出 (符合 Minecraft 逻辑，产出通常是固定的 1 或 4 个)
      // 如果 holding.count + result.count > 64，则说明由于空间不足无法取出产出
      if (holding.count + result.count > 64) return;
      inventoryUI.holdingItem.count += result.count;
    }

    // 消耗合成材料
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

function returnHeldAndCraftingItems() {
  // 1. 退回鼠标上的物品
  if (inventoryUI.holdingItem) {
    const added = inventoryManager.addItem(inventoryUI.holdingItem.id, inventoryUI.holdingItem.count);
    inventoryUI.holdingItem.count -= added;
    if (inventoryUI.holdingItem.count <= 0) inventoryUI.holdingItem = null;
  }
  // 2. 退回 2x2 合成格中的物品
  for (let i = 0; i < 4; i++) {
    const item = inventoryUI.craftingSlots[i];
    if (item) {
      const added = inventoryManager.addItem(item.id, item.count);
      item.count -= added;
      if (item.count <= 0) inventoryUI.craftingSlots[i] = null;
    }
  }
}

function toggleInventory(isWorkbench = false) {
  if (!hasSpawned || isConsoleOpen) return; 

  if (isInventoryOpen) {
    // 核心修复：调用统一的退回逻辑 (Bug 62)
    returnHeldAndCraftingItems();
    
    // 核心修复: 如果依然有剩余（背包全满），将物品丢出 (Bug 76)
    if (inventoryUI.holdingItem || inventoryUI.craftingSlots.some(s => s !== null)) {
      if (typeof addConsoleMsg === 'function') {
        addConsoleMsg("背包已满，剩余物品已丢出！", "yellow");
      }
      if (inventoryUI.holdingItem) {
        itemDropManager.spawn(camera.position.x, camera.position.y, camera.position.z, inventoryUI.holdingItem.id, inventoryUI.holdingItem.count);
        inventoryUI.holdingItem = null;
      }
      for (let i = 0; i < inventoryUI.craftingSlots.length; i++) {
        const item = inventoryUI.craftingSlots[i];
        if (item) {
          itemDropManager.spawn(camera.position.x, camera.position.y, camera.position.z, item.id, item.count);
          inventoryUI.craftingSlots[i] = null;
        }
      }
    }

    inventoryUI.updateDragCursor();
    isInventoryOpen = false;
    inventoryUI.uiContainer.style.display = 'none';
    initHotbarUI();

    instructions.style.display = 'block';
    controls.lock(); 
  } else {
    isOpeningInventory = true;
    inventoryUI.setWorkbenchMode(isWorkbench);
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

  // 核心修复: 实时计算并更新 FPS (Bug 82)
  frameCount++;
  const now = performance.now();
  if (now - lastFpsUpdate >= 1000) {
    debugFps.innerText = frameCount; // 核心修复: 去掉冗余的 "FPS: " 前缀 (Bug 86)
    frameCount = 0;
    lastFpsUpdate = now;
  }

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

// --- 快捷栏逻辑 (从背包同步) ---
let selectedSlot = 0;

function initHotbarUI() {
  const hotbar = document.getElementById('hotbar');
  if (!hotbar) return;
  hotbar.innerHTML = ''; 

  for (let index = 0; index < 9; index++) {
    const item = inventoryManager.slots[index];
    const slot = document.createElement('div');
    slot.className = `slot ${index === selectedSlot ? 'selected' : ''}`;
    slot.dataset.index = index;

    if (item && item.id !== 0) {
      const info = blockData[item.id];
      if (info) {
        slot.innerHTML = `
          <div class="cube-icon">
            <div class="face top" style="background-color: ${info.color}"></div>
            <div class="face front" style="background-color: ${info.color}"></div>
            <div class="face right" style="background-color: ${info.color}"></div>
          </div>
          <div class="slot-text">${info.name}</div>
          <div class="count" style="position:absolute; bottom:2px; right:2px; color:white; font-size:12px; font-weight:bold; text-shadow:1px 1px 2px black;">${item.count > 1 ? item.count : ''}</div>
        `;
      }
    }
    hotbar.appendChild(slot);
  }
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
initHUD();
updateHpUI();

window.addEventListener('keydown', (e) => {
  if (isConsoleOpen || isInventoryOpen) return;
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

// --- 掉落物系统初始化 ---
const itemDropManager = new ItemDropManager(scene, null, inventoryManager, blockData);
window.refreshInventoryUI = () => {
  inventoryUI.render(inventoryManager);
  initHotbarUI();
};

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
  inventoryManager, skyManager, camera, blockData,
  onUpdateUI: () => { 
    inventoryUI.updateCrafting(); // 关键修复：控制台指令操作后也需要刷新合成预览
    inventoryUI.render(inventoryManager); 
    initHotbarUI(); 
  }
});

// 初始化世界管理器
const worldManager = new WorldManager(scene, renderDistance, chunkSize);
worldManager.update(camera.position);

// 初始化操作指南
initHelpOverlay();

// 完善掉落物管理器的依赖

itemDropManager.worldManager = worldManager;

// 初始化生物管理器
const mobManager = new MobManager(scene, worldManager, itemDropManager, skyManager);

// 将 mobManager 注入指令解析器
commandParser.ctx.mobManager = mobManager;

// 6. 第一人称控制
const controls = new PointerLockControls(camera, document.body);
instructions.addEventListener('click', () => { controls.lock(); audioManager.init(camera); });

controls.addEventListener('lock', () => {
  instructions.style.display = 'none';
  if (isInventoryOpen) {
    // 核心修复：调用统一的退回逻辑 (Bug 62)
    returnHeldAndCraftingItems();
    
    // 核心修复: 如果依然有剩余（背包全满），将物品丢出 (Bug 76)
    if (inventoryUI.holdingItem || inventoryUI.craftingSlots.some(s => s !== null)) {
      if (typeof addConsoleMsg === 'function') {
        addConsoleMsg("背包已满，剩余物品已丢出！", "yellow");
      }
      if (inventoryUI.holdingItem) {
        itemDropManager.spawn(camera.position.x, camera.position.y, camera.position.z, inventoryUI.holdingItem.id, inventoryUI.holdingItem.count);
        inventoryUI.holdingItem = null;
      }
      for (let i = 0; i < 4; i++) {
        const item = inventoryUI.craftingSlots[i];
        if (item) {
          itemDropManager.spawn(camera.position.x, camera.position.y, camera.position.z, item.id, item.count);
          inventoryUI.craftingSlots[i] = null;
        }
      }
    }

    inventoryUI.updateDragCursor();
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
let miningGraceTimer = 0; // 核心修复：挖掘容错缓冲 (Bug 61)
const miningProgressContainer = document.getElementById('mining-progress-container');
const miningProgressBar = document.getElementById('mining-progress');

document.addEventListener('mousedown', (e) => {
  if (!controls.isLocked) return;

  // 1. DDA 射线检测方块 (Bug 49)
  _tempForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const voxelHit = worldManager.raycast(camera.position, _tempForward, MAX_REACH);

  // 2. 射线检测生物 (保持使用 Raycaster，因为生物是复杂 Mesh)
  raycaster.setFromCamera(center, camera);
  const mobGroups = Array.from(mobManager.mobs.values()).map(m => m.group);
  const mobIntersects = raycaster.intersectObjects(mobGroups, true);

  let hitMob = null;
  if (mobIntersects.length > 0 && mobIntersects[0].distance <= MAX_REACH) {
    // 比较生物距离与方块距离，避免隔墙打牛 (Bug 37)
    if (!voxelHit || mobIntersects[0].distance < voxelHit.distance) {
      hitMob = mobIntersects[0];
    }
  }

  if (hitMob) {
    if (e.button === 0) { // 左键攻击
      const hitGroup = hitMob.object.parent; // 获取 Mob 的 Group
      // 寻找对应的 Mob 实例
      for (const mob of mobManager.mobs.values()) {
        if (mob.group === hitGroup || mob.group === hitMob.object.parent.parent) {
          mob.takeDamage(2, camera.position);
          audioManager.playSound('dig', 0.5); // 借用挖掘声作为打击反馈
          return; // 攻击了生物就不再挖掘方块
        }
      }
    }
    return; // 命中生物但不是左键，也吃掉点击事件
  }

  if (voxelHit) {
    if (e.button === 0) {
      isMining = true; miningProgress = 0;
      targetBlock = { x: voxelHit.x, y: voxelHit.y, z: voxelHit.z };
      if (miningProgressContainer) miningProgressContainer.style.display = 'block';
    } else {
      const item = inventoryManager.slots[selectedSlot];
      if (item && item.id !== 0 && blockData[item.id]) {
        // 计算放置位置：点击坐标 + 点击面的法线
        const px = voxelHit.x + voxelHit.normal.x;
        const py = voxelHit.y + voxelHit.normal.y;
        const pz = voxelHit.z + voxelHit.normal.z;

        // 核心修复：防止方块放置在玩家体内 (Bug 4)
        const targetVoxelAABB = {
          minX: px, maxX: px + 1,
          minY: py, maxY: py + 1,
          minZ: pz, maxZ: pz + 1
        };
        const playerAABB = {
          minX: camera.position.x - playerRadius, maxX: camera.position.x + playerRadius,
          minY: camera.position.y - eyeHeight, maxY: camera.position.y - eyeHeight + playerHeight,
          minZ: camera.position.z - playerRadius, maxZ: camera.position.z + playerRadius
        };

        let isOverlapping = (
          targetVoxelAABB.minX < playerAABB.maxX && targetVoxelAABB.maxX > playerAABB.minX &&
          targetVoxelAABB.minY < playerAABB.maxY && targetVoxelAABB.maxY > playerAABB.minY &&
          targetVoxelAABB.minZ < playerAABB.maxZ && targetVoxelAABB.maxZ > playerAABB.minZ
        );

        if (!isOverlapping && mobManager) {
          for (const mob of mobManager.mobs.values()) {
            if (mob.isDead) continue;
            const mobHeight = mob.type === 'zombie' ? 1.8 : 0.8;
            const mobAABB = {
              minX: mob.group.position.x - 0.35, maxX: mob.group.position.x + 0.35,
              minY: mob.group.position.y, maxY: mob.group.position.y + mobHeight,
              minZ: mob.group.position.z - 0.35, maxZ: mob.group.position.z + 0.35
            };
            if (
              targetVoxelAABB.minX < mobAABB.maxX && targetVoxelAABB.maxX > mobAABB.minX &&
              targetVoxelAABB.minY < mobAABB.maxY && targetVoxelAABB.maxY > mobAABB.minY &&
              targetVoxelAABB.minZ < mobAABB.maxZ && targetVoxelAABB.maxZ > mobAABB.minZ
            ) {
              isOverlapping = true;
              break;
            }
          }
        }

        // 核心修复：增加世界边界检查 (Bug 29)
        const isWithinBounds = py >= 0 && py < 256;

        if ((!isOverlapping || isFlying) && blockData[item.id].placeable !== false && isWithinBounds) {
          worldManager.setBlock(px, py, pz, item.id);
          inventoryManager.removeItem(selectedSlot, 1);
          initHotbarUI();
          audioManager.playSound('place');
        }
      }
    }
  }
});
document.addEventListener('mouseup', (e) => { if (e.button === 0) { isMining = false; miningProgress = 0; targetBlock = null; if (miningProgressContainer) miningProgressContainer.style.display = 'none'; } });
document.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

// 10. 物理与动画循环
let prevTime = performance.now();

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
  // 螺旋搜索算法寻找最近的有地面区块
  const centerX = Math.floor(spawnX / chunkSize);
  const centerZ = Math.floor(spawnZ / chunkSize);
  const searchRadius = 2; // 搜索周围 5x5 个区块

  for (let r = 0; r <= searchRadius; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        
        const cx = centerX + dx;
        const cz = centerZ + dz;
        const chunk = worldManager.chunks.get(`${cx},${cz}`);
        
        if (chunk && chunk.generated) {
          const testX = cx * chunkSize + chunkSize / 2;
          const testZ = cz * chunkSize + chunkSize / 2;
          const y = worldManager.getHighestBlock(testX, testZ);
          if (y !== null && y > 0) {
            camera.position.set(testX, y + 1 + eyeHeight, testZ);
            hasSpawned = true;
            console.log(`[Spawn] Safe spot found at ${camera.position.x}, ${y}, ${camera.position.z}`);
            return;
          }
        }
      }
    }
  }
}

// --- 核心优化：预分配全局临时变量，规避 GC 压力 (Bug 47) ---
const _tempVec = new THREE.Vector3();
const _tempVec2 = new THREE.Vector3();
const _tempRight = new THREE.Vector3();
const _tempForward = new THREE.Vector3();
const _tempPos = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const time = performance.now(), delta = Math.min((time - prevTime) / 1000, 0.1);
  
  // 始终更新世界加载与环境光影，无论是否锁定鼠标
  worldManager.update(camera.position);
  if (skyManager) skyManager.update(delta);
  if (mobManager) mobManager.update(delta, camera.position);
  if (itemDropManager) itemDropManager.update(delta, camera.position);

  if (controls.isLocked) {
    // 核心修复: 支持长按连挖，当 isMining 为 true 且当前无目标时，尝试获取新目标 (Bug 77)
    if (isMining && !targetBlock) {
      _tempForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const hit = worldManager.raycast(camera.position, _tempForward, MAX_REACH);
      if (hit) {
        targetBlock = { x: hit.x, y: hit.y, z: hit.z };
        miningProgress = 0;
        miningGraceTimer = 0.2;
        if (miningProgressContainer) miningProgressContainer.style.display = 'block';
      }
    }

    if (isMining && targetBlock) {
      // DDA 射线检测方块 (Bug 49)
      _tempForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const voxelHit = worldManager.raycast(camera.position, _tempForward, MAX_REACH);

      let hitSameBlock = false;
      if (voxelHit && voxelHit.x === targetBlock.x && voxelHit.y === targetBlock.y && voxelHit.z === targetBlock.z) {
        hitSameBlock = true;
      }

      if (hitSameBlock) {
        miningGraceTimer = 0.2; // 核心修复：命中目标时重置缓冲时间 (Bug 61)
        miningProgress += delta * 0.25;
        if (miningProgressBar) miningProgressBar.style.width = `${Math.min(miningProgress * 100, 100)}%`;
        if (miningProgress >= 1.0) {
          const blockId = worldManager.getBlock(targetBlock.x, targetBlock.y, targetBlock.z);
          if (blockId !== 0) {
            // 生成掉落物而非直接入包
            itemDropManager.spawn(targetBlock.x + 0.5, targetBlock.y + 0.5, targetBlock.z + 0.5, blockId, 1);
          }
          worldManager.setBlock(targetBlock.x, targetBlock.y, targetBlock.z, 0); audioManager.playSound('dig');
          miningProgress = 0; targetBlock = null; if (miningProgressContainer) miningProgressContainer.style.display = 'none';
        }
      } else {
        // 核心修复: 未命中目标时，先扣除缓冲时间，直到归零才重置进度 (Bug 61)
        miningGraceTimer -= delta;
        if (miningGraceTimer <= 0) {
          miningProgress = 0;
          targetBlock = null; // Bug 77 核心：缓冲用尽后丢弃目标，允许重新寻找目标
          if (miningProgressBar) miningProgressBar.style.width = '0%';
          if (miningProgressContainer) miningProgressContainer.style.display = 'none';
        }
      }
    }

    // 僵尸伤害逻辑
    for (const mob of mobManager.mobs.values()) {
      if (mob.type === 'zombie' && !mob.isDead) {
        // 核心修复: 僵尸攻击判定失效 (高度差问题) (Bug 75)
        const dx = mob.group.position.x - camera.position.x;
        const dz = mob.group.position.z - camera.position.z;
        // 僵尸中心点高度约 0.9，相机在 1.6
        const dy = (mob.group.position.y + 0.9) - camera.position.y;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        if (distance < 1.5) {
          const oldTime = lastDamageTime;
          takePlayerDamage(2);
          if (lastDamageTime !== oldTime) {
            audioManager.playSound('dig', 1.0); // 暂用挖掘声作为伤害音效
          }
        }
      }
    }

    // 窒息伤害逻辑 (Bug 43)
    if (!isFlying && hasSpawned) {
      const headX = Math.floor(camera.position.x);
      const headY = Math.floor(camera.position.y);
      const headZ = Math.floor(camera.position.z);
      const headVoxel = worldManager.getBlock(headX, headY, headZ);
      // 如果头部位于实体方块内，造成窒息伤害
      if (headVoxel !== 0 && headVoxel !== 3) {
        const oldTime = lastDamageTime;
        takePlayerDamage(1);
        if (lastDamageTime !== oldTime) {
          audioManager.playSound('dig', 0.5); // 窒息也播放一个受击音效
        }
      }
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
    
    _tempRight.setFromMatrixColumn(camera.matrix, 0); _tempRight.y = 0; _tempRight.normalize();
    _tempForward.crossVectors(camera.up, _tempRight); _tempForward.y = 0; _tempForward.normalize();
    
    const deltaPos = _tempVec.set(0, 0, 0).addScaledVector(_tempRight, -velocity.x * delta).addScaledVector(_tempForward, -velocity.z * delta);
    deltaPos.y = velocity.y * delta;
    let hitGround = false;
    camera.position.y += deltaPos.y;
    if (checkCollision(camera.position)) { if (velocity.y < 0) { hitGround = true; camera.position.y = Math.floor(camera.position.y - eyeHeight + 1) + eyeHeight; } else camera.position.y -= deltaPos.y; velocity.y = 0; }
    if (!isFlying && !hitGround && velocity.y <= 0) { _tempPos.copy(camera.position); _tempPos.y -= 0.05; if (checkCollision(_tempPos)) { hitGround = true; velocity.y = 0; } }
    isGrounded = hitGround;
    camera.position.x += deltaPos.x; if (checkCollision(camera.position)) { camera.position.x -= deltaPos.x; velocity.x = 0; }
    camera.position.z += deltaPos.z; if (checkCollision(camera.position)) { camera.position.z -= deltaPos.z; velocity.z = 0; }
    if (!isFlying && camera.position.y < -20) { camera.position.set(8, 100, 8); velocity.set(0, 0, 0); }
    if (isGrounded && !isFlying && (velocity.x*velocity.x + velocity.z*velocity.z) > 1.0 && time - lastFootstepTime > 400) { audioManager.playSound('footstep', 0.3); lastFootstepTime = time; }
  }
  prevTime = time; renderer.render(scene, camera);
}
animate();
