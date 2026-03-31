// ============================================================================
// SUPPLY CHAIN SYSTEM v1
// Manages supply flow, link integrity, and supply priority profiles
// ============================================================================

import { GameState, RoomNode, RoomId } from "./types";
import { getCurrentOperation, getCurrentFloor } from "./ops";
import { getActiveRun } from "./campaignManager";
import { updateGameState } from "../state/gameStore";

// ============================================================================
// TYPES
// ============================================================================

export type SupplyProfile = "balanced" | "forward_push" | "defensive_hold" | "consolidation";

export type SupplyHealthTier = "stable" | "strained" | "critical";

export interface SupplyEdgeState {
  integrity: number; // 0-100, affects bandwidth
  lastAttackedStep?: number;
  isThreatened?: boolean;
}

export interface SupplyState {
  supplyProfile: SupplyProfile;
  supplyStep: number; // Increments after each room clear
  edgeState: Record<string, SupplyEdgeState>; // edgeId -> state
  flowCache?: Record<string, number>; // edgeId -> bandwidth
  lastOverlayViewedStep?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_EDGE_INTEGRITY = 100;
const LINK_ATTACK_DAMAGE_MIN = 10;
const LINK_ATTACK_DAMAGE_MAX = 25;
const BASE_SUPPLY_SOURCE_POWER = 100;
const SUPPLY_DECAY_PER_DEPTH = 0.85; // 15% decay per depth level

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Get or initialize supply state for current operation
 */
export function getSupplyState(state: GameState): SupplyState | null {
  const operation = getCurrentOperation(state);
  if (!operation) return null;
  
  // Supply state is stored on the operation
  const supplyState = (operation as any).supplyState as SupplyState | undefined;
  
  if (!supplyState) {
    // Initialize new supply state
    const initialState: SupplyState = {
      supplyProfile: "balanced",
      supplyStep: 0,
      edgeState: {},
      flowCache: {},
    };
    
    // Initialize all edges with default integrity
    const floor = getCurrentFloor(operation);
    if (floor) {
      const nodes = floor.nodes || floor.rooms || [];
      for (const node of nodes) {
        if (node.connections) {
          for (const toNodeId of node.connections) {
            const edgeId = getEdgeId(node.id, toNodeId);
            initialState.edgeState[edgeId] = {
              integrity: DEFAULT_EDGE_INTEGRITY,
            };
          }
        }
      }
    }
    
    return initialState;
  }
  
  return supplyState;
}

/**
 * Update supply state (synchronous)
 */
export function updateSupplyState(
  state: GameState,
  updater: (supply: SupplyState) => SupplyState
): void {
  const operation = getCurrentOperation(state);
  if (!operation) return;
  
  const currentSupply = getSupplyState(state);
  if (!currentSupply) return;
  
  const updatedSupply = updater(currentSupply);
  
  // Update operation with new supply state (synchronous)
  updateGameState((prev: GameState) => {
    if (!prev.operation) return prev;
    
    return {
      ...prev,
      operation: {
        ...prev.operation,
        supplyState: updatedSupply,
      } as any,
    };
  });
}

// ============================================================================
// EDGE ID HELPERS
// ============================================================================

export function getEdgeId(fromId: RoomId, toId: RoomId): string {
  return `${fromId}->${toId}`;
}

// ============================================================================
// SUPPLY FLOW COMPUTATION
// ============================================================================

/**
 * Compute supply flow for all edges based on current state
 */
export function computeSupplyFlow(
  nodes: RoomNode[],
  supplyState: SupplyState,
  profile: SupplyProfile
): Record<string, number> {
  const flowCache: Record<string, number> = {};
  
  // Build node map for quick lookup
  const nodeMap = new Map<string, RoomNode>();
  const nodeDepth = new Map<string, number>(); // Depth from start
  
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }
  
  // Find start node (first node or node with no incoming connections)
  const startNode = nodes.find(n => {
    // Check if any node connects TO this node
    const hasIncoming = nodes.some(other => 
      other.connections?.includes(n.id)
    );
    return !hasIncoming;
  }) || nodes[0];
  
