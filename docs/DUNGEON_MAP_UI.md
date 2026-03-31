# Dungeon Map UI - Path Highlighting & Fog of War

## Overview

The Dungeon Floor Map Screen has been rebuilt to provide correct path visualization, fog of war for unreached nodes, and a dark military/retro-terminal aesthetic that matches Chaos Core's atmosphere.

## Path Highlighting Logic

### Cleared Route Computation

The cleared route is computed using BFS (Breadth-First Search) from the start node to the current node:

1. **Graph Construction**: Build a graph from `node.connections` arrays
2. **Start Node Detection**: Find the start node (first node or node with no incoming connections)
3. **BFS Traversal**: Traverse from start to current node, only using cleared nodes
4. **Route Reconstruction**: Build a Set of edge IDs (`fromId->toId`) representing the cleared path

**Function**: `computeClearedRoute(nodes, currentRoomId, clearedNodeIds)`

### Edge Styling Rules

Edges are styled based on their state:

- **Cleared Route** (`opmap-connection--cleared-route`): Purple (`rgba(155, 127, 255, 0.8)`), 3px width, pulsing glow
  - Only edges on the path from start to current node
- **Branch Choice** (`opmap-connection--branch-choice`): Amber (`rgba(255, 200, 100, 0.9)`), 3px width, animated pulse
  - Edges from current node to available next nodes
- **Cleared Off-Route** (`opmap-connection--cleared-off-route`): Muted gray, 2px width, 40% opacity
  - Edges between cleared nodes that aren't on the current route
- **Unexplored** (`opmap-connection--unexplored`): Very muted, 1.5px width, 25% opacity
  - Known edges that haven't been traveled

### Connection Rendering

- Only edges between **revealed nodes** are rendered
- Edges are drawn using SVG `<line>` elements with rounded caps
- Each edge is rendered once (duplicate prevention via `renderedEdges` Set)
- Edge positions are calculated from node positions (accounting for grid spacing and bottom-to-top layout)

## Fog of War / Node Reveal

### Reveal Logic

Nodes become revealed when:

1. **Cleared**: Node is in `clearedNodeIds`
2. **Current**: Node is the current active node
3. **Available**: Node is in the available next nodes list
4. **Adjacent**: Node is connected to a cleared/current/available node

**Function**: `revealedNodeIds` Set is built by checking all nodes and their connections

### Visual States

- **Current** (`opmap-node--current`): Purple glow, strong border, highest visibility
- **Available** (`opmap-node--available`): Amber glow, pulsing animation, clickable
- **Visited** (`opmap-node--visited`): Muted, lower opacity, shows "✓ CLEARED" badge
- **Revealed** (`opmap-node--revealed`): Dimmed, shows basic info but not fully explored
- **Locked** (`opmap-node--locked`): Blurred, grayscale, shows "???" label, not clickable

### Unknown Nodes

Unrevealed nodes display:
- Icon: "???"
- Label: "???"
- Styling: Heavily blurred, grayscale, low opacity, fog overlay

## Branch Choice Visualization

When multiple next nodes are available:

1. **Edge Highlighting**: Edges from current node to available nodes use `opmap-connection--branch-choice` styling
   - Amber color with pulsing animation
   - Stronger glow effect
   - 3px stroke width

2. **Node Highlighting**: Available nodes use `opmap-node--available` class
   - Amber border and glow
   - Pulsing animation (`node-pulse-amber`)
   - "ENTER →" button visible
   - Higher z-index for visibility

3. **Non-Choices Muted**: Other nodes are dimmed or hidden based on reveal state

## Testing Branching Correctness

### Manual Verification

1. **Start a new operation** and observe the map
2. **Clear the first node** - verify cleared route highlights correctly
3. **Reach a branching point** - verify:
   - Both/all branch choices are highlighted with amber edges
   - Both/all branch nodes show amber glow and "ENTER →" button
   - Cleared route remains purple
4. **Choose one branch** - verify:
   - Cleared route updates to show chosen path
   - Other branch becomes "cleared off-route" (muted gray)
5. **Check fog of war** - verify:
   - Unreached nodes show "???"
   - Adjacent nodes to cleared/current become revealed
   - Distant nodes remain locked

### Debug Mode (Optional)

To enable debug rendering, add a query parameter or dev flag:
- Render node IDs as text overlays
- Show parent pointers
- Display edge IDs
- Log graph structure to console

## Visual Design

### Dark Dungeon Aesthetic

- **Background**: Deep radial gradient from `#050510` to `#0a0a1a`
- **Grid Overlay**: Subtle purple grid lines (`rgba(155, 127, 255, 0.02)`)
- **Fog Effect**: Radial gradient overlay creating depth and mystery
- **Node Cards**: Dark gradient backgrounds with subtle borders, tactical dossier feel
- **Typography**: Military-style uppercase labels, retro-terminal font choices

### Color Palette

- **Purple** (`#9b7fff`): Current node, cleared route
- **Amber** (`#ffc864`): Available choices, branch highlights
- **Red** (`#ff6666`): Battle nodes, danger
- **Muted Gray**: Cleared off-route, visited nodes
- **Very Dark**: Locked/unrevealed nodes

## Removed Features

- **Floor Progress Bar**: Removed (`renderFloorProgress` function removed)
  - Reason: Misleading with branching paths (players won't clear all rooms)
- **"NEXT" Badge**: Removed from node rendering
  - Reason: Redundant with "ENTER →" button and visual highlighting
- **Yellow Path Line**: Replaced with deterministic purple cleared route
  - Reason: Incorrectly connected non-adjacent nodes

## Performance Considerations

- Edge rendering uses SVG for scalability
- Fog of war uses CSS filters (GPU-accelerated)
- Node visibility computed once per render
- Cleared route computed once per render (BFS is O(V+E))

## Future Enhancements

- Optional depth indicator ("Depth: 2") instead of progress bar
- Animated fog particles (very subtle, low perf impact)
- Node type-specific visual treatments (more distinct icons)
- Map debug mode toggle (dev tools)

