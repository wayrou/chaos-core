// ============================================================================
// FIELD SYSTEM - MAP DEFINITIONS
// ============================================================================

import { FieldMap, FieldObject, InteractionZone } from "./types";
import {
  getAllImportedFieldMaps,
  getImportedFieldMap,
  isTechnicaContentDisabled,
} from "../content/technica";
import { getGameState } from "../state/gameStore";
import {
  isBlackMarketNodeUnlocked,
  isDispatchNodeUnlocked,
  isFoundryAnnexUnlocked,
  isPortNodeUnlocked,
  isSchemaNodeUnlocked,
  isStableNodeUnlocked,
} from "../core/campaign";
import {
  getBaseCampNodeDefinitions,
  getBaseCampNodeLayout,
  isBaseCampNodeUnlocked,
} from "./baseCampBuild";
import { getPlacedFieldDecor } from "../core/decorSystem";
import {
  OUTER_DECK_HAVEN_EXIT_OBJECT_ID,
  OUTER_DECK_HAVEN_EXIT_OBJECT_TILE,
  OUTER_DECK_HAVEN_EXIT_SPAWN_TILE,
  OUTER_DECK_HAVEN_EXIT_ZONE_ID,
  OUTER_DECK_OVERWORLD_MAP_ID,
} from "../core/outerDecks";
import { COUNTERWEIGHT_WORKSHOP_MAP_ID, isWeaponsmithUnlocked } from "../core/weaponsmith";
import { createOuterDeckFieldMap } from "./outerDeckMaps";
import { createWeaponsmithWorkshopFieldMap } from "./weaponsmithWorkshopMap";

function setMapAreaWalkable(map: FieldMap, left: number, top: number, width: number, height: number): void {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      const tile = map.tiles[y]?.[x];
      if (!tile) {
        continue;
      }
      tile.walkable = true;
      if (tile.type === "wall") {
        tile.type = "floor";
      }
    }
  }
}

function ensureNodeFootprintsWalkable(map: FieldMap): FieldMap {
  map.objects.forEach((object) => {
    if (object.type === "station") {
      setMapAreaWalkable(map, object.x, object.y, object.width, object.height);
    }
  });

  map.interactionZones.forEach((zone) => {
    setMapAreaWalkable(map, zone.x, zone.y, zone.width, zone.height);
  });

  return map;
}

// ============================================================================
// BASE CAMP MAP
// ============================================================================