  // Compute depths using BFS from start
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: startNode.id, depth: 0 }];
  nodeDepth.set(startNode.id, 0);
  
  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;
    const node = nodeMap.get(nodeId);
    if (!node || !node.connections) continue;
    
    for (const connectedId of node.connections) {
      if (!nodeDepth.has(connectedId)) {
        nodeDepth.set(connectedId, depth + 1);
        queue.push({ nodeId: connectedId, depth: depth + 1 });
      }
    }
  }
  
  // Compute supply potential for each node (starting from sources)
  const supplyPotential = new Map<string, number>();
  
  // Start node is a source
  supplyPotential.set(startNode.id, BASE_SUPPLY_SOURCE_POWER);
  
  // Propagate supply forward through the graph
  const processed = new Set<string>();
  const toProcess: string[] = [startNode.id];
  
  while (toProcess.length > 0) {
    const currentNodeId = toProcess.shift()!;
    if (processed.has(currentNodeId)) continue;
    processed.add(currentNodeId);
    
    const currentPotential = supplyPotential.get(currentNodeId) || 0;
    const node = nodeMap.get(currentNodeId);
    if (!node || !node.connections || node.connections.length === 0) continue;
    
    // Get outgoing edges
    const outgoingEdges = node.connections.map(toId => ({
      toId,
      edgeId: getEdgeId(currentNodeId, toId),
    }));
    
    // Compute weights based on profile
    const weights = computeProfileWeights(outgoingEdges, nodes, nodeDepth, profile);
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    
    if (totalWeight === 0) continue;
    
    // Distribute supply based on weights
    for (let i = 0; i < outgoingEdges.length; i++) {
      const { toId, edgeId } = outgoingEdges[i];
      const weight = weights[i].weight;
      const distributed = (currentPotential * weight) / totalWeight;
      
      // Apply decay based on depth
      const toDepth = nodeDepth.get(toId) || 0;
      const decayed = distributed * Math.pow(SUPPLY_DECAY_PER_DEPTH, toDepth);
      
      // Apply edge integrity multiplier
      const edgeState = supplyState.edgeState[edgeId] || { integrity: DEFAULT_EDGE_INTEGRITY };
      const effectiveFlow = decayed * (edgeState.integrity / 100);
      
      flowCache[edgeId] = effectiveFlow;
      
      // Update potential for target node
      const existingPotential = supplyPotential.get(toId) || 0;
      supplyPotential.set(toId, existingPotential + effectiveFlow);
      
      if (!processed.has(toId)) {
        toProcess.push(toId);
      }
    }
  }
  
  return flowCache;
}

/**
 * Compute profile weights for outgoing edges
 */
function computeProfileWeights(
  edges: Array<{ toId: string; edgeId: string }>,
  nodes: RoomNode[],
  nodeDepth: Map<string, number>,
  profile: SupplyProfile
): Array<{ edgeId: string; weight: number }> {
  if (edges.length === 0) return [];
  if (edges.length === 1) return [{ edgeId: edges[0].edgeId, weight: 1.0 }];
  
  const weights: Array<{ edgeId: string; weight: number }> = [];
  
  for (const edge of edges) {
    const toNode = nodes.find(n => n.id === edge.toId);
    if (!toNode) {
      weights.push({ edgeId: edge.edgeId, weight: 0 });
      continue;
    }
    
    const toDepth = nodeDepth.get(edge.toId) || 0;
    let weight = 1.0;
    
    switch (profile) {
      case "balanced":
        // Equal weight for all edges
        weight = 1.0;
        break;
        
      case "forward_push":
        // Bias toward deeper nodes (main path)
        const maxDepth = Math.max(...Array.from(nodeDepth.values()));
        const depthRatio = toDepth / Math.max(maxDepth, 1);
        weight = 0.5 + depthRatio * 1.5; // 0.5 to 2.0
        break;
        
      case "defensive_hold":
        // Bias toward nodes that might be key rooms (heuristic: check if it's a key room)
        const isKeyRoom = (toNode as any).isKeyRoom === true;
        weight = isKeyRoom ? 2.0 : 0.8;
        break;
        
      case "consolidation":
        // Bias toward nodes with fewer outgoing connections (fewer branches)
        const outgoingCount = toNode.connections?.length || 0;
        weight = outgoingCount === 0 ? 2.0 : 1.0 / Math.max(outgoingCount, 1);
        break;
    }
    
    weights.push({ edgeId: edge.edgeId, weight });
  }
  
  return weights;
}

// ============================================================================
// SUPPLY HEALTH TIERS
// ============================================================================

/**
 * Compute supply health tier based on flow vs demand
 */
export function computeSupplyHealth(
  flowCache: Record<string, number>,
  nodes: RoomNode[]
): SupplyHealthTier {
  // Simple v1: total flow vs number of cleared rooms
  const totalFlow = Object.values(flowCache).reduce((sum, flow) => sum + flow, 0);
  const clearedCount = nodes.filter(n => n.visited).length;
  const demand = clearedCount * 10; // 10 units per cleared room
  
  if (totalFlow >= demand) {
    return "stable";
  } else if (totalFlow >= demand * 0.7) {
    return "strained";
  } else {
    return "critical";
  }
}

