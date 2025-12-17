// ============================================================================
// FIELD NODE ROOM SCREEN - Headline 14d
// Mystery Dungeon-inspired rooms with light enemies, chests, sparkles, and exit
// Uses field movement system with SPACE BAR attack
// ============================================================================

import { updateGameState, getGameState } from "../../state/gameStore";
import { renderOperationMapScreen } from "./OperationMapScreen";
import { updateQuestProgress } from "../../quests/questManager";
import {
  createCompanion,
  updateCompanionFetch,
  updateCompanionAttack,
  findNearestResource,
  findNearestEnemy,
  checkCompanionReachedTarget,
  type Companion,
} from "../../field/companion";
import { handleKeyDown as handlePlayerInputKeyDown } from "../../core/playerInput";
import { tryJoinAsP2, dropOutP2 } from "../../core/coop";

// ============================================================================
// TYPES
// ============================================================================

interface FieldNodeEnemy {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  speed: number;
  facing: "north" | "south" | "east" | "west";
  lastMoveTime: number;
  deathAnimTime?: number; // For death animation
  // Knockback velocity
  vx: number;
  vy: number;
  knockbackTime: number; // Time remaining for knockback in ms
}

interface FieldNodeChest {
  id: string;
  x: number;
  y: number;
  opened: boolean;
  reward: {
    type: "wad" | "resource";
    resourceType?: "metalScrap" | "wood" | "chaosShards" | "steamComponents";
    amount: number;
  };
}

interface FieldNodeSparkle {
  id: string;
  x: number;
  y: number;
  resourceType: "metalScrap" | "wood" | "chaosShards" | "steamComponents";
  amount: number;
  collected: boolean;
}

interface FieldNodeTile {
  x: number;
  y: number;
  walkable: boolean;
  type: "floor" | "wall" | "exit";
}

interface FieldNodePlayer {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  facing: "north" | "south" | "east" | "west";
  isAttacking: boolean;
  attackCooldown: number;
  attackAnimTime: number;
  // Health system (Field Nodes only)
  hp: number;
  maxHp: number;
  invulnerabilityTime: number; // i-frames in ms
  // Knockback velocity
  vx: number;
  vy: number;
  // Ranged attack mode
  isRangedMode: boolean;
  // Energy cells for ranged attacks (charged by melee attacks)
  energyCells: number;
  maxEnergyCells: number;
}

interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  lifetime: number;
  maxLifetime: number;
}

interface FieldNodeRoomState {
  roomId: string;
  width: number;
  height: number;
  tiles: FieldNodeTile[][];
  player: FieldNodePlayer;
  enemies: FieldNodeEnemy[];
  chests: FieldNodeChest[];
  sparkles: FieldNodeSparkle[];
  exitPosition: { x: number; y: number };
  isPaused: boolean;
  isCompleted: boolean;
  companion?: Companion; // Sable companion (Headline 15a)
  collectedResources: {
    metalScrap: number;
    wood: number;
    chaosShards: number;
    steamComponents: number;
    wad: number;
  };
  projectiles: Projectile[];
}

// ============================================================================
// STATE
// ============================================================================

let roomState: FieldNodeRoomState | null = null;
let animationFrameId: number | null = null;
let lastFrameTime = 0;
let isEndlessMode = false;
let endlessRoomCount = 0;
let isPausedForExit = false;
let movementInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  dash: false,
  attack: false,
  toggleRanged: false,
};

// Match base camp field screen sizing
const TILE_SIZE = 64;
const PLAYER_SIZE = 48;
const ENEMY_SIZE = 40;
const ATTACK_COOLDOWN = 400; // ms
const ATTACK_DURATION = 200; // ms
const ATTACK_RANGE = 70; // pixels (melee)
const RANGED_ATTACK_RANGE = 400; // pixels (max range for ranged attacks)
const ATTACK_DAMAGE = 2;
const RANGED_ATTACK_DAMAGE = 5; // Ranged does significantly more damage than melee
const PROJECTILE_SPEED = 500; // pixels per second
const PROJECTILE_LIFETIME = 2000; // ms
const ENEMY_HP = 3;

// Player health constants
const PLAYER_MAX_HP = 100;
const PLAYER_DAMAGE_ON_CONTACT = 10; // Damage when enemy touches player
const INVULNERABILITY_DURATION = 1000; // ms of i-frames after taking damage

// Knockback constants
const ENEMY_KNOCKBACK_FORCE = 600; // pixels per second (2x increased)
const ENEMY_KNOCKBACK_DURATION = 300; // ms
const PLAYER_KNOCKBACK_FORCE = 400; // pixels per second (2x increased, smaller than enemy)
const PLAYER_KNOCKBACK_DURATION = 200; // ms
const KNOCKBACK_DAMPING = 0.85; // Velocity damping per frame

// ============================================================================
// ROOM GENERATION - Multi-Room Dungeon (Pokemon Mystery Dungeon Style)
// ============================================================================

interface RoomRect {
  x: number;
  y: number;
  width: number;
  height: number;
  id: number;
}

interface Corridor {
  from: number;
  to: number;
  path: { x: number; y: number }[];
}

