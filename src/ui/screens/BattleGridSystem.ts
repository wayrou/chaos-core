// ============================================================================
// BATTLE GRID COORDINATE SYSTEM - Robust, defensible isometric grid handling
// ============================================================================

import { isoProject, isoUnproject, ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from "../../core/isometric";
import { BattleState, Vec2 } from "../../core/battle";

/**
 * BattleGridCoordinateSystem - Handles all coordinate transformations
 * Single source of truth for grid <-> screen coordinate conversions
 */
export class BattleGridCoordinateSystem {
  public readonly gridWidth: number;
  public readonly gridHeight: number;
  private originX: number = 0;
  private originY: number = 0;
  private zoom: number = 1;
  private panX: number = 0;
  private panY: number = 0;

  constructor(gridWidth: number, gridHeight: number) {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.calculateOrigin();
  }

  /**
   * Calculate origin offset to center grid in container
   */
  private calculateOrigin(): void {
    const maxX = this.gridWidth - 1;
    const maxY = this.gridHeight - 1;

    const corners = [
      isoProject(0, 0, 0),
      isoProject(maxX, 0, 0),
      isoProject(0, maxY, 0),
      isoProject(maxX, maxY, 0),
    ];

    const minScreenX = Math.min(...corners.map(c => c.screenX));
    const minScreenY = Math.min(...corners.map(c => c.screenY));

    this.originX = -minScreenX;
    this.originY = -minScreenY;
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number): void {
    this.zoom = Math.max(0.1, Math.min(3.0, zoom));
  }

  /**
   * Set pan offset
   */
  setPan(x: number, y: number): void {
    this.panX = x;
    this.panY = y;
  }

  /**
   * Convert grid coordinates to screen coordinates
   * Note: Zoom is handled by CSS transform, so we don't apply it here
   */
  gridToScreen(gridX: number, gridY: number, elevation: number = 0): { x: number; y: number } {
    const projected = isoProject(gridX, gridY, elevation);
    const screenX = projected.screenX + this.originX + this.panX;
    const screenY = projected.screenY + this.originY + this.panY;
    return { x: screenX, y: screenY };
  }

  /**
   * Convert screen coordinates to grid coordinates (accounting for zoom/pan)
   * This is the critical function for click handling
   * Note: Must account for CSS zoom transform applied to parent
   */
  screenToGrid(screenX: number, screenY: number, containerElement?: HTMLElement): { x: number; y: number } | null {
    // Get actual zoom from CSS transform if container provided
    let actualZoom = this.zoom;
    if (containerElement) {
      const zoomInner = containerElement.closest('.battle-grid-zoom-inner') as HTMLElement;
      if (zoomInner) {
        const transform = window.getComputedStyle(zoomInner).transform;
        if (transform && transform !== 'none') {
          // Parse scale from matrix: matrix(scaleX, skewY, skewX, scaleY, translateX, translateY)
          const matrix = transform.match(/matrix\(([^)]+)\)/);
          if (matrix) {
            const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
            if (values.length >= 4) {
              actualZoom = values[0]; // scaleX
            }
          }
        }
      }
    }
    
    // Account for zoom (CSS transform scales the container)
    const unzoomedX = screenX / actualZoom - this.panX;
    const unzoomedY = screenY / actualZoom - this.panY;

    // Account for origin offset
    const isoX = unzoomedX - this.originX;
    const isoY = unzoomedY - this.originY;

    // Use isoUnproject to convert to grid coordinates
    const gridPos = isoUnproject(isoX, isoY);

    if (!gridPos) return null;

    // Validate bounds
    if (gridPos.x < 0 || gridPos.x >= this.gridWidth || 
        gridPos.y < 0 || gridPos.y >= this.gridHeight) {
      return null;
    }

    return gridPos;
  }

  /**
   * Get grid dimensions in screen space (before zoom transform)
   */
  getScreenDimensions(): { width: number; height: number } {
    const maxX = this.gridWidth - 1;
    const maxY = this.gridHeight - 1;

    const corners = [
      isoProject(0, 0, 0),
      isoProject(maxX, 0, 0),
      isoProject(0, maxY, 0),
      isoProject(maxX, maxY, 0),
    ];

    const minScreenX = Math.min(...corners.map(c => c.screenX));
    const maxScreenX = Math.max(...corners.map(c => c.screenX));
    const minScreenY = Math.min(...corners.map(c => c.screenY));
    const maxScreenY = Math.max(...corners.map(c => c.screenY));

    // Don't apply zoom here - CSS transform handles it
    const width = maxScreenX - minScreenX + ISO_TILE_WIDTH;
    const height = maxScreenY - minScreenY + ISO_TILE_HEIGHT;

    return { width, height };
  }

  /**
   * Get origin offset
   */
  getOrigin(): { x: number; y: number } {
    return { x: this.originX, y: this.originY };
  }
}

