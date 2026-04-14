// ============================================================================
// CHAOS CORE - NODE MAP GENERATOR
// Generate floor node maps with branching paths (forward-only)
// ============================================================================
// ----------------------------------------------------------------------------
// NODE MAP GENERATION
// ----------------------------------------------------------------------------
/**
 * Generate a node map for a floor with branching paths
 */
export function generateNodeMap(floorIndex, _floorCount, difficulty, rngSeed, enemyDensity = "normal", includeKeyRooms = true) {
    const rng = createSeededRNG(rngSeed + `_floor${floorIndex}`);
    // Determine node count (8-12, scale by difficulty)
    const baseCount = 10;
    const difficultyBonus = difficulty === "hard" ? 2 : difficulty === "easy" ? -2 : 0;
    const densityBonus = enemyDensity === "high" ? 1 : enemyDensity === "low" ? -1 : 0;
    const nodeCount = Math.max(8, Math.min(13, baseCount + difficultyBonus + densityBonus + rng.nextInt(-1, 1)));
    // Choose template based on seed
    const templateRoll = rng.nextFloat();
    let template;
    if (templateRoll < 0.6) {
        template = "split_rejoin"; // 60% - most common
    }
    else if (templateRoll < 0.9) {
        template = "risk_detour"; // 30% - optional side paths
    }
    else {
        template = "forked_corridor"; // 10% - rare mutually exclusive
    }
    // Generate nodes based on template
    let nodes = [];
    let connections = {};
    switch (template) {
        case "split_rejoin":
            ({ nodes, connections } = generateSplitRejoinMap(floorIndex, nodeCount, rng, enemyDensity));
            break;
        case "risk_detour":
            ({ nodes, connections } = generateRiskDetourMap(floorIndex, nodeCount, rng, enemyDensity));
            break;
        case "forked_corridor":
            ({ nodes, connections } = generateForkedCorridorMap(floorIndex, nodeCount, rng, enemyDensity));
            break;
    }
    ensureFieldNodes(nodes, floorIndex, rng);
    // Ensure 2 Key Rooms per floor
    if (includeKeyRooms) {
        ensureKeyRooms(nodes, connections, floorIndex, rng);
    }
    // Find start and exit nodes
    const startNode = nodes.find(n => n.id.includes("_start")) || nodes[0];
    const exitNode = nodes.find(n => n.id.includes("_exit")) || nodes[nodes.length - 1];
    // Ensure valid path from start to exit
    ensurePathToExit(startNode.id, exitNode.id, nodes, connections);
    return {
        nodes,
        connections,
        startNodeId: startNode.id,
        exitNodeId: exitNode.id,
    };
}
/**
 * Generate split-and-rejoin pattern (most common)
 */
function generateSplitRejoinMap(floorIndex, nodeCount, rng, enemyDensity) {
    const nodes = [];
    const connections = {};
    // Start node
    const startNode = createStartNode(floorIndex, rng);
    nodes.push(startNode);
    // Calculate depth layers (3-4 layers)
    const layers = Math.max(3, Math.min(4, Math.floor(nodeCount / 3)));
    const nodesPerLayer = Math.floor((nodeCount - 2) / layers); // -2 for start and exit
    let nodeCounter = 0;
    const layerNodes = [];
    // Generate layers
    for (let layer = 0; layer < layers; layer++) {
        const layerNodeIds = [];
        const nodesInLayer = layer === layers - 1 ? (nodeCount - 2) - (nodesPerLayer * (layers - 1)) : nodesPerLayer;
        for (let i = 0; i < nodesInLayer; i++) {
            const nodeId = `floor_${floorIndex}_node_${nodeCounter++}`;
            layerNodeIds.push(nodeId);
            const nodeType = rollNodeType(rng, layer, layers, enemyDensity);
            const node = createGeneratedNode(nodeId, nodeType, nodeCounter, { x: layer + 1, y: i - Math.floor(nodesInLayer / 2) }, rng);
            nodes.push(node);
        }
        layerNodes.push(layerNodeIds);
    }
    // Connect start to first layer
    connections[startNode.id] = layerNodes[0];
    // Connect layers (split and rejoin pattern)
    for (let layer = 0; layer < layers - 1; layer++) {
        const currentLayer = layerNodes[layer];
        const nextLayer = layerNodes[layer + 1];
        // Each node in current layer connects to 1-2 nodes in next layer
        for (const currentNodeId of currentLayer) {
            const nextConnections = [];
            // Connect to at least one node in next layer
            const nextIndex = rng.nextInt(0, nextLayer.length - 1);
            nextConnections.push(nextLayer[nextIndex]);
            // 50% chance to connect to second node (if available)
            if (nextLayer.length > 1 && rng.nextFloat() < 0.5) {
                const secondIndex = rng.nextInt(0, nextLayer.length - 1);
                if (secondIndex !== nextIndex && !nextConnections.includes(nextLayer[secondIndex])) {
                    nextConnections.push(nextLayer[secondIndex]);
                }
            }
            connections[currentNodeId] = nextConnections;
        }
    }
    // Exit node
    const exitNode = createExitNode(floorIndex, { x: layers + 1, y: 0 }, rng);
    nodes.push(exitNode);
    // Connect last layer to exit
    const lastLayer = layerNodes[layers - 1];
    for (const nodeId of lastLayer) {
        if (!connections[nodeId]) {
            connections[nodeId] = [];
        }
        connections[nodeId].push(exitNode.id);
    }
    return { nodes, connections };
}
/**
 * Generate risk detour pattern (optional side paths)
 */
