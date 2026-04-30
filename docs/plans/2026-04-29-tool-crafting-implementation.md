# Tool Crafting System Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement permanent tools, a fixed mining time reduction mechanic, and a 3x3 crafting grid accessed via the workbench.

**Architecture:** 
- Expand `CraftingManager` and `InventoryUI` to support dynamic grid sizes (2x2 vs 3x3).
- Update `blockData` to include tool attributes and block harvest properties.
- Modify `main.js` to intercept right-clicks on workbenches and to calculate mining speeds/drops based on held tools.

**Tech Stack:** JavaScript (ESM), HTML/CSS

---

### Task 1: Prepare UI for 3x3 Crafting Grid

**Files:**
- Modify: `index.html`
- Modify: `InventoryUI.js`

**Step 1:** In `index.html`, modify the `.craft-grid` CSS and HTML structure.
Change the CSS rule for `.craft-grid` inside `<style>`:
```css
      .craft-grid {
        display: grid;
        grid-template-columns: repeat(2, 52px);
        gap: 4px;
        margin-right: 16px;
      }
      .craft-grid.workbench-mode {
        grid-template-columns: repeat(3, 52px);
      }
```
Update the HTML for `#crafting-grid` in `index.html`:
```html
            <div class="craft-grid" id="crafting-grid">
              <!-- JS 动态生成 -->
            </div>
```

**Step 2:** In `InventoryUI.js`, modify the constructor and grid initialization.
Remove `this.craftingSlots = new Array(4).fill(null);` from the constructor and instead initialize it dynamically based on the mode. Actually, keep it as an array of 9 slots (since 3x3 is max), and just use the first 4 for 2x2.
In `initGrids()`, clear and dynamically append `.inv-slot` elements based on the current mode size (4 or 9).
Add a method `setWorkbenchMode(isWorkbench)`:
```javascript
  setWorkbenchMode(isWorkbench) {
    this.isWorkbench = isWorkbench;
    const size = isWorkbench ? 9 : 4;
    this.craftingSlots = new Array(size).fill(null);
    
    this.craftGrid.innerHTML = '';
    if (isWorkbench) {
      this.craftGrid.classList.add('workbench-mode');
    } else {
      this.craftGrid.classList.remove('workbench-mode');
    }
    
    for (let i = 0; i < size; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      slot.dataset.type = 'craft';
      slot.dataset.index = i;
      this.craftGrid.appendChild(slot);
    }
  }
```
Call `this.setWorkbenchMode(false)` at the end of the constructor.

**Step 3:** Commit the changes.
```bash
git add index.html InventoryUI.js
git commit -m "feat: setup UI for 3x3 workbench mode"
```

---

### Task 2: Expand CraftingManager for 3x3 Grids and Tool Recipes

**Files:**
- Modify: `CraftingManager.js`

**Step 1:** Update `_normalizeGrid(grid)` to handle dynamic heights/widths.
```javascript
  _normalizeGrid(grid) {
    const height = grid.length;
    const width = grid[0].length;
    let minX = width, maxX = -1, minY = height, maxY = -1;
    let hasItem = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] !== null) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          hasItem = true;
        }
      }
    }

    if (!hasItem) return null;

    const result = [];
    for (let y = minY; y <= maxY; y++) {
      const row = [];
      for (let x = minX; x <= maxX; x++) {
        row.push(grid[y][x]);
      }
      result.push(row);
    }
    return result;
  }
```

**Step 2:** Ensure `checkRecipe` converts the 1D `this.craftingSlots` array from `InventoryUI` into a 2D array (2x2 or 3x3) before checking.
Wait, `InventoryUI.js` calls `checkRecipe(grid)`. In `InventoryUI.js`:
```javascript
  updateCrafting() {
    const size = this.isWorkbench ? 3 : 2;
    const grid2D = [];
    for (let y = 0; y < size; y++) {
      const row = [];
      for (let x = 0; x < size; x++) {
        const item = this.craftingSlots[y * size + x];
        row.push(item ? item.id : null);
      }
      grid2D.push(row);
    }
    const result = this.craftingManager.checkRecipe(grid2D);
    // ...
  }
```

**Step 3:** Add tool recipes to `RECIPES` in `CraftingManager.js`.
```javascript
  {
    name: '木镐',
    pattern: [
      [9, 9, 9],
      [null, 10, null],
      [null, 10, null]
    ],
    result: { id: 20, count: 1 }
  },
  {
    name: '木斧',
    pattern: [
      [9, 9],
      [9, 10],
      [null, 10]
    ],
    result: { id: 21, count: 1 }
  },
  {
    name: '木锹',
    pattern: [
      [9],
      [10],
      [10]
    ],
    result: { id: 22, count: 1 }
  }
```

**Step 4:** Commit the changes.
```bash
git add CraftingManager.js InventoryUI.js
git commit -m "feat: upgrade CraftingManager to support 3x3 grid and add tool recipes"
```

---

### Task 3: Define Tools and Harvest Properties in blockData

**Files:**
- Modify: `main.js`

**Step 1:** Expand `blockData` definition in `main.js`.
```javascript
  // Add tools
  20: { name: '木镐', color: '#8b5a2b', isTool: true, toolType: 'pickaxe', toolLevel: 1 },
  21: { name: '木斧', color: '#8b5a2c', isTool: true, toolType: 'axe', toolLevel: 1 },
  22: { name: '木锹', color: '#8b5a2d', isTool: true, toolType: 'shovel', toolLevel: 1 },
  15: { name: '石头', color: '#808080', preferredTool: 'pickaxe', minHarvestLevel: 1 },
```
Also update existing blocks:
- 木头 (4), 木板 (9): `preferredTool: 'axe'`
- 泥土 (2), 沙子 (6), 草地 (1): `preferredTool: 'shovel'`

