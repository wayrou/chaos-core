# Dungeon Map Zoom Controls

## Overview

The dungeon floor map screen supports mouse wheel zoom with pan controls.

## Controls

### Panning
- **WASD** or **Arrow Keys**: Pan the map
- **Shift + WASD**: Pan at 2.5x speed
- **SPACE** or **ENTER**: Advance to next available room
- **CENTER button**: Reset pan and zoom, center on current node

### Zooming
- **Mouse Wheel**: Zoom in/out
- **Zoom Range**: 0.6x (60%) to 1.8x (180%)
- **Default Zoom**: 1.0x (100%)
- **Zoom Anchor**: Zooms centered on mouse cursor position

## Implementation Details

### Zoom Clamping
- `MIN_ZOOM = 0.6`
- `MAX_ZOOM = 1.8`
- `DEFAULT_ZOOM = 1.0`
- `ZOOM_SENSITIVITY = 0.1` (10% per wheel step)

### Transform Application
- Map container uses CSS transform: `translate(x, y) scale(zoom)`
- Transform origin: `0 0` (top-left)
- Pan coordinates adjust when zooming to keep cursor position fixed

### UI Display
- Zoom percentage shown in bottom control panel
- Format: "Zoom: 120%"
- Updates in real-time as user zooms

## Testing

### Quick Test Steps

1. **Open operation map** - Default zoom is 100%
2. **Scroll mouse wheel** - Zoom should change smoothly
3. **Check clamping** - Zoom should stop at 60% and 180%
4. **Pan while zoomed** - Panning should work at all zoom levels
5. **Click nodes** - Node hitboxes should work correctly at all zoom levels
6. **Press CENTER** - Should reset zoom to 100% and center on current node

### Expected Behavior

- Zoom is smooth and responsive
- Zoom is clamped to safe range (no extreme zoom)
- Panning works correctly at all zoom levels
- Node clicks work correctly (hitboxes scale with zoom)
- Zoom display updates in real-time
- CENTER button resets both pan and zoom