function createBaseCampMap(): FieldMap {
  return {
    "id": "base_camp",
    "name": "Base Camp",
    "width": 50,
    "height": 25,
    "tiles": [
      [
        {
          "x": 0,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 2,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 3,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 4,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 5,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 6,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 7,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 8,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 9,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 10,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 11,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 12,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 13,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 14,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 15,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 16,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 17,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 18,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 19,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 20,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 21,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 22,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 23,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 24,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 25,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 26,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 27,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 28,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 29,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 30,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 36,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 37,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 38,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 39,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 40,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 41,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 42,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 43,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 44,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 45,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 46,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 47,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 48,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 0,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 1,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 36,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 37,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 38,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 39,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 40,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 41,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 42,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 43,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 44,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 45,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 46,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 47,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 48,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 1,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 2,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 36,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 37,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 38,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 39,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 40,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 41,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 42,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 43,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 44,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 45,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 46,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 47,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 48,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 2,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 3,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 36,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 37,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 38,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 39,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 40,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 41,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 42,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 43,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 44,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 45,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 46,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 47,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 48,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 3,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 4,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 36,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 37,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 38,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 39,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 40,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 41,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 42,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 43,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 44,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 45,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 46,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 47,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 48,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 4,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 5,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 36,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 37,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 38,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 39,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 40,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 41,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 42,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 43,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 44,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 45,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 46,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 47,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 48,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 5,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 6,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 6,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 32,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 33,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 34,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 35,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 36,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 37,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 38,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 39,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 6,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 49,
          "y": 6,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 7,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 31,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 32,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 33,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 34,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 35,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 36,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 37,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 38,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 39,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 7,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 49,
          "y": 7,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 8,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 31,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 32,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 33,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 34,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 35,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 36,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 37,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 38,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 39,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 8,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 49,
          "y": 8,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 9,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 9,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 9,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 9,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 9,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 9,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 9,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 36,
          "y": 9,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 37,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 38,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 39,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 9,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 49,
          "y": 9,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 10,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 31,
          "y": 10,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 10,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 10,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 10,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 10,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 36,
          "y": 10,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 37,
          "y": 10,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 38,
          "y": 10,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 39,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 10,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 49,
          "y": 10,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 31,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 32,
          "y": 11,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 33,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 36,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 37,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 38,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 39,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 40,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 41,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 42,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 43,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 44,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 45,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 46,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 47,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 48,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 11,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 12,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 31,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 32,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 33,
          "y": 12,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 12,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 36,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 37,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 38,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 39,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 12,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 12,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 12,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 13,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 31,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 32,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 33,
          "y": 13,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 13,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 36,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 37,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 38,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 39,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 13,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 13,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 13,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 14,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 31,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 32,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 33,
          "y": 14,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 14,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 36,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 37,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 38,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 39,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 14,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 14,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 14,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 15,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 31,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 32,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 33,
          "y": 15,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 15,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 36,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 37,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 38,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 39,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 15,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 15,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 15,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 16,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 31,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 32,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 33,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 34,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 35,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 36,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 37,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 38,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 39,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 16,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 16,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 16,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 17,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 31,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 32,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 33,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 34,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 35,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 36,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 37,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 38,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 39,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 17,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 17,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 17,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 18,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 18,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 18,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 18,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 18,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 35,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 36,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 37,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 38,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 39,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 18,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 18,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 18,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 19,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 19,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 19,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 19,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 19,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 35,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 36,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 37,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 38,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 39,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 19,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 19,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 19,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 20,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 20,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 20,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 20,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 20,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 35,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 36,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 37,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 38,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 39,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 20,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 20,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 20,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 21,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 21,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 21,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 21,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 21,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 21,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 36,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 37,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 38,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 39,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 40,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 41,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 42,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 43,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 44,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 45,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 46,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 47,
          "y": 21,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 48,
          "y": 21,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 21,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 22,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 36,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 37,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 38,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 39,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 40,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 41,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 42,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 43,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 44,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 45,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 46,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 47,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 48,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 22,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 2,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 3,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 4,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 5,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 6,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 7,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 8,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 9,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 10,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 11,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 12,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 13,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 14,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 15,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 16,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 17,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 18,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 19,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 20,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 21,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 22,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 23,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 24,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 25,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 26,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 27,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 28,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 29,
          "y": 23,
          "walkable": true,
          "type": "stone",
        },
        {
          "x": 30,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 36,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 37,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 38,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 39,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 40,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 41,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 42,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 43,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 44,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 45,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 46,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 47,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 48,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 23,
          "walkable": false,
          "type": "wall",
        },
      ],
      [
        {
          "x": 0,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 1,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 2,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 3,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 4,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 5,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 6,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 7,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 8,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 9,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 10,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 11,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 12,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 13,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 14,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 15,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 16,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 17,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 18,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 19,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 20,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 21,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 22,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 23,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 24,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 25,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 26,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 27,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 28,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 29,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 30,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 31,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 32,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 33,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 34,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 35,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 36,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 37,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 38,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 39,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 40,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 41,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 42,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 43,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 44,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 45,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 46,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 47,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 48,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
        {
          "x": 49,
          "y": 24,
          "walkable": false,
          "type": "wall",
        },
      ],
    ],
    "objects": [
      {
        "id": "shop_station",
        "x": 3,
        "y": 3,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "shop",
        "metadata": {
          "name": "Shop",
        },
      },
      {
        "id": "roster_station",
        "x": 11,
        "y": 3,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "roster",
        "metadata": {
          "name": "Unit Roster",
        },
      },
      {
        "id": "loadout_station",
        "x": 27,
        "y": 5,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "loadout",
        "metadata": {
          "name": "Loadout",
        },
      },
      {
        "id": "ops_terminal",
        "x": 27,
        "y": 8,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "ops_terminal",
        "metadata": {
          "name": "Ops Terminal",
        },
      },
      {
        "id": "quest_board",
        "x": 3,
        "y": 10,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "quest_board",
        "metadata": {
          "name": "Quest Board",
        },
      },
      {
        "id": "tavern_station",
        "x": 7,
        "y": 10,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "tavern",
        "metadata": {
          "name": "Tavern",
        },
      },
      {
        "id": "gear_workbench_station",
        "x": 11,
        "y": 10,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "gear_workbench",
        "metadata": {
          "name": "Workshop",
        },
      },
      {
        "id": "quarters_station",
        "x": 7,
        "y": 3,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "quarters",
        "metadata": {
          "name": "Quarters",
        },
      },
      {
        "id": "schema_station",
        "x": 37,
        "y": 13,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "schema",
        "metadata": {
          "name": "S.C.H.E.M.A.",
        },
      },
      {
        "id": "foundry_annex_station",
        "x": 43,
        "y": 16,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "foundry_annex",
        "metadata": {
          "name": "Foundry + Annex",
        },
      },
      {
        "id": "black_market_station",
        "x": 37,
        "y": 19,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "black_market",
        "metadata": {
          "name": "Black Market",
        },
      },
      {
        "id": "stable_station",
        "x": 43,
        "y": 13,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "stable",
        "metadata": {
          "name": "Stable",
        },
      },
      {
        "id": "dispatch_station",
        "x": 37,
        "y": 16,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "dispatch",
        "metadata": {
          "name": "Dispatch",
        },
      },
      {
        "id": "port_station",
        "x": 42,
        "y": 18,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "port",
        "metadata": {
          "name": "Port",
        },
      },
      {
        "id": "comms_array_station",
        "x": 30,
        "y": 14,
        "width": 2,
        "height": 2,
        "type": "station",
        "sprite": "comms_array",
        "metadata": {
          "name": "Comms Array",
        },
      },
    ],
    "interactionZones": [
      {
        "id": "interact_shop",
        "x": 3,
        "y": 3,
        "width": 2,
        "height": 2,
        "action": "shop",
        "label": "SHOP",
      },
      {
        "id": "interact_roster",
        "x": 11,
        "y": 3,
        "width": 2,
        "height": 2,
        "action": "roster",
        "label": "UNIT ROSTER",
      },
      {
        "id": "interact_loadout",
        "x": 27,
        "y": 5,
        "width": 2,
        "height": 2,
        "action": "loadout",
        "label": "LOADOUT",
      },
      {
        "id": "interact_ops",
        "x": 27,
        "y": 8,
        "width": 2,
        "height": 2,
        "action": "ops_terminal",
        "label": "OPS TERMINAL",
      },
      {
        "id": "interact_quest_board",
        "x": 3,
        "y": 10,
        "width": 2,
        "height": 2,
        "action": "quest_board",
        "label": "QUEST BOARD",
      },
      {
        "id": "interact_tavern",
        "x": 7,
        "y": 10,
        "width": 2,
        "height": 2,
        "action": "tavern",
        "label": "TAVERN",
      },
      {
        "id": "interact_gear_workbench",
        "x": 11,
        "y": 10,
        "width": 2,
        "height": 2,
        "action": "gear_workbench",
        "label": "WORKSHOP",
      },
      {
        "id": "interact_quarters",
        "x": 7,
        "y": 3,
        "width": 2,
        "height": 2,
        "action": "quarters",
        "label": "QUARTERS",
      },
      {
        "id": "interact_schema",
        "x": 37,
        "y": 13,
        "width": 2,
        "height": 2,
        "action": "schema",
        "label": "S.C.H.E.M.A.",
      },
      {
        "id": "interact_foundry_annex",
        "x": 43,
        "y": 16,
        "width": 2,
        "height": 2,
        "action": "foundry-annex",
        "label": "FOUNDRY + ANNEX",
      },
      {
        "id": "interact_black_market",
        "x": 37,
        "y": 19,
        "width": 2,
        "height": 2,
        "action": "black_market",
        "label": "BLACK MARKET",
      },
      {
        "id": "interact_stable",
        "x": 43,
        "y": 13,
        "width": 2,
        "height": 2,
        "action": "stable",
        "label": "STABLE",
      },
      {
        "id": "interact_dispatch",
        "x": 37,
        "y": 16,
        "width": 2,
        "height": 2,
        "action": "dispatch",
        "label": "DISPATCH",
      },
      {
        "id": "interact_port",
        "x": 42,
        "y": 18,
        "width": 2,
        "height": 2,
        "action": "port",
        "label": "PORT",
      },
      {
        "id": "interact_comms_array",
        "x": 30,
        "y": 14,
        "width": 2,
        "height": 2,
        "action": "comms-array",
        "label": "COMMS ARRAY",
      },
    ],
  };
}

function cloneFieldMap(map: FieldMap): FieldMap {
  return {
    ...map,
    tiles: map.tiles.map((row) => row.map((tile) => ({ ...tile }))),
    objects: map.objects.map((object) => ({
      ...object,
      metadata: object.metadata ? { ...object.metadata } : undefined,
    })),
    interactionZones: map.interactionZones.map((zone) => ({
      ...zone,
      metadata: zone.metadata ? { ...zone.metadata } : undefined,
    })),
  };
}

function setTile(
  map: FieldMap,
  x: number,
  y: number,
  walkable: boolean,
  type: FieldMap["tiles"][number][number]["type"],
): void {
  const row = map.tiles[y];
  const tile = row?.[x];
  if (!row || !tile) {
    return;
  }

  row[x] = {
    ...tile,
    walkable,
    type,
  };
}

function fillRect(
  map: FieldMap,
  left: number,
  top: number,
  right: number,
  bottom: number,
  walkable: boolean,
  type: FieldMap["tiles"][number][number]["type"],
): void {
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      setTile(map, x, y, walkable, type);
    }
  }
}