function generateFieldNodeRoom(roomId: string, seed: number): FieldNodeRoomState {
  // Use seed for deterministic generation
  const rng = createSeededRandom(seed);
  
  // Generate 3-5 rooms
  const roomCount = 3 + Math.floor(rng() * 3); // 3-5 rooms
  
  // Create room layout (2x2 or 2x3 grid)
  const gridCols = 2;
  const gridRows = Math.ceil(roomCount / gridCols);
  
  // Room dimensions (smaller individual rooms, but more of them)
  const roomMinWidth = 10;
  const roomMaxWidth = 14;
  const roomMinHeight = 8;
  const roomMaxHeight = 12;
  
  // Spacing between rooms (for corridors) - increased for better corridor visibility
  const roomSpacing = 4;
  
  // Generate room rectangles
  const rooms: RoomRect[] = [];
  const roomGrid: (number | null)[][] = [];
  
  // Initialize grid
  for (let ry = 0; ry < gridRows; ry++) {
    roomGrid[ry] = [];
    for (let rx = 0; rx < gridCols; rx++) {
      roomGrid[ry][rx] = null;
    }
  }
  
  // Place rooms in grid
  let roomIdCounter = 0;
  for (let ry = 0; ry < gridRows && roomIdCounter < roomCount; ry++) {
    for (let rx = 0; rx < gridCols && roomIdCounter < roomCount; rx++) {
      const roomWidth = roomMinWidth + Math.floor(rng() * (roomMaxWidth - roomMinWidth + 1));
      const roomHeight = roomMinHeight + Math.floor(rng() * (roomMaxHeight - roomMinHeight + 1));
      
      // Calculate position accounting for previous rooms and spacing
      // Add some randomness to room positions for more organic feel
      const baseX = rx * (roomMaxWidth + roomSpacing) + Math.floor(rng() * 2);
      const baseY = ry * (roomMaxHeight + roomSpacing) + Math.floor(rng() * 2);
      
      rooms.push({
        id: roomIdCounter,
        x: baseX,
        y: baseY,
        width: roomWidth,
        height: roomHeight,
      });
      
      roomGrid[ry][rx] = roomIdCounter;
      roomIdCounter++;
    }
  }
  
  // Calculate total map dimensions
  const totalWidth = Math.max(...rooms.map(r => r.x + r.width)) + 2; // +2 for outer walls
  const totalHeight = Math.max(...rooms.map(r => r.y + r.height)) + 2;
  
  // Create tiles grid (all walls initially)
  const tiles: FieldNodeTile[][] = [];
  for (let y = 0; y < totalHeight; y++) {
    tiles[y] = [];
    for (let x = 0; x < totalWidth; x++) {
      tiles[y][x] = {
        x,
        y,
        walkable: false,
        type: "wall",
      };
    }
  }
  
  // Carve out rooms
  for (const room of rooms) {
    // Room interior (leave 1-tile border for walls)
    for (let ry = 1; ry < room.height - 1; ry++) {
      for (let rx = 1; rx < room.width - 1; rx++) {
        const tx = room.x + rx + 1; // +1 for outer wall
        const ty = room.y + ry + 1;
        if (tx < totalWidth && ty < totalHeight) {
          tiles[ty][tx] = {
            x: tx,
            y: ty,
            walkable: true,
            type: "floor",
          };
        }
      }
    }
  }
  
  // Generate corridors connecting rooms (minimum spanning tree approach)
  const corridors: Corridor[] = [];
  const connected: Set<number> = new Set([0]); // Start with first room
  const unconnected = new Set(rooms.slice(1).map(r => r.id));
  
  while (unconnected.size > 0) {
    // Find closest unconnected room to any connected room
    let bestFrom = -1;
    let bestTo = -1;
    let bestDist = Infinity;
    let bestPath: { x: number; y: number }[] = [];
    
    for (const fromId of connected) {
      const fromRoom = rooms[fromId];
      // Use room center for connection point
      const fromCenterX = fromRoom.x + Math.floor(fromRoom.width / 2);
      const fromCenterY = fromRoom.y + Math.floor(fromRoom.height / 2);
      
      for (const toId of unconnected) {
        const toRoom = rooms[toId];
        // Use room center for connection point
        const toCenterX = toRoom.x + Math.floor(toRoom.width / 2);
        const toCenterY = toRoom.y + Math.floor(toRoom.height / 2);
        
        const dist = Math.abs(fromCenterX - toCenterX) + Math.abs(fromCenterY - toCenterY);
        if (dist < bestDist) {
          bestDist = dist;
          bestFrom = fromId;
          bestTo = toId;
          
          // Create L-shaped corridor path (horizontal first, then vertical)
          const path: { x: number; y: number }[] = [];
          const startX = fromCenterX + 1; // +1 for outer wall offset
          const startY = fromCenterY + 1;
          const endX = toCenterX + 1;
          const endY = toCenterY + 1;
          
          // Horizontal segment (from room center to target X)
          const stepX = endX > startX ? 1 : -1;
          for (let x = startX; (stepX > 0 ? x <= endX : x >= endX); x += stepX) {
            path.push({ x, y: startY });
          }
          
          // Vertical segment (from horizontal end to target Y)
          const stepY = endY > startY ? 1 : -1;
          const midX = endX;
          for (let y = startY; (stepY > 0 ? y <= endY : y >= endY); y += stepY) {
            path.push({ x: midX, y });
          }
          
          bestPath = path;
        }
      }
    }
    
    if (bestFrom >= 0 && bestTo >= 0) {
      // Carve corridor (2 tiles wide for easier navigation)
      for (let i = 0; i < bestPath.length; i++) {
        const point = bestPath[i];
        if (point.x >= 0 && point.x < totalWidth && point.y >= 0 && point.y < totalHeight) {
          tiles[point.y][point.x].walkable = true;
          tiles[point.y][point.x].type = "floor";
          
          // Determine if this is a horizontal or vertical segment
          const isHorizontal = i === 0 || (i < bestPath.length - 1 && 
            Math.abs(bestPath[i + 1].x - point.x) > Math.abs(bestPath[i + 1].y - point.y));
          
          // Make corridor 2 tiles wide
          if (isHorizontal) {
            // Expand vertically for horizontal corridors
            if (point.y > 0) {
              tiles[point.y - 1][point.x].walkable = true;
              tiles[point.y - 1][point.x].type = "floor";
            }
            if (point.y < totalHeight - 1) {
              tiles[point.y + 1][point.x].walkable = true;
              tiles[point.y + 1][point.x].type = "floor";
            }
          } else {
            // Expand horizontally for vertical corridors
            if (point.x > 0) {
              tiles[point.y][point.x - 1].walkable = true;
              tiles[point.y][point.x - 1].type = "floor";
            }
            if (point.x < totalWidth - 1) {
              tiles[point.y][point.x + 1].walkable = true;
              tiles[point.y][point.x + 1].type = "floor";
            }
          }
        }
      }
      
      corridors.push({ from: bestFrom, to: bestTo, path: bestPath });
      connected.add(bestTo);
      unconnected.delete(bestTo);
    } else {
      break; // Safety break
    }
  }
  
  // Add some random interior walls/obstacles in rooms (fewer per room since rooms are smaller)
  for (const room of rooms) {
    const interiorWalls = 1 + Math.floor(rng() * 3); // 1-3 per room
    for (let i = 0; i < interiorWalls; i++) {
      const wx = room.x + 2 + Math.floor(rng() * (room.width - 4));
      const wy = room.y + 2 + Math.floor(rng() * (room.height - 4));
      
      if (wx >= 0 && wx < totalWidth && wy >= 0 && wy < totalHeight) {
        // Don't block corridors, room centers, or room edges (where corridors connect)
        const isNearCenter = Math.abs(wx - (room.x + room.width / 2)) < 3 &&
                           Math.abs(wy - (room.y + room.height / 2)) < 3;
        const isNearEdge = wx <= room.x + 2 || wx >= room.x + room.width - 2 ||
                          wy <= room.y + 2 || wy >= room.y + room.height - 2;
        if (!isNearCenter && !isNearEdge && tiles[wy] && tiles[wy][wx] && tiles[wy][wx].walkable) {
          tiles[wy][wx].walkable = false;
          tiles[wy][wx].type = "wall";
        }
      }
    }
  }
  
  // Place exit in last room (far side)
  const exitRoom = rooms[rooms.length - 1];
  const exitX = exitRoom.x + exitRoom.width - 3;
  const exitY = exitRoom.y + Math.floor(exitRoom.height / 2);
  if (exitX >= 0 && exitX < totalWidth && exitY >= 0 && exitY < totalHeight && tiles[exitY] && tiles[exitY][exitX]) {
    tiles[exitY][exitX].type = "exit";
    tiles[exitY][exitX].walkable = true;
  }
  
  // Player starts in first room (left side) - MUST be on walkable terrain
  const startRoom = rooms[0];
  let playerTileX = startRoom.x + 2;
  let playerTileY = startRoom.y + Math.floor(startRoom.height / 2);
  
  // Validate spawn position is walkable, if not find nearest walkable tile in start room
  if (playerTileX < 0 || playerTileX >= totalWidth || 
      playerTileY < 0 || playerTileY >= totalHeight ||
      !tiles[playerTileY] || !tiles[playerTileY][playerTileX] || 
      !tiles[playerTileY][playerTileX].walkable) {
    // Try to find a walkable position in the start room
    let foundWalkable = false;
    for (let ry = 1; ry < startRoom.height - 1; ry++) {
      for (let rx = 1; rx < startRoom.width - 1; rx++) {
        const tx = startRoom.x + rx + 1; // +1 for outer wall
        const ty = startRoom.y + ry + 1;
        if (tx >= 0 && tx < totalWidth && ty >= 0 && ty < totalHeight &&
            tiles[ty] && tiles[ty][tx] && tiles[ty][tx].walkable) {
          playerTileX = tx;
          playerTileY = ty;
          foundWalkable = true;
          break;
        }
      }
      if (foundWalkable) break;
    }
    
    // If still no walkable tile found (shouldn't happen, but safety fallback)
    if (!foundWalkable) {
      console.warn("[FIELDNODE] No walkable tile found in start room, using room center");
      playerTileX = startRoom.x + Math.floor(startRoom.width / 2) + 1;
      playerTileY = startRoom.y + Math.floor(startRoom.height / 2) + 1;
      // Force the tile to be walkable as last resort
      if (playerTileX >= 0 && playerTileX < totalWidth && 
          playerTileY >= 0 && playerTileY < totalHeight &&
          tiles[playerTileY] && tiles[playerTileY][playerTileX]) {
        tiles[playerTileY][playerTileX].walkable = true;
        tiles[playerTileY][playerTileX].type = "floor";
      }
    }
  }
  
  const playerX = playerTileX * TILE_SIZE + TILE_SIZE / 2;
  const playerY = playerTileY * TILE_SIZE + TILE_SIZE / 2;
  
  // Generate enemies distributed across all rooms (2-3 per room)
  const enemies: FieldNodeEnemy[] = [];
  let enemyIdCounter = 0;
  for (const room of rooms) {
    const enemiesInRoom = 2 + Math.floor(rng() * 2); // 2-3 per room
    for (let i = 0; i < enemiesInRoom; i++) {
      let attempts = 0;
      let ex, ey;
      do {
        ex = room.x + 2 + Math.floor(rng() * (room.width - 4));
        ey = room.y + 2 + Math.floor(rng() * (room.height - 4));
        attempts++;
      } while (attempts < 50 && (!tiles[ey] || !tiles[ey][ex] || !tiles[ey][ex].walkable || tiles[ey][ex].type === "exit"));
      
      if (attempts < 50 && tiles[ey] && tiles[ey][ex] && tiles[ey][ex].walkable && tiles[ey][ex].type !== "exit") {
        enemies.push({
          id: `enemy_${enemyIdCounter++}`,
          x: ex * TILE_SIZE + TILE_SIZE / 2,
          y: ey * TILE_SIZE + TILE_SIZE / 2,
          width: ENEMY_SIZE,
          height: ENEMY_SIZE,
          hp: ENEMY_HP,
          maxHp: ENEMY_HP,
          speed: 40 + rng() * 30,
          facing: "south",
          lastMoveTime: 0,
          vx: 0,
          vy: 0,
          knockbackTime: 0,
        });
      }
    }
  }
  
  // Generate chests distributed across rooms (1 per room, except first)
  const chests: FieldNodeChest[] = [];
  const resourceTypes: Array<"metalScrap" | "wood" | "chaosShards" | "steamComponents"> = 
    ["metalScrap", "wood", "chaosShards", "steamComponents"];
  
  for (let i = 1; i < rooms.length; i++) { // Skip first room
    const room = rooms[i];
    let attempts = 0;
    let cx, cy;
    do {
      cx = room.x + 2 + Math.floor(rng() * (room.width - 4));
      cy = room.y + 2 + Math.floor(rng() * (room.height - 4));
      attempts++;
    } while (attempts < 50 && (!tiles[cy] || !tiles[cy][cx] || !tiles[cy][cx].walkable || tiles[cy][cx].type === "exit"));
    
    if (attempts < 50 && tiles[cy] && tiles[cy][cx] && tiles[cy][cx].walkable && tiles[cy][cx].type !== "exit") {
      const rewardType = rng() > 0.3 ? "resource" : "wad";
      chests.push({
        id: `chest_${i - 1}`,
        x: cx * TILE_SIZE + TILE_SIZE / 2,
        y: cy * TILE_SIZE + TILE_SIZE / 2,
        opened: false,
        reward: {
          type: rewardType,
          resourceType: rewardType === "resource" ? resourceTypes[Math.floor(rng() * resourceTypes.length)] : undefined,
          amount: rewardType === "wad" ? 50 + Math.floor(rng() * 100) : 2 + Math.floor(rng() * 5),
        },
      });
    }
  }
  
  // Generate sparkles distributed across all rooms (2-4 per room)
  const sparkles: FieldNodeSparkle[] = [];
  for (const room of rooms) {
    const sparklesInRoom = 2 + Math.floor(rng() * 3); // 2-4 per room
    for (let i = 0; i < sparklesInRoom; i++) {
      let attempts = 0;
      let sx, sy;
      do {
        sx = room.x + 2 + Math.floor(rng() * (room.width - 4));
        sy = room.y + 2 + Math.floor(rng() * (room.height - 4));
        attempts++;
      } while (attempts < 50 && (!tiles[sy] || !tiles[sy][sx] || !tiles[sy][sx].walkable || tiles[sy][sx].type === "exit"));
      
      if (attempts < 50 && tiles[sy] && tiles[sy][sx] && tiles[sy][sx].walkable && tiles[sy][sx].type !== "exit") {
        sparkles.push({
          id: `sparkle_${sparkles.length}`,
          x: sx * TILE_SIZE + TILE_SIZE / 2,
          y: sy * TILE_SIZE + TILE_SIZE / 2,
          resourceType: resourceTypes[Math.floor(rng() * resourceTypes.length)],
          amount: 1 + Math.floor(rng() * 3),
          collected: false,
        });
      }
    }
  }
  
  // Initialize Sable near player (Headline 15a)
  const companion = createCompanion(playerX - 40, playerY - 40);
  
  return {
    roomId,
    width: totalWidth,
    height: totalHeight,
    tiles,
    player: {
      x: playerX,
      y: playerY,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      speed: 180,
      facing: "east",
      isAttacking: false,
      attackCooldown: 0,
      attackAnimTime: 0,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      invulnerabilityTime: 0,
      vx: 0,
      vy: 0,
      isRangedMode: false,
      energyCells: 0,
      maxEnergyCells: 5, // Maximum energy cells that can be stored
    },
    enemies,
    chests,
    sparkles,
    exitPosition: { x: exitX, y: exitY },
    isPaused: false,
    isCompleted: false,
    companion,
    collectedResources: {
      metalScrap: 0,
      wood: 0,
      chaosShards: 0,
      steamComponents: 0,
      wad: 0,
    },
    projectiles: [],
  };
}

