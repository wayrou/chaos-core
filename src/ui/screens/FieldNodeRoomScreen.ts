// ============================================================================
// FIELD NODE ROOM SCREEN - Headline 14d
// Mystery Dungeon-inspired rooms with light enemies, chests, sparkles, and exit
// Uses field movement system with SPACE BAR attack
// ============================================================================

import { updateGameState } from "../../state/gameStore";
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
}

// ============================================================================
// STATE
// ============================================================================

let roomState: FieldNodeRoomState | null = null;
let animationFrameId: number | null = null;
let lastFrameTime = 0;
let movementInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  dash: false,
  attack: false,
};

// Match base camp field screen sizing
const TILE_SIZE = 64;
const PLAYER_SIZE = 48;
const ENEMY_SIZE = 40;
const ATTACK_COOLDOWN = 400; // ms
const ATTACK_DURATION = 200; // ms
const ATTACK_RANGE = 70; // pixels
const ATTACK_DAMAGE = 2;
const ENEMY_HP = 3;

// ============================================================================
// ROOM GENERATION
// ============================================================================

function generateFieldNodeRoom(roomId: string, seed: number): FieldNodeRoomState {
  // Use seed for deterministic generation
  const rng = createSeededRandom(seed);
  
  // Larger rooms matching base camp scale (18-24 wide, 14-18 tall)
  const width = 18 + Math.floor(rng() * 7); // 18-24 tiles wide
  const height = 14 + Math.floor(rng() * 5); // 14-18 tiles tall
  
  // Create tiles
  const tiles: FieldNodeTile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      const isWall = x === 0 || x === width - 1 || y === 0 || y === height - 1;
      tiles[y][x] = {
        x,
        y,
        walkable: !isWall,
        type: isWall ? "wall" : "floor",
      };
    }
  }
  
  // Add some random interior walls/obstacles for variety (more for larger rooms)
  const interiorWalls = 5 + Math.floor(rng() * 8);
  for (let i = 0; i < interiorWalls; i++) {
    const wx = 3 + Math.floor(rng() * (width - 6));
    const wy = 3 + Math.floor(rng() * (height - 6));
    // Don't block spawn or exit areas
    if (wx > 4 && wy > 4 && wx < width - 4 && wy < height - 4) {
      tiles[wy][wx].walkable = false;
      tiles[wy][wx].type = "wall";
      // Occasionally add 2x2 wall clusters
      if (rng() > 0.6 && wx < width - 5 && wy < height - 5) {
        tiles[wy][wx + 1].walkable = false;
        tiles[wy][wx + 1].type = "wall";
        tiles[wy + 1][wx].walkable = false;
        tiles[wy + 1][wx].type = "wall";
      }
    }
  }
  
  // Place exit on the far side
  const exitX = width - 2;
  const exitY = Math.floor(height / 2);
  tiles[exitY][exitX].type = "exit";
  tiles[exitY][exitX].walkable = true;
  
  // Player starts on the left side
  const playerX = 2 * TILE_SIZE + TILE_SIZE / 2;
  const playerY = Math.floor(height / 2) * TILE_SIZE + TILE_SIZE / 2;
  
  // Generate enemies (4-8 for larger rooms)
  const enemyCount = 4 + Math.floor(rng() * 5);
  const enemies: FieldNodeEnemy[] = [];
  for (let i = 0; i < enemyCount; i++) {
    let ex, ey;
    let attempts = 0;
    do {
      ex = 5 + Math.floor(rng() * (width - 8));
      ey = 3 + Math.floor(rng() * (height - 6));
      attempts++;
    } while ((!tiles[ey][ex].walkable || tiles[ey][ex].type === "exit") && attempts < 30);
    
    if (attempts < 20) {
      enemies.push({
        id: `enemy_${i}`,
        x: ex * TILE_SIZE + TILE_SIZE / 2,
        y: ey * TILE_SIZE + TILE_SIZE / 2,
        width: ENEMY_SIZE,
        height: ENEMY_SIZE,
        hp: ENEMY_HP,
        maxHp: ENEMY_HP,
        speed: 40 + rng() * 30,
        facing: "south",
        lastMoveTime: 0,
      });
    }
  }
  
  // Generate chests (2-4 for larger rooms)
  const chestCount = 2 + Math.floor(rng() * 3);
  const chests: FieldNodeChest[] = [];
  for (let i = 0; i < chestCount; i++) {
    let cx, cy;
    let attempts = 0;
    do {
      cx = 4 + Math.floor(rng() * (width - 8));
      cy = 3 + Math.floor(rng() * (height - 6));
      attempts++;
    } while ((!tiles[cy][cx].walkable || tiles[cy][cx].type === "exit") && attempts < 30);
    
    if (attempts < 20) {
      const rewardType = rng() > 0.3 ? "resource" : "wad";
      const resourceTypes: Array<"metalScrap" | "wood" | "chaosShards" | "steamComponents"> = 
        ["metalScrap", "wood", "chaosShards", "steamComponents"];
      
      chests.push({
        id: `chest_${i}`,
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
  
  // Generate sparkles (6-12 for larger rooms)
  const sparkleCount = 6 + Math.floor(rng() * 7);
  const sparkles: FieldNodeSparkle[] = [];
  const resourceTypes: Array<"metalScrap" | "wood" | "chaosShards" | "steamComponents"> = 
    ["metalScrap", "wood", "chaosShards", "steamComponents"];
  
  for (let i = 0; i < sparkleCount; i++) {
    let sx, sy;
    let attempts = 0;
    do {
      sx = 3 + Math.floor(rng() * (width - 6));
      sy = 3 + Math.floor(rng() * (height - 6));
      attempts++;
    } while ((!tiles[sy][sx].walkable || tiles[sy][sx].type === "exit") && attempts < 30);
    
    if (attempts < 20) {
      sparkles.push({
        id: `sparkle_${i}`,
        x: sx * TILE_SIZE + TILE_SIZE / 2,
        y: sy * TILE_SIZE + TILE_SIZE / 2,
        resourceType: resourceTypes[Math.floor(rng() * resourceTypes.length)],
        amount: 1 + Math.floor(rng() * 3),
        collected: false,
      });
    }
  }
  
  // Initialize Sable near player (Headline 15a)
  const companion = createCompanion(playerX - 40, playerY - 40);
  
  return {
    roomId,
    width,
    height,
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

export function renderFieldNodeRoomScreen(roomId: string, seed?: number): void {
  const root = document.getElementById("app");
  if (!root) return;
  
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
          <span class="header-text">EXPLORATION ZONE</span>
        </div>
        <div class="field-node-header-controls">
          <span class="key-hint">WASD</span> Move
          <span class="key-hint">SPACE</span> Attack
          <span class="key-hint">E</span> Interact
          <span class="key-hint">SHIFT</span> Dash
        </div>
      </div>
      
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
  // Match base camp player style
  return `
    <div class="field-player field-node-player-combat ${player.isAttacking ? 'player-attacking' : ''}" 
         style="
           left: ${player.x - player.width / 2}px;
           top: ${player.y - player.height / 2}px;
           width: ${player.width}px;
           height: ${player.height}px;
         "
         data-facing="${player.facing}">
      <div class="field-player-sprite">A</div>
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
  
  // Larger attack offset to match bigger tiles
  const attackOffset = {
    north: { x: 0, y: -45 },
    south: { x: 0, y: 45 },
    east: { x: 45, y: 0 },
    west: { x: -45, y: 0 },
  };
  
  const offset = attackOffset[player.facing];
  
  return `
    <div class="field-node-attack-effect" style="
      left: ${player.x + offset.x - 30}px;
      top: ${player.y + offset.y - 30}px;
      width: 60px;
      height: 60px;
    ">
      💥
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
  if (!roomState || roomState.isPaused || roomState.isCompleted) {
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
  
  // Handle attack input
  if (movementInput.attack && player.attackCooldown <= 0 && !player.isAttacking) {
    performAttack();
    player.attackCooldown = ATTACK_COOLDOWN;
    player.isAttacking = true;
    player.attackAnimTime = ATTACK_DURATION;
    movementInput.attack = false; // Consume the input
  }
  
  // Movement
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

// ============================================================================
// ENEMY UPDATE
// ============================================================================

function updateEnemies(deltaTime: number, currentTime: number): void {
  if (!roomState) return;
  
  for (const enemy of roomState.enemies) {
    if (enemy.hp <= 0) continue;
    
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
      // Update attack behavior
      roomState.companion = updateCompanionAttack(
        companion,
        player,
        { x: targetEnemy.x, y: targetEnemy.y, id: targetEnemy.id },
        deltaTime,
        { width: roomState.width, height: roomState.height, tiles: roomState.tiles } as any
      );
      
      // Check if reached enemy
      if (checkCompanionReachedTarget(companion, targetEnemy.id, 30)) {
        // Deal damage (enough to kill)
        targetEnemy.hp = 0;
        targetEnemy.deathAnimTime = performance.now();
        console.log(`[SABLE] Defeated enemy ${targetEnemy.id}!`);
        
        // Update quest progress
        updateQuestProgress("kill_enemies", 1, 1);
        
        // Return to follow
        companion.state = "follow";
        companion.target = undefined;
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
  // Currently no player damage from enemies (as per spec: light enemies)
  // Could add knockback here if desired
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
    case "e": // Interact with chests
      interactWithChest();
      e.preventDefault();
      break;
    case "escape":
      // Pause or show menu
      e.preventDefault();
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