function normalizeGroundTilesToFloor(map: FieldMap): void {
  for (const row of map.tiles) {
    for (const tile of row) {
      if (!tile.walkable) {
        continue;
      }

      tile.type = "floor";
    }
  }
}

function moveObject(
  objects: FieldObject[],
  objectId: string,
  x: number,
  y: number,
): void {
  const object = objects.find((entry) => entry.id === objectId);
  if (!object) {
    return;
  }

  object.x = x;
  object.y = y;
}

function moveInteractionZone(
  zones: InteractionZone[],
  zoneId: string,
  x: number,
  y: number,
): void {
  const zone = zones.find((entry) => entry.id === zoneId);
  if (!zone) {
    return;
  }

  zone.x = x;
  zone.y = y;
}

function applyBaseCampBuildLayout(map: FieldMap): void {
  const state = getGameState();
  const uiLayout = state.uiLayout;

  getBaseCampNodeDefinitions().forEach((definition) => {
    if (!isBaseCampNodeUnlocked(definition.id)) {
      return;
    }

    const layout = getBaseCampNodeLayout(uiLayout, definition.id);
    if (layout.hidden) {
      map.objects = map.objects.filter((object) => object.id !== definition.objectId);
      map.interactionZones = map.interactionZones.filter((zone) => zone.id !== definition.zoneId);
      return;
    }

    moveObject(map.objects, definition.objectId, layout.x, layout.y);
    moveInteractionZone(map.interactionZones, definition.zoneId, layout.x, layout.y);
  });

  getPlacedFieldDecor(state, map.id).forEach(({ placement, decor }) => {
    map.objects.push({
      id: `field_decor_${placement.placementId}`,
      x: placement.x,
      y: placement.y,
      width: decor.tileWidth,
      height: decor.tileHeight,
      type: "decoration",
      sprite: decor.spriteKey,
      metadata: {
        name: decor.name,
        decorId: decor.id,
        placementId: placement.placementId,
        spriteKey: decor.spriteKey,
      },
    });
  });
}

