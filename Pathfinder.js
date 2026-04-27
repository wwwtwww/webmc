export class Pathfinder {
    static findPath(start, goal, worldManager, maxNodes = 500) {
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

                if (!this.isTraversable(neighbor.x, neighbor.y, neighbor.z, worldManager)) {
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
        return [
            { x: node.x + 1, y: node.y, z: node.z },
            { x: node.x - 1, y: node.y, z: node.z },
            { x: node.x, y: node.y + 1, z: node.z },
            { x: node.x, y: node.y - 1, z: node.z },
            { x: node.x, y: node.y, z: node.z + 1 },
            { x: node.x, y: node.y, z: node.z - 1 }
        ];
    }

    static isTraversable(x, y, z, worldManager) {
        const blockType = worldManager.getBlock(x, y, z);
        const blockAbove = worldManager.getBlock(x, y + 1, z);
        const blockBelow = worldManager.getBlock(x, y - 1, z);
        
        // 1. (x, y, z) is air/water
        const currentOk = (blockType === 0 || blockType === 3);
        // 2. (x, y-1, z) is solid
        const belowOk = (blockBelow !== 0 && blockBelow !== 3);
        // 3. (x, y+1, z) is air/water (2-block height clearance)
        const aboveOk = (blockAbove === 0 || blockAbove === 3);
        
        return currentOk && belowOk && aboveOk;
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
        this.content.push(element);
        this.bubbleUp(this.content.length - 1);
    }

    pop() {
        const result = this.content[0];
        const end = this.content.pop();
        if (this.content.length > 0) {
            this.content[0] = end;
            this.sinkDown(0);
        }
        return result;
    }

    remove(node) {
        const length = this.content.length;
        for (let i = 0; i < length; i++) {
            if (this.content[i] !== node) continue;
            const end = this.content.pop();
            if (i === length - 1) break;
            this.content[i] = end;
            this.bubbleUp(i);
            this.sinkDown(i);
            break;
        }
    }

    size() {
        return this.content.length;
    }

    rescoreElement(node) {
        this.bubbleUp(this.content.indexOf(node));
    }

    bubbleUp(n) {
        const element = this.content[n];
        const score = this.scoreFunction(element);
        while (n > 0) {
            const parentN = Math.floor((n + 1) / 2) - 1;
            const parent = this.content[parentN];
            if (score >= this.scoreFunction(parent)) break;
            this.content[parentN] = element;
            this.content[n] = parent;
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
            this.content[swap] = element;
            n = swap;
        }
    }
}
