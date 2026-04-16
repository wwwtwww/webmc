import { createNoise2D } from 'simplex-noise';

// 1. 初始化两套独立的噪声实例
const heightNoise = createNoise2D(() => 0.5); // 地形高度噪声
const biomeNoise = createNoise2D(() => 0.8);  // 群落分布噪声 (温度/湿度模拟)

const faces = [
  { dir: [ -1,  0,  0, ], corners: [ { pos: [ 0, 0, 0 ], uv: [ 0, 0 ] }, { pos: [ 0, 0, 1 ], uv: [ 1, 0 ] }, { pos: [ 0, 1, 1 ], uv: [ 1, 1 ] }, { pos: [ 0, 1, 0 ], uv: [ 0, 1 ] } ] },
  { dir: [  1,  0,  0, ], corners: [ { pos: [ 1, 0, 1 ], uv: [ 0, 0 ] }, { pos: [ 1, 0, 0 ], uv: [ 1, 0 ] }, { pos: [ 1, 1, 0 ], uv: [ 1, 1 ] }, { pos: [ 1, 1, 1 ], uv: [ 0, 1 ] } ] },
  { dir: [  0, -1,  0, ], corners: [ { pos: [ 0, 0, 0 ], uv: [ 0, 0 ] }, { pos: [ 1, 0, 0 ], uv: [ 1, 0 ] }, { pos: [ 1, 0, 1 ], uv: [ 1, 1 ] }, { pos: [ 0, 0, 1 ], uv: [ 0, 1 ] } ] },
  { dir: [  0,  1,  0, ], corners: [ { pos: [ 0, 1, 1 ], uv: [ 0, 0 ] }, { pos: [ 1, 1, 1 ], uv: [ 1, 0 ] }, { pos: [ 1, 1, 0 ], uv: [ 1, 1 ] }, { pos: [ 0, 1, 0 ], uv: [ 0, 1 ] } ] },
  { dir: [  0,  0, -1, ], corners: [ { pos: [ 1, 0, 0 ], uv: [ 0, 0 ] }, { pos: [ 0, 0, 0 ], uv: [ 1, 0 ] }, { pos: [ 0, 1, 0 ], uv: [ 1, 1 ] }, { pos: [ 1, 1, 0 ], uv: [ 0, 1 ] } ] },
  { dir: [  0,  0,  1, ], corners: [ { pos: [ 0, 0, 1 ], uv: [ 0, 0 ] }, { pos: [ 1, 0, 1 ], uv: [ 1, 0 ] }, { pos: [ 1, 1, 1 ], uv: [ 1, 1 ] }, { pos: [ 0, 1, 1 ], uv: [ 0, 1 ] } ] },
];

const colorMap = {
  1: [0.2, 0.8, 0.2], // 草地 (绿色)
  2: [0.5, 0.3, 0.1], // 泥土 (棕色)
  3: [0.1, 0.4, 0.9], // 水 (蓝色)
  4: [0.4, 0.2, 0.0], // 木头
  5: [0.1, 0.5, 0.1], // 树叶
  6: [0.9, 0.8, 0.5], // 沙子 (沙黄色)
  7: [0.95, 0.95, 1.0], // 雪 (白色)
};

self.onmessage = function(e) {
  const { data, chunkSize, chunkX, chunkZ } = e.data;
  
  // 采样比例
  const heightScale = 0.05;
  const biomeScale = 0.02;

  // 内部辅助函数：获取或动态判定方块类型
  function getVoxel(vx, vy, vz) {
    if (vx < 0 || vx >= chunkSize || vy < 0 || vy >= chunkSize || vz < 0 || vz >= chunkSize) {
      return 0;
    }
    const index = vy * chunkSize * chunkSize + vz * chunkSize + vx;
    return data[index];
  }

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const colors = [];

  // 遍历区块计算网格
  for (let y = 0; y < chunkSize; ++y) {
    for (let z = 0; z < chunkSize; ++z) {
      for (let x = 0; x < chunkSize; ++x) {
        let voxel = getVoxel(x, y, z);
        
        if (voxel !== 0) {
          const worldX = chunkX * chunkSize + x;
          const worldZ = chunkZ * chunkSize + z;

          // 基础颜色判定
          const baseColor = colorMap[voxel] || [1, 1, 1];
          
          // 棋盘格变色逻辑 (x+y+z)
          const isEven = (worldX + y + worldZ) % 2 === 0;
          const voxelColor = isEven 
            ? baseColor 
            : [baseColor[0] * 0.9, baseColor[1] * 0.9, baseColor[2] * 0.9];

          for (const { dir, corners } of faces) {
            const neighbor = getVoxel(x + dir[0], y + dir[1], z + dir[2]);
            
            const isNeighborAir = neighbor === 0;
            const isNeighborWater = (voxel !== 3 && neighbor === 3);

            if (isNeighborAir || isNeighborWater) {
              const ndx = positions.length / 3;
              for (const { pos, uv } of corners) {
                positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
                normals.push(dir[0], dir[1], dir[2]);
                uvs.push(uv[0], uv[1]);
                colors.push(...voxelColor);
              }
              indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 3, ndx);
            }
          }
        }
      }
    }
  }

  // 转换为 TypedArrays 以使用 Transferable Objects
  const posArray = new Float32Array(positions);
  const normArray = new Float32Array(normals);
  const uvArray = new Float32Array(uvs);
  const colorArray = new Float32Array(colors);
  const indexArray = new Uint32Array(indices);

  self.postMessage({
    positions: posArray,
    normals: normArray,
    uvs: uvArray,
    colors: colorArray,
    indices: indexArray,
    chunkX,
    chunkZ,
    data // 将数据传回（可选，取决于主线程是否需要更新后的 data）
  }, [
    posArray.buffer, 
    normArray.buffer, 
    uvArray.buffer, 
    colorArray.buffer, 
    indexArray.buffer
  ]);
};