function generateRiskDetourMap(floorIndex, nodeCount, rng, enemyDensity) {
    const nodes = [];
    const connections = {};
    // Start node
    const startNode = createStartNode(floorIndex, rng);
    nodes.push(startNode);
    // Main path (linear with occasional detours)
    const mainPathLength = nodeCount - 2; // -2 for start and exit
    const mainPath = [];
    for (let i = 0; i < mainPathLength; i++) {
        const nodeId = `floor_${floorIndex}_node_${i}`;
        mainPath.push(nodeId);
        const nodeType = rollNodeType(rng, i, mainPathLength, enemyDensity);
        const node = createGeneratedNode(nodeId, nodeType, i, { x: i + 1, y: 0 }, rng);
        nodes.push(node);
    }
    // Connect main path
    connections[startNode.id] = [mainPath[0]];
    for (let i = 0; i < mainPath.length - 1; i++) {
        connections[mainPath[i]] = [mainPath[i + 1]];
    }
    // Add 1-2 detour nodes (optional side paths)
    const detourCount = rng.nextInt(1, 2);
    for (let d = 0; d < detourCount; d++) {
        const detourFromIndex = rng.nextInt(0, mainPath.length - 2); // Can't detour from last node
        const detourFromId = mainPath[detourFromIndex];
        const detourToId = mainPath[detourFromIndex + 1];
        const detourNodeId = `floor_${floorIndex}_detour_${d}`;
        const detourType = (rng.nextFloat() < 0.5 ? "battle" : "treasure");
        const detourNode = createGeneratedNode(detourNodeId, detourType, d, { x: detourFromIndex + 1, y: d % 2 === 0 ? 1 : -1 }, rng, detourType === "battle" ? "Risk Detour" : undefined);
        nodes.push(detourNode);
        // Detour branches from main path and rejoins
        if (!connections[detourFromId]) {
            connections[detourFromId] = [];
        }
        connections[detourFromId].push(detourNodeId);
        connections[detourNodeId] = [detourToId];
    }
    // Exit node
    const exitNode = createExitNode(floorIndex, { x: mainPathLength + 1, y: 0 }, rng);
    nodes.push(exitNode);
    connections[mainPath[mainPath.length - 1]] = [exitNode.id];
    return { nodes, connections };
}
/**
 * Generate forked corridor pattern (rare, mutually exclusive paths)
 */
function generateForkedCorridorMap(floorIndex, nodeCount, rng, enemyDensity) {
    const nodes = [];
    const connections = {};
    // Start node
    const startNode = createStartNode(floorIndex, rng);
    nodes.push(startNode);
    // Fork into 2 paths
    const pathLength = Math.floor((nodeCount - 3) / 2); // -3 for start, fork, exit
    const leftPath = [];
    const rightPath = [];
    for (let i = 0; i < pathLength; i++) {
        // Left path
        const leftNodeId = `floor_${floorIndex}_left_${i}`;
        leftPath.push(leftNodeId);
        const leftType = rollNodeType(rng, i, pathLength, enemyDensity);
        const leftNode = createGeneratedNode(leftNodeId, leftType, i, { x: i + 1, y: -1 }, rng);
        nodes.push(leftNode);
        // Right path
        const rightNodeId = `floor_${floorIndex}_right_${i}`;
        rightPath.push(rightNodeId);
        const rightType = rollNodeType(rng, i, pathLength, enemyDensity);
        const rightNode = createGeneratedNode(rightNodeId, rightType, i, { x: i + 1, y: 1 }, rng);
        nodes.push(rightNode);
    }
    // Connect paths
    connections[startNode.id] = [leftPath[0], rightPath[0]];
    for (let i = 0; i < pathLength - 1; i++) {
        connections[leftPath[i]] = [leftPath[i + 1]];
        connections[rightPath[i]] = [rightPath[i + 1]];
    }
    // Rejoin point (exit)
    const exitNode = createExitNode(floorIndex, { x: pathLength + 1, y: 0 }, rng);
    nodes.push(exitNode);
    connections[leftPath[pathLength - 1]] = [exitNode.id];
    connections[rightPath[pathLength - 1]] = [exitNode.id];
    return { nodes, connections };
}
/**
 * Ensure 2 Key Rooms per floor
 * Key Rooms are battle nodes with isKeyRoom flag
 */