// Simple seeded random number generator
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// ============================================================================
// MAIN RENDER
// ============================================================================

export function renderFieldNodeRoomScreen(roomId: string, seed?: number, endless: boolean = false): void {
  const root = document.getElementById("app");
  if (!root) return;
  
  // Set endless mode flag
  isEndlessMode = endless;
  if (endless) {
    endlessRoomCount = 0;
    isPausedForExit = false;
  }
  
  // Generate room if needed
  const actualSeed = seed ?? Math.floor(Math.random() * 1000000);
  roomState = generateFieldNodeRoom(roomId, actualSeed);
  
  // Reset input state
  movementInput = {
    up: false,
    down: false,
    left: false,
    right: false,
    dash: false,
    attack: false,
    toggleRanged: false,
  };
  
  // Setup input handlers
  setupInputHandlers();
  
  // Start game loop
  startGameLoop();
  
  // Initial render
  render();
}

function render(): void {
  if (!roomState) return;
  
  const root = document.getElementById("app");
  if (!root) return;
  
  const { width, height, tiles, player, enemies, chests, sparkles, exitPosition, collectedResources, companion } = roomState;
  
  // Calculate viewport to center on player
  const viewportWidth = Math.min(width * TILE_SIZE, window.innerWidth - 40);
  const viewportHeight = Math.min(height * TILE_SIZE, window.innerHeight - 120);
  
  const offsetX = Math.max(0, Math.min(
    player.x - viewportWidth / 2,
    width * TILE_SIZE - viewportWidth
  ));
  const offsetY = Math.max(0, Math.min(
    player.y - viewportHeight / 2,
    height * TILE_SIZE - viewportHeight
  ));
  
  // Use base camp-like structure for visual consistency
  root.innerHTML = `
    <div class="field-node-root field-root">
      <!-- Header bar matching base camp style -->
      <div class="field-node-header-bar">
        <div class="field-node-header-title">
          <span class="header-icon">🗺️</span>
          <span class="header-text">${isEndlessMode ? `ENDLESS MODE — ROOM ${endlessRoomCount + 1}` : 'EXPLORATION ZONE'}</span>
        </div>
        <div class="field-node-header-controls">
          <span class="key-hint">WASD</span> Move
          <span class="key-hint">SPACE</span> Attack
          <span class="key-hint">E</span> Interact
          <span class="key-hint">SHIFT</span> Dash
          ${isEndlessMode ? '<span class="key-hint">ESC</span> Exit' : ''}
          <span class="key-hint">TAB</span> ${roomState?.player.isRangedMode ? 'Ranged' : 'Melee'}
        </div>
      </div>
      
      ${isPausedForExit ? renderEndlessExitOverlay() : ''}
      
      <!-- Player Health Bar (Field Nodes only) -->
      <div class="field-node-health-bar">
        <div class="health-bar-label">HP</div>
        <div class="health-bar-container">
          <div class="health-bar-fill" style="width: ${(player.hp / player.maxHp) * 100}%; ${player.invulnerabilityTime > 0 ? 'opacity: 0.6;' : ''}"></div>
          <div class="health-bar-text">${player.hp}/${player.maxHp}</div>
        </div>
      </div>
      
      <!-- Weapon Display Window -->
      ${renderWeaponWindow()}
      
      <!-- Map viewport matching base camp -->
      <div class="field-viewport field-node-viewport" style="width: ${viewportWidth}px; height: ${viewportHeight}px;">
        <div class="field-map field-node-map" style="
          width: ${width * TILE_SIZE}px; 
          height: ${height * TILE_SIZE}px;
          transform: translate(${-offsetX}px, ${-offsetY}px);
        ">
          ${renderTiles(tiles, exitPosition)}
          ${renderSparkles(sparkles)}
          ${renderChests(chests)}
          ${renderEnemies(enemies)}
          ${renderPlayer(player)}
          ${renderCompanion(companion)}
          ${renderAttackEffect(player)}
          ${renderCoopAvatars()}
          ${renderProjectiles(roomState.projectiles)}
        </div>
      </div>
      
      <!-- Status bar -->
      <div class="field-node-status-bar">
        <div class="field-node-stats-row">
          <div class="stat-box">
            <span class="stat-icon">👾</span>
            <span class="stat-value">${enemies.filter(e => e.hp > 0 && !e.deathAnimTime).length}</span>
            <span class="stat-label">ENEMIES</span>
          </div>
          <div class="stat-box">
            <span class="stat-icon">📦</span>
            <span class="stat-value">${chests.filter(c => !c.opened).length}</span>
            <span class="stat-label">CHESTS</span>
          </div>
          <div class="stat-box">
            <span class="stat-icon">✨</span>
            <span class="stat-value">${sparkles.filter(s => !s.collected).length}</span>
            <span class="stat-label">PICKUPS</span>
          </div>
        </div>
        <div class="field-node-loot-row">
          <span class="loot-label">COLLECTED:</span>
          ${collectedResources.wad > 0 ? `<span class="loot-item loot-wad">💰 ${collectedResources.wad}</span>` : ''}
          ${collectedResources.metalScrap > 0 ? `<span class="loot-item loot-metal">⚙️ ${collectedResources.metalScrap}</span>` : ''}
          ${collectedResources.wood > 0 ? `<span class="loot-item loot-wood">🪵 ${collectedResources.wood}</span>` : ''}
          ${collectedResources.chaosShards > 0 ? `<span class="loot-item loot-shards">💎 ${collectedResources.chaosShards}</span>` : ''}
          ${collectedResources.steamComponents > 0 ? `<span class="loot-item loot-steam">⚗️ ${collectedResources.steamComponents}</span>` : ''}
          ${Object.values(collectedResources).every(v => v === 0) ? '<span class="loot-empty">None yet</span>' : ''}
        </div>
      </div>
      
      ${roomState.isCompleted ? renderCompletionOverlay() : ''}
    </div>
  `;
}