function createConfiguredBaseCampMap(): FieldMap {
  const map = cloneFieldMap(createBaseCampMap());
  const state = getGameState();

  map.objects = map.objects.filter((object) => object.id !== "mini_core_station");
  map.interactionZones = map.interactionZones.filter(
    (zone) => zone.id !== "interact_mini_core" && zone.id !== "interact_haven_annex_gate",
  );

  normalizeGroundTilesToFloor(map);

  moveObject(map.objects, "comms_array_station", 30, 14);

  moveInteractionZone(map.interactionZones, "interact_comms_array", 30, 14);

  // Keep Comms Array reachable from the start.
  fillRect(map, 29, 13, 32, 17, true, "floor");

  // Keep the HAVEN annex physically open at all times; the actual facility nodes
  // simply appear as they unlock.
  fillRect(map, 35, 12, 47, 21, true, "floor");

  for (let x = 34; x <= 48; x += 1) {
    setTile(map, x, 11, false, "wall");
    setTile(map, x, 22, false, "wall");
  }

  for (let y = 11; y <= 22; y += 1) {
    setTile(map, 34, y, false, "wall");
    setTile(map, 48, y, false, "wall");
  }

  moveObject(map.objects, "stable_station", 43, 13);
  moveObject(map.objects, "dispatch_station", 37, 16);
  moveObject(map.objects, "black_market_station", 46, 18);
  moveObject(map.objects, "port_station", 43, 18);

  moveInteractionZone(map.interactionZones, "interact_stable", 43, 13);
  moveInteractionZone(map.interactionZones, "interact_dispatch", 37, 16);
  moveInteractionZone(map.interactionZones, "interact_black_market", 46, 18);
  moveInteractionZone(map.interactionZones, "interact_port", 43, 18);

  // Keep a two-tile wide passage under the Comms Array so the annex-side lane
  // is always physically accessible even before its facilities unlock.
  fillRect(map, 33, 15, 34, 20, true, "floor");

  // Give Foundry a reachable upper-right lane near Loadout without leaving a
  // disconnected dead strip at the very top-right of the map.
  fillRect(map, 29, 5, 36, 8, true, "floor");

  if (!isPortNodeUnlocked()) {
    map.objects = map.objects.filter((object) => object.id !== "port_station");
    map.interactionZones = map.interactionZones.filter((zone) => zone.id !== "interact_port");
  }

  if (!isDispatchNodeUnlocked()) {
    map.objects = map.objects.filter((object) => object.id !== "dispatch_station");
    map.interactionZones = map.interactionZones.filter((zone) => zone.id !== "interact_dispatch");
  }

  if (!isStableNodeUnlocked()) {
    map.objects = map.objects.filter((object) => object.id !== "stable_station");
    map.interactionZones = map.interactionZones.filter((zone) => zone.id !== "interact_stable");
  }

  if (!isBlackMarketNodeUnlocked()) {
    map.objects = map.objects.filter((object) => object.id !== "black_market_station");
    map.interactionZones = map.interactionZones.filter((zone) => zone.id !== "interact_black_market");
  }

  if (!isSchemaNodeUnlocked()) {
    map.objects = map.objects.filter((object) => object.id !== "schema_station");
    map.interactionZones = map.interactionZones.filter((zone) => zone.id !== "interact_schema");
  }

  if (!isFoundryAnnexUnlocked()) {
    map.objects = map.objects.filter((object) => object.id !== "foundry_annex_station");
    map.interactionZones = map.interactionZones.filter((zone) => zone.id !== "interact_foundry_annex");
  }

  applyBaseCampBuildLayout(map);

  // Open a south-exit lane from HAVEN into the Outer Deck overworld.
  fillRect(map, 22, 19, 27, 23, true, "floor");
  setTile(map, 24, 24, false, "wall");
  setTile(map, 25, 24, false, "wall");

  map.objects.push({
    id: OUTER_DECK_HAVEN_EXIT_OBJECT_ID,
    x: OUTER_DECK_HAVEN_EXIT_OBJECT_TILE.x,
    y: OUTER_DECK_HAVEN_EXIT_OBJECT_TILE.y,
    width: 4,
    height: 2,
    type: "station",
    sprite: "bulkhead",
    metadata: { name: "Outer Deck Access" },
  });
  map.interactionZones.unshift({
    id: OUTER_DECK_HAVEN_EXIT_ZONE_ID,
    x: OUTER_DECK_HAVEN_EXIT_OBJECT_TILE.x,
    y: OUTER_DECK_HAVEN_EXIT_SPAWN_TILE.y + 1,
    width: 4,
    height: 2,
    action: "custom",
    label: "OUTER DECKS",
    metadata: {
      handlerId: "outer_deck_enter_overworld",
      autoTrigger: true,
    },
  });

  if (isWeaponsmithUnlocked(state)) {
    map.objects.push({
      id: "haven_weaponsmith_station",
      x: 40,
      y: 13,
      width: 2,
      height: 2,
      type: "station",
      sprite: "repair_bench",
      metadata: { name: "Weaponsmith Bench" },
    });
    map.interactionZones.unshift({
      id: "interact_haven_weaponsmith",
      x: 40,
      y: 13,
      width: 2,
      height: 2,
      action: "custom",
      label: "WEAPONSMITH",
      metadata: { handlerId: "weaponsmith_workshop" },
    });
  }

  return map;
}

