/**
 * CraftingManager.js
 * 核心合成逻辑管理类
 */

const RECIPES = [
  {
    name: '木板',
    // 无序合成：1个原木(4) -> 4个木板(9)
    ingredients: [4], 
    result: { id: 9, count: 4 },
    isShapeless: true
  },
  {
    name: '木棍',
    // 有序合成：2个木板(9) 垂直摆放
    pattern: [
      [9],
      [9]
    ],
    result: { id: 10, count: 4 }
  },
  {
    name: '合成表',
    // 有序合成：2x2 木板(9)
    pattern: [
      [9, 9],
      [9, 9]
    ],
    result: { id: 11, count: 1 }
  }
];

export class CraftingManager {
  constructor() {
    this.recipes = RECIPES;
  }

  /**
   * 检查当前 2x2 网格是否匹配任何配方
   * @param {Array} grid 2x2 数组，存储物品ID或 null
   * @returns {Object|null} 匹配成功返回 result，否则返回 null
   */
  checkRecipe(grid) {
    // 1. 先尝试无序匹配 (Shapeless)
    const shapelessResult = this._checkShapeless(grid);
    if (shapelessResult) return shapelessResult;

    // 2. 尝试有序匹配 (Shaped)
    return this._checkShaped(grid);
  }

  /**
   * 无序匹配：只要物品种类和数量对得上即可
   */
  _checkShapeless(grid) {
    const currentIngredients = grid.flat().filter(id => id !== null).sort();
    
    for (const recipe of this.recipes) {
      if (!recipe.isShapeless) continue;
      
      const recipeIngredients = [...recipe.ingredients].sort();
      if (this._arraysEqual(currentIngredients, recipeIngredients)) {
        return { ...recipe.result };
      }
    }
    return null;
  }

  /**
   * 有序匹配：考虑形状，但忽略空白偏移
   */
  _checkShaped(grid) {
    // 提取当前网格的最小包围形状（去除空白行和列）
    const normalizedGrid = this._normalizeGrid(grid);
    if (!normalizedGrid) return null;

    for (const recipe of this.recipes) {
      if (recipe.isShapeless) continue;

      // 配方的 pattern 本身已经是最小化定义的
      if (this._comparePatterns(normalizedGrid, recipe.pattern)) {
        return { ...recipe.result };
      }
    }
    return null;
  }

  /**
   * 将 2x2 网格“去空白”标准化
   * 例如 [[null, 1], [null, 1]] 变为 [[1], [1]]
   */
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

  _comparePatterns(p1, p2) {
    if (p1.length !== p2.length || p1[0].length !== p2[0].length) return false;
    for (let y = 0; y < p1.length; y++) {
      for (let x = 0; x < p1[y].length; x++) {
        if (p1[y][x] !== p2[y][x]) return false;
      }
    }
    return true;
  }

  _arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}
gth; y++) {
      for (let x = 0; x < p1[y].length; x++) {
        if (p1[y][x] !== p2[y][x]) return false;
      }
    }
    return true;
  }

  _arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}
