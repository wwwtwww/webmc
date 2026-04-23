import { CraftingManager } from '../CraftingManager.js';

describe('CraftingManager', () => {
  it('matches the plank recipe', () => {
    const crafting = new CraftingManager();
    const result = crafting.checkRecipe([
      [4, null],
      [null, null],
    ]);

    expect(result).toEqual({ id: 9, count: 4 });
  });

  it('matches the stick recipe', () => {
    const crafting = new CraftingManager();
    const result = crafting.checkRecipe([
      [9, null],
      [9, null],
    ]);

    expect(result).toEqual({ id: 10, count: 4 });
  });
});
