export class Pathfinder {
    static findPath(start, goal, worldManager, maxNodes = 1500) {
        if (!start || !goal || !worldManager) return null;

        // Start and goal should be integers
        start = { x: Math.floor(start.x), y: Math.floor(start.y), z: Math.floor(start.z) };
        goal = { x: Math.floor(goal.x), y: Math.floor(goal.y), z: Math.floor(goal.z) };

        const openSet = new BinaryHeap(node => node.f);
        const openSetMap = new Map();
        const closedSet = new Set();
        
        const startNode = {
            ...start,
            g: 0,
            h: this.heuristic(start, goal),
            f: this.heuristic(start, goal),
            parent: null
        };

        const startKey = `${start.x},${start.y},${start.z}`;
        openSet.push(startNode);
        openSetMap.set(startKey, startNode);

        let nodesSearched = 0;

        while (openSet.size() > 0 && nodesSearched < maxNodes) {
            const current = openSet.pop();
            const currentKey = `${current.x},${current.y},${current.z}`;
            openSetMap.delete(currentKey);
            nodesSearched++;

            if (current.x === goal.x && current.y === goal.y && current.z === goal.z) {
                return this.reconstructPath(current);
            }

            closedSet.add(currentKey);

            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y},${neighbor.z}`;
                if (closedSet.has(neighborKey)) {
                    continue;
                }

                if (!this.isTraversable(neighbor.x, neighbor.y, neighbor.z, worldManager, current)) {
                    continue;
                }

                const tentativeG = current.g + 1;
                
                let neighborNode = openSetMap.get(neighborKey);

                if (!neighborNode) {
                    neighborNode = {
                        ...neighbor,
                        g: tentativeG,
                        h: this.heuristic(neighbor, goal),
                        f: tentativeG + this.heuristic(neighbor, goal),
                        parent: current
                    };
                    openSet.push(neighborNode);
                    openSetMap.set(neighborKey, neighborNode);
                } else if (tentativeG < neighborNode.g) {
                    neighborNode.g = tentativeG;
                    neighborNode.f = tentativeG + neighborNode.h;
                    neighborNode.parent = current;
                    // Note: BinaryHeap needs update if f score changes, but our simple implementation might not support it easily.
                    // Instead, we can re-push the node, and it will be handled by the pop logic if we check if it's still in openSetMap
                    // or we can implement a proper update. For now, let's just re-push and the pop will pick the best one.
                    // Actually, if we re-push, we'd have duplicates in openSet.
                    // Better to just rebuild or use a more sophisticated heap.
                    // Given it's A*, usually we just re-push or use a heap that supports 'decreaseKey'.
                    // For simplicity, let's add a 'rescoreElement' to BinaryHeap.
                    openSet.rescoreElement(neighborNode);
                }
            }
        }

        return null; // No path found or limit reached
    }

    static heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
    }

    static getNeighbors(node) {
        const neighbors = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    if (dx === 0 && dy === 0 && dz === 0) continue;
                    neighbors.push({ x: node.x + dx, y: node.y + dy, z: node.z + dz });
                }
            }
        }
        return neighbors;
    }

    static isTraversable(x, y, z, worldManager, currentNode = null) {
        const blockType = worldManager.getBlock(x, y, z);
        const blockAbove = worldManager.getBlock(x, y + 1, z);
        const blockBelow = worldManager.getBlock(x, y - 1, z);
        
        // 1. (x, y, z) is air/water
        const currentOk = (blockType === 0 || blockType === 3);
        // 2. (x, y-1, z) is solid
        let belowOk = (blockBelow !== 0 && blockBelow !== 3);
        
        if (!belowOk && currentNode && x === currentNode.x && z === currentNode.z && y === currentNode.y + 1) {
            const jumpOffBlock = worldManager.getBlock(currentNode.x, currentNode.y - 1, currentNode.z);
            if (jumpOffBlock !== 0 && jumpOffBlock !== 3) {
                belowOk = true;
            }
        }
        
        // 3. (x, y+1, z) is air/water (2-block height clearance)
        const aboveOk = (blockAbove === 0 || blockAbove === 3);

        // 核心修复: 跳跃过程中的高度校验 (Bug 60)
        // 如果是从低处往高处跳 (y = currentNode.y + 1)，
        // 则当前格子的上方 (currentNode.y + 2) 必须也是空气，否则会撞头。
        let jumpClearanceOk = true;
        if (currentNode && y === currentNode.y + 1) {
            const headSpaceVoxel = worldManager.getBlock(currentNode.x, currentNode.y + 2, currentNode.z);
            if (headSpaceVoxel !== 0 && headSpaceVoxel !== 3) {
                jumpClearanceOk = false;
            }
        }
        
        // 4. 对角线穿角检测 (Bug 39)
        let diagonalOk = true;
        if (currentNode) {
            const dx = Math.abs(x - currentNode.x);
            const dz = Math.abs(z - currentNode.z);
            if (dx === 1 && dz === 1) {
                // 检查两个相邻的水平格子
                const corner1 = worldManager.getBlock(currentNode.x, currentNode.y, z);
                const corner2 = worldManager.getBlock(x, currentNode.y, currentNode.z);
                const corner1Above = worldManager.getBlock(currentNode.x, currentNode.y + 1, z);
                const corner2Above = worldManager.getBlock(x, currentNode.y + 1, currentNode.z);
                
                // 如果任意一个角落（或其上方，因为需要两格高）是实体墙，则判定被卡住无法斜穿
                const c1Blocked = (corner1 !== 0 && corner1 !== 3) || (corner1Above !== 0 && corner1Above !== 3);
                const c2Blocked = (corner2 !== 0 && corner2 !== 3) || (corner2Above !== 0 && corner2Above !== 3);
                
                if (c1Blocked || c2Blocked) {
                    diagonalOk = false;
                }
            }
        }
        
        return currentOk && belowOk && aboveOk && jumpClearanceOk && diagonalOk;
    }

    static reconstructPath(node) {
        const path = [];
        let current = node;
        while (current) {
            path.push({ x: current.x, y: current.y, z: current.z });
            current = current.parent;
        }
        return path.reverse();
    }
}

class BinaryHeap {
    constructor(scoreFunction) {
        this.content = [];
        this.scoreFunction = scoreFunction;
    }

    push(element) {
        // 为元素添加用于追踪在 content 中位置的属性
        element._heapIdx = this.content.length;
        this.content.push(element);
        this.bubbleUp(this.content.length - 1);
    }

    pop() {
        if (this.content.length === 0) return null;
        const result = this.content[0];
        result._heapIdx = -1;
        const end = this.content.pop();
        if (this.content.length > 0) {
            this.content[0] = end;
            end._heapIdx = 0;
            this.sinkDown(0);
        }
        return result;
    }

    size() {
        return this.content.length;
    }

    rescoreElement(node) {
        if (node._heapIdx != null && node._heapIdx !== -1) {
            this.bubbleUp(node._heapIdx);
        }
    }

    bubbleUp(n) {
        const element = this.content[n];
        const score = this.scoreFunction(element);
        while (n > 0) {
            const parentN = Math.floor((n + 1) / 2) - 1;
            const parent = this.content[parentN];
            if (score >= this.scoreFunction(parent)) break;
            
            // 交换内容并更新索引
            this.content[parentN] = element;
            element._heapIdx = parentN;
            this.content[n] = parent;
            parent._heapIdx = n;
            
            n = parentN;
        }
    }

    sinkDown(n) {
        const length = this.content.length;
        const element = this.content[n];
        const elemScore = this.scoreFunction(element);

        while (true) {
            const child2N = (n + 1) * 2;
            const child1N = child2N - 1;
            let swap = null;
            let child1Score;
            if (child1N < length) {
                const child1 = this.content[child1N];
                child1Score = this.scoreFunction(child1);
                if (child1Score < elemScore) swap = child1N;
            }
            if (child2N < length) {
                const child2 = this.content[child2N];
                const child2Score = this.scoreFunction(child2);
                if (child2Score < (swap == null ? elemScore : child1Score)) swap = child2N;
            }

            if (swap == null) break;
            
            this.content[n] = this.content[swap];
            this.content[n]._heapIdx = n;
            this.content[swap] = element;
            element._heapIdx = swap;
            
            n = swap;
        }
    }
}