**Step 2:** Commit.
```bash
git add main.js
git commit -m "feat: define tools and harvest properties in blockData"
```

---

### Task 4: Implement Workbench Interaction

**Files:**
- Modify: `main.js`

**Step 1:** Update `toggleInventory` signature and call in `main.js`.
```javascript
function toggleInventory(isWorkbench = false) {
  if (!hasSpawned || isConsoleOpen) return; 

  if (isInventoryOpen) {
    returnHeldAndCraftingItems();
    
    if (inventoryUI.holdingItem || inventoryUI.craftingSlots.some(s => s !== null)) {
      if (typeof addConsoleMsg === 'function') addConsoleMsg("背包已满，剩余物品已丢出！", "yellow");
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
```

**Step 2:** Modify the right-click event (`mousedown` button === 2) to intercept workbench interaction.
In the `if (voxelHit)` block:
```javascript
    if (e.button === 0) {
      // ... mining
    } else {
      // INTERCEPT WORKBENCH INTERACTION
      if (voxelHit.blockId === 11) {
        toggleInventory(true);
        return;
      }
      // ... existing placement logic
```
Change `e.code === 'KeyE'` to `toggleInventory(false)`.

**Step 3:** Commit.
```bash
git add main.js
git commit -m "feat: implement workbench right-click interaction to open 3x3 grid"
```

---

### Task 5: Implement Mining Speed and Drops Logic

**Files:**
- Modify: `main.js`

**Step 1:** In the `animate()` loop mining progress section, replace the fixed `delta * 0.25` progress.
```javascript
      if (hitSameBlock) {
        miningGraceTimer = 0.2; 
        
        // 核心修复: 简易挖掘速度减免与掉落判断 (Tool System)
        const targetBlockId = worldManager.getBlock(targetBlock.x, targetBlock.y, targetBlock.z);
        const targetData = blockData[targetBlockId];
        
        const heldItem = inventoryManager.slots[selectedSlot];
        const heldData = heldItem ? blockData[heldItem.id] : null;

        let requiredTime = 1.5; // 默认 1.5 秒
        let canHarvest = true;

        if (targetData) {
          const requiresTool = targetData.minHarvestLevel > 0;
          const hasCorrectTool = heldData && heldData.isTool && heldData.toolType === targetData.preferredTool;
          const toolLevel = (hasCorrectTool ? heldData.toolLevel : 0);

          if (requiresTool && toolLevel < targetData.minHarvestLevel) {
            canHarvest = false;
          }

          if (hasCorrectTool && toolLevel >= (targetData.minHarvestLevel || 0)) {
            requiredTime = 0.3; // 拿对工具直接 0.3 秒挖完
          }
        }

        miningProgress += delta / requiredTime;
        if (miningProgressBar) miningProgressBar.style.width = `${Math.min(miningProgress * 100, 100)}%`;
        
        if (miningProgress >= 1.0) {
          if (targetBlockId !== 0 && canHarvest) {
            itemDropManager.spawn(targetBlock.x + 0.5, targetBlock.y + 0.5, targetBlock.z + 0.5, targetBlockId, 1);
          }
          worldManager.setBlock(targetBlock.x, targetBlock.y, targetBlock.z, 0); 
          audioManager.playSound('dig');
          miningProgress = 0; targetBlock = null; if (miningProgressContainer) miningProgressContainer.style.display = 'none';
        }
      }
```

**Step 2:** Ensure `returnHeldAndCraftingItems` handles dynamic `craftingSlots` length:
```javascript
  // 2. 退回合成格中的物品
  for (let i = 0; i < inventoryUI.craftingSlots.length; i++) {
    const item = inventoryUI.craftingSlots[i];
    if (item) {
      const added = inventoryManager.addItem(item.id, item.count);
      item.count -= added;
      if (item.count <= 0) inventoryUI.craftingSlots[i] = null;
    }
  }
```

**Step 3:** Fix `InventoryUI.js` `updateCrafting` grid formatting logic bug (we didn't finish writing it earlier).
Make sure `updateCrafting` in `InventoryUI.js` looks like this:
```javascript
  updateCrafting() {
    const size = this.isWorkbench ? 3 : 2;
    const grid2D = [];
    for (let y = 0; y < size; y++) {
      const row = [];
      for (let x = 0; x < size; x++) {
        const item = this.craftingSlots[y * size + x];
        row.push(item ? item.id : null);
      }
      grid2D.push(row);
    }
    const result = this.craftingManager.checkRecipe(grid2D);
    if (result) {
      this.craftingResult = result;
      // ... render result slot ...
```

**Step 4:** Run tests to make sure we didn't break things: `npm test`
If `crafting.test.js` breaks because `InventoryUI` is not instantiated or missing properties, fix it. We might need to ensure `crafting.test.js` is updated if it directly tests `CraftingManager.checkRecipe` with 2x2 grids, as it should still work gracefully with the new logic.

**Step 5:** Commit.
```bash
git add main.js InventoryUI.js
git commit -m "feat: implement tool mining speed reduction and drops logic"
```

---
