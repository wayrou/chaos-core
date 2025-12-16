// ============================================================================
// CHAOS CORE - NODE MAP GENERATOR
// Generate floor node maps with interconnected rooms
// ============================================================================

import { RoomNode, RoomType } from "./types";
import { NodeMap } from "./campaign";
import { Difficulty } from "./campaign";

// ----------------------------------------------------------------------------
// NODE MAP GENERATION
// ----------------------------------------------------------------------------

/**
 * Generate a node map for a floor
 */
export function generateNodeMap(
  floorIndex: number,
  floorCount: number,
  difficulty: Difficulty,
  rngSeed: string
): NodeMap {
  const rng = createSeededRNG(rngSeed + `_floor${floorIndex}`);
  
  // Determine node count (8-14, scale by difficulty)
  const baseCount = 10;
  const difficultyBonus = difficulty === "hard" ? 2 : difficulty === "easy" ? -2 : 0;
  const nodeCount = Math.max(8, Math.min(14, baseCount + difficultyBonus + rng.nextInt(-1, 1)));
  
  // Generate nodes
  const nodes: RoomNode[] = [];
  const nodeIds: string[] = [];
  
  // Start node
  const startNode: RoomNode = {
    id: `floor_${floorIndex}_start`,
    label: "Start",
    type: "rest",
    position: { x: 0, y: 0 },
    visited: true,
  };
  nodes.push(startNode);
  nodeIds.push(startNode.id);
  
  // Generate middle nodes
  const middleCount = nodeCount - 2; // -2 for start and exit
  const nodeTypes: RoomType[] = ["battle", "battle", "battle", "shop", "rest", "event"];
  
  for (let i = 0; i < middleCount; i++) {
    const nodeId = `floor_${floorIndex}_node_${i}`;
    nodeIds.push(nodeId);
    
    // Determine node type (weighted)
    let nodeType: RoomType = "battle"; // Default
    const typeRoll = rng.nextFloat();
    
    if (typeRoll < 0.5) {
      nodeType = "battle";
    } else if (typeRoll < 0.65) {
      nodeType = "shop";
    } else if (typeRoll < 0.8) {
      nodeType = "rest";
    } else if (typeRoll < 0.9) {
      nodeType = "event";
    } else {
      nodeType = "battle"; // Elite battle chance
    }
    
    // Position nodes in a branching path layout
    const x = Math.floor(i / 3) + 1;
    const y = (i % 3) - 1;
    
    const node: RoomNode = {
      id: nodeId,
      label: getNodeLabel(nodeType, i),
      type: nodeType,
      position: { x, y },
      visited: false,
    };
    
    nodes.push(node);
  }
  
  // Exit node
  const exitNode: RoomNode = {
    id: `floor_${floorIndex}_exit`,
    label: "Exit",
    type: "rest", // Exit is treated as rest/safe zone
    position: { x: Math.floor(middleCount / 3) + 2, y: 0 },
    visited: false,
  };
  nodes.push(exitNode);
  nodeIds.push(exitNode.id);
  
  // Generate connections (ensure path from start to exit)
  const connections: Record<string, string[]> = {};
  
  // Connect start to first nodes
  connections[startNode.id] = nodeIds.slice(1, Math.min(4, nodeIds.length - 1));
  
  // Connect middle nodes in branching pattern
  for (let i = 1; i < nodeIds.length - 1; i++) {
    const currentId = nodeIds[i];
    const connected: string[] = [];
    
    // Connect to next layer
    const nextLayerStart = Math.floor((i - 1) / 3) * 3 + 4;
    if (nextLayerStart < nodeIds.length - 1) {
      for (let j = 0; j < 3 && nextLayerStart + j < nodeIds.length - 1; j++) {
        connected.push(nodeIds[nextLayerStart + j]);
      }
    }
    
    // Connect to exit if on last layer
    const currentLayer = Math.floor((i - 1) / 3);
    const totalLayers = Math.floor((nodeIds.length - 2) / 3);
    if (currentLayer === totalLayers - 1) {
      connected.push(exitNode.id);
    }
    
    // Also connect to adjacent nodes in same layer
    if (i > 1 && i < nodeIds.length - 1) {
      const sameLayerStart = Math.floor((i - 1) / 3) * 3 + 1;
      const sameLayerIndex = (i - 1) % 3;
      if (sameLayerIndex > 0) {
        connected.push(nodeIds[sameLayerStart + sameLayerIndex - 1]);
      }
      if (sameLayerIndex < 2 && sameLayerStart + sameLayerIndex + 1 < nodeIds.length - 1) {
        connected.push(nodeIds[sameLayerStart + sameLayerIndex + 1]);
      }
    }
    
    connections[currentId] = connected;
  }
  
  // Exit has no outgoing connections
  connections[exitNode.id] = [];
  
  return {
    nodes,
    connections,
    startNodeId: startNode.id,
    exitNodeId: exitNode.id,
  };
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
    tavern: ["Tavern"],
    field_node: ["Field Exploration"],
  };
  
  const options = labels[type] || ["Room"];
  return options[index % options.length];
}

// ----------------------------------------------------------------------------
// SEEDED RNG (same as encounter generator)
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