/**
 * TileRegistry - Maps grid coordinates to DOM elements for reliable lookup
 */
export class TileRegistry {
  private tiles: Map<string, HTMLElement> = new Map();

  /**
   * Register a tile element
   */
  register(x: number, y: number, element: HTMLElement): void {
    const key = this.getKey(x, y);
    this.tiles.set(key, element);
    
    // Store coordinates on element for redundancy
    element.setAttribute("data-grid-x", String(x));
    element.setAttribute("data-grid-y", String(y));
    element.setAttribute("data-tile-key", key);
  }

  /**
   * Get tile element by grid coordinates
   */
  get(x: number, y: number): HTMLElement | null {
    const key = this.getKey(x, y);
    return this.tiles.get(key) || null;
  }

  /**
   * Get tile element from DOM element (handles clicks on child elements)
   */
  getFromElement(element: HTMLElement | null): HTMLElement | null {
    if (!element) return null;

    // Check if element itself is a tile
    if (element.classList.contains("iso-tile")) {
      return element;
    }

    // Find parent tile element
    const tile = element.closest(".iso-tile") as HTMLElement;
    return tile || null;
  }

  /**
   * Get grid coordinates from tile element
   */
  getCoordinates(element: HTMLElement): { x: number; y: number } | null {
    const xStr = element.getAttribute("data-grid-x");
    const yStr = element.getAttribute("data-grid-y");

    if (!xStr || !yStr) {
      // Fallback: try data-x and data-y
      const fallbackX = element.getAttribute("data-x");
      const fallbackY = element.getAttribute("data-y");
      if (fallbackX && fallbackY) {
        const x = parseInt(fallbackX, 10);
        const y = parseInt(fallbackY, 10);
        if (!isNaN(x) && !isNaN(y)) {
          return { x, y };
        }
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

  /**
   * Clear all registered tiles
   */
  clear(): void {
    this.tiles.clear();
  }

  private getKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}

/**
 * BattleGridClickHandler - Centralized click handling with proper coordinate conversion
 */
export class BattleGridClickHandler {
  private coordSystem: BattleGridCoordinateSystem;
  private tileRegistry: TileRegistry;
  private container: HTMLElement | null = null;
  private clickHandlers: Map<string, (x: number, y: number, event: MouseEvent) => void> = new Map();

  constructor(coordSystem: BattleGridCoordinateSystem, tileRegistry: TileRegistry) {
    this.coordSystem = coordSystem;
    this.tileRegistry = tileRegistry;
  }

  /**
   * Attach click handler to container
   */
  attach(container: HTMLElement): void {
    if (this.container) {
      this.detach();
    }

    this.container = container;
    container.addEventListener("click", this.handleClick.bind(this), true);
  }

  /**
   * Detach click handler
   */
  detach(): void {
    if (this.container) {
      this.container.removeEventListener("click", this.handleClick.bind(this), true);
      this.container = null;
    }
  }

  /**
   * Register a click handler for a specific tile type or action
   */
  on(action: string, handler: (x: number, y: number, event: MouseEvent) => void): void {
    this.clickHandlers.set(action, handler);
  }

  /**
   * Handle click event - converts screen coordinates to grid coordinates
   * CRITICAL: Must account for CSS zoom transform on parent element
   */
  private handleClick(event: MouseEvent): void {
    if (!this.container) return;

    // Get the zoom-inner element (has the CSS transform scale)
    const zoomInner = this.container.closest('.battle-grid-zoom-inner') as HTMLElement;
    if (!zoomInner) {
      // Fallback: use container directly if no zoom wrapper
      const rect = this.container.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;
      const gridPos = this.coordSystem.screenToGrid(clickX, clickY);
      this.processClick(gridPos, event);
      return;
    }
    
    // Get zoom factor from CSS transform
    const zoomTransform = window.getComputedStyle(zoomInner).transform;
    let zoom = 1;
    if (zoomTransform && zoomTransform !== 'none') {
      const matrix = zoomTransform.match(/matrix\(([^)]+)\)/);
      if (matrix) {
        const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
        if (values.length >= 4) {
          zoom = values[0]; // scaleX (should equal scaleY for uniform scaling)
        }
      }
    }
    
    // Get click position in viewport coordinates
    const viewportX = event.clientX;
    const viewportY = event.clientY;
    
    // Get zoom-inner's bounding rect (already transformed)
    const zoomRect = zoomInner.getBoundingClientRect();
    
    // Get container's bounding rect (already transformed)
    const containerRect = this.container.getBoundingClientRect();
    
    // Convert viewport coordinates to container-local coordinates
    // Account for zoom: the rects are already scaled, so we need to "unscale" them
    const clickX = (viewportX - containerRect.left) / zoom;
    const clickY = (viewportY - containerRect.top) / zoom;

    // Convert screen coordinates to grid coordinates (no zoom needed here, already handled)
    const gridPos = this.coordSystem.screenToGrid(clickX, clickY);
    
    this.processClick(gridPos, event);
  }
  
  /**
   * Process click with validated grid coordinates
   */
  private processClick(gridPos: { x: number; y: number } | null, event: MouseEvent): void {

    if (!gridPos) {
      // Click outside grid bounds
      return;
    }

    // Find the clicked tile element
    const clickedElement = event.target as HTMLElement;
    const tileElement = this.tileRegistry.getFromElement(clickedElement);

    if (!tileElement) {
      return;
    }

    // Verify coordinates match (defensive check)
    const tileCoords = this.tileRegistry.getCoordinates(tileElement);
    if (!tileCoords) {
      console.warn("[BATTLE_GRID] Could not get coordinates from tile element", tileElement);
      return;
    }
    
    // Use tile coordinates as authoritative source (they're set during rendering)
    // The calculated gridPos is a validation, but tile data attributes are truth
    const finalX = tileCoords.x;
    const finalY = tileCoords.y;
    
    // Log mismatch for debugging (but still use tile coordinates)
    if (tileCoords.x !== gridPos.x || tileCoords.y !== gridPos.y) {
      console.warn("[BATTLE_GRID] Coordinate mismatch - using tile coordinates", {
        calculated: gridPos,
        tile: tileCoords,
        using: { x: finalX, y: finalY }
      });
    }

    // Determine which handler to call based on tile classes
    if (tileElement.classList.contains("iso-tile--placement-option")) {
      const handler = this.clickHandlers.get("placement");
      if (handler) {
        event.preventDefault();
        event.stopPropagation();
        handler(finalX, finalY, event);
      }
    } else if (tileElement.classList.contains("iso-tile--move-option")) {
      const handler = this.clickHandlers.get("move");
      if (handler) {
        event.preventDefault();
        event.stopPropagation();
        handler(finalX, finalY, event);
      }
    } else if (tileElement.classList.contains("iso-tile--attack-option")) {
      const handler = this.clickHandlers.get("attack");
      if (handler) {
        event.preventDefault();
        event.stopPropagation();
        handler(finalX, finalY, event);
      }
    }
  }
}

/**
 * BattleGridRenderer - Handles rendering with coordinate system integration
 */
export class BattleGridRenderer {
  private coordSystem: BattleGridCoordinateSystem;
  private tileRegistry: TileRegistry;

  constructor(coordSystem: BattleGridCoordinateSystem, tileRegistry: TileRegistry) {
    this.coordSystem = coordSystem;
    this.tileRegistry = tileRegistry;
  }

  /**
   * Render a single tile
   */
  renderTile(
    x: number,
    y: number,
    elevation: number,
    classes: string[],
    walls: { left: boolean; right: boolean },
    unit?: any
  ): { html: string; element?: HTMLElement } {
    const screenPos = this.coordSystem.gridToScreen(x, y, elevation);
    const origin = this.coordSystem.getOrigin();

    const tileX = screenPos.x;
    const tileY = screenPos.y;

    const cls = ["iso-tile", "iso-tile--floor", ...classes].join(" ");

    const html = `
      <div class="${cls}" 
           data-grid-x="${x}" 
           data-grid-y="${y}"
           data-x="${x}" 
           data-y="${y}" 
           data-elevation="${elevation}"
           data-tile-key="${x},${y}"
           style="left: ${tileX}px; top: ${tileY}px; pointer-events: auto;">
        ${walls.left ? `<div class="iso-wall iso-wall--left" style="height: ${elevation * 16}px; pointer-events: none;"></div>` : ''}
        ${walls.right ? `<div class="iso-wall iso-wall--right" style="height: ${elevation * 16}px; pointer-events: none;"></div>` : ''}
        <div class="iso-tile-top" style="pointer-events: none;"></div>
      </div>
    `;

    return { html };
  }

  /**
   * Register rendered tiles in registry (called after DOM is updated)
   */
  registerTiles(container: HTMLElement): void {
    this.tileRegistry.clear();
    const tiles = container.querySelectorAll(".iso-tile");
    tiles.forEach(tile => {
      const xStr = tile.getAttribute("data-grid-x");
      const yStr = tile.getAttribute("data-grid-y");
      if (xStr && yStr) {
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);
        if (!isNaN(x) && !isNaN(y)) {
          this.tileRegistry.register(x, y, tile as HTMLElement);
        }
      }
    });
  }
}