// ============================================================================
// LINK ATTACK SYSTEM (Deterministic)
// ============================================================================

/**
 * Roll for link attacks after room clear (deterministic)
 */
export function rollLinkAttacks(
  supplyState: SupplyState,
  operationSeed: string,
  floorIndex: number,
  nodes: RoomNode[]
): Array<{ edgeId: string; damage: number }> {
  const attacks: Array<{ edgeId: string; damage: number }> = [];
  
  // Attack chance increases with depth and supply step
  const baseChance = 0.15; // 15% base chance
  const depthMultiplier = 1 + (floorIndex * 0.1);
  const stepMultiplier = 1 + (supplyState.supplyStep * 0.05);
  const attackChance = Math.min(0.6, baseChance * depthMultiplier * stepMultiplier);
  
  // Use deterministic RNG
  const rng = createDeterministicRNG(`${operationSeed}_supply_${supplyState.supplyStep}`);
  const roll = rng();
  
  if (roll < attackChance) {
    // Select edge to attack (weighted by flow)
    const flowCache = supplyState.flowCache || {};
    const edges = Object.keys(flowCache);
    
    if (edges.length > 0) {
      // Weight by flow (higher flow = more likely target)
      const totalFlow = edges.reduce((sum, eid) => sum + (flowCache[eid] || 0), 0);
      if (totalFlow > 0) {
        let targetRoll = rng() * totalFlow;
        let selectedEdgeId = edges[0];
        
        for (const edgeId of edges) {
          const flow = flowCache[edgeId] || 0;
          if (targetRoll <= flow) {
            selectedEdgeId = edgeId;
            break;
          }
          targetRoll -= flow;
        }
        
        // Apply damage
        const damage = LINK_ATTACK_DAMAGE_MIN + 
          Math.floor(rng() * (LINK_ATTACK_DAMAGE_MAX - LINK_ATTACK_DAMAGE_MIN + 1));
        
        attacks.push({ edgeId: selectedEdgeId, damage });
      }
    }
  }
  
  return attacks;
}

/**
 * Apply link attack damage
 */
export function applyLinkAttack(
  supplyState: SupplyState,
  edgeId: string,
  damage: number
): SupplyState {
  const edgeState = supplyState.edgeState[edgeId] || { integrity: DEFAULT_EDGE_INTEGRITY };
  const newIntegrity = Math.max(0, edgeState.integrity - damage);
  
  return {
    ...supplyState,
    edgeState: {
      ...supplyState.edgeState,
      [edgeId]: {
        ...edgeState,
        integrity: newIntegrity,
        lastAttackedStep: supplyState.supplyStep,
        isThreatened: newIntegrity < 50,
      },
    },
  };
}

/**
 * Create deterministic RNG from seed
 */
function createDeterministicRNG(seed: string): () => number {
  // Simple hash-based RNG
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  let state = Math.abs(hash);
  
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

// ============================================================================
// SUPPLY STEP ADVANCE
// ============================================================================

/**
 * Advance supply step (called after room clear)
 */
export function advanceSupplyStep(state: GameState): void {
  const operation = getCurrentOperation(state);
  if (!operation) return;
  
  const floor = getCurrentFloor(operation);
  if (!floor) return;
  
  const nodes = floor.nodes || floor.rooms || [];
  const supplyState = getSupplyState(state);
  if (!supplyState) return;
  
  // Increment step
  const newStep = supplyState.supplyStep + 1;
  
  // Get operation seed for deterministic attacks
  const activeRun = getActiveRun();
  const operationSeed = activeRun?.rngSeed || "default_seed";
  
  // Roll for link attacks
  const attacks = rollLinkAttacks(supplyState, operationSeed, operation.currentFloorIndex, nodes);
  
  // Apply attacks
  let updatedSupply: SupplyState = {
    ...supplyState,
    supplyStep: newStep,
  };
  
  for (const attack of attacks) {
    updatedSupply = applyLinkAttack(updatedSupply, attack.edgeId, attack.damage);
  }
  
  // Recompute flow
  updatedSupply.flowCache = computeSupplyFlow(nodes, updatedSupply, updatedSupply.supplyProfile);
  
  // Update state
  updateSupplyState(state, () => updatedSupply);
}