function renderTiles(tiles: FieldNodeTile[][], exitPos: { x: number; y: number }): string {
  let html = '';
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const tile = tiles[y][x];
      const isExit = x === exitPos.x && y === exitPos.y;
      
      // Use base camp field tile classes for consistency
      const walkableClass = tile.walkable ? 'field-tile-walkable' : 'field-tile-wall';
      const typeClass = isExit ? 'field-node-tile-exit' : (tile.type === 'wall' ? 'field-tile-wall' : 'field-tile-floor');
      
      html += `
        <div class="field-tile ${walkableClass} ${typeClass}" style="
          left: ${x * TILE_SIZE}px;
          top: ${y * TILE_SIZE}px;
          width: ${TILE_SIZE}px;
          height: ${TILE_SIZE}px;
        ">
          ${isExit ? '<div class="field-node-exit-marker">EXIT →</div>' : ''}
        </div>
      `;
    }
  }
  return html;
}

function renderSparkles(sparkles: FieldNodeSparkle[]): string {
  return sparkles
    .filter(s => !s.collected)
    .map(s => `
      <div class="field-node-sparkle" style="
        left: ${s.x - 16}px;
        top: ${s.y - 16}px;
        width: 32px;
        height: 32px;
      ">
        ✨
      </div>
    `).join('');
}

function renderChests(chests: FieldNodeChest[]): string {
  return chests.map(c => `
    <div class="field-node-chest ${c.opened ? 'chest-opened' : ''}" style="
      left: ${c.x - 24}px;
      top: ${c.y - 24}px;
      width: 48px;
      height: 48px;
    ">
      ${c.opened ? '📭' : '📦'}
    </div>
  `).join('');
}

