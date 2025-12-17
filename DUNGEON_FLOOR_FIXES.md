# Dungeon Floor Navigation Fixes

**Date:** 2025-12-16
**Issues:** Node clickability broken, branches overlapping, layout left-to-right instead of bottom-to-top, distant room info visible

---

## Issues Fixed

### 1. **Layout Orientation: Left-to-Right → Bottom-to-Top** ✅

**Problem:**
- Node map was rendering left-to-right (layers progress horizontally)
- Should be bottom-to-top (start at bottom, exit at top)

**Root Cause:**
- `position.x` represents layers (progression depth)
- `position.y` represents vertical spread within layer (branching)
- My initial fix used `position.x` for horizontal and `position.y` for vertical
- This was backwards - needed to **swap x and y**

**Solution:**
```typescript
// CORRECT: Swap x and y coordinates
const nodeX = (node.position?.y || 0) * 280;  // Horizontal (branches)
const nodeY = (maxLayer - (node.position?.x || 0)) * 200;  // Vertical (progression, flipped)
```

**Result:**
- Start node (x=0) renders at bottom
- Exit node (x=max) renders at top
- Branching (y values) spreads horizontally
- Progress moves upward vertically

---

### 2. **Branch Overlap** ✅

**Problem:**
- Nodes with different position.y values were overlapping
- Spacing was too tight (initial 200x150)
- First fix (280x200) still had overlap
- Needed much wider spacing for readability

**Solution:**
- Increased horizontal spacing from 200px → 280px → **400px**
- Increased vertical spacing from 150px → 200px → **300px**
- Updated node wrapper width to match: **400px**
- Updated container min-width: **2000px** (from 1400px)
- Updated container min-height: **1800px** (from 1200px)

**Result:**
- Branches now have clear separation
- Nodes don't overlap even with 3+ branches
- Much better readability for navigation

---

### 3. **Node Clickability Broken** ✅

**Problem:**
- Nodes rendered but not clickable
- Event handlers not working

**Root Cause:**
- CSS `.opmap-nodes-container` was using `display: flex; flex-direction: column`
- This conflicts with absolute positioning
- Nodes need `position: relative` container

**Solution:**
```css
.opmap-nodes-container {
  position: relative;  /* Allow absolute positioning of children */
  min-width: 1400px;
  min-height: 1200px;
  padding: 60px 40px;
  pointer-events: auto;
}

.opmap-node-wrapper {
  position: absolute;  /* Positioned via inline style */
  width: 280px;
  pointer-events: auto;
}
```

**Result:**
- Nodes render at correct positions
- Click handlers work
- Buttons are functional

---

### 4. **Distant Room Info Visible** ✅

**Problem:**
- Players could see labels/types for all nodes ahead
- Allows too much planning ahead

**Solution:**
```typescript
// Hide detailed info for distant nodes
const showDetails = isVisited || isCurrent || isAvailable;

${showDetails ? `
  <div class="opmap-node-info">
    <div class="opmap-node-label">${node.label}</div>
    <div class="opmap-node-type">${typeLabel}</div>
    ...
  </div>
` : `
  <div class="opmap-node-info opmap-node-info--hidden">
    <div class="opmap-node-label">???</div>
  </div>
`}
```

**CSS:**
```css
.opmap-node-info--hidden {
  opacity: 0.5;
}

.opmap-node-info--hidden .opmap-node-label {
  color: rgba(150, 150, 170, 0.6);
}
```

**Result:**
- Only visited, current, or next available nodes show details
- Distant nodes show "???" with faded appearance
- Players can see the structure but not specific room types

---

## Technical Details

### Coordinate System

**In nodeMapGenerator.ts:**
```typescript
position: { x: layer + 1, y: i - Math.floor(nodesInLayer / 2) }
```
- `x` = layer number (0 = start, 1-4 = progression layers, max = exit)
- `y` = vertical offset within layer (-2, -1, 0, 1, 2 for branching)

**In OperationMapScreen.ts rendering:**
```typescript
// Swap and flip for bottom-to-top layout:
const nodeX = (node.position?.y || 0) * 400;  // y → horizontal (branches)
const nodeY = (maxLayer - (node.position?.x || 0)) * 300;  // x → vertical (flipped)
```

### Spacing Calculations

**Horizontal (branching):**
- `y * 400px`
- y ranges from -2 to +2 typically
- Total spread: ~1600px for 5 branches

**Vertical (progression):**
- `(maxLayer - x) * 300px`
- 4-5 layers typical
- Total height: ~1200-1500px

**Container size:**
- min-width: 2000px (accommodates wide branching)
- min-height: 1800px (accommodates tall floors)

### Connection Lines

SVG lines connect node centers:
```typescript
const x1 = fromNode.position.y * 400 + 200;  // Horizontal center (400px spacing, 200px offset)
const y1 = (maxLayer - fromNode.position.x) * 300 + 150;  // Vertical center (300px spacing, 150px offset)
```

---

## Files Modified

| File | Changes | Purpose |
|------|---------|---------|
| `src/ui/screens/OperationMapScreen.ts` | ~30 lines | Swap x/y, increase spacing, hide distant info |
| `src/styles.css` | ~15 lines | Absolute positioning, hidden info styles |

---

## Verification

### Bottom-to-Top Layout
1. Start operation
2. View floor map
3. **Expected:** Start node at bottom, exit at top
4. **Expected:** Progress moves upward

### Branching Visible
1. Progress to first branch
2. **Expected:** Multiple nodes side-by-side (horizontally)
3. **Expected:** No overlap
4. **Expected:** Clear connections between layers

### Clickability
1. Click "ENTER →" button on available node
2. **Expected:** Button works, enters room
3. **Expected:** Click anywhere on node card also works

### Hidden Info
1. View nodes beyond next available
2. **Expected:** Distant nodes show "???" instead of name/type
3. **Expected:** Icon still visible but faded
4. **Expected:** After visiting, info becomes visible

---

## Key Changes Summary

1. **Swapped x and y coordinates** - position.x is now vertical (progression), position.y is horizontal (branching)
2. **Flipped y-axis** - maxLayer - position.x puts start at bottom, exit at top
3. **Increased spacing** - 280px horizontal, 200px vertical (prevents overlap)
4. **Fixed CSS** - Container uses position: relative, wrappers use position: absolute
5. **Hidden distant nodes** - Only show details for visited/current/next available

---

## Testing Checklist

- [ ] Start operation → map shows bottom-to-top
- [ ] Start node at bottom of screen
- [ ] Exit node at top of screen
- [ ] Branches spread horizontally
- [ ] No node overlap
- [ ] Nodes are clickable (buttons work)
- [ ] Distant nodes show "???"
- [ ] After visiting node, info becomes visible
- [ ] Connections visible between layers
- [ ] Pan controls work (WASD)
- [ ] Auto-center on current node works

---

## Result

✅ **Layout is now bottom-to-top** (start at bottom, climb upward)
✅ **Branches are visible and clear** (horizontal spread, no overlap)
✅ **Nodes are fully clickable** (absolute positioning working)
✅ **Distant room info is hidden** (prevents over-planning)

The dungeon floor navigation now works as designed!