// ============================================================================
// FREE ZONE MAP (Placeholder)
// ============================================================================

function createFreeZoneMap(): FieldMap {
  const width = 15;
  const height = 12;

  const tiles: FieldMap["tiles"] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      // Random walls for variety (simple pattern)
      const isWall = (x + y) % 5 === 0 && (x > 2 && x < width - 3 && y > 2 && y < height - 3);
      tiles[y][x] = {
        x,
        y,
        walkable: !isWall && (x !== 0 && x !== width - 1 && y !== 0 && y !== height - 1),
        type: isWall ? "wall" : "grass",
      };
    }
  }

  // Placeholder resources
  const objects: FieldObject[] = [
    {
      id: "resource_1",
      x: 5,
      y: 5,
      width: 1,
      height: 1,
      type: "resource",
      sprite: "resource",
      metadata: { resourceType: "metalScrap" },
    },
    {
      id: "resource_2",
      x: 10,
      y: 7,
      width: 1,
      height: 1,
      type: "resource",
      sprite: "resource",
      metadata: { resourceType: "wood" },
    },
  ];

  // Add entry point to free zone from base camp (will be added to base camp map)

  // Exit back to base camp (placed at walkable location)
  const interactionZones: InteractionZone[] = [
    {
      id: "exit_to_base_camp",
      x: 1,
      y: 6,
      width: 1,
      height: 1,
      action: "free_zone_entry",
      label: "RETURN TO BASE CAMP",
      metadata: { targetMap: "base_camp" },
    },
  ];

  return {
    id: "free_zone_1",
    name: "Free Zone",
    width,
    height,
    tiles,
    objects,
    interactionZones,
  };
}

