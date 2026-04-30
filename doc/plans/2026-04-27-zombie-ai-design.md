# Hostile Mobs and A* Pathfinding Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement hostile zombies that use A* pathfinding to chase and damage the player.

**Architecture:** Refactor the `Mob` class into a more generic base class, implement a utility for A* pathfinding on the voxel grid, and create a `Zombie` subclass. Add player health and damage logic to `main.js` to support combat.

**Tech Stack:** Three.js, JavaScript (ESM).

---

### Task 1: Refactor Mob.js for Extensibility

**Files:**
- Modify: `Mob.js`
- Test: `tests/mob-refactor.test.js`

**Step 1: Write a failing test for mob type customization**

```javascript
import { Mob } from '../Mob.js';
import * as THREE from 'three';

describe('Mob Refactor', () => {
  it('should support different colors for different mob types', () => {
    const mob = new Mob(1, 'zombie', new THREE.Vector3(0, 0, 0));
    // Assuming we'll change originalColor based on type
    expect(mob.type).toBe('zombie');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/mob-refactor.test.js`
Expected: FAIL (color/type mismatch)

**Step 3: Refactor Mob.js to handle types**

```javascript
// In Mob.js constructor
constructor(id, type, position) {
  this.id = id;
  this.type = type;
  // ...
  if (type === 'zombie') {
    this.originalColor = new THREE.Color(0x2d4d2d); // Dark green
    this.hp = 20;
    this.moveSpeed = 3.5;
  } else {
    this.originalColor = new THREE.Color(0xffafb0); // Pig pink
    this.hp = 10;
    this.moveSpeed = 2.0;
  }
  // ...
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/mob-refactor.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add Mob.js
git commit -m "refactor: make Mob class type-aware for zombie support"
```

---

### Task 2: Implement A* Pathfinder Utility

**Files:**
- Create: `Pathfinder.js`
- Test: `tests/pathfinder.test.js`

**Step 1: Write a failing test for A* pathfinding**

```javascript
import { Pathfinder } from '../Pathfinder.js';

describe('Pathfinder', () => {
  it('should find a path between two points', () => {
    const mockWorld = { getBlock: (x, y, z) => 0 }; // Empty world
    const path = Pathfinder.findPath({x:0,y:0,z:0}, {x:2,y:0,z:0}, mockWorld);
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length-1]).toEqual({x:2,y:0,z:0});
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/pathfinder.test.js`
Expected: FAIL (Pathfinder not defined)

**Step 3: Implement A* algorithm**

Implement `Pathfinder.js` with `findPath(start, goal, worldManager)` using a priority queue and Manhattan distance.

**Step 4: Run test to verify it passes**

Run: `npm test tests/pathfinder.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add Pathfinder.js
git commit -m "feat: implement A* pathfinding utility"
```

---

### Task 3: Integrate A* and Chasing AI in Mob.js

**Files:**
- Modify: `Mob.js`
- Modify: `MobManager.js`

**Step 1: Add chasing state to Mob.js**

```javascript
// In Mob.js update()
if (this.type === 'zombie' && playerPos) {
  const dist = this.group.position.distanceTo(playerPos);
  if (dist < 15) {
    this.state = 'chasing';
    // Use Pathfinder to update target
  }
}
```

**Step 2: Update MobManager.js to pass player position**

```javascript
// In MobManager.js update()
mob.update(delta, this.worldManager, playerPos);
```

**Step 3: Run existing tests to ensure no regressions**

Run: `npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add Mob.js MobManager.js
git commit -m "feat: add chasing state and player-aware AI"
```

---

### Task 4: Add Player Health and Damage Feedback

**Files:**
- Modify: `main.js`
- Modify: `index.html`

**Step 1: Add HP variable and UI to main.js and index.html**

```javascript
// main.js
let playerHp = 20;
const maxPlayerHp = 20;
```

**Step 2: Implement damage logic**

```javascript
function takePlayerDamage(amount) {
  playerHp -= amount;
  // Visual feedback: red flash overlay
  // Handle death: respawn
}
```

**Step 3: Zombie collision damage**

In `main.js` loop, check distance between player and zombies. If < 1.0, `takePlayerDamage(1)`.

**Step 4: Commit**

```bash
git add main.js index.html
git commit -m "feat: add player health system and zombie damage logic"
```

---

### Task 5: Spawn Zombies at Night

**Files:**
- Modify: `MobManager.js`

**Step 1: Check time in MobManager**

```javascript
// In MobManager.js trySpawnAround
const time = this.skyManager.time;
const isNight = time < 6 || time > 18;
if (isNight && Math.random() < 0.5) {
  this.spawn('zombie', position);
}
```

**Step 2: Commit**

```bash
git add MobManager.js
git commit -m "feat: spawn zombies during night time"
```
