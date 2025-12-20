// ============================================================================
// BATTLE GRID RENDERER - Simple, predictable grid rendering
// ============================================================================

import { BattleState, BattleUnitState } from "../../core/battle";
import { getBattleUnitPortraitPath } from "../../core/portraits";
import { getCoverVisualState } from "../../core/coverGenerator";
import { getGameState } from "../../state/gameStore";
import { PlayerId } from "../../core/types";

/**
 * Simple, robust battle grid renderer
 * - Uses unit.pos.x/y as single source of truth
 * - Simple CSS grid layout (no isometric projection)
 * - Direct grid coordinates - predictable and accurate
 */
export class BattleGridRenderer {
  private static readonly TILE_SIZE = 75; // pixels per tile
  
  /**
   * Render the entire battle grid
   */
  static render(
    battle: BattleState,
    selectedCardIdx: number | null,
    activeUnit: BattleUnitState | undefined,
    isPlacementPhase: boolean,
    zoom: number,
    moveTiles?: Set<string>,
    attackTiles?: Set<string>,
    facingTiles?: Set<string>
  ): string {
    const { gridWidth, gridHeight } = battle;
    const units = Object.values(battle.units).filter(u => u.hp > 0 && u.pos);
    
    // Determine valid move/attack/placement/facing tiles
    const moveTileSet = moveTiles || new Set<string>();
    const attackTileSet = attackTiles || new Set<string>();
    const facingTileSet = facingTiles || new Set<string>();
    const placementTiles = new Set<string>();
    
    if (isPlacementPhase && battle.placementState) {
      // Show all legal placement squares on the left edge (x=0)
      // Highlight all tiles on the left edge so players know where they can place units
      const placementState = battle.placementState;
      const placedCount = placementState.placedUnitIds.length;
      const maxUnits = placementState.maxUnitsPerSide;
      
      // Only show placement options if we haven't reached the max unit limit
      if (placedCount < maxUnits) {
        for (let y = 0; y < gridHeight; y++) {
          const occupied = units.some(u => u.pos && u.pos.x === 0 && u.pos.y === y);
          // Show tile if not occupied - these are valid placement locations
          if (!occupied) {
            placementTiles.add(`0,${y}`);
          }
        }
      }
    }
    
    // Build tile HTML - simple grid layout
    let tilesHtml = "";
    const unitsHtml: Array<{ html: string; x: number; y: number }> = [];
    
    // Render tiles in grid order (top to bottom, left to right)
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const tile = battle.tiles.find(t => t.pos.x === x && t.pos.y === y);
        const elevation = tile?.elevation ?? 0;
        const key = `${x},${y}`;
        
        // Find unit at this position (CRITICAL: use exact match)
        const unit = units.find(u => 
          u.pos && 
          u.pos.x === x && 
          u.pos.y === y
        );
        
        // Validate unit position matches tile
        if (unit) {
          const unitGridX = unit.pos!.x;
          const unitGridY = unit.pos!.y;
          
          if (unitGridX !== x || unitGridY !== y) {
            console.error("[BATTLE_GRID] Unit position mismatch!", {
              unitId: unit.id,
              unitPos: { x: unitGridX, y: unitGridY },
              tilePos: { x, y }
            });
            // Skip rendering this unit - position is invalid
          } else {
            // Unit is valid, will render it
          }
        }
        
        // Build tile classes
        let classes = "battle-tile";
        
        // Determine terrain class
        if (tile) {
          const terrain = tile.terrain;
          if (terrain === "light_cover" || terrain === "heavy_cover") {
            const visualState = getCoverVisualState(tile);
            classes += ` battle-tile--${terrain} battle-tile--cover-${visualState}`;
          } else if (terrain === "rubble") {
            classes += " battle-tile--rubble";
          } else {
            classes += " battle-tile--floor";
          }
        } else {
          classes += " battle-tile--floor";
        }
        
        if (moveTileSet.has(key)) classes += " battle-tile--move-option";
        if (attackTileSet.has(key)) classes += " battle-tile--attack-option";
        if (placementTiles.has(key)) classes += " battle-tile--placement-option";
        if (facingTileSet.has(key)) classes += " battle-tile--facing-option";
        if (elevation > 0) classes += ` battle-tile--elevation-${elevation}`;
        
        // Render tile using CSS grid positioning
        tilesHtml += `
          <div class="${classes}" 
               data-x="${x}" 
               data-y="${y}"
               style="grid-column: ${x + 1}; grid-row: ${y + 1};">
          </div>
        `;
        
        // Collect unit HTML to render after tiles
        if (unit && unit.pos) {
          // CRITICAL: Validate unit position matches tile position
          if (unit.pos.x !== x || unit.pos.y !== y) {
            console.error("[BATTLE_GRID] Unit position mismatch during rendering!", {
              unitId: unit.id,
              unitPos: { x: unit.pos.x, y: unit.pos.y },
              tilePos: { x, y }
            });
            // Skip rendering this unit - it's at the wrong position
            // This prevents visual bugs where units appear in wrong places
            continue;
          }
          
          // Validate position is within bounds
          if (unit.pos.x < 0 || unit.pos.x >= gridWidth || 
              unit.pos.y < 0 || unit.pos.y >= gridHeight) {
            console.error("[BATTLE_GRID] Unit position out of bounds!", {
              unitId: unit.id,
              pos: unit.pos,
              bounds: { width: gridWidth, height: gridHeight }
            });
            continue;
          }
          
          const side = unit.isEnemy ? "battle-unit--enemy" : "battle-unit--ally";
          const act = unit.id === battle.activeUnitId ? "battle-unit--active" : "";
          const truncName = unit.name.length > 8 ? unit.name.slice(0, 8) + "…" : unit.name;
          const facing = unit.facing ?? (unit.isEnemy ? "west" : "east");
          
          // Get controller info for player units
          let controllerBadge = "";
          if (!unit.isEnemy && unit.controller) {
            const state = getGameState();
            const player = state.players[unit.controller as PlayerId];
            const controllerColor = player?.color || (unit.controller === "P1" ? "#ff8a00" : "#6849c2");
            const controllerLabel = unit.controller === "P1" ? "P1" : "P2";
            controllerBadge = `
              <div class="battle-unit-controller-badge" style="background: ${controllerColor}; color: white; border: 2px solid ${controllerColor};">
                ${controllerLabel}
              </div>
            `;
          }
          
          // Calculate pixel position for unit
          // CRITICAL: Account for grid padding (12px) and gaps (4px)
          // Grid has 12px padding, then tiles with 4px gaps
          // Position at center of tile
          const GRID_PADDING = 12;
          const GAP = 4;
          const unitX = GRID_PADDING + unit.pos.x * (this.TILE_SIZE + GAP) + this.TILE_SIZE / 2;
          const unitY = GRID_PADDING + unit.pos.y * (this.TILE_SIZE + GAP) + this.TILE_SIZE / 2;
          
          unitsHtml.push({
            html: `
              <div class="battle-unit battle-unit--simple ${side} ${act}" 
                   data-unit-id="${unit.id}" 
                   data-unit-x="${unit.pos.x}"
                   data-unit-y="${unit.pos.y}"
                   data-facing="${facing}"
                   style="position: absolute !important; left: ${unitX}px !important; top: ${unitY}px !important; transform: translate(-50%, -50%) !important; width: auto !important; height: auto !important; min-width: 0 !important; min-height: 0 !important; max-width: none !important; max-height: none !important; background: none !important; border: none !important; padding: 0 !important; z-index: 1000;">
                <div class="battle-unit-portrait-wrapper">
                  <div class="battle-unit-portrait">
                    <img src="${getBattleUnitPortraitPath(unit.id, unit.baseUnitId)}" alt="${unit.name}" class="battle-unit-portrait-img" onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
                  </div>
                  ${controllerBadge}
                  <div class="battle-unit-info-overlay">
                    <div class="battle-unit-name">${truncName}</div>
                    <div class="battle-unit-hp">HP ${unit.hp}/${unit.maxHp}</div>
                  </div>
                </div>
              </div>
            `,
            x: unit.pos.x,
            y: unit.pos.y
          });
        }
      }
    }
    
    // Calculate grid container size
    const gridWidthPx = gridWidth * this.TILE_SIZE + (gridWidth - 1) * 4 + 24; // tiles + gaps + padding
    const gridHeightPx = gridHeight * this.TILE_SIZE + (gridHeight - 1) * 4 + 24;
    
    return `
      <div class="battle-grid-pan-wrapper">
        <div class="battle-grid-zoom-viewport">
          <div class="battle-grid-zoom-inner" style="transform: scale(${zoom}); transform-origin: center center;">
            <div class="battle-grid-container battle-grid-container--simple" 
                 id="battleGridContainer"
                 style="width: ${gridWidthPx}px; height: ${gridHeightPx}px; position: relative; margin: 0 auto;">
              <div class="battle-grid battle-grid--simple" 
                   style="display: grid; grid-template-columns: repeat(${gridWidth}, ${this.TILE_SIZE}px); grid-template-rows: repeat(${gridHeight}, ${this.TILE_SIZE}px); gap: 4px; padding: 12px; width: 100%; height: 100%; position: relative; box-sizing: border-box;">
                ${tilesHtml}
              </div>
              <div class="battle-grid-units battle-grid-units--simple" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; box-sizing: border-box;">
                ${unitsHtml.map(u => u.html).join('')}
              </div>
              <div class="battle-animation-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2000; overflow: visible;"></div>
              <div class="battle-grid-overlays"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Get grid coordinates from clicked tile element
   * Simple, direct approach using data attributes
   */
  static getTileCoordinates(element: HTMLElement): { x: number; y: number } | null {
    const xStr = element.getAttribute("data-x");
    const yStr = element.getAttribute("data-y");
    
    if (!xStr || !yStr) {
      // Try to find parent tile
      const tile = element.closest(".battle-tile") as HTMLElement;
      if (tile) {
        return this.getTileCoordinates(tile);
      }
      return null;
    }
    
    const x = parseInt(xStr, 10);
    const y = parseInt(yStr, 10);
    
    if (isNaN(x) || isNaN(y)) {
      return null;
    }
    
    return { x, y };
  }
}
