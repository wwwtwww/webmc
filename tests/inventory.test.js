import { InventoryManager } from '../InventoryManager.js';

describe('InventoryManager', () => {
  it('stacks identical items up to 64', () => {
    const inventory = new InventoryManager(36);

    const first = inventory.addItem(4, 30);
    const second = inventory.addItem(4, 20);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(inventory.slots[0]).toEqual({ id: 4, count: 50 });
  });

  it('clears a slot when removing all items', () => {
    const inventory = new InventoryManager(36);
    inventory.addItem(9, 10);

    const removed = inventory.removeItem(0, 10);

    expect(removed).toBe(true);
    expect(inventory.slots[0]).toBeNull();
  });
});