function renderEnemies(enemies: FieldNodeEnemy[]): string {
  return enemies
    .filter(e => e.hp > 0 || e.deathAnimTime)
    .map(e => {
      const isDying = e.deathAnimTime !== undefined && e.hp <= 0;
      return `
        <div class="field-node-enemy ${isDying ? 'enemy-dying' : ''}" style="
          left: ${e.x - e.width / 2}px;
          top: ${e.y - e.height / 2}px;
          width: ${e.width}px;
          height: ${e.height}px;
        ">
          <div class="enemy-sprite">👾</div>
          ${!isDying ? `
            <div class="enemy-hp-bar">
              <div class="enemy-hp-fill" style="width: ${(e.hp / e.maxHp) * 100}%"></div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
}

function renderPlayer(player: FieldNodePlayer): string {
  // FieldNodeRoomScreen uses its own player system (not game state players)
  // For now, render as P1 (can be extended later to support P2 in field nodes)
  const attackClass = player.isAttacking ? "player-attacking" : "";
  const invulnerableClass = player.invulnerabilityTime > 0 ? "player-invulnerable" : "";
  const invulnerableStyle = player.invulnerabilityTime > 0 
    ? `opacity: ${Math.floor((player.invulnerabilityTime / INVULNERABILITY_DURATION) * 5) % 2 === 0 ? 0.5 : 1};` 
    : "";
  return `
    <div class="field-player field-node-player-combat field-player-p1 ${attackClass} ${invulnerableClass}" 
         style="
           left: ${player.x - player.width / 2}px;
           top: ${player.y - player.height / 2}px;
           width: ${player.width}px;
           height: ${player.height}px;
           border: 2px solid #ff8a00;
           ${invulnerableStyle}
         "
         data-facing="${player.facing}">
      <div class="field-player-sprite">⚔</div>
      <div class="field-player-indicator" style="background: #ff8a00; color: white; font-size: 10px; padding: 2px 4px; border-radius: 4px; position: absolute; top: -18px; left: 50%; transform: translateX(-50%);">P1</div>
    </div>
  `;
}

function renderCoopAvatars(): string {
  // Field nodes use their own player system, so for now just return empty
  // This can be extended later if we want P2 in field nodes
  return "";
}

function renderProjectiles(projectiles: Projectile[]): string {
  if (!projectiles || projectiles.length === 0) return "";
  
  return projectiles.map(proj => `
    <div class="field-node-projectile" 
         style="left: ${proj.x - 4}px; top: ${proj.y - 4}px; width: 8px; height: 8px;">
    </div>
  `).join("");
}

function renderWeaponWindow(): string {
  if (!roomState) return "";
  
  const { player } = roomState;
  const modeText = player.isRangedMode ? "RANGED" : "MELEE";
  const canUseRanged = player.energyCells > 0;
  
  return `
    <div class="field-node-weapon-window">
      <div class="weapon-window-title">BOWBLADE</div>
      <div class="weapon-window-mode ${player.isRangedMode ? 'weapon-window-mode--ranged' : 'weapon-window-mode--melee'}">${modeText}</div>
      <div class="weapon-window-energy">
        <div class="weapon-window-energy-label">ENERGY CELLS</div>
        <div class="weapon-window-energy-bar">
          <div class="weapon-window-energy-fill" style="width: ${(player.energyCells / player.maxEnergyCells) * 100}%"></div>
        </div>
        <div class="weapon-window-energy-value">${player.energyCells} / ${player.maxEnergyCells}</div>
      </div>
      ${player.isRangedMode && !canUseRanged ? `
        <div class="weapon-window-warning">NO ENERGY - USE MELEE TO CHARGE</div>
      ` : ''}
      <div class="weapon-window-hint">
        <span class="key-hint">TAB</span> Switch Mode
      </div>
    </div>
  `;
}

function renderCompanion(companion?: Companion): string {
  if (!companion) return '';
  
  return `
    <div class="field-companion field-companion-sable" 
         style="
           left: ${companion.x - companion.width / 2}px;
           top: ${companion.y - companion.height / 2}px;
           width: ${companion.width}px;
           height: ${companion.height}px;
         "
         data-facing="${companion.facing}" 
         data-state="${companion.state}">
      <div class="field-companion-sprite">🐕</div>
    </div>
  `;
}

function renderAttackEffect(player: FieldNodePlayer): string {
  if (!player.isAttacking) return '';
  
  // Calculate slash position and rotation based on facing direction
  const attackOffset = {
    north: { x: 0, y: -35, rotation: -45 },
    south: { x: 0, y: 35, rotation: 135 },
    east: { x: 35, y: 0, rotation: 45 },
    west: { x: -35, y: 0, rotation: -135 },
  };
  
  const offset = attackOffset[player.facing];
  
  return `
    <div class="field-node-attack-effect field-node-sword-slash" 
         data-facing="${player.facing}"
         style="
      left: ${player.x + offset.x - 40}px;
      top: ${player.y + offset.y - 40}px;
      width: 80px;
      height: 80px;
      transform-origin: center center;
    ">
      <div class="sword-slash-line"></div>
    </div>
  `;
}

function renderCompletionOverlay(): string {
  const resources = roomState!.collectedResources;
  
  return `
    <div class="field-node-completion-overlay">
      <div class="field-node-completion-card">
        <div class="completion-title">ROOM CLEARED!</div>
        <div class="completion-rewards">
          ${resources.wad > 0 ? `<div class="reward-item">💰 ${resources.wad} WAD</div>` : ''}
          ${resources.metalScrap > 0 ? `<div class="reward-item">⚙️ ${resources.metalScrap} Metal Scrap</div>` : ''}
          ${resources.wood > 0 ? `<div class="reward-item">🪵 ${resources.wood} Wood</div>` : ''}
          ${resources.chaosShards > 0 ? `<div class="reward-item">💎 ${resources.chaosShards} Chaos Shards</div>` : ''}
          ${resources.steamComponents > 0 ? `<div class="reward-item">⚗️ ${resources.steamComponents} Steam Components</div>` : ''}
        </div>
        <button class="completion-continue-btn" id="continueBtn">CONTINUE</button>
      </div>
    </div>
  `;
}

// ============================================================================
// GAME LOOP
// ============================================================================

function startGameLoop(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }
  lastFrameTime = performance.now();
  gameLoop(lastFrameTime);
}

function stopGameLoop(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function gameLoop(currentTime: number): void {
  if (!roomState || roomState.isPaused || roomState.isCompleted || isPausedForExit) {
    animationFrameId = requestAnimationFrame(gameLoop);
    return;
  }
  
  const deltaTime = currentTime - lastFrameTime;
  lastFrameTime = currentTime;
  
  // Update game state
  updatePlayer(deltaTime, currentTime);
  updateEnemies(deltaTime, currentTime);
  updateCompanion(deltaTime, currentTime); // Update Sable (Headline 15a)
  checkCollisions();
  checkSparklePickups();
  checkExitReached();
  
  // Render
  render();
  
  // Continue loop
  animationFrameId = requestAnimationFrame(gameLoop);
}

// ============================================================================
// PLAYER UPDATE
// ============================================================================

function updatePlayer(deltaTime: number, _currentTime: number): void {
  if (!roomState) return;
  
  const player = roomState.player;
  
  // Update invulnerability timer
  if (player.invulnerabilityTime > 0) {
    player.invulnerabilityTime -= deltaTime;
    if (player.invulnerabilityTime < 0) {
      player.invulnerabilityTime = 0;
    }
  }
  
  // Update knockback velocity (dampen over time)
  if (player.vx !== 0 || player.vy !== 0) {
    player.vx *= Math.pow(KNOCKBACK_DAMPING, deltaTime / 16); // Normalize to 16ms frame
    player.vy *= Math.pow(KNOCKBACK_DAMPING, deltaTime / 16);
    
    // Apply knockback movement
    const knockbackX = player.vx * (deltaTime / 1000);
    const knockbackY = player.vy * (deltaTime / 1000);
    
    if (canMoveTo(player.x + knockbackX, player.y, player.width, player.height)) {
      player.x += knockbackX;
    } else {
      player.vx = 0; // Stop horizontal knockback on collision
    }
    
    if (canMoveTo(player.x, player.y + knockbackY, player.width, player.height)) {
      player.y += knockbackY;
    } else {
      player.vy = 0; // Stop vertical knockback on collision
    }
    
    // Stop very small velocities
    if (Math.abs(player.vx) < 1) player.vx = 0;
    if (Math.abs(player.vy) < 1) player.vy = 0;
  }
  
  // Update attack cooldown
  if (player.attackCooldown > 0) {
    player.attackCooldown -= deltaTime;
  }
  
  // Update attack animation
  if (player.isAttacking) {
    player.attackAnimTime -= deltaTime;
    if (player.attackAnimTime <= 0) {
      player.isAttacking = false;
    }
  }
  
  // Handle ranged mode toggle
  if (movementInput.toggleRanged) {
    player.isRangedMode = !player.isRangedMode;
    movementInput.toggleRanged = false;
    render(); // Update UI to show mode change
  }
  
  // Handle attack input
  if (movementInput.attack && player.attackCooldown <= 0 && !player.isAttacking) {
    if (player.isRangedMode) {
      // Ranged attacks require energy cells
      if (player.energyCells > 0) {
        performRangedAttack();
      } else {
        // Show feedback that ranged attack is blocked
        showToast("NO ENERGY CELLS - USE MELEE TO CHARGE");
      }
    } else {
      performAttack();
    }
    player.attackCooldown = ATTACK_COOLDOWN;
    player.isAttacking = true;
    player.attackAnimTime = ATTACK_DURATION;
    movementInput.attack = false; // Consume the input
  }
  
  // Update projectiles
  updateProjectiles(deltaTime);
  
  // Movement (only if not in heavy knockback)
  const knockbackMagnitude = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
  const canMove = knockbackMagnitude < 50; // Allow movement if knockback is small
  
  if (canMove) {
    const dashMultiplier = movementInput.dash ? 2.0 : 1.0;
    const moveDistance = player.speed * dashMultiplier * (deltaTime / 1000);
    
    let newX = player.x;
    let newY = player.y;
    
    if (movementInput.up) {
      newY -= moveDistance;
      player.facing = "north";
    }
    if (movementInput.down) {
      newY += moveDistance;
      player.facing = "south";
    }
    if (movementInput.left) {
      newX -= moveDistance;
      player.facing = "west";
    }
    if (movementInput.right) {
      newX += moveDistance;
      player.facing = "east";
    }
    
    // Collision check
    if (canMoveTo(newX, player.y, player.width, player.height)) {
      player.x = newX;
    }
    if (canMoveTo(player.x, newY, player.width, player.height)) {
      player.y = newY;
    }
  }
  
  // Clamp player position to room bounds
  const roomWidth = roomState.width * TILE_SIZE;
  const roomHeight = roomState.height * TILE_SIZE;
  player.x = Math.max(player.width / 2, Math.min(roomWidth - player.width / 2, player.x));
  player.y = Math.max(player.height / 2, Math.min(roomHeight - player.height / 2, player.y));
}

function canMoveTo(x: number, y: number, width: number, height: number): boolean {
  if (!roomState) return false;
  
  const { tiles } = roomState;
  
  // Check corners of the bounding box
  const halfW = width / 2;
  const halfH = height / 2;
  const corners = [
    { x: x - halfW, y: y - halfH },
    { x: x + halfW, y: y - halfH },
    { x: x - halfW, y: y + halfH },
    { x: x + halfW, y: y + halfH },
  ];
  
  for (const corner of corners) {
    const tileX = Math.floor(corner.x / TILE_SIZE);
    const tileY = Math.floor(corner.y / TILE_SIZE);
    
    if (tileY < 0 || tileY >= tiles.length || tileX < 0 || tileX >= tiles[0].length) {
      return false;
    }
    
    if (!tiles[tileY][tileX].walkable) {
      return false;
    }
  }
  
  return true;
}

function performAttack(): void {
  if (!roomState) return;
  
  const { player, enemies } = roomState;
  
  // Calculate attack area
  const attackOffset = {
    north: { x: 0, y: -ATTACK_RANGE / 2 },
    south: { x: 0, y: ATTACK_RANGE / 2 },
    east: { x: ATTACK_RANGE / 2, y: 0 },
    west: { x: -ATTACK_RANGE / 2, y: 0 },
  };
  
  const offset = attackOffset[player.facing];
  const attackX = player.x + offset.x;
  const attackY = player.y + offset.y;
  
  // Check for enemies in attack range
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    
    const dist = Math.sqrt(
      Math.pow(enemy.x - attackX, 2) + Math.pow(enemy.y - attackY, 2)
    );
    
    if (dist < ATTACK_RANGE) {
      enemy.hp -= ATTACK_DAMAGE;
      console.log(`[FIELD_NODE] Hit enemy ${enemy.id}, HP: ${enemy.hp}/${enemy.maxHp}`);
      
      // Charge energy cells on successful melee hit (2 cells per hit for better ranged availability)
      const chargeAmount = 2;
      player.energyCells = Math.min(player.maxEnergyCells, player.energyCells + chargeAmount);
      console.log(`[FIELD_NODE] Energy cells charged: ${player.energyCells}/${player.maxEnergyCells}`);
      
      // Apply knockback to enemy (away from player)
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distToPlayer = Math.sqrt(dx * dx + dy * dy);
      
      if (distToPlayer > 0) {
        // Normalize direction and apply knockback force
        const knockbackDirX = dx / distToPlayer;
        const knockbackDirY = dy / distToPlayer;
        enemy.vx = knockbackDirX * ENEMY_KNOCKBACK_FORCE;
        enemy.vy = knockbackDirY * ENEMY_KNOCKBACK_FORCE;
        enemy.knockbackTime = ENEMY_KNOCKBACK_DURATION;
      }
      
      if (enemy.hp <= 0) {
        enemy.deathAnimTime = performance.now();
        console.log(`[FIELD_NODE] Enemy ${enemy.id} defeated!`);
        
        // Update quest progress for killing light enemies (Headline 15)
        updateQuestProgress("kill_enemies", 1, 1);
        
        // Small chance to drop resources
        if (Math.random() < 0.3) {
          const types: Array<"metalScrap" | "wood" | "chaosShards" | "steamComponents"> = 
            ["metalScrap", "wood", "chaosShards", "steamComponents"];
          const type = types[Math.floor(Math.random() * types.length)];
          roomState.collectedResources[type] += 1;
          showToast(`+1 ${formatResourceName(type)}`);
        }
      }
    }
  }
  
  // Remove dead enemies after animation
  setTimeout(() => {
    if (roomState) {
      roomState.enemies = roomState.enemies.filter(e => e.hp > 0 || (e.deathAnimTime && performance.now() - e.deathAnimTime < 500));
    }
  }, 500);
}

function performRangedAttack(): void {
  if (!roomState) return;
  
  const { player, enemies } = roomState;
  
  // Consume one energy cell for ranged attack
  if (player.energyCells <= 0) {
    console.log(`[FIELD_NODE] Cannot perform ranged attack - no energy cells`);
    return;
  }
  
  player.energyCells -= 1;
  console.log(`[FIELD_NODE] Energy cell consumed: ${player.energyCells}/${player.maxEnergyCells} remaining`);
  
  // Find nearest enemy to aim at
  let nearestEnemy: FieldNodeEnemy | null = null;
  let nearestDist = RANGED_ATTACK_RANGE;
  
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestEnemy = enemy;
    }
  }
  
  if (!nearestEnemy) {
    // No enemy in range, fire in facing direction
    const direction = {
      north: { x: 0, y: -1 },
      south: { x: 0, y: 1 },
      east: { x: 1, y: 0 },
      west: { x: -1, y: 0 },
    };
    const dir = direction[player.facing];
    
    const projectile: Projectile = {
      id: `proj_${Date.now()}_${Math.random()}`,
      x: player.x,
      y: player.y,
      vx: dir.x * PROJECTILE_SPEED,
      vy: dir.y * PROJECTILE_SPEED,
      damage: RANGED_ATTACK_DAMAGE,
      lifetime: 0,
      maxLifetime: PROJECTILE_LIFETIME,
    };
    
    roomState.projectiles.push(projectile);
    return;
  }
  
  // Fire projectile toward nearest enemy
  const dx = nearestEnemy.x - player.x;
  const dy = nearestEnemy.y - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist > 0) {
    const dirX = dx / dist;
    const dirY = dy / dist;
    
    const projectile: Projectile = {
      id: `proj_${Date.now()}_${Math.random()}`,
      x: player.x,
      y: player.y,
      vx: dirX * PROJECTILE_SPEED,
      vy: dirY * PROJECTILE_SPEED,
      damage: RANGED_ATTACK_DAMAGE,
      lifetime: 0,
      maxLifetime: PROJECTILE_LIFETIME,
    };
    
    roomState.projectiles.push(projectile);
  }
}