// ============================================================================
// QUARTERS MAP
// ============================================================================

function createQuartersMap(): FieldMap {
  const width = 10;
  const height = 8;

  // Create walkable floor grid
  const tiles: FieldMap["tiles"] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      // Walls around edges, floor in center
      const isWall = x === 0 || x === width - 1 || y === 0 || y === height - 1;
      tiles[y][x] = {
        x,
        y,
        walkable: !isWall,
        type: isWall ? "wall" : "floor",
      };
    }
  }

  // Quarters objects (visual placeholders)
  const objects: FieldObject[] = [
    {
      id: "mailbox_object",
      x: 2,
      y: 2,
      width: 1,
      height: 1,
      type: "station",
      sprite: "mailbox",
      metadata: { name: "Mailbox" },
    },
    {
      id: "bunk_object",
      x: 7,
      y: 2,
      width: 2,
      height: 1,
      type: "station",
      sprite: "bunk",
      metadata: { name: "Bunk" },
    },
    {
      id: "pinboard_object",
      x: 2,
      y: 5,
      width: 1,
      height: 1,
      type: "station",
      sprite: "pinboard",
      metadata: { name: "Pinboard" },
    },
    {
      id: "footlocker_object",
      x: 7,
      y: 5,
      width: 1,
      height: 1,
      type: "station",
      sprite: "footlocker",
      metadata: { name: "Footlocker" },
    },
    {
      id: "exit_door_object",
      x: 4,
      y: 5,
      width: 2,
      height: 1,
      type: "station",
      sprite: "door",
      metadata: { name: "Exit" },
    },
  ];

  // Interaction zones for quarters interactables
  const interactionZones: InteractionZone[] = [
    {
      id: "interact_mailbox",
      x: 2,
      y: 3,
      width: 1,
      height: 1,
      action: "custom",
      label: "MAILBOX",
      metadata: { quartersAction: "mailbox" },
    },
    {
      id: "interact_bunk",
      x: 7,
      y: 3,
      width: 2,
      height: 1,
      action: "custom",
      label: "BUNK",
      metadata: { quartersAction: "bunk" },
    },
    {
      id: "interact_pinboard",
      x: 2,
      y: 6,
      width: 1,
      height: 1,
      action: "custom",
      label: "PINBOARD",
      metadata: { quartersAction: "pinboard" },
    },
    {
      id: "interact_footlocker",
      x: 7,
      y: 6,
      width: 1,
      height: 1,
      action: "custom",
      label: "FOOTLOCKER",
      metadata: { quartersAction: "footlocker" },
    },
    {
      id: "interact_sable",
      x: 5,
      y: 4,
      width: 1,
      height: 1,
      action: "custom",
      label: "SABLE",
      metadata: { quartersAction: "sable" },
    },
    {
      id: "exit_quarters",
      x: 4,
      y: 5,
      width: 2,
      height: 1,
      action: "base_camp_entry",
      label: "EXIT TO BASE CAMP",
      metadata: { targetMap: "base_camp" },
    },
  ];

  return {
    id: "quarters",
    name: "Quarters",
    width,
    height,
    tiles,
    objects,
    interactionZones,
  };
}