function ensureKeyRooms(nodes, _connections, floorIndex, rng) {
    // Find battle nodes (not start/exit) that can be key rooms
    const candidateNodes = nodes.filter(n => !n.id.includes("_start") &&
        !n.id.includes("_exit") &&
        n.type === "battle" &&
        !n.isKeyRoom // Don't select already-marked key rooms
    );
    if (candidateNodes.length < 2) {
        console.warn(`[NODEMAP] Not enough battle nodes for key rooms on floor ${floorIndex}`);
        return;
    }
    // Select 2 random candidates
    const selected = [];
    const candidates = [...candidateNodes];
    for (let i = 0; i < 2 && candidates.length > 0; i++) {
        const index = rng.nextInt(0, candidates.length - 1);
        selected.push(candidates[index]);
        candidates.splice(index, 1);
    }
    // Mark as key rooms (battle nodes with flag)
    for (const node of selected) {
        node.isKeyRoom = true;
        node.label = "Key Room Battle";
    }
    console.log(`[NODEMAP] Marked ${selected.length} battle nodes as Key Rooms on floor ${floorIndex}`);
}
function createGeneratedNode(id, type, index, position, rng, labelOverride) {
    return {
        id,
        label: labelOverride || getNodeLabel(type, index, rng),
        type,
        position,
        visited: false,
        fieldNodeSeed: type === "field_node" ? rng.nextInt(1, 999999) : undefined,
    };
}
function ensureFieldNodes(nodes, floorIndex, rng) {
    const existingFieldNodes = nodes.filter(node => node.type === "field_node");
    const targetCount = nodes.length >= 10 ? 2 : 1;
    if (existingFieldNodes.length >= targetCount) {
        existingFieldNodes.forEach((node, index) => {
            if (!node.fieldNodeSeed) {
                node.fieldNodeSeed = rng.nextInt(1, 999999);
            }
            node.label = getNodeLabel("field_node", index, rng);
        });
        return;
    }
    const battleNodes = nodes.filter(node => node.type === "battle" && !node.id.includes("_start") && !node.id.includes("_exit"));
    const safeBattleConversions = Math.max(0, battleNodes.length - 3);
    let battleConversionsUsed = 0;
    const candidates = nodes.filter(node => {
        if (node.id.includes("_start") || node.id.includes("_exit")) {
            return false;
        }
        if (node.type === "field_node" || node.type === "boss" || node.type === "key_room") {
            return false;
        }
        if (node.type === "battle" && battleConversionsUsed >= safeBattleConversions) {
            return false;
        }
        return true;
    });
    candidates.sort((a, b) => {
        const priority = (node) => {
            switch (node.type) {
                case "event":
                    return 0;
                case "treasure":
                    return 1;
                case "rest":
                    return 2;
                case "shop":
                case "tavern":
                    return 3;
                case "battle":
                    return 4;
                default:
                    return 5;
            }
        };
        return priority(a) - priority(b);
    });
    const needed = targetCount - existingFieldNodes.length;
    const converted = [];
    for (const node of candidates) {
        if (converted.length >= needed) {
            break;
        }
        if (node.type === "battle" && battleConversionsUsed >= safeBattleConversions) {
            continue;
        }
        if (node.type === "battle") {
            battleConversionsUsed += 1;
        }
        node.type = "field_node";
        node.fieldNodeSeed = rng.nextInt(1, 999999);
        converted.push(node);
    }
    [...existingFieldNodes, ...converted].forEach((node, index) => {
        node.label = getNodeLabel("field_node", index, rng);
    });
    console.log(`[NODEMAP] Ensured ${existingFieldNodes.length + converted.length} field nodes on floor ${floorIndex}`);
}
/**
 * Ensure there's a valid path from start to exit
 */