function updateProjectiles(deltaTime: number): void {
  if (!roomState) return;
  
  const { projectiles, enemies } = roomState;
  const roomWidth = roomState.width * TILE_SIZE;
  const roomHeight = roomState.height * TILE_SIZE;
  
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    
    // Update lifetime
    proj.lifetime += deltaTime;
    if (proj.lifetime >= proj.maxLifetime) {
      projectiles.splice(i, 1);
      continue;
    }
    
    // Update position
    proj.x += proj.vx * (deltaTime / 1000);
    proj.y += proj.vy * (deltaTime / 1000);
    
    // Check bounds
    if (proj.x < 0 || proj.x > roomWidth || proj.y < 0 || proj.y > roomHeight) {
      projectiles.splice(i, 1);
      continue;
    }
    
    // Check collision with enemies
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      
      const dx = enemy.x - proj.x;
      const dy = enemy.y - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < ENEMY_SIZE / 2) {
        // Hit enemy
        enemy.hp -= proj.damage;
        console.log(`[FIELD_NODE] Ranged hit enemy ${enemy.id}, HP: ${enemy.hp}/${enemy.maxHp}`);
        
        // Apply knockback
        if (dist > 0) {
          const knockbackDirX = dx / dist;
          const knockbackDirY = dy / dist;
          enemy.vx = knockbackDirX * ENEMY_KNOCKBACK_FORCE * 0.5; // Less knockback for ranged
          enemy.vy = knockbackDirY * ENEMY_KNOCKBACK_FORCE * 0.5;
          enemy.knockbackTime = ENEMY_KNOCKBACK_DURATION;
        }
        
        if (enemy.hp <= 0) {
          enemy.deathAnimTime = performance.now();
          console.log(`[FIELD_NODE] Enemy ${enemy.id} defeated!`);
          updateQuestProgress("kill_enemies", 1, 1);
          
          if (Math.random() < 0.3) {
            const types: Array<"metalScrap" | "wood" | "chaosShards" | "steamComponents"> = 
              ["metalScrap", "wood", "chaosShards", "steamComponents"];
            const type = types[Math.floor(Math.random() * types.length)];
            roomState.collectedResources[type] += 1;
            showToast(`+1 ${formatResourceName(type)}`);
          }
        }
        
        // Remove projectile
        projectiles.splice(i, 1);
        break;
      }
    }
  }
}

// ============================================================================
// ENEMY UPDATE
// ============================================================================

function updateEnemies(deltaTime: number, currentTime: number): void {
  if (!roomState) return;
  
  for (const enemy of roomState.enemies) {
    if (enemy.hp <= 0) continue;
    
    // Update knockback
    if (enemy.knockbackTime > 0) {
      enemy.knockbackTime -= deltaTime;
      
      // Apply knockback velocity
      const knockbackX = enemy.vx * (deltaTime / 1000);
      const knockbackY = enemy.vy * (deltaTime / 1000);
      
      const newX = enemy.x + knockbackX;
      const newY = enemy.y + knockbackY;
      
      // Check collision and clamp to room bounds
      if (canMoveTo(newX, enemy.y, enemy.width, enemy.height)) {
        enemy.x = newX;
      } else {
        enemy.vx = 0; // Stop horizontal knockback on collision
      }
      
      if (canMoveTo(enemy.x, newY, enemy.width, enemy.height)) {
        enemy.y = newY;
      } else {
        enemy.vy = 0; // Stop vertical knockback on collision
      }
      
      // Dampen knockback velocity
      enemy.vx *= Math.pow(KNOCKBACK_DAMPING, deltaTime / 16);
      enemy.vy *= Math.pow(KNOCKBACK_DAMPING, deltaTime / 16);
      
      // Stop very small velocities
      if (Math.abs(enemy.vx) < 1) enemy.vx = 0;
      if (Math.abs(enemy.vy) < 1) enemy.vy = 0;
      
      // Clamp enemy position to room bounds
      const roomWidth = roomState.width * TILE_SIZE;
      const roomHeight = roomState.height * TILE_SIZE;
      enemy.x = Math.max(enemy.width / 2, Math.min(roomWidth - enemy.width / 2, enemy.x));
      enemy.y = Math.max(enemy.height / 2, Math.min(roomHeight - enemy.height / 2, enemy.y));
    }
    
    // Only move toward player if not in knockback
    if (enemy.knockbackTime <= 0) {
      // Simple AI: move toward player occasionally
      if (currentTime - enemy.lastMoveTime > 1000 + Math.random() * 1000) {
        enemy.lastMoveTime = currentTime;
        
        const dx = roomState.player.x - enemy.x;
        const dy = roomState.player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 100) {
          // Move toward player
          const moveX = (dx / dist) * enemy.speed * (deltaTime / 1000) * 5;
          const moveY = (dy / dist) * enemy.speed * (deltaTime / 1000) * 5;
          
          const newX = enemy.x + moveX;
          const newY = enemy.y + moveY;
          
          if (canMoveTo(newX, enemy.y, enemy.width, enemy.height)) {
            enemy.x = newX;
          }
          if (canMoveTo(enemy.x, newY, enemy.width, enemy.height)) {
            enemy.y = newY;
          }
          
          // Update facing
          if (Math.abs(dx) > Math.abs(dy)) {
            enemy.facing = dx > 0 ? "east" : "west";
          } else {
            enemy.facing = dy > 0 ? "south" : "north";
          }
        }
      }
    }
  }
}

// ============================================================================
// COMPANION UPDATE (Headline 15a)
// ============================================================================