// ============================================================================
// NETWORK LOBBY MAP
// ============================================================================

function createNetworkLobbyMap(): FieldMap {
  const width = 22;
  const height = 14;
  const tiles: FieldMap["tiles"] = [];

  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      const isBoundary = x === 0 || x === width - 1 || y === 0 || y === height - 1;
      const isRaisedTable = x >= 8 && x <= 13 && y >= 5 && y <= 8;
      const isConsoleBlock = (x >= 3 && x <= 5 && y >= 3 && y <= 4) || (x >= 16 && x <= 18 && y >= 3 && y <= 4);
      tiles[y][x] = {
        x,
        y,
        walkable: !isBoundary && !isRaisedTable && !isConsoleBlock,
        type: isBoundary ? "wall" : isRaisedTable || isConsoleBlock ? "stone" : "floor",
      };
    }
  }

  const objects: FieldObject[] = [
    {
      id: "lobby_skirmish_console",
      x: 3,
      y: 3,
      width: 3,
      height: 2,
      type: "station",
      sprite: "console",
      metadata: { name: "Skirmish Console" },
    },
    {
      id: "lobby_ops_table",
      x: 8,
      y: 5,
      width: 6,
      height: 4,
      type: "station",
      sprite: "ops_table",
      metadata: { name: "Operations Table" },
    },
    {
      id: "lobby_comms_uplink",
      x: 16,
      y: 3,
      width: 3,
      height: 2,
      type: "station",
      sprite: "uplink",
      metadata: { name: "Comms Uplink" },
    },
    {
      id: "lobby_lounge_bench",
      x: 5,
      y: 10,
      width: 4,
      height: 1,
      type: "decoration",
      sprite: "bench",
      metadata: { name: "Lounge Bench" },
    },
    {
      id: "lobby_ready_bench",
      x: 13,
      y: 10,
      width: 4,
      height: 1,
      type: "decoration",
      sprite: "bench",
      metadata: { name: "Ready Bench" },
    },
  ];

  return {
    id: "network_lobby",
    name: "Multiplayer Lobby",
    width,
    height,
    tiles,
    objects,
    interactionZones: [
      {
        id: "network_lobby_skirmish_console",
        x: 3,
        y: 3,
        width: 3,
        height: 2,
        action: "custom",
        label: "SKIRMISH CONSOLE",
        metadata: { handlerId: "lobby_skirmish_console" },
      },
      {
        id: "network_lobby_ops_table",
        x: 8,
        y: 5,
        width: 6,
        height: 4,
        action: "custom",
        label: "OPERATIONS TABLE",
        metadata: { handlerId: "lobby_ops_table" },
      },
      {
        id: "network_lobby_comms_uplink",
        x: 16,
        y: 3,
        width: 3,
        height: 2,
        action: "comms-array",
        label: "COMMS UPLINK",
      },
    ],
  };
}