function ensurePathToExit(startId, exitId, _nodes, connections) {
    // Simple BFS to verify path exists
    const visited = new Set();
    const queue = [startId];
    visited.add(startId);
    while (queue.length > 0) {
        const current = queue.shift();
        if (current === exitId) {
            return; // Path exists
        }
        const nextNodes = connections[current] || [];
        for (const nextId of nextNodes) {
            if (!visited.has(nextId)) {
                visited.add(nextId);
                queue.push(nextId);
            }
        }
    }
    // If no path found, create one
    console.warn(`[NODEMAP] No path from start to exit, creating direct connection`);
    if (!connections[startId]) {
        connections[startId] = [];
    }
    connections[startId].push(exitId);
}
/**
 * Roll node type based on position and layer
 */
function rollNodeType(rng, position, total, enemyDensity) {
    const roll = rng.nextFloat();
    const progress = position / total;
    const battleThreshold = enemyDensity === "high" ? 0.58 : enemyDensity === "low" ? 0.34 : 0.46;
    const fieldThreshold = enemyDensity === "high" ? 0.68 : enemyDensity === "low" ? 0.48 : 0.58;
    const shopThreshold = enemyDensity === "high" ? 0.77 : enemyDensity === "low" ? 0.62 : 0.70;
    const restThreshold = enemyDensity === "high" ? 0.84 : enemyDensity === "low" ? 0.79 : 0.82;
    const eventThreshold = enemyDensity === "high" ? 0.91 : enemyDensity === "low" ? 0.93 : 0.91;
    const eliteThreshold = enemyDensity === "high" ? 0.98 : enemyDensity === "low" ? 0.95 : 0.96;
    // Early nodes: more battles, fewer elites
    // Late nodes: more elites, fewer battles
    if (roll < battleThreshold) {
        return "battle";
    }
    else if (roll < fieldThreshold) {
        return "field_node";
    }
    else if (roll < shopThreshold) {
        return "shop";
    }
    else if (roll < restThreshold) {
        return "rest";
    }
    else if (roll < eventThreshold) {
        return "event";
    }
    else if (progress > 0.7 && roll < eliteThreshold) {
        return "elite"; // Elite battles more likely later
    }
    else {
        return "treasure";
    }
}
/**
 * Get label for a node based on type
 */
function getNodeLabel(type, index, rng) {
    const labels = {
        battle: ["Combat Zone", "Enemy Encounter", "Hostile Area", "Battlefield", "Kill Corridor", "War Chamber"],
        shop: ["Merchant", "Supply Depot", "Trading Post", "Relay Vendor", "Provision Kiosk"],
        rest: ["Safe Zone", "Rest Area", "Camp Site", "Recovery Nook", "Quiet Barracks"],
        event: ["Strange Occurrence", "Mystery", "Event", "Signal Echo", "Anomaly Pulse"],
        boss: ["Boss Encounter", "Elite Battle", "Command Nest"],
        elite: ["Elite Encounter", "Champion Battle", "Stronghold", "Purge Node"],
        treasure: ["Treasure Cache", "Hidden Stash", "Loot Vault", "Locked Hoard", "Spoils Locker"],
        tavern: ["Tavern"],
        field_node: ["Field Exploration", "Survey Zone", "Unmapped Pocket", "Dust Channel"],
        key_room: ["Key Room"],
    };
    const options = labels[type] || ["Room"];
    const variantIndex = (index + rng.nextInt(0, options.length - 1)) % options.length;
    return options[variantIndex];
}
function getSpecialNodeLabel(kind, floorIndex, rng) {
    const labels = kind === "start"
        ? ["Uplink Gate", "Staging Lift", "Entry Lock", "Survey Breach", "Drop Threshold"]
        : ["Descent Lift", "Spiral Hatch", "Deep Gate", "Lowering Platform", "Exit Spine"];
    return `${labels[rng.nextInt(0, labels.length - 1)]} // F${floorIndex + 1}`;
}
function createStartNode(floorIndex, rng) {
    return {
        id: `floor_${floorIndex}_start`,
        label: getSpecialNodeLabel("start", floorIndex, rng),
        type: "rest",
        position: { x: 0, y: 0 },
        visited: true,
    };
}
function createExitNode(floorIndex, position, rng) {
    return {
        id: `floor_${floorIndex}_exit`,
        label: getSpecialNodeLabel("exit", floorIndex, rng),
        type: "rest",
        position,
        visited: false,
    };
}
function createSeededRNG(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    let state = Math.abs(hash) || 1;
    return {
        nextInt(min, max) {
            state = (state * 1103515245 + 12345) & 0x7fffffff;
            const normalized = state / 0x7fffffff;
            return Math.floor(min + normalized * (max - min + 1));
        },
        nextFloat() {
            state = (state * 1103515245 + 12345) & 0x7fffffff;
            return state / 0x7fffffff;
        },
    };
}