function updateCompanion(deltaTime: number, currentTime: number): void {
  if (!roomState || !roomState.companion) return;
  
  const companion = roomState.companion;
  const player = roomState.player;
  
  // Check behavior cooldown
  if (currentTime - companion.lastBehaviorTime > companion.behaviorCooldownMs) {
    companion.lastBehaviorTime = currentTime;
    
    // Priority: Attack > Fetch > Follow
    // Check for enemies first (if not already attacking)
    if (companion.state !== "attack") {
      const nearestEnemy = findNearestEnemy(companion, player, roomState.enemies);
      if (nearestEnemy) {
        companion.state = "attack";
        companion.target = { x: nearestEnemy.x, y: nearestEnemy.y, id: nearestEnemy.id };
      }
    }
    
    // Check for resources (if not attacking and not already fetching)
    if (companion.state !== "attack" && companion.state !== "fetch") {
      const nearestResource = findNearestResource(companion, player, roomState.sparkles);
      if (nearestResource) {
        companion.state = "fetch";
        companion.target = { x: nearestResource.x, y: nearestResource.y, id: nearestResource.id };
      }
    }
  }
  
  // Update based on state
  if (companion.state === "attack" && companion.target) {
    const targetEnemy = roomState.enemies.find(e => e.id === companion.target!.id);
    if (!targetEnemy || targetEnemy.hp <= 0) {
      // Enemy dead or gone, return to follow
      companion.state = "follow";
      companion.target = undefined;
    } else {
      // Update attack cooldown first
      if (companion.attackCooldown > 0) {
        companion.attackCooldown -= deltaTime;
      }
      
      // Update attack behavior (movement toward enemy)
      roomState.companion = updateCompanionAttack(
        companion,
        player,
        { x: targetEnemy.x, y: targetEnemy.y, id: targetEnemy.id },
        deltaTime,
        { width: roomState.width, height: roomState.height, tiles: roomState.tiles } as any
      );
      
      // Get updated companion reference
      const updatedCompanion = roomState.companion;
      
      // Check if reached enemy and can attack (similar to player attack range)
      const dx = targetEnemy.x - updatedCompanion.x;
      const dy = targetEnemy.y - updatedCompanion.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Attack if within range (similar to player ATTACK_RANGE) and cooldown is ready
      if (distance < ATTACK_RANGE && updatedCompanion.attackCooldown <= 0) {
        // Deal damage (same as player attack)
        targetEnemy.hp -= ATTACK_DAMAGE;
        console.log(`[SABLE] Hit enemy ${targetEnemy.id}, HP: ${targetEnemy.hp}/${targetEnemy.maxHp}`);
        
        // Apply knockback to enemy (away from Sable, same as player attack)
        if (distance > 0) {
          const knockbackDirX = dx / distance;
          const knockbackDirY = dy / distance;
          targetEnemy.vx = knockbackDirX * ENEMY_KNOCKBACK_FORCE;
          targetEnemy.vy = knockbackDirY * ENEMY_KNOCKBACK_FORCE;
          targetEnemy.knockbackTime = ENEMY_KNOCKBACK_DURATION;
        }
        
        // Set attack cooldown (same as player)
        updatedCompanion.attackCooldown = ATTACK_COOLDOWN;
        
        // Check if enemy died
        if (targetEnemy.hp <= 0) {
          targetEnemy.hp = 0;
          targetEnemy.deathAnimTime = performance.now();
          console.log(`[SABLE] Defeated enemy ${targetEnemy.id}!`);
          
          // Update quest progress
          updateQuestProgress("kill_enemies", 1, 1);
          
          // Small chance to drop resources (same as player kills)
          if (Math.random() < 0.3) {
            const types: Array<"metalScrap" | "wood" | "chaosShards" | "steamComponents"> = 
              ["metalScrap", "wood", "chaosShards", "steamComponents"];
            const type = types[Math.floor(Math.random() * types.length)];
            roomState.collectedResources[type] += 1;
            showToast(`Sable found +1 ${formatResourceName(type)}`);
          }
          
          // Return to follow
          updatedCompanion.state = "follow";
          updatedCompanion.target = undefined;
        }
      }
    }
  } else if (companion.state === "fetch" && companion.target) {
    const targetSparkle = roomState.sparkles.find(s => s.id === companion.target!.id);
    if (!targetSparkle || targetSparkle.collected) {
      // Resource already collected, return to follow
      companion.state = "follow";
      companion.target = undefined;
    } else {
      // Update fetch behavior
      roomState.companion = updateCompanionFetch(
        companion,
        player,
        { x: targetSparkle.x, y: targetSparkle.y, id: targetSparkle.id },
        deltaTime,
        { width: roomState.width, height: roomState.height, tiles: roomState.tiles } as any
      );
      
      // Check if reached resource
      if (checkCompanionReachedTarget(companion, targetSparkle.id, 20)) {
        // Collect resource
        targetSparkle.collected = true;
        roomState.collectedResources[targetSparkle.resourceType] += targetSparkle.amount;
        showToast(`Sable found +${targetSparkle.amount} ${formatResourceName(targetSparkle.resourceType)}`);
        
        // Return to follow
        companion.state = "follow";
        companion.target = undefined;
      }
    }
  } else {
    // Follow behavior (fallback)
    const dx = player.x - companion.x;
    const dy = player.y - companion.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 120) {
      const moveDistance = companion.speed * (deltaTime / 1000);
      const moveX = (dx / distance) * moveDistance;
      const moveY = (dy / distance) * moveDistance;
      
      companion.x += moveX;
      companion.y += moveY;
      
      // Update facing
      if (Math.abs(dx) > Math.abs(dy)) {
        companion.facing = dx > 0 ? "east" : "west";
      } else {
        companion.facing = dy > 0 ? "south" : "north";
      }
    }
  }
}

// ============================================================================
// COLLISION & PICKUPS
// ============================================================================

function checkCollisions(): void {
  if (!roomState) return;
  
  const { player, enemies } = roomState;
  
  // Check player-enemy collisions for damage and knockback
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    
    // AABB collision detection
    const playerLeft = player.x - player.width / 2;
    const playerRight = player.x + player.width / 2;
    const playerTop = player.y - player.height / 2;
    const playerBottom = player.y + player.height / 2;
    
    const enemyLeft = enemy.x - enemy.width / 2;
    const enemyRight = enemy.x + enemy.width / 2;
    const enemyTop = enemy.y - enemy.height / 2;
    const enemyBottom = enemy.y + enemy.height / 2;
    
    const isColliding = 
      playerRight > enemyLeft &&
      playerLeft < enemyRight &&
      playerBottom > enemyTop &&
      playerTop < enemyBottom;
    
    if (isColliding) {
      // Damage player if not invulnerable
      if (player.invulnerabilityTime <= 0 && player.hp > 0) {
        player.hp -= PLAYER_DAMAGE_ON_CONTACT;
        player.invulnerabilityTime = INVULNERABILITY_DURATION;
        console.log(`[FIELD_NODE] Player took damage! HP: ${player.hp}/${player.maxHp}`);
        
        // Apply knockback to player (away from enemy)
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
          const knockbackDirX = dx / dist;
          const knockbackDirY = dy / dist;
          player.vx = knockbackDirX * PLAYER_KNOCKBACK_FORCE;
          player.vy = knockbackDirY * PLAYER_KNOCKBACK_FORCE;
        }
        
        // Check for death
        if (player.hp <= 0) {
          player.hp = 0;
          handlePlayerDeath();
          return; // Exit early on death
        }
      }
      
      // Apply small knockback to enemy (away from player) - prevents sticking
      if (enemy.knockbackTime <= 0) {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
          const knockbackDirX = dx / dist;
          const knockbackDirY = dy / dist;
          enemy.vx = knockbackDirX * (ENEMY_KNOCKBACK_FORCE * 0.3); // Smaller push
          enemy.vy = knockbackDirY * (ENEMY_KNOCKBACK_FORCE * 0.3);
          enemy.knockbackTime = ENEMY_KNOCKBACK_DURATION * 0.5; // Shorter duration
        }
      }
    }
  }
}

function handlePlayerDeath(): void {
  if (!roomState) return;
  
  console.log("[FIELD_NODE] Player died! Exiting room...");
  
  // Stop the game loop
  stopGameLoop();
  
  // Exit the room and return to operation map
  // TODO: Handle death cutscenes or penalties later
  cleanup();
  
  // Return to operation map (or base camp if test room or endless mode)
  const isTestRoom = roomState.roomId.startsWith("test_") || roomState.roomId.startsWith("endless_");
  if (isTestRoom || isEndlessMode) {
    import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
      renderFieldScreen("base_camp");
    });
  } else {
    renderOperationMapScreen();
  }
}

function handleEndlessModeExit(): void {
  if (!isEndlessMode) return;
  
  console.log(`[ENDLESS] Exiting endless mode after ${endlessRoomCount} rooms`);
  
  // Pause the game
  isPausedForExit = true;
  if (roomState) {
    roomState.isPaused = true;
  }
  
  // Render exit overlay
  render();
  
  // Attach button handler
  setTimeout(() => {
    const exitBtn = document.getElementById("endlessExitBtn");
    if (exitBtn) {
      exitBtn.onclick = () => {
        cleanup();
        isEndlessMode = false;
        endlessRoomCount = 0;
        isPausedForExit = false;
        
        import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
          renderFieldScreen("base_camp");
        });
      };
    }
  }, 100);
}

function renderEndlessExitOverlay(): string {
  return `
    <div class="field-node-endless-exit-overlay">
      <div class="field-node-endless-exit-card">
        <div class="endless-exit-title">ENDLESS MODE PAUSED</div>
        <div class="endless-exit-stats">
          <div class="endless-stat">Rooms Completed: <span class="endless-stat-value">${endlessRoomCount}</span></div>
        </div>
        <div class="endless-exit-message">Return to Base Camp?</div>
        <button class="endless-exit-btn" id="endlessExitBtn">RETURN TO BASE CAMP</button>
      </div>
    </div>
  `;
}