// KEY ROOM MAPS (Dynamic)
function createKeyRoomMap(mapId: string): FieldMap {
  // Extract key room ID from map ID (format: "keyroom_<roomNodeId>")
  const keyRoomId = mapId.replace("keyroom_", "");

  // Create a simple facility map for the key room
  // This is a placeholder - can be expanded with facility-specific layouts
  const width = 20;
  const height = 15;

  const tiles: Array<{ x: number; y: number; type: "floor" | "wall" }> = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Create walls around edges, floor in center
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        tiles.push({ x, y, type: "wall" });
      } else {
        tiles.push({ x, y, type: "floor" });
      }
    }
  }

  // Convert to 2D array format
  const tiles2D: import("./types").FieldTile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles2D[y] = [];
    for (let x = 0; x < width; x++) {
      const tile = tiles.find(t => t.x === x && t.y === y);
      tiles2D[y][x] = {
        x,
        y,
        walkable: tile?.type === "floor",
        type: tile?.type === "wall" ? "wall" : "floor",
      };
    }
  }

  return {
    id: mapId as FieldMap["id"],
    name: `Key Room: ${keyRoomId}`,
    width,
    height,
    tiles: tiles2D,
    objects: [],
    interactionZones: [
      {
        id: `exit_${keyRoomId}`,
        x: 1,
        y: height - 2,
        width: 2,
        height: 1,
        action: "base_camp_entry",
        label: "EXIT",
        metadata: { targetMap: "base_camp" },
      },
    ],
  };
}

// ============================================================================
// MAP REGISTRY
// ============================================================================

const maps = new Map<FieldMap["id"], FieldMap>([
  ...(isTechnicaContentDisabled("map", "base_camp") ? [] : [["base_camp", createBaseCampMap()] as const]),
  ...(isTechnicaContentDisabled("map", "free_zone_1") ? [] : [["free_zone_1", createFreeZoneMap()] as const]),
  ...(isTechnicaContentDisabled("map", "quarters") ? [] : [["quarters", createQuartersMap()] as const]),
  ["network_lobby", createNetworkLobbyMap()] as const,
]);

for (const importedMap of getAllImportedFieldMaps()) {
  maps.set(importedMap.id, importedMap);
}

export function getFieldMap(mapId: FieldMap["id"]): FieldMap {
  // Handle dynamic key room maps
  if (typeof mapId === "string" && mapId.startsWith("keyroom_")) {
    return ensureNodeFootprintsWalkable(createKeyRoomMap(mapId));
  }
  if (mapId === OUTER_DECK_OVERWORLD_MAP_ID) {
    return ensureNodeFootprintsWalkable(createOuterDeckFieldMap(mapId) as FieldMap);
  }
  if (typeof mapId === "string" && mapId.startsWith("outerdeck_")) {
    const map = createOuterDeckFieldMap(mapId);
    if (map) {
      return ensureNodeFootprintsWalkable(map);
    }
  }
  if (mapId === COUNTERWEIGHT_WORKSHOP_MAP_ID) {
    return ensureNodeFootprintsWalkable(createWeaponsmithWorkshopFieldMap());
  }
  if (mapId === "base_camp" && !isTechnicaContentDisabled("map", "base_camp")) {
    return ensureNodeFootprintsWalkable(createConfiguredBaseCampMap());
  }
  const map = maps.get(mapId) || getImportedFieldMap(mapId);
  if (!map) {
    throw new Error(`Field map not found: ${mapId}`);
  }
  return ensureNodeFootprintsWalkable(map);
}

export function getAllMapIds(): FieldMap["id"][] {
  return Array.from(maps.keys());
}
