export class Pathfinder {
    static findPath(start, goal, worldManager, maxNodes = 500) {
        if (!start || !goal || !worldManager) return null;

        // Start and goal should be integers
        start = { x: Math.floor(start.x), y: Math.floor(start.y), z: Math.floor(start.z) };
        goal = { x: Math.floor(goal.x), y: Math.floor(goal.y), z: Math.floor(goal.z) };

        const openSet = [];
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

        while (openSet.length > 0 && nodesSearched < maxNodes) {
            // Sort openSet by f value (priority queue simulation)
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
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
        // Traversable if it's air (0) or water (3)
        return blockType === 0 || blockType === 3;
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