function checkSparklePickups(): void {
  if (!roomState) return;
  
  const { player, sparkles } = roomState;
  const pickupRange = 30;
  
  for (const sparkle of sparkles) {
    if (sparkle.collected) continue;
    
    const dist = Math.sqrt(
      Math.pow(sparkle.x - player.x, 2) + Math.pow(sparkle.y - player.y, 2)
    );
    
    if (dist < pickupRange) {
      sparkle.collected = true;
      roomState.collectedResources[sparkle.resourceType] += sparkle.amount;
      showToast(`+${sparkle.amount} ${formatResourceName(sparkle.resourceType)}`);
    }
  }
}

function checkExitReached(): void {
  if (!roomState || roomState.isCompleted) return;
  
  const { player, exitPosition } = roomState;
  
  const exitCenterX = exitPosition.x * TILE_SIZE + TILE_SIZE / 2;
  const exitCenterY = exitPosition.y * TILE_SIZE + TILE_SIZE / 2;
  
  const dist = Math.sqrt(
    Math.pow(player.x - exitCenterX, 2) + Math.pow(player.y - exitCenterY, 2)
  );
  
  if (dist < TILE_SIZE) {
    completeRoom();
  }
}

// ============================================================================
// CHEST INTERACTION
// ============================================================================

function interactWithChest(): void {
  if (!roomState) return;
  
  const { player, chests } = roomState;
  const interactRange = 50;
  
  for (const chest of chests) {
    if (chest.opened) continue;
    
    const dist = Math.sqrt(
      Math.pow(chest.x - player.x, 2) + Math.pow(chest.y - player.y, 2)
    );
    
    if (dist < interactRange) {
      chest.opened = true;
      
      if (chest.reward.type === "wad") {
        roomState.collectedResources.wad += chest.reward.amount;
        showToast(`+${chest.reward.amount} WAD!`);
      } else if (chest.reward.resourceType) {
        roomState.collectedResources[chest.reward.resourceType] += chest.reward.amount;
        showToast(`+${chest.reward.amount} ${formatResourceName(chest.reward.resourceType)}!`);
      }
      
      console.log(`[FIELD_NODE] Opened chest ${chest.id}`);
      return;
    }
  }
}

// ============================================================================
// ROOM COMPLETION
// ============================================================================

function completeRoom(): void {
  if (!roomState) return;
  
  roomState.isCompleted = true;
  
  // Apply collected resources to game state
  const resources = roomState.collectedResources;
  const roomId = roomState.roomId;
  const isTestRoom = roomId.startsWith("test_");
  
  updateGameState(prev => {
    // Mark room as visited (only if in an operation)
    const operation = prev.operation ? { ...prev.operation } : null;
    if (operation && !isTestRoom) {
      const floor = operation.floors[operation.currentFloorIndex];
      if (floor) {
        const nodes = floor.nodes || floor.rooms || [];
        const room = nodes.find(n => n.id === roomId);
        if (room) {
          room.visited = true;
        }
      }
    }
    
    return {
      ...prev,
      operation,
      wad: prev.wad + resources.wad,
      resources: {
        ...prev.resources,
        metalScrap: (prev.resources?.metalScrap ?? 0) + resources.metalScrap,
        wood: (prev.resources?.wood ?? 0) + resources.wood,
        chaosShards: (prev.resources?.chaosShards ?? 0) + resources.chaosShards,
        steamComponents: (prev.resources?.steamComponents ?? 0) + resources.steamComponents,
      },
    };
  });
  
  // Update quest progress for field node exploration (Headline 15)
  updateQuestProgress("clear_node", "field_node", 1);
  
  // Update quest progress for resource collection
  if (resources.metalScrap > 0) updateQuestProgress("collect_resource", "metalScrap", resources.metalScrap);
  if (resources.wood > 0) updateQuestProgress("collect_resource", "wood", resources.wood);
  if (resources.chaosShards > 0) updateQuestProgress("collect_resource", "chaosShards", resources.chaosShards);
  if (resources.steamComponents > 0) updateQuestProgress("collect_resource", "steamComponents", resources.steamComponents);
  
  // Render completion overlay
  render();
  
  // Add continue button handler
  setTimeout(() => {
    const continueBtn = document.getElementById("continueBtn");
    if (continueBtn) {
      continueBtn.addEventListener("click", () => {
        // If in endless mode, continue to next room instead of exiting
        if (isEndlessMode) {
          endlessRoomCount++;
          const nextSeed = Math.floor(Math.random() * 1000000);
          console.log(`[ENDLESS] Continuing to room ${endlessRoomCount + 1} with seed:`, nextSeed);
          
          // Cleanup current room state
          cleanup();
          
          // Start next room
          renderFieldNodeRoomScreen(`endless_room_${endlessRoomCount}`, nextSeed, true);
          return;
        }
        
        cleanup();
        
        // If this was a test room, go back to field screen
        // Otherwise, go back to operation map
        if (isTestRoom) {
          import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
            renderFieldScreen("base_camp");
          });
        } else {
          renderOperationMapScreen();
        }
      });
    }
  }, 100);
}

// ============================================================================
// INPUT HANDLING
// ============================================================================

function setupInputHandlers(): void {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
}

function cleanupInputHandlers(): void {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
}

function handleKeyDown(e: KeyboardEvent): void {
  if (!roomState || !document.querySelector(".field-node-root")) return;
  
  const key = e.key?.toLowerCase() ?? "";
  
  // Handle ESC key for endless mode exit
  if (key === "escape" || e.key === "Escape") {
    if (isEndlessMode) {
      e.preventDefault();
      e.stopPropagation();
      handleEndlessModeExit();
      return;
    }
  }
  
  // Co-op drop-in/drop-out (only outside battle, but field nodes don't have battles)
  const state = getGameState();
  if (state.phase !== "battle" && state.currentBattle === null) {
    // J key: Join as P2
    if (key === "j" || key === "J") {
      e.preventDefault();
      e.stopPropagation();
      tryJoinAsP2();
      return;
    }
    
    // K key: Drop out P2
    if (key === "k" || key === "K") {
      e.preventDefault();
      e.stopPropagation();
      dropOutP2();
      return;
    }
  }
  
  // Update player input system
  handlePlayerInputKeyDown(e);
  
  // Legacy movementInput for FieldNodeRoomScreen (P1 only for now)
  if (e.shiftKey) {
    movementInput.dash = true;
  }
  
  switch (key) {
    case "w":
    case "arrowup":
      movementInput.up = true;
      e.preventDefault();
      break;
    case "s":
    case "arrowdown":
      movementInput.down = true;
      e.preventDefault();
      break;
    case "a":
    case "arrowleft":
      movementInput.left = true;
      e.preventDefault();
      break;
    case "d":
    case "arrowright":
      movementInput.right = true;
      e.preventDefault();
      break;
    case " ": // SPACE - Attack
      movementInput.attack = true;
      e.preventDefault();
      break;
    case "tab": // TAB - Toggle ranged mode
      movementInput.toggleRanged = true;
      e.preventDefault();
      break;
    case "e": // Interact with chests
      interactWithChest();
      e.preventDefault();
      break;
    case "escape":
      // Pause or show menu (only if not endless mode)
      if (!isEndlessMode) {
        e.preventDefault();
      }
      break;
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  if (!document.querySelector(".field-node-root")) return;
  
  const key = e.key?.toLowerCase() ?? "";
  
  if (!e.shiftKey) {
    movementInput.dash = false;
  }
  
  switch (key) {
    case "w":
    case "arrowup":
      movementInput.up = false;
      break;
    case "s":
    case "arrowdown":
      movementInput.down = false;
      break;
    case "a":
    case "arrowleft":
      movementInput.left = false;
      break;
    case "d":
    case "arrowright":
      movementInput.right = false;
      break;
    case " ":
      movementInput.attack = false;
      break;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function formatResourceName(type: string): string {
  const names: Record<string, string> = {
    metalScrap: "Metal Scrap",
    wood: "Wood",
    chaosShards: "Chaos Shards",
    steamComponents: "Steam Components",
  };
  return names[type] || type;
}

function showToast(message: string): void {
  const existing = document.querySelector(".field-node-toast");
  if (existing) existing.remove();
  
  const toast = document.createElement("div");
  toast.className = "field-node-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add("toast-visible"), 10);
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 1500);
}

function cleanup(): void {
  stopGameLoop();
  cleanupInputHandlers();
  roomState = null;
}

export { cleanup as cleanupFieldNodeRoom };

