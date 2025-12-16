// ============================================================================
// CHAOS CORE - NODE MAP GENERATOR
// Generate floor node maps with branching paths (forward-only)
// ============================================================================

import { RoomNode, RoomType } from "./types";
import { NodeMap } from "./campaign";
import { Difficulty } from "./campaign";

// ----------------------------------------------------------------------------
// NODE MAP GENERATION
// ----------------------------------------------------------------------------

/**
 * Generate a node map for a floor with branching paths
 */
export function generateNodeMap(
  floorIndex: number,
  _floorCount: number,
  difficulty: Difficulty,
  rngSeed: string
): NodeMap {
  const rng = createSeededRNG(rngSeed + `_floor${floorIndex}`);
  
  // Determine node count (8-12, scale by difficulty)
  const baseCount = 10;
  const difficultyBonus = difficulty === "hard" ? 2 : difficulty === "easy" ? -2 : 0;
  const nodeCount = Math.max(8, Math.min(12, baseCount + difficultyBonus + rng.nextInt(-1, 1)));
  
  // Choose template based on seed
  const templateRoll = rng.nextFloat();
  let template: "split_rejoin" | "risk_detour" | "forked_corridor";
  
  if (templateRoll < 0.6) {
    template = "split_rejoin"; // 60% - most common
  } else if (templateRoll < 0.9) {
    template = "risk_detour"; // 30% - optional side paths
  } else {
    template = "forked_corridor"; // 10% - rare mutually exclusive
  }
  
  // Generate nodes based on template
  let nodes: RoomNode[] = [];
  let connections: Record<string, string[]> = {};
  
  switch (template) {
    case "split_rejoin":
      ({ nodes, connections } = generateSplitRejoinMap(floorIndex, nodeCount, rng));
      break;
    case "risk_detour":
      ({ nodes, connections } = generateRiskDetourMap(floorIndex, nodeCount, rng));
      break;
    case "forked_corridor":
      ({ nodes, connections } = generateForkedCorridorMap(floorIndex, nodeCount, rng));
      break;
  }
  
  // Ensure 2 Key Rooms per floor
  ensureKeyRooms(nodes, connections, floorIndex, rng);
  
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
function generateSplitRejoinMap(
  floorIndex: number,
  nodeCount: number,
  rng: SeededRNG
): { nodes: RoomNode[]; connections: Record<string, string[]> } {
  const nodes: RoomNode[] = [];
  const connections: Record<string, string[]> = {};
  
  // Start node
  const startNode: RoomNode = {
    id: `floor_${floorIndex}_start`,
    label: "Start",
    type: "rest",
    position: { x: 0, y: 0 },
    visited: true,
  };
  nodes.push(startNode);
  
  // Calculate depth layers (3-4 layers)
  const layers = Math.max(3, Math.min(4, Math.floor(nodeCount / 3)));
  const nodesPerLayer = Math.floor((nodeCount - 2) / layers); // -2 for start and exit
  
  let nodeCounter = 0;
  const layerNodes: string[][] = [];
  
  // Generate layers
  for (let layer = 0; layer < layers; layer++) {
    const layerNodeIds: string[] = [];
    const nodesInLayer = layer === layers - 1 ? (nodeCount - 2) - (nodesPerLayer * (layers - 1)) : nodesPerLayer;
    
    for (let i = 0; i < nodesInLayer; i++) {
      const nodeId = `floor_${floorIndex}_node_${nodeCounter++}`;
      layerNodeIds.push(nodeId);
      
      const nodeType = rollNodeType(rng, layer, layers);
      const node: RoomNode = {
        id: nodeId,
        label: getNodeLabel(nodeType, nodeCounter),
        type: nodeType,
        position: { x: layer + 1, y: i - Math.floor(nodesInLayer / 2) },
        visited: false,
      };
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
      const nextConnections: string[] = [];
      
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
  const exitNode: RoomNode = {
    id: `floor_${floorIndex}_exit`,
    label: "Exit",
    type: "rest",
    position: { x: layers + 1, y: 0 },
    visited: false,
  };
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
function generateRiskDetourMap(
  floorIndex: number,
  nodeCount: number,
  rng: SeededRNG
): { nodes: RoomNode[]; connections: Record<string, string[]> } {
  const nodes: RoomNode[] = [];
  const connections: Record<string, string[]> = {};
  
  // Start node
  const startNode: RoomNode = {
    id: `floor_${floorIndex}_start`,
    label: "Start",
    type: "rest",
    position: { x: 0, y: 0 },
    visited: true,
  };
  nodes.push(startNode);
  
  // Main path (linear with occasional detours)
  const mainPathLength = nodeCount - 2; // -2 for start and exit
  const mainPath: string[] = [];
  
  for (let i = 0; i < mainPathLength; i++) {
    const nodeId = `floor_${floorIndex}_node_${i}`;
    mainPath.push(nodeId);
    
    const nodeType = rollNodeType(rng, i, mainPathLength);
    const node: RoomNode = {
      id: nodeId,
      label: getNodeLabel(nodeType, i),
      type: nodeType,
      position: { x: i + 1, y: 0 },
      visited: false,
    };
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
    const detourNode: RoomNode = {
      id: detourNodeId,
      label: "Risk Detour",
      type: (rng.nextFloat() < 0.5 ? "battle" : "treasure") as RoomType,
      position: { x: detourFromIndex + 1, y: d % 2 === 0 ? 1 : -1 },
      visited: false,
    };
    nodes.push(detourNode);
    
    // Detour branches from main path and rejoins
    if (!connections[detourFromId]) {
      connections[detourFromId] = [];
    }
    connections[detourFromId].push(detourNodeId);
    connections[detourNodeId] = [detourToId];
  }
  
  // Exit node
  const exitNode: RoomNode = {
    id: `floor_${floorIndex}_exit`,
    label: "Exit",
    type: "rest",
    position: { x: mainPathLength + 1, y: 0 },
    visited: false,
  };
  nodes.push(exitNode);
  connections[mainPath[mainPath.length - 1]] = [exitNode.id];
  
  return { nodes, connections };
}

/**
 * Generate forked corridor pattern (rare, mutually exclusive paths)
 */
function generateForkedCorridorMap(
  floorIndex: number,
  nodeCount: number,
  rng: SeededRNG
): { nodes: RoomNode[]; connections: Record<string, string[]> } {
  const nodes: RoomNode[] = [];
  const connections: Record<string, string[]> = {};
  
  // Start node
  const startNode: RoomNode = {
    id: `floor_${floorIndex}_start`,
    label: "Start",
    type: "rest",
    position: { x: 0, y: 0 },
    visited: true,
  };
  nodes.push(startNode);
  
  // Fork into 2 paths
  const pathLength = Math.floor((nodeCount - 3) / 2); // -3 for start, fork, exit
  const leftPath: string[] = [];
  const rightPath: string[] = [];
  
  for (let i = 0; i < pathLength; i++) {
    // Left path
    const leftNodeId = `floor_${floorIndex}_left_${i}`;
    leftPath.push(leftNodeId);
    const leftNode: RoomNode = {
      id: leftNodeId,
      label: getNodeLabel(rollNodeType(rng, i, pathLength), i),
      type: rollNodeType(rng, i, pathLength),
      position: { x: i + 1, y: -1 },
      visited: false,
    };
    nodes.push(leftNode);
    
    // Right path
    const rightNodeId = `floor_${floorIndex}_right_${i}`;
    rightPath.push(rightNodeId);
    const rightNode: RoomNode = {
      id: rightNodeId,
      label: getNodeLabel(rollNodeType(rng, i, pathLength), i),
      type: rollNodeType(rng, i, pathLength),
      position: { x: i + 1, y: 1 },
      visited: false,
    };
    nodes.push(rightNode);
  }
  
  // Connect paths
  connections[startNode.id] = [leftPath[0], rightPath[0]];
  
  for (let i = 0; i < pathLength - 1; i++) {
    connections[leftPath[i]] = [leftPath[i + 1]];
    connections[rightPath[i]] = [rightPath[i + 1]];
  }
  
  // Rejoin point (exit)
  const exitNode: RoomNode = {
    id: `floor_${floorIndex}_exit`,
    label: "Exit",
    type: "rest",
    position: { x: pathLength + 1, y: 0 },
    visited: false,
  };
  nodes.push(exitNode);
  
  connections[leftPath[pathLength - 1]] = [exitNode.id];
  connections[rightPath[pathLength - 1]] = [exitNode.id];
  
  return { nodes, connections };
}

/**
 * Ensure 2 Key Rooms per floor
 */
function ensureKeyRooms(
  nodes: RoomNode[],
  connections: Record<string, string[]>,
  floorIndex: number,
  rng: SeededRNG
): void {
  // Find non-start, non-exit nodes that can be key rooms
  const candidateNodes = nodes.filter(
    n => !n.id.includes("_start") && !n.id.includes("_exit") && n.type !== "key_room"
  );
  
  if (candidateNodes.length < 2) {
    console.warn(`[NODEMAP] Not enough candidate nodes for key rooms on floor ${floorIndex}`);
    return;
  }
  
  // Select 2 random candidates
  const selected: RoomNode[] = [];
  const candidates = [...candidateNodes];
  
  for (let i = 0; i < 2 && candidates.length > 0; i++) {
    const index = rng.nextInt(0, candidates.length - 1);
    selected.push(candidates[index]);
    candidates.splice(index, 1);
  }
  
  // Convert to key rooms
  for (const node of selected) {
    node.type = "key_room";
    node.label = "Key Room";
  }
}

/**
 * Ensure there's a valid path from start to exit
 */
function ensurePathToExit(
  startId: string,
  exitId: string,
  _nodes: RoomNode[],
  connections: Record<string, string[]>
): void {
  // Simple BFS to verify path exists
  const visited = new Set<string>();
  const queue: string[] = [startId];
  visited.add(startId);
  
  while (queue.length > 0) {
    const current = queue.shift()!;
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
function rollNodeType(rng: SeededRNG, position: number, total: number): RoomType {
  const roll = rng.nextFloat();
  const progress = position / total;
  
  // Early nodes: more battles, fewer elites
  // Late nodes: more elites, fewer battles
  if (roll < 0.5) {
    return "battle";
  } else if (roll < 0.65) {
    return "shop";
  } else if (roll < 0.8) {
    return "rest";
  } else if (roll < 0.9) {
    return "event";
  } else if (progress > 0.7 && roll < 0.95) {
    return "elite"; // Elite battles more likely later
  } else {
    return "treasure";
  }
}

/**
 * Get label for a node based on type
 */
function getNodeLabel(type: RoomType, index: number): string {
  const labels: Record<RoomType, string[]> = {
    battle: ["Combat Zone", "Enemy Encounter", "Hostile Area", "Battlefield"],
    shop: ["Merchant", "Supply Depot", "Trading Post"],
    rest: ["Safe Zone", "Rest Area", "Camp Site"],
    event: ["Strange Occurrence", "Mystery", "Event"],
    boss: ["Boss Encounter", "Elite Battle"],
    elite: ["Elite Encounter", "Champion Battle", "Stronghold"],
    treasure: ["Treasure Cache", "Hidden Stash", "Loot Vault"],
    tavern: ["Tavern"],
    field_node: ["Field Exploration"],
    key_room: ["Key Room"],
  };
  
  const options = labels[type] || ["Room"];
  return options[index % options.length];
}

// ----------------------------------------------------------------------------
// SEEDED RNG
// ----------------------------------------------------------------------------

interface SeededRNG {
  nextInt(min: number, max: number): number;
  nextFloat(): number;
}

function createSeededRNG(seed: string): SeededRNG {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  let state = Math.abs(hash) || 1;
  
  return {
    nextInt(min: number, max: number): number {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      const normalized = state / 0x7fffffff;
      return Math.floor(min + normalized * (max - min + 1));
    },
    nextFloat(): number {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    },
  };
}
