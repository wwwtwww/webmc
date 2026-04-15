// chunkWorker.js - 处理体素网格生成的后台线程
// 视角：从方块外部看向该面
// 顶点顺序统一为: 0:左下(BL), 1:右下(BR), 2:右上(TR), 3:左上(TL)
const faces = [
  { // 左面 (-x)
    dir: [ -1,  0,  0, ],
    corners: [
      { pos: [ 0, 0, 0 ], uv: [ 0, 0 ] },
      { pos: [ 0, 0, 1 ], uv: [ 1, 0 ] },
      { pos: [ 0, 1, 1 ], uv: [ 1, 1 ] },
      { pos: [ 0, 1, 0 ], uv: [ 0, 1 ] },
    ],
  },
  { // 右面 (+x)
    dir: [  1,  0,  0, ],
    corners: [
      { pos: [ 1, 0, 1 ], uv: [ 0, 0 ] },
      { pos: [ 1, 0, 0 ], uv: [ 1, 0 ] },
      { pos: [ 1, 1, 0 ], uv: [ 1, 1 ] },
      { pos: [ 1, 1, 1 ], uv: [ 0, 1 ] },
    ],
  },
  { // 下面 (-y)
    dir: [  0, -1,  0, ],
    corners: [
      { pos: [ 0, 0, 0 ], uv: [ 0, 0 ] },
      { pos: [ 1, 0, 0 ], uv: [ 1, 0 ] },
      { pos: [ 1, 0, 1 ], uv: [ 1, 1 ] },
      { pos: [ 0, 0, 1 ], uv: [ 0, 1 ] },
    ],
  },
  { // 上面 (+y)
    dir: [  0,  1,  0, ],
    corners: [
      { pos: [ 0, 1, 1 ], uv: [ 0, 0 ] },
      { pos: [ 1, 1, 1 ], uv: [ 1, 0 ] },
      { pos: [ 1, 1, 0 ], uv: [ 1, 1 ] },
      { pos: [ 0, 1, 0 ], uv: [ 0, 1 ] },
    ],
  },
  { // 后面 (-z)
    dir: [  0,  0, -1, ],
    corners: [
      { pos: [ 1, 0, 0 ], uv: [ 0, 0 ] },
      { pos: [ 0, 0, 0 ], uv: [ 1, 0 ] },
      { pos: [ 0, 1, 0 ], uv: [ 1, 1 ] },
      { pos: [ 1, 1, 0 ], uv: [ 0, 1 ] },
    ],
  },
  { // 前面 (+z)
    dir: [  0,  0,  1, ],
    corners: [
      { pos: [ 0, 0, 1 ], uv: [ 0, 0 ] },
      { pos: [ 1, 0, 1 ], uv: [ 1, 0 ] },
      { pos: [ 1, 1, 1 ], uv: [ 1, 1 ] },
      { pos: [ 0, 1, 1 ], uv: [ 0, 1 ] },
    ],
  },
];

const colorMap = {
  1: [0.2, 0.8, 0.2], // 草地
  2: [0.5, 0.3, 0.1], // 泥土
  3: [0.1, 0.4, 0.9], // 水
  4: [0.4, 0.2, 0.0], // 木头
  5: [0.1, 0.5, 0.1], // 树叶
};

self.onmessage = function(e) {
  const { data, chunkSize, chunkX, chunkZ } = e.data;
  
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const colors = [];

  function getVoxel(vx, vy, vz) {
    if (vx < 0 || vx >= chunkSize || vy < 0 || vy >= chunkSize || vz < 0 || vz >= chunkSize) {
      return 0; // 边界外视为空气进行面剔除
    }
    const index = vy * chunkSize * chunkSize + vz * chunkSize + vx;
    return data[index];
  }

  for (let y = 0; y < chunkSize; ++y) {
    for (let z = 0; z < chunkSize; ++z) {
      for (let x = 0; x < chunkSize; ++x) {
        const voxel = getVoxel(x, y, z);
        if (voxel !== 0) {
          const baseColor = colorMap[voxel] || [1, 1, 1];
          // 全局坐标用于棋盘格变色逻辑同步
          const worldX = chunkX * chunkSize + x;
          const worldZ = chunkZ * chunkSize + z;
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

  // 转换为 TypedArrays 以使用可转移对象
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