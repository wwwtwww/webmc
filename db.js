import Dexie from 'dexie';

// 1. 实例化 VoxelWorld 数据库
export const db = new Dexie('VoxelWorld');

// 2. 定义表结构
// 我们只需要记录增量修改 (Delta)，即玩家手动修改过的点。
// 这样不需要存储整个 16x256x16 的庞大数组，极大节省空间和 IO。
db.version(1).stores({
  chunks: 'chunkKey' // 主键
});

/**
 * 保存单个方块的增量修改
 * @param {string} chunkKey 格式如 "0,0"
 * @param {number} x, y, z 局部坐标 (0-15, 0-255, 0-15)
 * @param {number} blockId 方块 ID (0 为挖掘, 255 为预挖空气)
 */
export async function saveChunkDelta(chunkKey, x, y, z, blockId) {
  const voxelKey = `${x}_${y}_${z}`;
  
  // 使用事务确保原子性
  await db.transaction('rw', db.chunks, async () => {
    const entry = await db.chunks.get(chunkKey) || { chunkKey, deltas: {} };
    
    // 更新增量对象
    entry.deltas[voxelKey] = blockId;
    
    // 如果某个方块被改回了自然状态（这里由于我们没有记录初始值，
    // 简单的逻辑是只要有手动操作就一直记录在该 delta 里）
    await db.chunks.put(entry);
  });
}

/**
 * 获取指定区块的所有历史增量修改
 * @returns {Promise<Object>} 返回 { "x_y_z": id, ... }
 */
export async function getChunkDelta(chunkKey) {
  const entry = await db.chunks.get(chunkKey);
  return entry ? entry.deltas : {};
}
