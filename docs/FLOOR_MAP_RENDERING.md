# Floor Map Rendering System

## Overview

The Dungeon Floor Map screen (`OperationMapScreen.ts`) renders procedurally-generated node-based dungeon floors with branching paths. This document explains how the path line rendering works and how to debug alignment issues.

## Architecture

### Components

1. **HTML Structure**
   - `.opmap-nodes-container`: Relative-positioned container for all nodes and the SVG overlay
   - `.opmap-node-wrapper`: Absolutely-positioned wrapper for each room card
   - `.opmap-node`: The actual room card element
   - `#opmap-connections-overlay`: Full-size SVG overlay for drawing path lines

2. **Coordinate System**
   - All coordinates are relative to `.opmap-nodes-container`
   - Node positions are set via inline styles using `position: absolute`
   - SVG overlay covers entire container with `position: absolute; inset: 0`

### Rendering Flow

```
1. renderOperationMapScreen()
   ↓
2. renderRoguelikeMap()
   - Generates HTML for nodes
   - Stores connection data on window.__opmapConnectionData
   ↓
3. requestAnimationFrame() × 2
   - Ensures DOM is fully laid out
   ↓
4. drawMapConnections()
   - Measures actual node positions via getBoundingClientRect()
   - Converts to container-local coordinates
   - Draws SVG lines with proper styling
   ↓
5. setupConnectionRedrawOnResize()
   - Uses ResizeObserver to redraw on container size changes
```

## Path Line Coordinate Alignment

### Problem: Lines Drift or Misalign

**Root Cause**: Measuring before DOM layout is complete, or using wrong coordinate space.

**Solution**: The system uses a two-phase approach:

1. **Store connection data during render** (before DOM exists)
2. **Measure and draw after DOM is ready** (in requestAnimationFrame)

### Coordinate Conversion Formula

```typescript
// Get bounding rects
const containerRect = container.getBoundingClientRect();
const nodeRect = node.getBoundingClientRect();

// Convert to container-local coordinates
const localX = nodeRect.left - containerRect.left + nodeRect.width / 2;
const localY = nodeRect.top - containerRect.top + nodeRect.height / 2;
```

**Key Points**:
- Always measure AFTER the DOM is rendered
- Always use the SAME coordinate space (container-local)
- Use node center points for anchoring (not top-left)

## Path Line Styling

### Visual Language

Path lines use a "tactical map" / retro-military UI style:

- **Thickness**: 2-3px (not thin placeholder lines)
- **Glow**: SVG filter with `feGaussianBlur` for soft bloom
- **Rounded caps**: `stroke-linecap="round"`
- **Color scheme**: Teal/blue + gold accents from Chaos Core palette

### Line States

1. **Available Next Edges** (gold + glow)
   - `stroke: rgba(255, 215, 0, 1)`
   - `stroke-width: 3`
   - `filter: url(#opmap-path-glow)`
   - Indicates the player can move to this node

2. **Cleared Path** (muted greenish)
   - `stroke: rgba(100, 255, 150, 1)`
   - `stroke-width: 2`
   - `opacity: 0.4`
   - Shows previously visited connections

3. **Normal Edges** (dim blue)
   - `stroke: rgba(150, 200, 255, 1)`
   - `stroke-width: 2`
   - `opacity: 0.3`
   - Default visible connections

## Branching Uniqueness Rule

### Requirement

At any decision point where the player has 2+ available next nodes, the node types **MUST** be distinct.

**Example**:
- ✅ Branch: [Battle] vs [Key Room]
- ✅ Branch: [Shop] vs [Event]
- ❌ Branch: [Battle] vs [Battle] (NOT ALLOWED)

### Implementation

The `enforceUniqueBranchingTypes()` function in `nodeMapGenerator.ts`:

1. Iterates over all connection edges
2. For nodes with 2+ outgoing connections (branches)
3. Checks if any sibling nodes share the same type
4. Re-rolls duplicate types from a fallback pool
5. Ensures all sibling nodes have unique types

### Fallback Type Pool

```typescript
["battle", "shop", "rest", "event", "elite", "treasure"]
```

If the pool is exhausted (extremely rare), the system falls back to "battle" with a console warning.

## Debugging Tips

### Enable Debug Anchors (Optional Enhancement)

Add a dev-only toggle to visualize anchor points:

```typescript
function drawDebugAnchors() {
  const svg = document.getElementById("opmap-connections-overlay");
  nodes.forEach(node => {
    const rect = node.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const x = rect.left - containerRect.left + rect.width / 2;
    const y = rect.top - containerRect.top + rect.height / 2;

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", x.toString());
    dot.setAttribute("cy", y.toString());
    dot.setAttribute("r", "5");
    dot.setAttribute("fill", "red");
    svg.appendChild(dot);
  });
}
```

### Common Issues

1. **Lines appear in wrong position**
   - Check that measurements happen AFTER `requestAnimationFrame`
   - Verify coordinate conversion uses container rect

2. **Lines don't update on resize**
   - Ensure `setupConnectionRedrawOnResize()` is called
   - Check ResizeObserver is attached to correct container

3. **Lines disappear when panning**
   - SVG overlay must have `overflow: visible`
   - Ensure SVG is a child of the transformed container

4. **Lines don't match visual style**
   - Check SVG filter is defined in `<defs>`
   - Verify stroke-linecap is set to "round"

## Map Generation Determinism

All map generation uses seeded RNG to ensure:
- Same seed = same map layout
- Same seed = same node types
- Same seed = same branching decisions

This allows for:
- Reproducible testing
- Daily challenges
- Shared seeds between players

## Testing Checklist

- [ ] Lines connect to correct nodes at 100% zoom
- [ ] Lines remain aligned at 50% zoom
- [ ] Lines remain aligned at 200% zoom
- [ ] Lines redraw when window is resized
- [ ] Lines remain aligned when side panels open/close
- [ ] All branching choices offer different node types
- [ ] Generate 100 maps with different seeds - no duplicate siblings
- [ ] Lines have proper glow effect on available edges
- [ ] Lines are muted on cleared paths

## Performance Notes

- `drawMapConnections()` is called on every resize event (throttled by requestAnimationFrame)
- SVG rendering is GPU-accelerated on modern browsers
- No canvas fallback needed - SVG is well-supported
- Connection data stored on `window` is cleaned up on screen change

---

**Last Updated**: 2025-12-17
**Related Files**:
- `src/ui/screens/OperationMapScreen.ts`
- `src/core/nodeMapGenerator.ts`
- `src/styles.css` (search for `.opmap-connections-overlay`)
