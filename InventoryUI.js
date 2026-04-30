/**
 * InventoryUI.js
 * 负责背包界面的 DOM 渲染与点击交互事件
 */
export class InventoryUI {
  constructor(blockData, craftingManager) {
    this.blockData = blockData;
    this.craftingManager = craftingManager;
    
    this.uiContainer = document.getElementById('inventory-ui');
    this.mainGrid = document.getElementById('main-inventory');
    this.hotbarGrid = document.getElementById('hotbar-inventory');
    this.craftGrid = document.getElementById('crafting-grid');
    this.resultSlot = document.getElementById('crafting-result');

    // --- 交互状态 ---
    this.holdingItem = null; // 当前手持物品 {id, count}
    this.craftingSlots = new Array(9).fill(null); // 3x3 合成区, max 9
    this.craftingResult = null; // 合成产出预览
    
    // 鼠标跟随的悬浮光标
    this.dragCursor = document.createElement('div');
    this.dragCursor.id = 'drag-cursor';
    Object.assign(this.dragCursor.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '1000',
      display: 'none',
      width: '52px',
      height: '52px',
      justifyContent: 'center',
      alignItems: 'center'
    });
    document.body.appendChild(this.dragCursor);

    // 外部钩子，供 main.js 注入具体逻辑
    this.onSlotClick = null; 

    this.initGrids();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // 鼠标跟随
    document.addEventListener('mousemove', (e) => {
      if (this.isOpen() && this.holdingItem) {
        this.dragCursor.style.left = `${e.clientX - 26}px`;
        this.dragCursor.style.top = `${e.clientY - 26}px`;
      }
    });

    // 产出槽绑定点击
    this.resultSlot.addEventListener('click', () => {
      if (this.onSlotClick) this.onSlotClick(0, 'result');
    });
  }

  /**
   * 静态生成基础槽位结构
   */
  initGrids() {
    // 1. 初始化 27 个主背包格子 (索引 9-35)
    this.mainGrid.innerHTML = '';
    for (let i = 9; i < 36; i++) {
      this.mainGrid.appendChild(this._createSlot(i, 'inventory'));
    }

    // 2. 初始化 9 个快捷栏同步格子 (索引 0-8)
    this.hotbarGrid.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      this.hotbarGrid.appendChild(this._createSlot(i, 'inventory'));
    }
  }

  _createSlot(index, type) {
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    slot.dataset.index = index;
    slot.dataset.type = type;
    slot.addEventListener('click', () => {
      if (this.onSlotClick) this.onSlotClick(index, type);
    });
    return slot;
  }

  /**
   * 更新悬浮光标的内容
   */
  updateDragCursor() {
    if (this.holdingItem) {
      this.dragCursor.style.display = 'flex';
      this._renderSlotContent(this.dragCursor, this.holdingItem);
    } else {
      this.dragCursor.style.display = 'none';
      this.dragCursor.innerHTML = '';
    }
  }

  /**
   * 全量渲染背包数据
   * @param {InventoryManager} inventoryManager 
   */
  render(inventoryManager) {
    // 渲染 36 个通用槽位
    for (let i = 0; i < inventoryManager.size; i++) {
      const slotData = inventoryManager.slots[i];
      const slotEls = document.querySelectorAll(`.inv-slot[data-type="inventory"][data-index="${i}"]`);
      slotEls.forEach(el => this._renderSlotContent(el, slotData));
    }

    // 渲染合成区
    const craftEls = this.craftGrid.querySelectorAll('.inv-slot');
    craftEls.forEach((el, i) => this._renderSlotContent(el, this.craftingSlots[i]));

    // 渲染结果预览
    this._renderSlotContent(this.resultSlot, this.craftingResult);
  }

  /**
   * 更新合成预览逻辑
   */
  updateCrafting() {
    const grid = [
      [this.craftingSlots[0]?.id || null, this.craftingSlots[1]?.id || null],
      [this.craftingSlots[2]?.id || null, this.craftingSlots[3]?.id || null]
    ];
    this.craftingResult = this.craftingManager.checkRecipe(grid);
  }

  /**
   * 内部方法：具体渲染一个槽位内部的图标和文字
   */
  _renderSlotContent(el, data) {
    el.innerHTML = '';
    if (data && data.id !== 0) {
      const info = this.blockData[data.id];
      if (info) {
        el.innerHTML = `
          <div class="cube-icon">
            <div class="face top" style="background-color: ${info.color}"></div>
            <div class="face front" style="background-color: ${info.color}"></div>
            <div class="face right" style="background-color: ${info.color}"></div>
          </div>
          ${data.count > 1 ? `<div class="count">${data.count}</div>` : ''}
        `;
      }
    }
  }

  /**
   * 切换背包显示/隐藏
   */
  toggle() {
    const isVisible = this.uiContainer.style.display === 'flex';
    this.uiContainer.style.display = isVisible ? 'none' : 'flex';
    return !isVisible;
  }

  isOpen() {
    return this.uiContainer.style.display === 'flex';
  }

  setWorkbenchMode(isWorkbench) {
    this.isWorkbench = isWorkbench;
    const size = isWorkbench ? 9 : 4;
    this.craftingSlots = new Array(9).fill(null); // 3x3 max
    
    this.craftGrid.innerHTML = '';
    if (isWorkbench) {
      this.craftGrid.classList.add('workbench-mode');
    } else {
      this.craftGrid.classList.remove('workbench-mode');
    }
    
    for (let i = 0; i < size; i++) {
      this.craftGrid.appendChild(this._createSlot(i, 'craft'));
    }
  }
}
innerHTML = '';
    if (isWorkbench) {
      this.craftGrid.classList.add('workbench-mode');
    } else {
      this.craftGrid.classList.remove('workbench-mode');
    }
    
    for (let i = 0; i < size; i++) {
      this.craftGrid.appendChild(this._createSlot(i, 'craft'));
    }
  }
}
