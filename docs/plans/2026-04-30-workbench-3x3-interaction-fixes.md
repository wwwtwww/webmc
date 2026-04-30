# Workbench 3x3 Interaction & Bug Fixes Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable right-click interaction for workbenches to open the 3x3 crafting UI and fix associated bugs (90, 91, 92) where materials are not correctly returned or consumed in 3x3 mode.

**Architecture:**
- Update `main.js` input handling to detect workbench hits on right-click.
- Refactor `main.js` helper functions to iterate over the full 9-slot crafting grid instead of hardcoded 4 slots.
- Ensure `InventoryUI` state is correctly synchronized during these operations.

**Tech Stack:** Vanilla JavaScript, Three.js (for raycasting).

---

### Task 1: Fix Bug 90 - Implement Workbench Right-Click Interaction

**Files:**
- Modify: `main.js` (inside the `mousedown` event listener for `e.button === 2`)

**Step 1: Add workbench detection to right-click logic**
In the right-click handler, before attempting to place a block, check if the `voxelHit` is a workbench (ID 11). If so, call `toggleInventory(true)` and prevent block placement.

```javascript
// Inside mousedown for e.button === 2
if (voxelHit) {
  const hitBlockId = worldManager.getBlock(voxelHit.x, voxelHit.y, voxelHit.z);
  if (hitBlockId === 11) { // 11 is Workbench
    toggleInventory(true);
    return;
  }
  // ... existing block placement logic
}
```

**Step 2: Commit**
```bash
git add main.js
git commit -m "fix: Bug 90 - implement right-click to open 3x3 workbench UI"
```

---

### Task 2: Fix Bug 91 - Refactor Item Return Logic for 3x3 Grid

**Files:**
- Modify: `main.js` (refactor `returnHeldAndCraftingItems` and its callers)

**Step 1: Update `returnHeldAndCraftingItems` to iterate all slots**
Currently, it only checks `i < 4`. It must check `i < inventoryUI.craftingSlots.length` (which is 9).

```javascript
function returnHeldAndCraftingItems() {
  // ... pick up item logic
  for (let i = 0; i < inventoryUI.craftingSlots.length; i++) {
    const item = inventoryUI.craftingSlots[i];
    // ... return logic
  }
}
```

**Step 2: Update `toggleInventory` and `controls.lock` listeners**
Ensure the loop in `toggleInventory` and `controls.lock` that spawns item drops also uses the correct length.

**Step 3: Commit**
```bash
git add main.js
git commit -m "fix: Bug 91 - ensure all 9 crafting slots are returned/dropped on UI close"
```

---

### Task 3: Fix Bug 92 - Refactor Recipe Consumption for 3x3 Grid

**Files:**
- Modify: `main.js` (refactor `handleResultClick`)

**Step 1: Update consumption loop in `handleResultClick`**
Change the loop that decrements counts from `i < 4` to `i < inventoryUI.craftingSlots.length`.

```javascript
function handleResultClick() {
  // ... check holding logic
  // 消耗合成材料
  for (let i = 0; i < inventoryUI.craftingSlots.length; i++) {
    if (inventoryUI.craftingSlots[i]) {
      inventoryUI.craftingSlots[i].count--;
      if (inventoryUI.craftingSlots[i].count <= 0) inventoryUI.craftingSlots[i] = null;
    }
  }
  // ... update UI logic
}
```

**Step 2: Commit**
```bash
git add main.js
git commit -m "fix: Bug 92 - ensure all 9 slots of a 3x3 recipe are consumed"
```

---

### Task 4: Verification & Documentation Cleanup

**Files:**
- Modify: `docs/buglist.md`

**Step 1: Verify workbench opens on right-click**
(Manual verification note: Ensure no block is placed when clicking the workbench)

**Step 2: Verify 3x3 items are returned**
Place items in slots 5-9 of a workbench, close UI, check if they are in inventory or dropped.

**Step 3: Update Bug List**
Move Bug 90, 91, 92 to Fixed Bugs section.

**Step 4: Commit and Push**
```bash
git add docs/buglist.md
git commit -m "docs: mark workbench interaction bugs as fixed"
git push
```
