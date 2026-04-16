// chunkWorker.js - 高性能体素网格生成器 (支持跨区块面剔除)
// 视角：从方块外部看向该面
// 顶点顺序统一为: 0:左下(BL), 1:右下(BR), 2:右上(TR), 3:左上(TL)
const faces = [
  { dir: [ -1,  0,  0, ], corners: [ { pos: [ 0, 0, 0 ], uv: [ 0, 0 ] }, { pos: [ 0, 0, 1 ], uv: [ 1, 0 ] }, { pos: [ 0, 1, 1 ], uv: [ 1, 1 ] }, { pos: [ 0, 1, 0 ], uv: [ 0, 1 ] } ] },
  { dir: [  1,  0,  0, ], corners: [ { pos: [ 1, 0, 1 ], uv: [ 0, 0 ] }, { pos: [ 1, 0, 0 ], uv: [ 1, 0 ] }, { pos: [ 1, 1, 0 ], uv: [ 1, 1 ] }, { pos: [ 1, 1, 1 ], uv: [ 0, 1 ] } ] },
  { dir: [  0, -1,  0, ], corners: [ { pos: [ 0, 0, 0 ], uv: [ 0, 0 ] }, { pos: [ 1, 0, 0 ], uv: [ 1, 0 ] }, { pos: [ 1, 0, 1 ], uv: [ 1, 1 ] }, { pos: [ 0, 0, 1 ], uv: [ 0, 1 ] } ] },
  { dir: [  0,  1,  0, ], corners: [ { pos: [ 0, 1, 1 ], uv: [ 0, 0 ] }, { pos: [ 1, 1, 1 ], uv: [ 1, 0 ] }, { pos: [ 1, 1, 0 ], uv: [ 1, 1 ] }, { pos: [ 0, 1, 0 ], uv: [ 0, 1 ] } ] },
  { dir: [  0,  0, -1, ], corners: [ { pos: [ 1, 0, 0 ], uv: [ 0, 0 ] }, { pos: [ 0, 0, 0 ], uv: [ 1, 0 ] }, { pos: [ 0, 1, 0 ], uv: [ 1, 1 ] }, { pos: [ 1, 1, 0 ], uv: [ 0, 1 ] } ] },
  { dir: [  0,  0,  1, ], corners: [ { pos: [ 0, 0, 1 ], uv: [ 0, 0 ] }, { pos: [ 1, 0, 1 ], uv: [ 1, 0 ] }, { pos: [ 1, 1, 1 ], uv: [ 1, 1 ] }, { pos: [ 0, 1, 1 ], uv: [ 0, 1 ] } ] },
];

const colorMap = {
  1: [0.2, 0.8, 0.2], // 草地
  2: [0.5, 0.3, 0.1], // 泥土
  3: [0.1, 0.4, 0.9], // 水
  4: [0.4, 0.2, 0.0], // 木头
  5: [0.1, 0.5, 0.1], // 树叶
  6: [0.9, 0.8, 0.5], // 沙子
  7: [0.95, 0.95, 1.0], // 雪
};

self.onmessage = function(e) {
  // paddedData 是一个 18x256x18 的 Uint8Array
  const { paddedData, chunkSize, chunkHeight, chunkX, chunkZ } = e.data;
  
  const pSize = chunkSize + 2; // 18
  
  // 采样比例（同步主线程逻辑）
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const colors = [];

  // 在 18x256x18 的 paddedData 中采样，偏移量为 1
  function getVoxel(vx, vy, vz) {
    // vx, vy, vz 是相对于当前 chunk (0-15) 的坐标
    // 转换到 padded 坐标 (1-16)
    const px = vx + 1;
    const py = vy;
    const pz = vz + 1;
    
    if (py < 0 || py >= chunkHeight) return 0;
    
    const index = py * pSize * pSize + pz * pSize + px;
    return paddedData[index];
  }

  // 遍历 16x256x16 核心区域
  for (let y = 0; y < chunkHeight; ++y) {
    for (let z = 0; z < chunkSize; ++z) {
      for (let x = 0; x < chunkSize; ++x) {
        const voxel = getVoxel(x, y, z);
        if (voxel !== 0) {
          const baseColor = colorMap[voxel] || [1, 1, 1];
          const worldX = chunkX * chunkSize + x;
          const worldZ = chunkZ * chunkSize + z;
          
          const isEven = (worldX + y + worldZ) % 2 === 0;
          const voxelColor = isEven 
            ? baseColor 
            : [baseColor[0] * 0.9, baseColor[1] * 0.9, baseColor[2] * 0.9];

          for (const { dir, corners } of faces) {
            // 检查相邻方块（可能跨越到 padded 区域）
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
    chunkZ
  }, [
    posArray.buffer, 
    normArray.buffer, 
    uvArray.buffer, 
    colorArray.buffer, 
    indexArray.buffer
  ]);
};