# General GDD

**Chaos Core GDD**

# **Game Overview**

Chaos Core is a tactical, squad-based strategy game set entirely within a massive, procedurally generated dungeon- the Chaos Core. Players command a team of units through a series of campaign 'operations,' each broken into procedural floors made up of interconnected rooms. The game blends deckbuilding, grid-based combat, and light base management.

# **Core Loop**

Base Camp Phase: Interact with NPCs, upgrade facilities, craft, recruit units, manage decks and equipment.

Floor Navigation Phase: choose the next room to enter- tactical battle, free movement zone, shop or rest area.

Battle Phase: Tactical grid-based combat with deck/hand system, strain management, cover, and deployable defenses.

Post-Battle Phase: Gain loot/resources, choose and upgrade key rooms, decide whether to defend rooms under attack

# **Field System**

## **Overview**

Field Mode introduces **top-down real-time exploration** into Chaos Core. It connects Base Camp, Free Zones, and lightweight real-time combat while preserving the game’s core tactical identity.

It provides:

* A **walkable Base Camp hub** where the player physically approaches stations (Shop, Workshop, Loadout, Roster, Ops Terminal).  
* **Free Zone nodes**: small exploration maps containing resources, minor enemies, environmental interactions, and exits.  
* A **simple real-time combat loop**, significantly lighter than tactical battles but meaningful for risk/reward and run pacing.

Field Mode is not meant to replace tactical combat; it enhances the roguelike feel and run flow, providing downtime, exploration, and resource gathering.

---

## **1\. FIELD ENGINE CORE**

### **1.1 Perspective & Camera**

* Top-down or slight pseudo-3D tilt (Zelda-like).  
* Single-screen maps or scrolling maps with camera centered on the player.  
* Smooth WASD movement, 8-direction optional.

### **1.2 Player Avatar**

Represents Aeriss.

**Stats (derived from squad or global profile):**

* **Field HP** (scaled from squad health or a separate “Field Pool”).  
* **MoveSpeed** (lightly affected by MULE load penalties).  
* **Field ATK** (derived from main equipped weapon).  
* **Field DEF** (derived from squad average or MULE class).

Field stats intentionally approximate squad power without recreating tactical complexity.

### **1.3 Movement & Collision**

* Solid tiles / walls define level boundaries.  
* Player has an axis-aligned bounding box (AABB) for collision.  
* Optional diagonal movement; no grid snapping.

### **1.4 Interaction Zones**

Non-blocking invisible rectangles near interactable objects.

When the player overlaps:

* Show floating prompt: **“E — INTERACT”**  
* On E, pause Field Mode → open UI overlay screen (Shop, Loadout, etc.).  
* On close, resume Field Mode with player returned to exact position.

---

## **2\. BASE CAMP FIELD MAP**

### **2.1 Purpose**

Transforms the Base Camp from a menu to a living hub the player walks through.

Creates atmosphere, pacing, grounding in the world.

### **2.2 Layout Elements**

* **Shop Stall** (opens renderShopScreen()).  
* **Workshop Console** (opens Gear Workbench once implemented).  
* **Loadout Bay** (opens renderInventoryScreen() / Forward Locker).  
* **Roster Barracks** (unit assignment, future customization).  
* **Operation Terminal** (opens renderOperationSelectScreen()).  
* **Optional NPCs** (flavor text, story exposition, sidequests in future).

### **2.3 Interaction Rules**

Approaching a station triggers:

UIOverlay.open(ScreenType)

FieldMode.pause()

Closing the overlay:

FieldMode.resume()

### **2.4 Technical Notes**

* Base Camp Field runs as its own “screen renderer” similar to BattleScreen.  
* Uses a requestAnimationFrame loop for movement \+ rendering.  
* Can be built using DOM sprites, Canvas 2D, or Godot-like tilemap logic inside TS.

---

## **3\. FREE ZONES (Exploration Nodes)**

### **3.1 Definition**

Operation rooms flagged FREE\_ZONE load an exploration map instead of a tactical battle.

These maps reward collection, light combat, and route-risk decisions.

### **3.2 Purpose in Run Structure**

* Resource acquisition (scrap, wood, shards).  
* Chance for **low-tier card drops** or mini-packs.  
* Minor HP/Strain management pressure.  
* Optional detour to strengthen before harder battles.

### **3.3 Map Elements**

* **Small handcrafted or procedural maps** (\~1–3 screens).  
* Resource items placed manually or procedurally.  
* Basic enemies that patrol or agro on sight.  
* Environmental hazards (toxic puddles, mines, turrets).  
* Single exit node (door, elevator, teleporter).

### **3.4 Completion Condition**

* Player reaches exit OR  
* Optional objective completed: “Destroy generator / Kill 5 mobs”.

---

## **4\. FIELD COMBAT (Light ARPG System)**

### **4.1 Player Attacks**

* Single-button attack: melee slash or short-range projectile.  
* Damage \= FieldATK.  
* Optional cooldown timer (0.3s–0.6s).

### **4.2 Player Defense**

Optional (future):

* **Dash/I-frame** (Shift or Space).  
* **Directional block** (hold Right Mouse / separate key).

### **4.3 Enemies**

Enemies intentionally simple:

* **Chaser**: moves toward player, contact damage.  
* **Shooter**: fires slow projectiles.  
* **Turret**: stationary hazard.

Stats:

* HP  
* Move speed  
* Touch damage  
* XP or resource drop chance

Alive count in Free Zones is always low to keep pacing quick.

### **4.4 Damage Integration**

Damage taken in Field Mode:

* Reduces **Field HP** and syncs to squad HP OR  
* Adds **Strain** to the next battle if cumulative damage is high.

### **4.5 Rewards**

Guaranteed:

* Resource pickups → added to inventory (MASS/BULK/POWER impact).  
  Chance-based:  
* Common card drops  
* Low-tier .PAK packs  
* Crafting materials

---

## **5\. INVENTORY \+ LOADOUT IN FIELD MODE**

### **5.2 Immediate Pickup Logic**

When collecting:

inventory.resources\[type\] \+= amount

inventory.mass/bulk/power updated

UI: Small floating \+X indicator

---

## **6\. TECHNICAL ARCHITECTURE**

### **6.1 New Systems Introduced**

1. **FieldSceneManager**  
   * Handles switching between Base Camp field, Free Zones, and tactical battles.  
2. **FieldRenderer**  
   * Renders tilemap \+ sprites.  
3. **FieldEntitySystem**  
   * Player  
   * Enemies  
   * Projectiles  
   * Pickups  
   * Interaction Zones  
4. **Physics/Collision Module**  
   * Simple AABB collisions  
   * Raycast or overlap checks for melee  
5. **UI Layer Integration**  
   * Pause Field Mode when any UI screen opens  
   * Resume seamlessly when closed

### **6.2 Reuse of Existing Systems**

* **Inventory / Forward Locker**  
* **Resource data structures**  
* **Battle reward system** feeding new card drops (.PAK packs)  
* **MULE load penalties** (adapted for movement)  
* **ScrollLink OS aesthetic** → for terminals placed in Free Zones or Base Camp

---

Below are **clean, drop-in GDD inserts** written in a neutral, designer-facing style that fits the level of specificity your Chaos Core GDD already has. These are meant to be **authoritative**, not brainstorm notes.

You can paste these directly into your GDD under new sections.

---

# **Controlled Rooms & Forward Operating Bases**

## **Overview**

**Controlled Rooms** represent forward operating bases (FOBs) established by the player during an Operation. Unlike standard dungeon rooms, Controlled Rooms **persist across multiple floors within the same Operation** and provide ongoing logistical, strategic, and defensive benefits. Controlled Rooms do **not** persist between Operations.

Controlled Rooms transform the dungeon crawl into a sustained military campaign, where territory control, supply lines, and maintenance are as important as winning individual battles.

---

## **Capturing Key Rooms**

* Forward Command Posts are created by capturing **Key Rooms** during dungeon floor progression.

## **Forward Command Posts Index**

Upon capturing a Key Room, the player selects its type. The base level available forward command posts are:

Supply Depot

Medical Ward

Armory

Command Center

Mine

And later, the following forward command posts can be unlocked after conditions are met:

Logistics Hub

Prototype Systems Lab

Forward Maintenance Bay

Emergency Supply Cache

Forward Fire Support Post

Operations Planning Cell

Black Ops Coordination Cell

The room immediately becomes a forward command post and is added to the Operation’s controlled room list.

---

## **Persistence Rules**

* Controlled Rooms persist **for the duration of the current Operation**.  
* Controlled Rooms remain active across all subsequent floors of that Operation.  
* All Controlled Rooms are cleared and lost when the Operation ends (success or failure).

---

## **Controlled Rooms Window (Campaign Management UI)**

A dedicated **Controlled Rooms** window is accessible from the dungeon floor map screen.

### **Displayed Information**

For each Controlled Room, the window displays:

* Room type and icon  
* Floor of origin  
* Current status:  
  * Secured  
  * Contested  
  * Damaged  
  * Lost  
* Threat Meter (0–100)  
* Fortification Level (0–3)  
* Upkeep cost  
* Effective benefit percentage (distance penalty applied)

Rooms are grouped by the floor on which they were captured. Visual indicators (stamps, warnings, highlights) communicate urgency and change.

### **Player Actions**

From the Controlled Rooms window, the player may:

* **Enter Field Mode** (recommended method of interaction)  
* **Reinforce (Quick)** — instant but inefficient fortification  
* **Abandon** — permanently lose the room and its benefits

---

## **Distance Penalty Model (Model A)**

Controlled Room benefits weaken slightly the farther the player progresses from the floor on which the room was captured.

Example scaling:

* Same floor: 100% effectiveness  
* 1 floor away: \~85%  
* 2 floors away: \~70%  
* Minimum effectiveness is capped (e.g., 60%)

This represents stretched supply lines while still rewarding early territorial control.

---

## **Time, Upkeep, and Pressure**

### **Operation Time**

Each Operation tracks an internal **time step** that advances when:

* A dungeon room is cleared  
* The player enters or exits a Controlled Room Field Mode  
* A floor transition occurs

### **Upkeep**

* Each Controlled Room requires a small upkeep cost per time step.  
* Upkeep cost increases as the Operation progresses deeper.  
* If upkeep cannot be paid:  
  * The room’s Threat increases  
  * Room status degrades over time  
  * Repeated neglect results in the room being Lost

---

## **Threat Meter & Attacks**

Each Controlled Room has a **Threat Meter** representing enemy awareness and pressure.

### **Threat Increases When:**

* Time advances  
* Upkeep is unpaid  
* The player advances to deeper floors

### **Threat Decreases When:**

* The player enters Field Mode and performs maintenance or security actions  
* Fortification level increases  
* Successful defenses are completed

### **Attack Events**

* After clearing dungeon rooms, the game may roll for a Controlled Room attack.  
* Attack probability increases with:  
  * Dungeon depth  
  * Time elapsed  
  * Threat level  
  * Low fortification  
* When attacked, the player chooses:  
  * **Defend** — immediately enter Field Mode defense  
  * **Delay** — temporarily ignore at cost of increased threat  
  * **Abandon** — permanently lose the room

---

## **Field Mode: Controlled Rooms**

### **Field Mode Access**

* Entered from the Controlled Rooms window or during defense events.  
* Uses the **existing field exploration system** (same rules as base camp or dungeon field maps).  
* **Does not use squad units** or tactical grid combat.

### **Field Maps**

* Each Controlled Room type has a small, contained field map (1–3 screens).  
* Layouts are static per room type and reused across Operations.

### **Fortification & Maintenance**

Upgrades are performed through **physical interactions**, not menus:

* Repair/build barricades  
* Install turrets  
* Reinforce walls  
* Activate backup generators

These actions:

* Cost resources  
* Take time  
* Increase Fortification Level  
* Reduce Threat  
* Lower future upkeep costs

### **Quick Reinforce**

* Available from the Controlled Rooms window  
* More resource-expensive and less effective than performing actions in Field Mode  
* Exists as a convenience option, not an optimal strategy

---

## **Defense Gameplay**

* When defending a Controlled Room, the player is placed directly into that room’s Field Mode map.  
* Enemies spawn from breach points and edges.  
* Fortifications affect:  
  * Enemy spawn count  
  * Breach locations  
  * Turret availability  
* Successful defense reduces Threat and stabilizes room status.  
* Failed defense degrades room status and may result in permanent loss.

---

## **Flavor NPCs**

* Controlled Room field maps include friendly NPCs.  
* NPC dialogue is state-based and reactive to:  
  * Threat level  
  * Fortification  
  * Room status  
* Dialogue is ambient and non-branching, reinforcing the sense of an ongoing campaign.

---

# **Gear Builder System**

## **Overview**

The **Gear Builder** is an advanced equipment creation system that allows players to construct new gear from foundational components. It exists as a **separate tab** within the Gear Workbench interface and complements (rather than replaces) the existing gear customization system.

* **Customize Gear** \= how a piece of gear behaves moment-to-moment (cards, slots, tuning)

* **Build Gear** \= what a piece of gear fundamentally *is*

The Gear Builder emphasizes **intent, doctrine, and risk**, not numerical optimization.

---

## **Gear Workbench Structure**

The Gear Workbench contains two tabs:

1. **Build Gear**

2. **Customize Gear** (existing system)

Players must first build a piece of gear before it can be customized.

---

## **Core Design Philosophy**

**Handcrafted gear defines identity.**  
 **Built gear defines specialization.**  
 **Endless gear defines experimentation.**

The Gear Builder allows players to intentionally create equipment aligned with a specific tactical doctrine, trading reliability and flexibility for focused performance.

---

## **The Three Layers of Gear Identity**

Every piece of gear consists of three conceptual layers:

### **1\. Chassis**

The **Chassis** defines the physical and mechanical foundation of the gear.

Chassis determines:

* Equipment slot (weapon, chest armor, accessory)

* Weight / bulk profile

* Durability and stability baseline

* Maximum supported systems

* Which cards and modifications are compatible later

Examples:

* Light Weapon Frame

* Heavy Weapon Frame

* Reinforced Armor Frame

* Flexible Harness

Chassis are:

* Finite

* Reusable

* Never randomly generated

New chassis types are unlocked through:

* Armory upgrades

* Story progression

* Forward Command Posts

* Research rewards

---

### **2\. Doctrine**

The **Doctrine** defines the intended tactical use and behavioral bias of the gear.

Doctrine influences:

* Trigger weighting (movement, kills, defense, etc.)

* Strain curve behavior

* Reliability vs volatility

* How slotted cards behave under stress

Examples:

* Assault Doctrine

* Skirmish Doctrine

* Suppression Doctrine

* Sustain Doctrine

* Control Doctrine

Doctrine selection is a **strategic commitment**:

* Doctrines cannot be freely swapped

* Changing doctrine requires dismantling the gear

* Dismantling may incur material loss or stability penalties

New doctrines are unlocked through:

* Capturing specific Forward Command Posts

* Prototype Systems Lab research

* Campaign milestones

---

### **3\. Field Modifications**

Field Modifications represent experimental or situational adjustments.

* These are applied primarily via **endless gear** or special rewards

* They introduce tradeoffs, instability, or rule-bending effects

* Field Modifications may increase power but reduce stability

Field Modifications interact with the Customize Gear system and Field Mods system.

---

## **Build Gear Flow**

1. Player selects **Build Gear** tab

2. Choose gear slot (weapon, armor, etc.)

3. Select a **Chassis**

4. Select a **Doctrine**

5. Pay build cost (materials \+ logistics)

6. Resulting gear is created with:

   * Chassis

   * Doctrine

   * Empty customization slots

The player then moves to **Customize Gear** to slot cards and fine-tune behavior.

---

## **Stability System**

Every built gear piece has a **Stability** value.

Stability affects:

* Proc reliability

* Jam chance

* Strain penalties

* Edge-case failures under pressure

Stability decreases when:

* Conflicting systems are added

* Experimental Field Modifications are applied

* Gear is heavily over-slotted

Low stability is intentional — it represents risky engineering choices, not mistakes.

---

## **Endless Gear Integration**

Endless (procedural) gear represents **field-assembled or improvised equipment**.

* Endless gear often uses unstable or partially locked chassis

* Endless gear may have forced doctrines or modifiers

* Endless gear can be salvaged into:

  * Chassis fragments

  * Doctrine research

  * Experimental components

This gives endless gear long-term value beyond direct use.

---

## **Design Intent**

The Gear Builder exists to:

* Deepen equipment identity

* Encourage specialization over generalist builds

* Provide meaningful, irreversible choices

* Support emergent playstyles without stat inflation

The system prioritizes **doctrine and intent** over numerical optimization.

---

# **Dungeon Floor Supply Chain System**

## **Overview**

The **Supply Chain System** models the logistical reality of pushing forces through hostile territory. On each dungeon floor, supply is abstracted as a **continuous bandwidth flow** connecting Forward Command Posts, active rooms, and ongoing operations.

The system is designed to:

* Be functional without micromanagement

* Reward strategic planning

* Create tension through branching paths and enemy disruption

---

## **Core Concepts**

### **Supply Sources**

Supply Sources generate supply bandwidth.

* Forward Command Posts (e.g., Supply Depot, Logistics Hub)

* Base Camp origin point

### **Supply Links**

Supply Links are the routes connecting rooms.

* Automatically derived from cleared dungeon paths

* Can be threatened, damaged, or disrupted

### **Supply Sinks**

Supply Sinks consume supply bandwidth:

* Upkeep costs

* Room defenses

* Repairs and fortifications

* Mount maintenance

* Field operations

---

## **Supply Flow Model**

* Supply is represented as a **scalar bandwidth value**, not individual items

* Supply flow is continuous and recalculated:

  * After each room clear

  * After major disruptions or repairs

* Supply decays with:

  * Distance from sources

  * Branching paths

  * Damaged or threatened links

---

## **Auto-Routing**

By default:

* Supply is automatically routed along cleared paths

* Branches split supply proportionally

* Players are never required to manually draw routes

Auto-routing ensures the system is usable by default.

---

## **Supply Overlay Mode**

Players may activate **Supply Overlay Mode** from the dungeon floor map.

Overlay displays:

* Supply flow intensity (line thickness / glow)

* Bottlenecks and weak links

* Threatened or damaged routes

* Downstream risk indicators

From the overlay, players may:

* Prioritize one branch over another

* Throttle low-value routes

* Apply predefined routing profiles

---

## **Supply Priority Profiles**

To avoid micromanagement, players may select a **Supply Priority Profile**:

* **Balanced** — default distribution

* **Forward Push** — favors advancement and combat readiness

* **Defensive Hold** — favors controlled rooms and defenses

* **Consolidation** — minimizes upkeep and stabilizes supply

Profiles automatically adjust routing logic. Advanced players may override priorities manually.

---

## **Enemy Interaction**

Enemies may:

* Attack supply links

* Sabotage bottlenecks

* Interdict high-flow routes

Effects include:

* Temporary supply loss

* Increased upkeep downstream

* Increased threat to Forward Command Posts

Enemy actions target **links**, not just rooms.

---

## **Field Mode Interaction**

In Field Mode, players may:

* Repair damaged supply links

* Clear debris or sabotage

* Build relay points or junction reinforcements

These actions:

* Restore or increase supply flow

* Reduce decay

* Stabilize threatened routes

Field Mode interactions are optional but powerful.

---

## **Branching Path Synergy**

Branching dungeon paths naturally:

* Split supply

* Increase decay

* Increase vulnerability

Players must decide between:

* Wider control

* Stronger, narrower supply lines

There is no hard limit — logistics pressure is the constraint.

---

## **Failure States**

Supply chain failure is:

* Visible

* Gradual

* Recoverable

Consequences include:

* Escalating upkeep costs

* Degraded Forward Command Posts

* Harder defenses and repairs

* Mount and equipment reliability issues

Players can recover by:

* Rerouting supply

* Repairing links

* Abandoning overstretched posts

* Switching priority profiles

Failure creates tension without immediate run loss.

---

## **Design Intent**

The Supply Chain System exists to:

* Give dungeon maps strategic meaning beyond combat

* Ground upkeep and pressure in world logic

* Reward foresight and adaptation

* Create meaningful consequences for overextension

The system emphasizes **flow, pressure, and resilience**, not optimization.

# **Field Mods & Hardpoint System**

## **Overview**

**Field Mods** are temporary, run-scoped augmentations that alter combat rules through triggered effects and procs. Field Mods are designed to deliver the escalating, chaotic power curve typical of roguelite games while preserving the importance of persistent gear and loadout planning.

Field Mods do not permanently increase stats. Instead, they modify **how combat behaves**.

---

## **Core Concepts**

* Each unit has **2 Hardpoints**.  
* Field Mods are socketed into Hardpoints.  
* Field Mods are acquired **during Operations** and lost when the run ends.  
* Mods may be freely socketed and unsocketed during a run via the Manage Units screen.

---

## **Scope & Persistence**

* Field Mods are **run-scoped only**.  
* They do not persist between Operations.  
* Some rare Field Mods apply squad-wide effects instead of per-unit effects.

---

## **Triggers & Effects**

Field Mods operate through **military-flavored triggers** and conditional logic.

### **Common Triggers**

* On Engagement (battle start)  
* On Contact (successful hit)  
* On Confirmed Kill  
* On Taking Damage  
* On Unit Downed  
* On Turn Start / Turn End

### **Effects**

* Bonus damage  
* Shields or armor  
* Card draw or modification  
* Movement or positioning effects  
* Chain reactions or secondary procs

Effects are rule-based, not passive stat bonuses.

---

## **Stacking & Chance**

* Field Mods may stack.  
* Stacks increase potency, trigger chance, or frequency.  
* Proc chances are explicit and visible.  
* All rolls are deterministic per battle seed.

---

## **Acquisition**

Field Mods are obtained through:

* Treasure rewards  
* Elite battle rewards  
* Shops  
* Rare Black Market nodes in base camp

Reward screens typically present a **“choose 1 of 3”** selection.

---

## **Squad-Wide Field Mods**

* Rare Field Mods apply effects to all units.  
* Squad-wide mods occupy a special designation but still count as a single mod instance.  
* Squad-wide effects are clearly labeled in UI.

---

## **UI & Feedback**

* Hardpoints are clearly visible in the Manage Units screen.  
* Active Field Mods display their triggers and effects in tooltips.  
* Proc activations are visually and audibly communicated during battle.

---

## **Design Intent**

Field Mods exist to:

* Increase combat variety and emergent behavior  
* Reward adaptation rather than pre-planning  
* Create memorable, high-chaos moments during runs  
* Complement (not replace) gear and base loadouts

Field Mods intentionally favor **rule-bending over stat inflation**.

---

If you want next, I can:

* Merge these into a **single “Campaign Systems” GDD chapter**  
* Write **example Controlled Room benefit tables**  
* Write **example Field Mod entries** in final item text format  
* Or help you reconcile these with your existing Forward Locker / M.U.L.E. sections

## **7\. FUTURE EXPANSION PATH**

These naturally follow headlines 11e–11h:

### **7.1 Expanded Free Zones**

* Larger maps  
* Random side-rooms  
* Hidden caches  
* Rare elite mobs

### **7.2 Field Abilities**

* Dash  
* Charge attack  
* Deployable tools (turrets, traps)  
* Scanning mode for hidden materials

### **7.4 NPC Interactions**

* Dialogue system  
* Random encounters  
* Side quests that modify the main run

---

## **8\. DESIGN GOALS (Summary)**

* Keep Field Mode **fast, light, and atmospheric**, not a second full game.  
* Enhance the roguelike loop with **risk, resource tension, and small bursts of action**.  
* Strengthen immersion: Base Camp becomes a real place, not a menu.  
* Bridge progression systems: resources gained in Free Zones → better equipment → better tactical performance.  
* Maintain Chaos Core’s identity: **tactical grid battles remain the core gameplay**, Field Mode enriches everything around them.

# **Stable, Mounted Units & Forward Stable**

## **Overview**

Mounted units provide situational mobility, positioning, and tactical options through a logistics-driven system that integrates with grid size, deck construction, Controlled Rooms, and campaign progression.

Mounts are **not always available**, are **not purely stat buffs**, and are governed by logistical constraints. They introduce new tactical possibilities while preserving infantry relevance and encounter balance.

---

## **Stable Node (Base Camp)**

### **Unlock Conditions**

* The **Stable** node unlocks after a major story milestone (e.g., completion of Operation 2).

### **Purpose**

The Stable is the sole location where the player may:

* Assign mounts to units  
* Equip mount-specific gear  
* Repair mount condition  
* View mount status and readiness

Mounts cannot be assigned, swapped, or repaired during Operations outside of specific Controlled Room support (see Forward Stable).

---

## **Mount Availability Rules**

### **Grid Size Restrictions**

Mounts are only usable on **medium and large battle grids**.

**Mount-allowed grids:**

* 6×4  
* 6×5  
* 8×6  
* Any grid explicitly flagged as “Open”

**Mount-forbidden grids:**

* 4×3  
* 5×4  
* Any grid flagged as “Confined” or “Interior”

If a battle occurs on a mount-forbidden grid:

* Mounted units automatically dismount before battle begins  
* Mount condition is not penalized

This ensures mounts remain powerful but situational.

---

## **Mount Classes**

### **Light Mount**

**Role:** Speed and repositioning

* Large movement bonus  
* Ignores difficult terrain  
* Fragile  
* High forced-dismount risk under heavy damage

Intended for scouting, flanking, and hit-and-run tactics.

---

### **Heavy Mount**

**Role:** Area control and disruption

* Moderate movement bonus  
* Can push enemies and destroy light cover  
* Resistant to forced dismount  
* Larger footprint on the grid

Intended for front-line pressure and formation breaking.

---

### **Support Mount**

**Role:** Logistics and sustain

* Small movement bonus  
* Improves unit’s logistical contribution (e.g., consumables, support actions)  
* Focused on non-damage utility

**Unlock Condition:**

Support mounts unlock only after capturing a **Medical Ward** Controlled Room, reinforcing their support identity.

---

## **Mount Condition**

Mounts do not die permanently. Each mount has a **Condition** value.

### **Condition Loss Occurs When:**

* The mounted unit takes significant damage  
* Forced dismount events occur  
* Heavy defensive engagements take place

### **Low Condition Effects:**

* Increased forced dismount chance  
* Reduced movement bonuses  
* At zero condition, the mount becomes unavailable

### **Repair**

* Mounts are repaired at the Base Camp Stable  
* Limited repairs may be performed at a Forward Stable during Operations

---

## **Mount Gear**

Each mount has **1–2 gear slots**.

Mount gear:

* Is mount-specific  
* Provides utility and durability benefits  
* Never directly increases unit damage

### **Example Mount Gear**

* Reinforced Plating (reduced condition loss)  
* Saddle Packs (additional consumable capacity)  
* Stabilizers (forced dismount resistance)  
* Signal Rig (synergy with Field Mods or command effects)

---

## **Mounted Combat via Cards**

Mounts grant combat capabilities through **deck injection**, not separate mechanics.

### **Core Rule**

When a unit is mounted:

* Mount-specific cards are added to that unit’s combat deck

When a unit is unmounted:

* Mount-specific cards are removed or disabled

This keeps mounted combat fully within the existing card-based battle system.

---

### **Mount Card Examples**

#### **Light Mount Cards**

* **Ride-By Strike** — Move through an enemy, deal damage, continue moving  
* **Rapid Reposition** — Gain bonus movement  
* **Break Contact** — Disengage without triggering reactions

#### **Heavy Mount Cards**

* **Trample** — Charge in a straight line, damaging and pushing enemies  
* **Shielded Advance** — Damage reduction while moving  
* **Linebreaker** — Destroy light cover while advancing

#### **Support Mount Cards**

* **Mobile Resupply** — Restore consumables or cards to allies  
* **Emergency Extraction** — Pull an ally to safety  
* **Field Treatment** — Heal or cleanse debuffs

If a unit is forcibly dismounted mid-battle, mount cards become unavailable.

---

## **Forward Stable (Controlled Room)**

Once the Stable is unlocked, **Forward Stable** becomes an available Controlled Room type.

### **Forward Stable Purpose**

A Forward Stable extends mount logistics deeper into the Operation.

### **Benefits**

* Reduces mount condition loss  
* Allows limited mount repairs during the Operation  
* Increases reliability of mounted units on deeper floors

### **Interaction**

Forward Stable functions within the Controlled Rooms system:

* Subject to threat, upkeep, and fortification  
* Can be defended and upgraded via Field Mode  
* Lost Forward Stables remove their support benefits

---

## **Progression Summary**

* No mounts available early game  
* Stable unlocks mid-campaign  
* Light mounts unlock first  
* Heavy mounts unlock later through story progression and investment  
* Support mounts unlock after capturing a Medical Ward  
* Forward Stable becomes available as a Controlled Room after Stable unlock

---

## **Design Intent**

The mounted unit system is intended to:

* Add tactical depth without becoming mandatory  
* Reinforce Chaos Core’s logistics-first identity  
* Integrate seamlessly with deck-building, Controlled Rooms, and campaign progression  
* Provide visually and mechanically distinct combat moments without breaking balance

Mounts emphasize **mobility, positioning, and logistics**, not raw power.

# **Endless Gear System (Procedural Equipment)**

Overview

Endless Gear represents field-assembled, improvised, or experimental equipment created or recovered during Operations.

It exists alongside handcrafted story gear and intentionally built gear from the Gear Builder.

Endless Gear prioritizes experimentation, instability, and emergent behavior over reliability or narrative identity.

Endless Gear:

* Is procedural  
* Is often unstable or compromised  
* Uses existing gear systems (Chassis, Doctrine, Field Mods, Stability)  
* Has long-term value through dismantling and research

---

Design Intent

Handcrafted gear defines narrative identity.

Built gear defines doctrine and intent.

Endless gear defines improvisation under pressure.

Endless gear is not meant to be optimal. It is meant to be interesting, risky, and replayable.

---

Structural Rules

Endless Gear always conforms to the Gear Builder architecture:

Each Endless Gear item contains:

* A Chassis (sometimes degraded or variant)  
* A Doctrine (forced or biased)  
* Zero or more Field Modifications  
* A Stability value  
* Locked cards and limited free slots

Endless Gear never introduces new card templates or mechanics.

---

Endless Chassis Variants

Endless Gear uses variant states of existing chassis, not new chassis types.

Examples:

* *Light Weapon Frame (Scavenged)*  
  −1 Stability baseline  
  −1 maximum free slot  
* *Reinforced Armor Frame (Worn)*  
  Reduced durability ceiling  
* *Flexible Harness (Improvised)*  
  Higher Field Mod compatibility  
  Lower long-term reliability

Chassis variants communicate field conditions and supply pressure.

---

Forced Doctrine Assignment

Endless Gear does not allow free doctrine selection.

Instead:

* Doctrine is rolled or biased  
* Doctrine may conflict with the chassis  
* Doctrine changes require dismantling and rebuild

Examples:

* Heavy Weapon Frame \+ Skirmish Doctrine  
* Light Armor Frame \+ Suppression Doctrine

Doctrine mismatch is intentional and creates emergent builds.

---

Field Modifications (Procedural Identity)

Endless Gear derives most of its uniqueness from Field Modifications.

These mods:

* Use existing trigger systems  
* Favor conditional and reactive effects  
* Often increase instability

Examples:

* On Confirmed Kill → \+1 Heat to all weapons  
* If unit is Overstrained → Weapon cards gain \+2 damage  
* On Reshuffle → Repair one random weapon node

Endless Field Mods prioritize rules over raw stats.

---

Stability & Risk

Endless Gear typically has lower Stability than built gear.

Low Stability may cause:

* Trigger failure  
* Weapon misfires  
* Increased strain  
* Temporary card lockouts  
* Unreliable Field Mod procs

Stability pressure reinforces:

* Heat management  
* Clutch wear decisions  
* Supply and repair systems

---

Endless Crafting Recipes

Overview

Endless Crafting allows players to assemble procedural gear through intent-driven recipes, rather than fixed upgrades.

Endless recipes produce similar but non-identical results, even when using the same inputs.

The goal is replayable experimentation, not deterministic optimization.

---

Core Crafting Model

Endless crafting follows a three-part formula:

Recipe \= Chassis \+ Materials

Where:

* The Chassis defines structure and compatibility  
* Materials bias doctrine, Field Mods, and stability outcomes  
* RNG finalizes exact rolls within controlled bounds

Same recipe inputs ≠ guaranteed same result.

---

Materials with Semantic Meaning

Endless crafting uses existing Chaos Core resources, each with semantic weight.

Core Materials

* Metal Scrap  
  * Structural bias  
  * Durability and repair interaction  
  * Increases reliability at the cost of flexibility  
* Chaos Shards  
  * Chaos / void effects  
  * Instability and corruption-leaning Field Mods  
  * Risk-reward amplification  
* Steam Components  
  * Mechanical synergies  
  * Heat, clutch, and subsystem interaction  
  * Higher potential power with operational cost  
* Wood  
  * Lightweight builds  
  * Mobility, evasion, or utility bias  
  * Lower durability ceilings

Optional Advanced Inputs (Later Headlines)

* Crystals  
  * Precision, magic amplification  
* Medic Herbs  
  * Sustain, recovery, stabilization effects

---

Recipe Bias Examples

Example 1 — Aggressive Mechanical Build

Chassis: Light Weapon Frame

Materials:

\- Metal Scrap

\- Steam Components

\- Chaos Shards

Bias:

* Mechanical Field Mods  
* Heat interaction  
* Lower Stability  
* High volatility

---

Example 2 — Controlled Utility Gear

Chassis: Flexible Harness

Materials:

\- Wood

\- Metal Scrap

\- Crystals

Bias:

* Utility Field Mods  
* Higher proc reliability  
* Lower raw output

---

Example 3 — High-Risk Chaos Experiment

Chassis: Reinforced Armor Frame

Materials:

\- Chaos Shards

\- Chaos Shards

\- Steam Components

Bias:

* Corrupted Field Mods  
* Severe Stability penalties  
* Powerful but unreliable effects

---

Generation Rules

When crafting Endless Gear:

1. Chassis defines:  
   * Slot type  
   * Card compatibility  
   * Base stability range  
2. Materials:  
   * Bias Field Mod pools  
   * Influence doctrine likelihood  
   * Affect stability roll  
3. RNG:  
   * Selects final Field Mods  
   * Determines exact Stability  
   * Applies minor stat variance where allowed

Crafting is predictable in direction, not in outcome.

---

Integration with Gear Builder

Endless Gear:

* Can be customized further via Customize Gear  
* Uses existing card slot rules  
* May resist over-slotting due to Stability loss

Endless Gear can be dismantled to recover:

* Chassis fragments  
* Experimental components  
* Doctrine research progress

This ensures Endless Gear always feeds back into long-term systems.

---

UI & Player Communication

Endless crafting UI must clearly show:

* Expected bias (icons or tags)  
* Risk level (Stability indicator)  
* Non-deterministic warning

Example tooltip:

“Outcome influenced by materials. Final behavior not guaranteed.”

Transparency builds player trust.

---

Design Summary

Endless Gear & Endless Crafting exist to:

* Increase replay value  
* Encourage experimentation  
* Reinforce Chaos Core’s logistics-first identity  
* Avoid stat inflation  
* Preserve handcrafted gear importance

The system emphasizes intent, risk, and adaptation, not perfect builds.

---

If you want next, I can:

* Add example Endless Crafting recipes as a table  
* Write Field Mod pool definitions per material  
* Define Stability thresholds and failure behaviors  
* Produce JSON-ready data schemas  
* Help you decide which gear slots should never be procedural

Just tell me what you want to solve for next.

# 

# **Floor Navigation**

After leaving the base camp, the player enters a floor navigation screen where a path of rooms is chosen one at a time- there are four different room types:

\-Tactical battle encounters

\-”Wild” zones (free movement areas where resources can be collected and light enemies are fought).

\-Shop rooms where gear can be bought or sold.

\-Taverns where units can be healed, recruited or dispatched.

When a floor is completed, the player moves onto the next floor- players can’t move back to previous floors.

# **Campaign Structure**

The campaign is divided into five Operations, each representing a major military push or storyline arc. Each Operation contains 3 floors, each procedurally generated, taking around 2 hours of play to complete. Floors are made of interconnected rooms linked on a node map. If the player loses a battle in a room, they retry that room without losing floor progress.

Operations include:

• Operation Iron Gate – Secure the Chaos Rift entrance.

• Operation Black Spire – Capture enemy artillery positions.

• Operation Ghost Run – Disrupt enemy supply lines.

• Operation Ember Siege – Destroy key enemy fortifications.

• Operation Final Dawn – Assault the enemy command center.

Custom Operation \- Player gets to choose number of floors and difficulty level

# **Tactical Battles**

["Gumby" battle system]()

Grid Sizes: as small as 4x3 and as big as 8x6- max units allowed to be placed are grid area x 0.25 clamp 3-10. 

Actions: Move, Card, Item, Wait.

Deck/Hand System: Each unit draws 5 cards per turn from their personal deck- there are four types of cards:

* Class  
* Equipment  
* Core  
* Gambit

Strain System: Playing cards generates strain. Over strain threshold \= reduced accuracy, restricted core cards- though certain cards rely on a unit being over its strain threshold.

Per-unit leveling system from 0-30, with stats (ATK, DEF, AGI, HP, ACC) gradually increasing by level and being augmented by equipment.

Cover & Destructible Terrain: Units can hide behind destructible cover for protection.

Deployable Defenses: Before certain battles, players can place limited traps, barricades, or turrets on the map.

Recon Reports: Certain controlled key rooms allow players to preview upcoming maps and enemies.

Certain tactical battle rooms involve varying win conditions, such as capture points and holdout timers.

Turn order is AGI-based per unit, per side. IGOUGO

## **Weapon System**

### **Overview**

Each unit can equip weapons that provide 1-3 locked cards to their deck. When a weapon is equipped, its associated cards are automatically added to the unit's deck and cannot be individually removed—only unequipping the weapon removes these cards. Weapons have multiple subsystems (Heat, Ammo, Wear, Clutch, and Damage) that create tactical depth and require active management during combat.

### **Weapon Window UI**

During battle, each unit with an equipped weapon displays a Weapon Window alongside their hand. This window shows:

* Header: Weapon name and Clutch toggle  
* Node Diagram: 6-node component layout with color-coded status  
* Status Bars: Heat track (mechanical weapons), Ammo counter, Wear indicator  
* Action Buttons: Quick Reload, Full Reload, Active Vent, Field Patch

### **Visual States**

* Clutch Active: Weapon window gains colored border glow (amber/red)  
* Node States:  
  * Green \= OK  
  * Yellow \= Damaged (shows penalty)  
  * Red \= Broken (shows severe penalty)  
  * Gray/X \= Destroyed (node offline)  
* Heat Track: Visual pips that fill left-to-right and change color based on heat zones  
* Action Buttons: Grayed out when unavailable with tooltip explaining why

### **Contextual Information**

* Default View: Compact bars/numbers for Heat, Ammo, Wear  
* Hover States:  
  * Diagram: Nodes expand to show function and current penalties  
  * Heat Bar: Shows heat zones and effects ("0-3: Stable | 4-6: Barrel Glow, \-1 ACC")  
  * Nodes: Individual node status ("SIGHTS \- Damaged: \-1 ACC, \-2 ACC on Overwatch")  
  * Action Buttons: Shows strain cost, effects, and disabled reasons

### **Core Systems**

### **Clutch System**

Each weapon has a clutch toggle that can be activated to enhance weapon card effects. The clutch toggle is a switch on the weapon window that can be flipped on/off at any time during the unit's turn.

Effects:

* When ON: Weapon cards gain their clutch bonus effects  
* Each weapon card played with clutch active adds \+1 Wear to the weapon  
* Weapon window gains colored border glow when clutch is active  
* Some weapons have double clutch toggles with two separate effects

### **Wear Penalties:**

* Wear 1: \-1 ACC  
* Wear 2+: \-w ACC and \-w DMG (where w \= wear value)

Wear penalties apply automatically to all attacks from that weapon. Console logs track wear increases.

### **Heat System (Mechanical Weapons Only)**

Mechanical weapons (guns, crossbows, steam-powered melee, gatling devices) build heat as they're used. Non-mechanical weapons (swords, bows, greatbows) are unaffected.

Heat Accumulation:

* Core attack cards: \+1 Heat  
* Weapon skill cards: \+1 to \+3 Heat (varies by card)  
* Gambit cards: Up to \+4 Heat (if specified)

Heat Track:

* Range: 0-6 (or 0-8+ for high-capacity weapons)  
* Marked per weapon, not per character  
* Each weapon has unique heat zones with different effects

Heat Zones (Example \- Emberclaw Repeater):

* 0-3: Stable (no effects)  
* 4-6: Barrel Glow (-1 ACC)  
* 7-8: Critical (next shot overheats, \-2 ACC)

Heat zone effects are applied automatically. Background color of heat section changes per zone with brief animation when entering new zones.

Heat Relief:

* Passive Cooling: \-1 Heat at start of unit's turn (automatic, animated)  
* Active Vent: Button on weapon window  
  * Costs: Full turn (cannot play cards or take other actions)  
  * Effect: Fully cools weapon to 0 Heat  
  * Penalty: 10% max HP self-damage (steam burns/recoil)

Overheat: When Heat reaches Max Capacity:

1. Weapon jams for next turn  
2. Unit takes 10% max HP damage  
3. Heat resets to 0  
4. Console: SLK//HEAT :: CRITICAL HEAT REACHED\!

### **Ammo System**

Some weapons consume ammo when weapon cards are played. Ammo-using weapons have two reload options available via buttons on the weapon window.

Ammo Consumption:

* Automatic when playing cards with ammo cost  
* Cards requiring ammo are grayed out in hand when insufficient ammo available  
* Tooltip shows: "Requires 1 ammo. \[RELOAD\]"

Reload Actions:

* Quick Reload: Quick action \+ strain cost (varies by weapon)  
  * Refills ammo halfway (rounded up)  
  * Can still play cards this turn  
  * Preview shows result: "Restore 3 ammo (to 5/6)"  
* Full Reload: Quick action \+ strain cost (varies by weapon)  
  * Refills ammo completely  
  * Can still play cards this turn  
  * Preview shows result: "Restore 6 ammo (to 6/6)"

Visual Display:

AMMO: ●●●●○○  \[4/6\]

Quick: 1⚡ (→5)

Full: 0⚡ (→6)

### **Weapon Damage System**

Each mechanical weapon has six numbered component nodes that can be damaged in combat:

Node Layout:

1. 👁️ SIGHTS / STABILIZER  
2. 🎯 BARREL / EMITTER / EDGE  
3. ⚙️ ACTION / DRAW / SERVO  
4. ⚡ POWER COUPLING / TENSIONER  
5. 🌡️ HEAT SINK ARRAY  
6. 📦 FEED PATH / MAG LATCH / QUIVER

When Weapons Take Damage:

After a unit takes damage from a Direct attack:

* Roll d6 → on 6, weapon is struck  
* If attack was a Crit, weapon damage is automatic (no roll)  
* AoE/Indirect attacks don't damage weapons unless card specifies

When weapon is hit:

1. Weapon window shakes/flashes red  
2. Roll d6 to determine which node is struck  
3. Node pulses red and changes state  
4. Effect text appears on node  
5. Console: SLK//DMG :: \[NODE NAME\] struck. \[STATUS\]

Damage States:

Nodes progress through three damage states:

* OK → Damaged → Broken → Destroyed

Each node has unique penalties at each state (see Node Effects below).

Node Effects:

1\) SIGHTS / STABILIZER

* Damaged: \-1 ACC with this weapon; Overwatch \-2 ACC  
* Broken: \-2 ACC and this weapon can't use Overwatch  
* Destroyed: Weapon offline until repaired

2\) BARREL / EMITTER / EDGE

* Damaged: Range \-1 band (min R(1)); Arc/AoE radius \-1 (min 0); Melee: \-1 damage  
* Broken: Can't use Arc/AoE cards with this weapon; Melee: still \-1 damage  
* Destroyed: Weapon offline until repaired

3\) ACTION / DRAW / SERVO

* Damaged: Multi-attack weapon cards (Rapid Shot, Volley, Full Barrage) unplayable; Core attack OK  
* Broken: After playing any weapon card, roll d6: on 1-2 it jams (no effect) and you take \+1 Strain  
* Destroyed: Weapon offline until repaired

4\) POWER COUPLING / TENSIONER

* Damaged: First weapon card each turn costs \+1 Strain  
* Broken: This weapon gains \+1 Heat whenever it attacks (if heatless, \+1 Strain instead)  
* Destroyed: Weapon offline until repaired

5\) HEAT SINK ARRAY

* Damaged: Max Heat \-2; effects that remove heat remove 1 less (min 0); heat track grays out 2 slots  
* Broken: Can't remove more than 1 Heat/turn; if Max Heat reached, next attack can't be declared  
* Destroyed: Weapon offline until repaired

6\) FEED PATH / MAG LATCH / QUIVER

* Damaged: Ammo cost \+1 for weapon attacks; Quick Reload restores 1 fewer (min 1\)  
* Broken: Quick Reload fails (no ammo); Full Reload only restores half (rounded up)  
* Destroyed: Weapon offline until repaired

### **Repair System**

Field Patch:

* Button on weapon window  
* Cost: 1 Strain  
* Effect: Repair one node down one step (Broken→Damaged or Damaged→OK)  
* Action type: Quick action (can still play cards)

Synergy Repairs:

When you resolve certain effects, you may repair a matching node one step as a bonus (no action or strain cost):

* Any Reload → Repair Feed Path one step  
* Any Heat removal/vent (Cooling Discipline, Full Vent, heat-reducing cards) → Repair Heat Sink one step  
* Guard/Brace self-buff from weapon cards (Blast Shield, Magnetic Guard, defensive weapon cards) → Repair Sights OR Action one step (your choice)

Visual Feedback: When synergy repair triggers:

SLK//RELOAD :: Ammo restored. \[+3\]

SLK//REPAIR :: Feed Path repaired (synergy). \[Damaged → OK\]

Node pulses green and changes color automatically.

### **Deck Integration**

Auto-Population:

When a weapon is equipped to a unit:

1. Old weapon's cards are removed from deck (if replacing)  
2. New weapon's 1-3 cards are added to deck  
3. Weapon cards are marked as Locked (cannot be individually removed)  
4. Deck is shuffled

Deck View Display:

Weapon cards in deck view show:

* Small weapon icon in corner  
* Locked icon overlay (padlock or chain symbol)  
* Tooltip: "This card is from \[Weapon Name\]. Unequip the weapon to remove this card from your deck."

Card Tooltips:

When hovering over weapon cards in hand or deck:

* Shows heat cost: "+2 Heat"  
* Shows ammo cost: "-1 Ammo"  
* Shows clutch bonus effect (if clutch active): "CLUTCH: Ignore target's DEF"  
* Shows current availability: "Requires 1 ammo. \[RELOAD\]" (if insufficient ammo)

### **In-Battle Flow**

Turn Start:

1. Weapon window displays at bottom-right  
2. Hand window displays at bottom-center  
3. Heat auto-decreases by 1 (animated pips)  
4. Console: SLK//COOL :: \[Weapon Name\] cooled. \[Heat: 4 → 3\]

Playing a Weapon Card:

1. Select card in hand  
2. Card preview shows: "\[Card Name\] \- \+2 Heat, \-1 Ammo"  
3. Select target  
4. Execute:  
   * Damage applied to target  
   * Heat increases (animated pips fill)  
   * Ammo decreases (counter updates)  
   * If clutch ON: Wear increases  
5. Console: SLK//ATK :: \[Card Name\] hit for 12 damage. \[Heat \+2, Ammo \-1, Wear \+1\]

Taking Weapon Damage:

1. Unit takes hit  
2. Weapon hit check (d6 → 6, or automatic on crit)  
3. Weapon window shakes/flashes red  
4. Roll to determine node hit  
5. Node pulses red and changes state  
6. Console: SLK//DMG :: \[NODE NAME\] damaged. \[Effect description\]  
7. Visual updates automatically (grayed heat slots, penalty text, etc.)

Using Weapon Actions:

Quick/Full Reload:  
SLK//ACT  :: Quick Reload initiated.SLK//AMMO :: \+3 ammo. \[Ammo: 6/6\]

* 

Active Vent:  
SLK//ACT  :: Active Vent initiated. Full turn consumed.SLK//COOL :: \[Weapon Name\] vented. \[Heat: 6 → 0\]SLK//DMG  :: Steam burns\! \[-2 HP\]

* 

Field Patch:  
SLK//FIX  :: Field Patch applied. \[NODE\] repaired. \[Broken → Damaged\]

* 

Console Notifications

All weapon state changes are logged to the ScrollLink console with clear formatting:

SLK//LOAD :: \[Weapon Name\] equipped.

SLK//DECK :: \+3 weapon cards added to deck.

SLK//COOL :: Passive cooling. \[Heat: 5 → 4\]

SLK//CARD :: \[Card Name\] activated.

SLK//ATK  :: Target hit for \[X\] damage.

SLK//HEAT :: \+\[X\] heat. \[Heat: 4 → 6\]

SLK//AMMO :: \-\[X\] ammo. \[Ammo: 3/6\]

SLK//WEAR :: Clutch wear applied. \[Wear: 2/3\]

SLK//DMG  :: \[NODE NAME\] struck. \[Status\]

SLK//WARN :: \[Penalty description\]

SLK//ACT  :: \[Action Name\] initiated.

SLK//FIX  :: \[Node Name\] repaired. \[Damaged → OK\]

SLK//JAM  :: Weapon jammed\!

SLK//REPAIR :: \[Node Name\] repaired (synergy). \[Damaged → OK\]

### **Action Economy**

Weapon actions have three timing types:

* Quick Action: Can be performed alongside playing cards (Reload, Field Patch)  
* Full Turn: Consumes entire turn, cannot play cards (Active Vent only)  
* Free Action: No cost (Clutch toggle, passive cooling)

Action buttons show timing type in tooltip and are color-coded:

* Quick actions: Blue/Green  
* Full turn actions: Red with warning icon

### **Design Goals**

The weapon system is designed to:

1. Create tactical decisions: Heat/ammo/wear management vs. aggressive play  
2. Reward skill: Timing vents, using synergy repairs, knowing when to clutch  
3. Add depth without complexity: Visual feedback handles calculations automatically  
4. Feel physical: Weapons degrade, overheat, jam—they're tools that need maintenance  
5. Support varied playstyles: High-heat aggressive builds vs. conservative sustained fire vs. burst damage with cooldowns

The system integrates seamlessly with the existing strain economy—weapon management choices directly impact strain spending, creating interesting build decisions between weapon-heavy and skill-heavy decks.

# **Dungeon Control**

Key rooms are captured through tactical battles. After capture, the player chooses its type. Each type grants passive benefits and generates resources between battles.

Key rooms can randomly come under enemy attack during a run. The player may choose to defend them to retain their benefits.

**Base Camp**  
The base camp, set in a huge cargo elevator within the dungeon, serves as the hub between Floors. Here the player can:  
 • Recruit new units.  
 • Upgrade facilities (training grounds, workshop, infirmary).  
 • Modify decks and equip gear.  
 • Craft items with gathered resources.

# **Quest System (Quest Board)**

## **Overview**

The **Quest System** provides optional, run-bound objectives that give players additional structure, incentives, and narrative texture during a Chaos Core run. Quests are selected from a **Quest Board** and tracked passively during gameplay. They encourage varied playstyles, synergy with existing systems (Units, Fields, Recruitment), and player-driven risk/reward decisions.

Quests are **not required** to complete a run, but successful completion grants meaningful rewards that accelerate progression or unlock tactical advantages.

---

## **Design Goals**

* Add **intentional direction** to runs without forcing linear play.

* Encourage use of underutilized systems (Fields, positioning, unit variety).

* Create short-term, run-specific goals that feel achievable and rewarding.

* Remain modular, data-driven, and easy to extend with new quest types.

---

## **Quest Board**

The **Quest Board** is a discrete interaction point, most commonly found:

* In **Base Camp / Hub areas**, or

* As a **special node** on the Chaos Rift map.

When accessed, the Quest Board presents a small selection of available quests. The player may accept a limited number of quests at a time (default: **1 active quest per run**, expandable later via upgrades).

Quests persist until:

* Completed

* Failed

* Or the run ends

---

## **Quest Lifecycle**

Each quest follows a simple state machine:

1. **Available** – Quest appears on the board.

2. **Accepted** – Quest is active and progress is tracked.

3. **Completed** – Requirements are met; rewards are granted.

4. **Failed** – Failure condition is triggered (if applicable).

Optional failure conditions (e.g., “core takes damage,” “unit is defeated”) vary by quest type.

---

## **Quest Types**

Quests are categorized by their primary intent. Initial implementations may include:

### **Combat Quests**

* Defeat a number of enemies.

* Clear a floor without core damage.

* Defeat an elite or boss under specific conditions.

### **Field Quests**

* Use a specific Field ability a number of times.

* Maintain unit presence in a Field zone for a duration.

* Win encounters while a Field is active.

### **Unit & Squad Quests**

* Complete a floor with specific unit compositions.

* Level up or recruit a unit during the run.

* Prevent any unit losses during an operation.

### **Exploration & Objective Quests**

* Visit optional nodes or rooms.

* Interact with specific map features.

* Retrieve an item or resource.

Quest types are designed to **listen to existing game events**, not create bespoke mechanics.

---

## **Quest Data Model (Conceptual)**

Each quest is defined by the following core attributes:

* **ID** – Unique identifier.

* **Name & Description** – Player-facing text and flavor.

* **Quest Type** – Determines tracking logic.

* **Objectives** – One or more measurable conditions.

* **Progress State** – Current vs. required completion.

* **Failure Conditions** (optional).

* **Rewards** – Granted on completion.

Quests are data-driven and can be authored via JSON, resource files, or equivalent.

---

## **Progress Tracking**

Quest progress updates passively via global game events, such as:

* Enemy defeated

* Floor cleared

* Field activated

* Unit recruited

* Core damaged

* Turn ended

The Quest System subscribes to these events and updates relevant quests accordingly. Core combat and field systems remain unaware of quests beyond emitting standard events.

---

## **Rewards**

Quest rewards integrate directly with existing Chaos Core systems and may include:

* **Run Currency** (WAD or equivalent)

* **Units or Recruitment Options**

* **Temporary Buffs** (run-scoped modifiers)

* **Field Enhancements**

* **Meta-progression Resources** (future expansion)

Rewards are intentionally impactful but bounded to avoid eclipsing primary progression loops.

---

## **UI & Feedback**

While active, quests are visible as a compact overlay or panel showing:

* Quest name

* Progress indicator

* Failure warnings (if applicable)

On completion or failure:

* A brief notification is displayed.

* Rewards (if any) are clearly communicated.

Initial UI implementation may be minimal and expanded later.

---

## **Extensibility & Future Hooks**

The Quest System is designed to support future expansion, including:

* Multi-stage quests

* Narrative quest chains

* Faction-specific quest pools

* Dynamic quest generation based on player behavior

* Meta upgrades that increase quest slots or reroll counts

# **Unit Recruitment**

## **1\. Overview**

The player manages a **Guild Roster** of up to:

* **10 active party members** available for deployment in battles.  
* **30 total guild members** (global cap, including active party, reserves, and dispatched units).

Units are acquired through:

* **Recruitment hubs** (taverns/contract boards) in Base Camp and certain nodes.  
* **Story/event recruits** (scripted characters).  
* **Post-mission survivors / rescued NPCs** (later expansion).

Players may also **dispatch units on off-screen missions** (Expeditions) to gather resources, intel, and other strategic benefits.

---

## **2\. Guild Roster Structure**

### **2.1 Slots**

* **Active Party Slots (≤ 10):**  
  Units that can be selected for battles in the current operation.  
* **Reserve Guild Slots (up to 30 total including party):**  
  Units not in the current active party but available for:  
  * Future deployment  
  * Recruitment to new operations  
  * Off-screen expeditions

If the roster is full (30), new recruits cannot be hired until space is freed.

### **2.2 Unit Metadata**

Each unit has:

* Name (randomized from name pools, with locale tags / culture flavor)  
* Appearance profile (sprite / portrait variant seed)  
* Base Class (Squire / Ranger / etc.)  
* Current Class (may differ from base if promoted)  
* Class Grid Progress (per class)  
* PWR (Personnel Warfare Rating)  
* Affinities (Melee, Ranged, Magic, Support, Mobility, Survival)  
* Contract Status (see below)

---

## **3\. Recruitment Hubs (Taverns / Contract Boards)**

### **3.1 Location**

* **Base Camp Tavern**: always accessible between operations.  
* **Tavern Nodes** on operation maps: rare room type allowing mid-run recruitment (with limited selection).

### **3.2 Candidate Pool**

When the player opens a recruitment hub:

* Generate a **candidate pool** of 3–6 units.  
* Candidates persist until:  
  * Player leaves Base Camp (new operation starts), or  
  * Player completes a mission cycle and the pool refreshes (design-defined).

### **3.3 Candidate Generation**

For each candidate:

1. **Determine Archetype**  
   * Random base class from unlocked class pool (Squire, Ranger, etc.).  
   * Optionally skew towards classes underrepresented in the player’s guild.  
2. **Determine PWR Band**  
   * Low-tier recruit (rookie)  
   * Standard recruit  
   * Veteran recruit  
   * Rare/elite recruit (less common, higher WAD cost)  
3. **Roll Key Attributes**  
   * Starting class grid nodes (pre-bought masteries)  
   * Starting gear tier & card slots  
   * Core stats within a range appropriate for their PWR band  
   * Affinity seeds (e.g., a “Ranger-leaning” recruit starts with some Ranged affinity)  
4. **Assign Flavor**  
   * Name  
   * Visual variant  
   * One-line origin blurb (optional, future flavor content)

### **3.4 Cost & Contracts**

Each recruit has:

* **Hire Cost (WAD)**: main currency cost.  
* **Maintenance Cost (optional, future)**: could be ongoing WAD or just abstracted as nothing if you want less management.

Possible contract types to future-proof:

1. **Standard Contract**  
   * Pay WAD once → unit joins guild permanently (until dismissed or lost).  
2. **Limited Contract (optional)**  
   * Cheaper hire for a fixed number of operations.  
   * After the term, unit may:  
     * Request full hire (higher cost)  
     * Leave  
     * Stay with a new condition

For v1, you can use only **Standard Contracts**.

---

## **4\. Recruitment Flow (Base Camp Tavern)**

1. Player enters **Base Camp → Tavern**.  
2. UI lists **Candidate Cards**, each showing:  
   * Name \+ class icon  
   * Current class (e.g. “SQUIRE (Rank 1)”)  
   * PWR value  
   * 1–2 key traits (e.g., “High Mobility”, “Prefers Ranged Weapons”)  
   * Hire Cost (WAD)  
3. Player can:  
   * Select a candidate → view **Detail Panel**:  
     * Full stats  
     * Current gear  
     * Affinity overview  
     * Class tree preview  
   * Confirm “HIRE” (if WAD and roster space).  
4. On hire:  
   * Deduct WAD.  
   * Add unit to Guild Roster (Reserve or Active Party as decided by player).

If roster is at 30:

* Show warning: “Guild Roster Full (30/30). Dismiss a unit to recruit new members.”

---

## **5\. Off-Screen Missions (Expeditions)**

Off-screen missions give unused units something meaningful to do and support resource flow.

### **5.1 Access**

* From Base Camp: **“Dispatch / Expeditions” terminal** or node.  
* Later: certain map nodes may open time-limited field expeditions.

### **5.2 Mission Slots**

* Player may have **N active expeditions** at once (e.g., 2 at start, expandable via upgrades).  
* Each expedition:  
  * Has a mission type.  
  * Has a recommended PWR band and class tags.  
  * Has a duration (in operations or “in-game ticks”).

### **5.3 Mission Types (Examples)**

* **Scouting Run**  
  * Rewards: intel on upcoming nodes, small Squad XP, minor resources.  
  * Favored Affinities: Mobility, Survival.  
* **Salvage Expedition**  
  * Rewards: resources (Scrap, Wood, Steam Components), chance of gear.  
  * Favored Classes: Squire, Sentry, Paladin, Ranger.  
* **Arcane Survey**  
  * Rewards: Chaos Shards, rare card components, lore data.  
  * Favored Classes: Wizard, Chaosmancer, Academic.  
* **Escort / Protection**  
  * Rewards: WAD, reputation, chance of unique recruits.  
  * Favored Traits: PWR ≥ threshold, Survival affinity.

### **5.4 Success Chance**

Each mission has:

* **Base Success Rate** (e.g., 50–60%).  
* Modifiers based on:  
  * Average PWR of assigned units (vs mission recommended PWR).  
  * Number of units sent (more bodies \= safer).  
  * Relevant Affinities / Classes:  
    * Higher Mobility may improve scouting missions.  
    * Higher Survival helps dangerous expeditions.  
    * Magic-heavy parties may excel at Arcane missions.

Pseudo-formula:

SuccessChance \=

  BaseChance

  \+ (avgPWR \- missionRecommendedPWR) \* PWRFactor

  \+ AffinityBonus

  \+ ClassSynergyBonus

  clamped to \[minSuccess, maxSuccess\]

SuccessChance \=

  BaseChance

  \+ (avgPWR \- missionRecommendedPWR) \* PWRFactor

  \+ AffinityBonus

  \+ ClassSynergyBonus

  clamped to \[minSuccess, maxSuccess\]

## **6\. Integration with Other Systems**

### **6.1 Squad XP**

* Expeditions are a key alternative source of **Squad XP**, especially for:  
  * Players who want to bolster class grids without constant frontline combat.  
  * Giving unused units a strategic role.

### **6.2 PWR**

* PWR is used:  
  * For UI evaluation of candidate strength (recruitment screen).  
  * In expedition success calculations.  
  * As a soft gate for certain mission tiers (“Recommended PWR 150+”).

### **6.3 Affinity**

* Affinity influences:  
  * Which recruits appear at Tavern (e.g., world biased toward underrepresented roles can be added later).  
  * Expedition outcomes (bonuses based on relevant affinities).  
  * Unlocking advanced job classes for recruited units over time.

### **6.4 Class Mastery**

* Recruits can enter with **partial mastery** in a class grid (e.g., Squire Rank 1 with a few nodes unlocked).  
* Off-screen missions \+ Squad XP allow new recruits to catch up over time without field deployment if the player chooses.

---

## **7\. Future Hooks**

* **Unique Named Recruits:**  
  Rare candidates with custom traits, stories, or unique cards.  
* **Contract Negotiations:**  
  Recruits who demand more WAD, special conditions, or gear.




# **UNIT PERFORMANCE SYSTEM**

Personnel Warfare Rating (PWR) & Persistent Affinity System

---

## **1\. Overview**

Chaos Core does not use traditional character levels. Instead, each unit’s combat capability is defined by:

1. **PWR — Personnel Warfare Rating**  
   A derived rating representing the unit’s total combat readiness based on class mastery, ability grid progression, gear quality, free-slot cards equipped, passive flags, and other systemic bonuses.  
2. **Class Mastery Rank (per class)**  
   Units advance within specific job roles by unlocking nodes in each class’s ability grid using Squad XP.  
3. **Persistent Affinity System (per unit)**  
   Units develop long-term tendencies (Melee, Magic, Ranged, Support, Mobility, Survival) based on the actions they perform across **all operations**, shaping discounts and unlock paths.

Together, these systems allow units to grow in flexible, role-defined ways without numeric level inflation, preserving tactical clarity and roguelike replayability.

---

## **2\. Personnel Warfare Rating (PWR)**

**PWR** is a **derived, non-level-based rating** representing the total combat functionality of a unit. It updates automatically as a unit’s build changes.

PWR Inputs

* Total statline (HP, ATK, DEF, AGI, ACC)  
* Class Rank(s) and unlocked masteries  
* Ability Grid nodes unlocked (value-weighted)  
* Equipped gear tier / rarity  
* Cards slotted into free gear slots  
* Passive bonuses from class promotions, hybrid jobs, or class flags

What PWR Represents

PWR is not used for combat calculations directly; rather, it:

* Communicates overall unit strength at a glance.  
* Helps players compare builds or identify underperforming units.  
* May factor into future systems such as:  
  * Operation difficulty scaling  
  * Recruitment availability  
  * Base Camp rank requirements  
  * Event checks

Example PWR Scale (tunable)

* 0–49: Rookie / Underdeveloped  
* 50–129: Standard Issue  
* 130–219: Veteran  
* 220–319: Elite  
* 320+: Paragon

---

## **3\. Persistent Affinity System**

Affinity tracks the **long-term behavior and preferences** of each unit across all operations. Affinities do **not** alter card stats and do not directly affect combat performance. Instead, they influence progression choices and development costs.

Affinity persists **between operations** (not wiped per run), giving each unit a distinct personality formed by the player’s playstyle.

Tracked Affinities (per unit)

| Affinity | Increases When Unit… | Used To Influence… |
| ----- | ----- | ----- |
| **Melee** | Uses melee cards | Squire / Paladin / Trickster grid discounts |
| **Ranged** | Uses bows / guns | Ranger / Scout / Bowmaster discounts |
| **Magic** | Casts magic | Wizard / Cleric / Chaosmancer discounts |
| **Support** | Buffs, heals, shields | Cleric / Academic discounts |
| **Mobility** | Moves frequently | Scout / Shadow unlock conditions |
| **Survival** | Takes damage and survives | Sentry / Paladin unlock conditions |

Affinities increment slowly (e.g., 1 per action) and accumulate indefinitely.

---

## **4\. Affinity Effects**

Affinities do not grant immediate bonuses; instead they modify **progression costs** and **unlock requirements**.

### **4.1 Ability Grid Discounts**

Nodes in a class grid may define affinity-based discount tiers:

**Example: Squire → Paladin Grid Node**

Node: Guardian's Oath    
Base Cost: 90 Squad XP    
Affinity Discounts:  
  \-10 XP at Survival ≥ 60    
  \-20 XP at Survival ≥ 150    
  \-30 XP at Survival ≥ 300 

Affinity **helps you buy into a class you’re naturally steering toward**, without forcing it.

---

### **4.2 Class Unlock Conditions**

Advanced jobs require a mix of:

* Class Rank (from grid nodes)  
* Affinity thresholds (role expression)  
* Sometimes specific grid prerequisites

**Example: Spellblade**

Requirements:  
  Squire Rank ≥ 2    
  Wizard Rank ≥ 2    
  Melee Affinity ≥ 80    
  Magic Affinity ≥ 80 

**Example: Bowmaster**

Requirements:  
  Ranger Rank ≥ 2    
  Ranged Affinity ≥ 200 

**Example: Shadow (Thief → Assassin branch)**

Requirements:  
  Thief Rank ≥ 3    
  Mobility Affinity ≥ 120   
---

### **4.3 Hybrid Job Flavor & Identity**

Persistent affinities give each unit a natural identity across runs:

* A unit who always casts spells becomes a natural **Wizard → Chaosmancer**.  
* A unit who is frequently on the frontline becomes a **Squire → Paladin**.  
* A unit you use to scout maps and reposition becomes a **Ranger → Scout**.

Affinity does not overpower build flexibility: the player can spend Squad XP wherever they want—but discounts gently reward consistent play.

---

## **5\. PWR \+ Affinity Synergy**

* PWR reflects the *result* of decisions made in Ability Grids and gear systems.  
* Affinity shapes the *cost and availability* of those decisions.  
* Class Rank marks *proficiency* within the class.

Combined, they form a lightweight but deep progression loop:

Use abilities →  
Gain affinity →  
Unlock cheaper nodes →  
Increase class mastery →  
Gain PWR →  
Unlock promotions and hybrid classes →  
Repeat  
---

## **6\. Why This Model Works for Chaos Core**

* **No per-unit XP** → avoids grind and keeps runs clean.  
* **Squad XP economy** → tight control over progression pacing.  
* **Persistent affinity** → your squad organically evolves over time.  
* **PWR** → gives players a readable measure of unit strength.  
* **Class grids** → deep FFT-like mastery without complexity bloat.  
* **Discount-driven affinity** → replicates FFT’s “grow by doing” feeling in a modern, roguelite-friendly format.

---

## **7\. Implementation Notes**

* Affinity tracking must be lightweight: increments on action resolution only.  
* PWR should be recalculated whenever:  
  * Stats change  
  * Gear changes  
  * Cards slotted change  
  * Ability grid nodes unlock  
  * Class promotions occur  
* Future UI should include:  
  * PWR badge on unit roster  
  * Affinity breakdown page  
  * Discount indicators in the class grid

# **Classes**

## **1\. Overview**

The Class Tree system defines how units evolve from basic combat roles into specialized branches and hybrid advanced classes.

The design goal is to evoke **Final Fantasy Tactics–style progression**, while staying compatible with Chaos Core’s equipment-driven cards, tactical combat, and roguelite structure.

* Each unit begins as **Squire** or **Ranger**.  
* Other Tier 1 classes (Magician, Thief, Academic, Freelancer) unlock through gameplay milestones.  
* Promotion to Tier 2 branches occurs via **Class Mastery** \+ unlock conditions.  
* Tier 3 hybrid/elite classes require **multi-class mastery** and special feats or discoveries.

---

## **2\. Tier Structure (High-Level)**

TIER 0 — Starter         Squire, Ranger

TIER 1 — Core Unlocks    Magician, Thief, Academic, Freelancer

TIER 2 — Job Branches    Promoted roles for each Tier 0/1 class

TIER 3 — Elite Hybrids   Multi-class prestige roles

---

## **3\. TIER 0 — STARTER JOBS**

Starter jobs are always available for new recruits.

---

### **SQUIRE**

**Primary Weapons:** Swords

**Role:** Balanced frontline unit, adaptive and reliable.

**Branches into:** Sentry, Paladin, Watch Guard.

---

### **RANGER**

**Primary Weapons:** Bows

**Role:** Long-range attacker with strong mobility options.

**Branches into:** Hunter, Bowmaster, Trapper.

---

## **4\. TIER 1 — CORE UNLOCKABLE CLASSES**

Unlocked by global milestones in operations, discoveries, or mastery.

---

### **MAGICIAN**

**Primary:** Staves

**Role:** Damage \+ utility casting.

**Unlock Condition Examples:**

* Bring 5 Chaos Shards to Base Camp.  
* Survive a Chaos Anomaly encounter.

**Branches:** Cleric, Wizard, Chaosmancer.

---

### **THIEF**

**Primary:** Shortswords

**Role:** Stealth, mobility, debuffs, crits.

**Unlock Condition Examples:**

* Successfully steal an item from an enemy.  
* Complete a Free Zone without taking damage.

**Branches:** Scout, Shadow, Trickster.

---

### **ACADEMIC**

**Primary:** Bows, Shortswords

**Role:** Tactical analysis, buffing, intel.

**Unlock Condition Examples:**

* Collect 3 enemy data fragments.  
* Scan 10 unique enemy types.

**Branches:** *None (pure utility class).*

---

### **FREELANCER**

**Primary:** Any weapon (penalties for off-class gear)

**Role:** Adaptive generalist.

**Unlock Condition Examples:**

* Reach Mastery Rank 2 in any two Tier 0/1 classes.

**Branches:** *None (baseline hybrid class).*

---

## **5\. TIER 2 — CLASS BRANCHES**

Promotion classes that specialize each core job.

---

### **SQUIRE → BRANCHES**

#### ***SENTRY***

**Weapons:** Swords, Greatswords

**Role:** Defensive vanguard / anti-rush frontline.

**Unlock:**

* Complete 3 battles with no ally KOs.  
* Reach Squire Rank 3+.

---

#### ***PALADIN***

**Weapons:** Swords, Greatswords

**Role:** Protector with healing/mitigation abilities.

**Unlock:**

* Save an ally from lethal damage 5 times.  
* Retrieve Radiant Core artifact from Free Zone.

---

#### ***WATCH GUARD***

**Weapons:** Swords, Bows

**Role:** Hybrid melee–ranged control & overwatch.

**Unlock:**

* Achieve a battle where the unit deals melee and ranged damage.  
* Reach Squire Rank 3+.

---

### **RANGER → BRANCHES**

#### ***HUNTER***

**Weapons:** Bows, Guns

**Role:** Precision ranged crits and single-target burst.

**Unlock:**

* Score 3 max-range critical hits.  
* Craft a gun.

---

#### ***BOWMASTER***

**Weapons:** Bows, Greatbows

**Role:** Long-range power shots, piercing attacks.

**Unlock:**

* Collect Greatbow Frame.  
* Fire 50 arrows total.

---

#### ***TRAPPER***

**Weapons:** Bows, Guns

**Role:** Battlefield control: traps, snares, lures.

**Unlock:**

* Trigger 5 traps in Free Zones.  
* Craft a trap card.

---

### **MAGICIAN → BRANCHES**

#### ***CLERIC***

**Weapons:** Staves

**Role:** Heals, shields, purifies corruption.

**Unlock:**

* Heal 500 HP cumulatively.  
* Purify a Chaos Node.

---

#### ***WIZARD***

**Weapons:** Staves, Greatstaves

**Role:** High-damage elemental casting.

**Unlock:**

* Deal 1000 total magic damage.  
* Use 3 elemental categories of spells.

---

#### ***CHAOSMANCER***

**Weapons:** Staves, Swords

**Role:** Chaos-infused hybrid melee \+ magic.

**Unlock:**

* Survive 3 Chaos Surges.  
* Find Corrupted Staff relic.

---

### **THIEF → BRANCHES**

#### ***SCOUT***

**Weapons:** Bows

**Role:** Recon, vision range boosts, picking off stragglers.

**Unlock:**

* Discover 10 secrets in Free Zones.

---

#### ***SHADOW***

**Weapons:** Shortswords, Bows

**Role:** Assassination, evasion, backstab crits.

**Unlock:**

* Perform 5 backstab kills.  
* Complete a Shadow Trial stealth node.

---

#### ***TRICKSTER***

**Weapons:** Swords

**Role:** Confusion, displacement, debuffs.

**Unlock:**

* Apply 20+ debuffs across operations.  
* Win a fight where 10 enemy attacks miss due to manipulation.

---

## **6\. TIER 3 — PRESTIGE HYBRID CLASSES**

These require mastery in multiple classes and thematic unlock conditions.

Each one is meant to feel like a **prestige promotion**.

---

### **SPELLBLADE**

**Weapons:** Swords

**Role:** Magic-infused melee.

**Prereqs:**

* Squire Rank 3  
* Magician Rank 3  
  **Unlock:** Wield any magic-infused sword.

---

### **DRAGOON**

**Weapons:** Spears / Greatspears

**Role:** Jump attacks, anti-air, shock assaults.

**Prereqs:**

* Squire Rank 4  
* Ranger Rank 3  
  **Unlock:** Kill flying enemy via jump card.

---

### **GLADIATOR**

**Weapons:** Greatswords, Fists

**Role:** Stances, counters, duel-style combat.

**Prereqs:**

* Squire Rank 4  
* Freelancer Rank 3  
  **Unlock:** Win a 1vX duel with only one surviving ally.

---

### **GEOMANCER**

**Weapons:** Staves, Shortswords

**Role:** Terrain manipulation, AoE zones.

**Prereqs:**

* Magician Rank 3  
* Ranger Rank 3  
  **Unlock:** Encounter 3 terrain anomalies.

---

### **ORACLE**

**Weapons:** Staves

**Role:** Status magic, foresight, predictive buffs.

**Prereqs:**

* Magician Rank 3  
* Academic Rank 2  
  **Unlock:** Win a fight with ≥5 active debuffs on enemies.

---

### **SUMMONER**

**Weapons:** Greatstaves

**Role:** Eidolons, sigils, temporary allies.

**Prereqs:**

* Cleric Rank 3  
* Wizard Rank 3  
  **Unlock:** Defeat a Sigil Beast in Free Zone.

---

### **CHRONOMANCER**

**Weapons:** Staves

**Role:** Haste/Slow, turn manipulation.

**Prereqs:**

* Wizard Rank 4  
* Academic Rank 3  
  **Unlock:** Defeat a miniboss within 5 turns.

---

### **WARSMITH**

**Weapons:** Guns, Hammers

**Role:** Engineering: turrets, drones, gadgets.

**Prereqs:**

* Academic Rank 3  
* Freelancer Rank 3  
  **Unlock:** Craft an advanced Steam Component.

---

### **NECROTEC**

**Weapons:** Staves, Swords

**Role:** Reanimates fallen enemies as mechanical husks.

**Prereqs:**

* Chaosmancer Rank 3  
* Warsmith Rank 3  
  **Unlock:** Combine metal scrap \+ chaos shard to attempt reactivation ritual.

---

### **BATTLE ALCHEMIST**

**Weapons:** Bombs, Shortswords

**Role:** Grenades, chain reactions, status payloads.

**Prereqs:**

* Magician Rank 2  
* Thief Rank 2  
  **Unlock:** Craft 5 alchemical weapons.

---

## **7\. CLASS TREE (ASCII FORMAT)**

\========================================================

 CHAOS CORE – CLASS TREE (ASCII DIAGRAM)

\========================================================

 TIER 0 (Starter)

  \[SQUIRE\]                 \[RANGER\]

 TIER 1 (Unlockable)

  \[MAGICIAN\]   \[THIEF\]   \[ACADEMIC\]   \[FREELANCER\]

 TIER 2 (Promotions)

  SQUIRE →    SENTRY, PALADIN, WATCH GUARD

  RANGER →    HUNTER, BOWMASTER, TRAPPER

  MAGICIAN →  CLERIC, WIZARD, CHAOSMANCER

  THIEF →     SCOUT, SHADOW, TRICKSTER

 TIER 3 (Hybrid / Prestige)

  SPELLBLADE     \= Squire \+ Magician

  DRAGOON        \= Squire \+ Ranger

  GLADIATOR      \= Squire \+ Freelancer

  GEOMANCER      \= Magician \+ Ranger

  ORACLE         \= Magician \+ Academic

  SUMMONER       \= Cleric \+ Wizard

  CHRONOMANCER   \= Wizard \+ Academic

  WARSMITH       \= Academic \+ Freelancer

  NECROTEC       \= Chaosmancer \+ Warsmith

  BATTLE ALCHEMIST \= Magician \+ Thief

# **Decks, Equipment & Modules**

Five equip slots per unit: Weapon (no max), Chestpiece, Helmet, two Accessories.

Weapons are class-restricted; other gear is universal.

Modules: Found/crafted/bought upgrades that add new equipment cards to unit decks.

Decks can be modified at any time outside of a tactical battle encounter.

## **Gear Workbench & Card Slotting System**

### **Overview**

Chaos Core traditionally determines a unit’s combat deck from **class \+ equipped gear**.  
 The Gear Workbench system expands player customization by allowing each piece of equipment to hold:

* **Locked Cards** (defining item identity & class fantasy)

* **Free Card Slots** (2–3 on average)

Players collect individual cards through:

* Battle rewards

* Shop purchases

* Crafting recipes

* Opening .PAK card packs (3–5 card pulls)

Cards slotted into equipment become part of the unit’s battle deck.  
 This preserves Chaos Core’s existing deck identity while adding satisfying deckbuilding freedom.

---

### **Design Goals**

1. **Add meaningful, limited customization** without overwhelming players.

2. Preserve **class identity and item identity** using locked cards.

3. Provide **pack opening excitement** while preventing deck bloat.

4. Allow players to meaningfully tune their combat engine mid-run or between floors.

5. Integrate smoothly into the **forward locker \+ loadout loop**.

6. Ensure gear feels like **modular OS components** compiling into a unit’s deck.

---

### **Core System Rules**

#### ***Equipment Card Structure***

Every piece of equippable gear contains:

lockedCards: CardId\[\]        // Fixed, cannot be removed

freeSlots: number            // Usually 2–3

slottedCards: CardId\[\]       // Player-chosen cards

#### ***Deck Formation***

A unit’s combat deck is the **SUM of all cards** in their equipped items:

#### ***Free Slot Rules***

* No card-type restrictions.

* Cards can be freely added or removed at the Gear Workbench.

* Each slot holds **one** card.

* Cards do **not** incur MASS/BULK/POWER penalties.

* Cards do **not** go to the general inventory — they exist in the **Card Library**.

#### ***Card Library***

The Card Library is a persistent list of all cards the player owns (copies allowed).

#### ***Card Copies***

* Once obtained, a card may be slotted into any compatible equipment.

* No single-copy restrictions.

* Encourages experimentation.

### **Acquisition Sources**

#### ***Battle Rewards***

Battles may award:

* 1 guaranteed common card

* Chance for an uncommon or rare card

* Small chance for a chaos-variant card

#### ***Shop***

Shops sell:

* Individual cards

* .PAK card packs

* Rarer cards cycle in the rotation

#### ***Crafting***

The Workshop can synthesize new cards using:

* Metal Scrap

* Chaos Shards

* Steam Components

* Optional new late-game materials

#### ***.PAK Packs***

.PAK files contain **3–5 cards** sampled from weighted rarity pools.

Pack examples:

* **CORE.PAK** — General cards (common/uncommon-heavy)

* **STEAM.PAK** — Steam and mobility cards

* **VOID.PAK** — Chaos/void cards with corruption risk

* **TECH.PAK** — Equipment synergy cards

* **BOSS.PAK** — Rare and epic-only packs dropped by bosses

Opening a pack triggers the **PAK Decompiler Animation**

### **Future Expansion Hooks**

* Legendary gear with **special slot types**

* “Overclock Slots” allowing 2 cards in 1 slot

* Void corruption mutating slotted cards during a run

* Card upgrades (leveling an individual card)

* Crafting rare cards from fragments

* MULE upgrades granting extra free slots in all gear

## 

## **Rolled Card Instances System (“Variable Stat Cards”)**

### **Overview**

To introduce long-term roguelite variety and create meaningful gear customization, Chaos Core uses a Rolled Card Instance System.

Cards pulled from packs, crafted, bought in shops, or dropped in combat come as unique instances with slightly varied stats. This makes every run’s loadouts and gear builds feel distinct while keeping core card behavior predictable.

This system supports:

* excitement during pack openings  
* long-term investment in perfect gear builds  
* decisions between “more damage” vs “lower strain cost”  
* crafting / fusing / upgrading paths in future headlines

---

### **1\. Card Templates vs Card Instances**

Card Template

A card template defines the *base identity* and rules of a card.

Examples:

* name  
* base damage  
* base strain  
* card tags / behavior  
* which stats are allowed to roll

CardTemplate {

  id: "slash",

  baseDamage: 4,

  baseStrain: 1,

  damageRoll: \[0, \+3\],   // allowable modifier range

  strainRoll: \[0, \-1\],   // can reduce strain by up to 1

  tags: \["attack", "melee"\]

}

Templates never change during a run.

#### ***Card Instance***

When a player acquires a card (from a pack, shop, craft, or battle), the game generates a rolled instance:

CardInstance {

  id: "slash\_8f35d1",

  templateId: "slash",

  rolled: {

    damageBonus: \+2,

    strainBonus: \-1

  },

  quality: "Fine", // optional flair based on roll strength

  source: "pack"

}

The instance is stored in the player’s Card Library and can be slotted into gear.

---

### **2\. Rollable Stats**

Cards roll from small, controlled stat ranges to preserve readability and avoid destabilizing the deck system.

Allowed rolls

* Damage (small \+0 → \+3 window)  
* Strain cost changes (0 → \-1)  
* Accuracy (e.g., \+0% → \+5%)  
* Minor status effects (optional future headline)

Not rolled

* Card behavior or targeting  
* Key tactical mechanics (movement range, AoE shape)  
* Anything requiring new animations or UI strings

Only the numbers roll, not the identity.

---

### **3\. Acquisition & Roll Generation**

Whenever a card instance is created, the system:

1. Retrieves the card template.  
2. For each stat with a roll range, randomly selects a bonus or reduction.  
3. Biases rolls upward for rarer sources:  
   * Boss / elite battles  
   * Premium packs (.PAK files)  
   * High-tier shop stock  
   * High-quality crafts  
4. Determines optional quality color (Normal, Fine, Rare, Epic) based on how close rolls are to their max values.

Pseudocode:

function generateCardInstance(template, qualityHint) {

  rolled \= {};

  rolled.damageBonus \= randomWithin(template.damageRoll);

  rolled.strainBonus \= randomWithin(template.strainRoll);

  quality \= evaluateRollQuality(template, rolled);

  return new CardInstance(template.id, rolled, quality, source);

}

---

### **4\. Gear Slot Integration**

Each piece of equipment has:

* Locked cards (unchanging, not rolled)  
* Free card slots (customizable, hold card instances)

When a unit equips gear, the deck compiler assembles the unit’s deck by:

1. Reading the locked card templates.  
2. Reading each slotted Card Instance.  
3. Applying rolled stats to produce final card values.

This allows:

* Two “Slash” cards in a deck to behave differently (e.g. \+1 dmg vs \+3 dmg).  
* Players to chase perfect rolls for high-value gear.  
* Gear loadouts to remain personalized across runs.

---

### **5\. UI/UX Representation**

#### ***Card Library Window***

Each card instance displays:

* Template name: *“Slash”*  
* Final stats: *DMG 7 (4+3)*, *STR 0 (1–1)*  
* Colored modifiers:  
  * Green \+damage  
  * Blue \-strain  
* Instance quality badge (optional cosmetic)

#### ***Gear Workbench***

When viewing a piece of equipment:

* Free slots show which Card Instances are installed.  
* Hover shows both base template and rolled stats.  
* Drag-and-drop to slot or unslot cards.

#### ***Pack Opening UX***

When opening a .PAK:

* Rolling animation generates each card instance live.  
* Higher rolls show enhanced animation or color cues.  
* Pack type influences roll quality bias.

---

### **6\. Long-Term Expansion Hooks**

This system enables multiple future mechanics without rewriting core gameplay:

Crafting / Fusion

* Combine 3 low-roll “Slash” copies → generate 1 higher-tier re-roll.  
* Use materials (scrap, steam components, chaos shards) to re-roll a card.

Corruption Paths

* Void altars overcharge a rolled card:  
  * \+damage range  
  * \+strain penalties  
  * added chaotic side effects

Loadout Synergies

* Some gear pieces may give bonuses to high-quality cards.

Run-Based Progression

* Different runs produce different roll distributions, shaping player strategies.

---

### **7\. Design Goals**

This system solves multiple goals cleanly:

✔ Roguelite Variety

No two “Slash” cards feel identical across runs.

✔ Player Agency

Crafting, fusing, and choosing card rolls creates meta-level decisions.

✔ Synergy with Gear Slots

Free slots become a meaningful layer of buildcraft.

✔ Scalable for Future Content

Templates remain stable; only instance data grows.

✔ Low Complexity for Players

Players understand “Slash \+3” instantly.

---

### **8\. Implementation Milestones (for Headline Planning)**

11db-a

 — Add Template \+ Instance data structures

11db-b

 — Implement roll generation

11db-c

 — Store card instances in the Card Library

11db-d

 — Gear Workbench UI supports viewing rolled stats

11db-e

 — Deck compiler reads rolled instances

11db-f

 — Packs & battle rewards generate rolled instances

11db-g

 — Add quality tiers (optional)

11db-h

 — (Future) Crafting & Fusion systems

# **Consumable Items**

## **Overview**

Consumable items are single-use resources that provide immediate tactical benefits during battle or between encounters. All consumables are stored in a **shared inventory pool** accessible by any unit during combat. Consumables take up Mass, Bulk, and Power capacity in the Forward Locker, creating strategic decisions about what to carry into operations.

## **Storage & Access**

**Forward Locker:**

* All consumables are stored in the Forward Locker  
* Shared pool \- any unit can access any consumable during battle  
* Each consumable has Mass/Bulk/Power values that contribute to loadout capacity  
* Consumables are subject to degradation alongside other Forward Locker items

**Base Camp Inventory:**

* Consumables can be stored in Base Camp between operations  
* Move consumables between Base Camp ↔ Forward Locker via Loadout screen  
* No capacity limits in Base Camp storage

## **Usage in Battle**

**Action Cost:**

* Using any consumable costs **1 full action**  
* Cannot play cards or take other actions on the same turn  
* Can still move before or after using consumable (if movement available)

**Activation Flow:**

1. During unit's turn, select "Use Item" action  
2. Consumable panel opens showing Forward Locker contents  
3. Select consumable item  
4. Select target (if applicable)  
5. Effect applies immediately  
6. Item is consumed and removed from inventory  
7. Console logs the action

**Consumable Panel (In Battle):**

┌─────────────────────────────────────┐

│ CONSUMABLES (Forward Locker)        │

├─────────────────────────────────────┤

│ \[💊\] Field Ration (x5)              │

│ \[🏥\] Medkit (x2)                    │

│ \[🔧\] Repair Kit (x2)                │

│ \[⚡\] Overcharge Cell (x1)           │

│ \[❄️\] Coolant Flask (x3)             │

│ \[💨\] Smoke Canister (x2)            │

│ \[🔪\] Throwing Knife (x4)            │

│ \[💥\] Firebomb (x1)                  │

│ \[⚡\] Shock Charge (x2)              │

│ \[✨\] Arcane Elixir (x3)             │

│ \[🎯\] Focus Draught (x2)             │

│ \[🚩\] Battle Banner (x1)             │

└─────────────────────────────────────┘

Click to use (costs 1 full action)

## **Acquiring Consumables**

**Purchase:**

* Available at Shop rooms during operations  
* Available at Quartermaster Garrick in Base Camp  
* Listed sell and buy prices (sell \= 50% of buy price typically)

**Crafting:**

* Crafted at Workshop in Base Camp using gathered resources  
* Recipes require specific combinations of Metal Scrap, Wood, Chaos Shards, Steam Components  
* Crafted items go directly to Base Camp inventory

**Loot:**

* Found as battle rewards  
* Discovered in free-move zones (crates, resource nodes)  
* Dropped by certain enemies

## **Consumable Categories**

### **Healing & Recovery**

**Field Ration**

* Effect: Restore 2 HP to target unit  
* Mass: 1 | Bulk: 1 | Power: 0  
* Sell: 15 WAD | Buy: 30 WAD  
* Crafting: 2 Medic Herbs \+ 1 Treated Leather  
* Range: R(0-1), V1, Direct  
* *Basic healing for minor wounds. Compact and lightweight.*

**Medkit**

* Effect: Restore 5 HP to target unit  
* Mass: 2 | Bulk: 2 | Power: 0  
* Sell: 40 WAD | Buy: 80 WAD  
* Crafting: 4 Medic Herbs \+ 1 Treated Leather  
* Range: R(0-1), V1, Direct  
* *Advanced medical supplies for serious injuries.*

### **Mechanical Maintenance**

**Repair Kit**

* Effect: Restore 3 HP to mechanical unit (units with mechanical weapons/armor)  
* Mass: 2 | Bulk: 1 | Power: 0  
* Sell: 20 WAD | Buy: 40 WAD  
* Crafting: 2 Metal Scrap \+ 1 Processed Fuel  
* Range: R(0-1), V1, Direct  
* *Emergency field repairs for mechanical components.*

**Overcharge Cell**

* Effect: Add \+3 Heat instantly to mechanical weapon; next attack from that weapon gains \+3 ATK  
* Mass: 1 | Bulk: 1 | Power: 2  
* Sell: 25 WAD | Buy: 50 WAD  
* Crafting: 2 Processed Fuel \+ 1 Crystal  
* Range: R(0-1), V1, Direct  
* *Dangerous power surge for desperate situations. Risk overheating.*

**Coolant Flask**

* Effect: Remove 3 Heat from target unit's mechanical weapon  
* Mass: 2 | Bulk: 1 | Power: 0  
* Sell: 30 WAD | Buy: 60 WAD  
* Crafting: 3 Processed Fuel \+ 1 Crystal  
* Range: R(0-1), V1, Direct  
* *Emergency cooling compound. Prevents overheat cascades.*

### **Tactical Utility**

**Smoke Canister**

* Effect: Create smoke on target tile (blocks LoS for 1 turn, affects both allies and enemies)  
* Mass: 1 | Bulk: 2 | Power: 0  
* Sell: 25 WAD | Buy: 50 WAD  
* Crafting: 2 Processed Fuel \+ 2 Treated Leather  
* Range: R(1-3), V1, Direct  
* *Obscures vision. Use for cover or tactical repositioning.*

**Arcane Elixir**

* Effect: Restore 2 Strain to target unit  
* Mass: 1 | Bulk: 1 | Power: 0  
* Sell: 30 WAD | Buy: 60 WAD  
* Crafting: 2 Arcane Dust \+ 1 Crystal  
* Range: R(0-1), V1, Direct  
* *Magical restorative. Clears mental fatigue and strain.*

**Focus Draught**

* Effect: Target unit's next attack gains \+2 ACC  
* Mass: 1 | Bulk: 1 | Power: 0  
* Sell: 15 WAD | Buy: 30 WAD  
* Crafting: 1 Arcane Dust \+ 1 Medic Herbs  
* Range: R(0-1), V1, Direct  
* *Enhances perception and precision. Effect lasts until next attack.*

**Battle Banner**

* Effect: All allied units within 2 tiles gain \+1 ATK for 1 turn  
* Mass: 2 | Bulk: 3 | Power: 0  
* Sell: 45 WAD | Buy: 90 WAD  
* Crafting: 3 Treated Leather \+ 2 Medic Herbs  
* Range: R(0-2), V1, Self  
* *Deployable morale booster. Inspires nearby allies.*

### **Attack Consumables**

**Throwing Knife**

* Effect: Deal 2 damage ignoring DEF to target  
* Mass: 1 | Bulk: 0 | Power: 0  
* Sell: 10 WAD | Buy: 20 WAD  
* Crafting: 1 Metal Scrap \+ 1 Treated Leather  
* Range: R(1-3), V1, Direct  
* *Quick throwing weapon. Bypasses armor.*

**Firebomb**

* Effect: Deal 3 Fire damage and apply Burning status to all enemies in AoE(1)  
* Mass: 2 | Bulk: 2 | Power: 1  
* Sell: 35 WAD | Buy: 70 WAD  
* Crafting: 3 Processed Fuel \+ 1 Treated Leather \+ 1 Crystal  
* Range: R(1-3), V1, AoE(1)  
* *Explosive incendiary device. Creates lasting fire.*

**Shock Charge**

* Effect: Deal 2 Electric damage to all enemies in AoE(1) and apply Stunned (1 turn)  
* Mass: 2 | Bulk: 1 | Power: 2  
* Sell: 40 WAD | Buy: 80 WAD  
* Crafting: 2 Processed Fuel \+ 1 Metal Scrap \+ 1 Crystal  
* Range: R(1-2), V1, AoE(1)  
* *Electromagnetic pulse device. Disrupts enemy actions.*

## **Loadout Strategy**

**Capacity Considerations:**

* Each consumable contributes to total Mass/Bulk/Power load  
* Carrying many consumables \= higher load penalties (AGI reduction, jam chance, HP shocks)  
* Must balance: Combat utility vs. loadout capacity vs. material/equipment space

**Pre-Operation Planning:**

* Assess operation type: Boss-heavy ops \= more healing consumables  
* Consider team composition: Mechanical-heavy party \= more Repair Kits and Coolant Flasks  
* Account for expected battle length: Longer operations \= more consumables needed

**Risk/Reward:**

* Overloading consumables provides tactical flexibility but risks loadout collapse  
* Minimal consumables keeps load light but limits emergency options  
* Finding the balance is a core strategic element

## **Degradation**

Consumables stored in Forward Locker degrade like other items:

* **Degradation Rate**: 4-6 condition per battle (moderate)  
* **Worn (74-50)**: Contributes 120% to load calculations  
* **Damaged (49-25)**: Contributes 150% to load calculations; 10% chance to fail when used (item consumed but no effect)  
* **Critical (24-1)**: Contributes 200% to load calculations; 25% chance to fail when used  
* **Broken (0)**: Item destroyed and removed from inventory

**Mitigation:**

* Return to Base Camp for Workshop repairs  
* Use Tavern quick repairs (25 condition restored)  
* Abandon degraded consumables to reduce load  
* Consumables in Base Camp do not degrade

## **Console Notifications**

**Using Consumables:**

SLK//ACT  :: Use Item selected.

SLK//ITEM :: \[Item Name\] used on \[Target\].

SLK//HEAL :: \[Target\] restored 5 HP. \[12/20 HP\]

SLK//ITEM :: \[Item Name\] consumed. \[X remaining\]

**Degradation Warnings:**

SLK//WARN :: \[Item Name\] is damaged. May fail when used.

SLK//FAIL :: \[Item Name\] failed to activate\! Item lost.

**Capacity Warnings:**

SLK//LOAD :: Consumables contributing to overload.

SLK//WARN :: Consider reducing consumable quantity.

## **Tactical Tips**

**Emergency Reserve:**

* Keep 1-2 Medkits and 1-2 Arcane Elixirs minimum for emergencies  
* These are "insurance" against catastrophic failures

**Action Economy:**

* Using consumables costs a full turn \- plan accordingly  
* Best used when unit has no better actions available  
* Consider: Is healing worth more than attacking this turn?

**Shared Access Advantage:**

* Any unit can use any consumable  
* Position fast/low-value units to play "medic" role  
* Academic class often ideal consumable user (low attack power anyway)

**Consumable Combos:**

* Focus Draught → High-accuracy attack card \= almost guaranteed crit  
* Overcharge Cell → Gambit card \= massive burst damage  
* Smoke Canister → Reposition vulnerable units safely

**Boss Preparation:**

* Stock up before boss floors  
* Don't hoard \- use consumables liberally on tough fights  
* Running out is failure; dying with full inventory is waste

---

### **Special Ammo (Consumable Subtype)**

Special ammunition provides temporary bonuses to weapon attacks and is consumed on use. Unlike standard weapon ammo (which is unlimited and restored via reload actions), special ammo is a finite consumable resource.

**Usage:**

* Stored in Forward Locker with other consumables  
* Costs **1 full action** to use (same as medkits/repair kits)  
* Grants buff: "Next Attack: \[Effect\]"  
* Buff persists until consumed by a weapon attack  
* Item is removed from Forward Locker when buff triggers

**Visual Indicators:**

* Unit displays icon badge when special ammo loaded (💥 ❄️ 🔥 ⚡ etc.)  
* Weapon window shows: \[LOADED: Special Ammo Name\]  
* Console confirms when loaded and when consumed

**Tactical Use:**

* Best used before high-impact attacks (gambits, multi-hit cards, charged attacks)  
* Useful for boss fights, elite enemies, or breaking through heavy defenses  
* Action economy trade-off: Using special ammo costs a turn, must be worth the bonus

**Special Ammo Types:**

| Item | Effect | Mass | Bulk | Power | Cost | Recipe |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| Explosive Rounds | \+2 damage, AoE(1) | 2 | 1 | 0 | 50 WAD | 2 SM \+ 2 CS |
| Armor-Piercing Bolts | Ignore 4 DEF | 1 | 1 | 0 | 40 WAD | 2 SM \+ 1 SC |
| Frost Shells | Apply Rooted (2 turns) | 2 | 1 | 0 | 60 WAD | 2 CS \+ 1 W |
| Incendiary Arrows | Apply Burning (3 turns) | 1 | 1 | 0 | 45 WAD | 1 W \+ 2 CS |
| Shock Rounds | Chain to 1 adjacent enemy (50% dmg) | 2 | 2 | 1 | 70 WAD | 2 SC \+ 2 CS |
| Piercing Shot | Hit all enemies in line | 1 | 1 | 0 | 55 WAD | 2 SM \+ 1 CS |

*SM \= Metal Scrap, CS \= Chaos Shards, SC \= Steam Components, W \= Wood*

**Console Notifications:**

SLK//ACT  :: Use Item selected.

SLK//ITEM :: \[Ammo Name\] loaded. \[X remaining\]

SLK//BUFF :: Next attack: \[Effect description\].

\[When attacking\]

SLK//SPEC :: \[Ammo Name\] effect triggered\!

SLK//ITEM :: \[Ammo Name\] consumed. \[X remaining\]

Here is a **polished, ready-to-drop-in GDD insert** for **Option 4A: Sable as a Pure Companion Buff**.  
 It follows your existing Chaos Core doc tone and structure.

---

# **Sable (Lightweight Utility Companion)**

## **Overview**

Sable is a friendly dog companion who accompanies the player during Base Camp exploration and Field Node screens.  
 Sable provides emotional charm, environmental liveliness, and light gameplay utility without impacting the game’s core balance or tactical systems.

This feature is deliberately lightweight: Sable does **not** participate in main tactical battles, does not level up, and does not require management. Her role is supportive, ambient, and designed to improve player feel and pacing in Field Mode.

---

## **Design Goals**

* Make Base Camp and Field Node environments feel more alive and dynamic.

* Give players a sense of camaraderie without requiring complex companion systems.

* Smooth Field Node pacing by offloading trivial resource pickups.

* Introduce light automated enemy interactions without requiring player attention.

* Create delightful, low-commitment “micro-interactions” that enrich the experience.

---

## **Core Behaviors**

### **1\. Follow Behavior**

Sable follows the player through Base Camp and Field Nodes at a short distance, maintaining a natural, slightly lagged movement pattern:

* When the player moves, Sable jogs to catch up.

* When the player stops, Sable wanders briefly and then returns to their side.

* Sable never blocks the player or interacts with collision boundaries in a way that impacts navigation.

### **2\. Resource Fetching**

When resources are present within a defined detection radius, Sable will:

1. Detect the resource.

2. Run to its location.

3. Play a brief “retrieve” animation.

4. Automatically transfer the resource to the player’s inventory.

This allows Field Nodes to feel smoother and more fluid, reducing micro-collection fatigue.

**Important:**

* Sable fetches only low-value resources (scrap, wood, shards, etc.).

* Sable will not interact with high-value chests, rare drops, or interactable objects.

### **3\. Light Enemy Disruption**

Sable can engage **light-only enemies** in Field Nodes—these are small, low-threat creatures intended for pacing, not challenge.

Behavior:

* When a light enemy is within detection radius, Sable performs a quick dash attack.

* Dash deals small damage, typically defeating the enemy instantly.

* No player input required.

* Sable does NOT attack dungeon-floor enemies, story enemies, or any entity involved in tactical combat.

This maintains game balance while streamlining Field Node experience.

---

## **Non-Mechanical Flavor Behaviors**

* Occasional barks when spotting resources or light enemies.

* Sniffing idle animation when the player stops moving.

* Runs in circles or wagging tail when idle for extended periods.

* Contextual sitting animation near campfires, terminals, or when close to the player for \>3s.

These behaviors enhance world feel without requiring systemic complexity.

---

## **Rules & Constraints**

* Sable **cannot be harmed** and does not have HP.

* Sable does not appear in tactical battle screens.

* Sable cannot fetch items that require player confirmation or manual interaction (e.g., chests, terminals, recruitable characters).

* Sable only exists in:

  * Base Camp field map

  * Field Node rooms

* Sable disappears during transitions into tactical combat, floor maps, shops, or story cutscenes.

---

## **Implementation Notes**

### **Entity Definition**

Sable is defined as a lightweight autonomous agent in Field Mode:

Companion {

  id: "sable",

  x: number,

  y: number,

  state: "follow" | "fetch" | "attack" | "idle",

  speed: number,

}

### **Game Loop Integration**

Add updateCompanion() inside the Field Mode game loop:

* Follows player movement

* Periodically scans for:

  * Nearby low-value resources

  * Light enemies

* Switches state accordingly

### **Collision & Pathing**

* Sable uses simplified, non-blocking collision.

* She cannot push or inhibit the player’s movement.

* Pathfinding can be minimal (straight lines with simple avoidance).

---

## **UI / UX Considerations**

* A small icon or sound indicates Sable retrieved something.

* Optional: floating text like “Fetched \+1 Scrap”.

* Petting prompt (optional flavor):

  * "E — Pet Sable" when standing still near her in Base Camp.

A brief “heart” particle on pet reinforces charm without reward-systems creep.

---

## **Cut Feature Options (Not Included in 4A, but Expandable)**

These are deliberately excluded from this implementation to maintain scope simplicity but are compatible future expansions:

* Sable happiness/mood system

* Level-ups or ability unlocks

* Sable assisting in tactical battles

* Inventory interactions

* Special scent-based detection for rare items

---

## **Benefits of This System**

* Enhances emotional engagement without extra player effort.

* Makes Base Camp and Field Nodes feel “alive”.

* Reduces friction around minor tasks (resource pickup).

* Improves pacing and readability against light enemies.

* Strong aesthetic payoff for minimal mechanical risk.

---

If you want, I can also prepare:

* **Technical breakdown / implementation plan**

* **Cursor agent prompt to implement Sable**

* **Sprite and animation plan**

* **Sound design notes**

* **Mini-quest or narrative introduction for Sable**

Just tell me\!

# **Procedural Generation**

Dungeon floors generated from a pool of 20 pre-designed tactical maps and 10 exploration rooms, arranged procedurally.

Key room locations, enemy types, and resource caches are randomized each run. 

Room modifiers like hazards and special objectives are layered procedurally as well.

Difficulty is scaled linearly across floors.

# **Mini Core — Tactical Autonomy Simulations**

## **Overview**

**Mini Core** is an optional base-camp minigame that allows the player to run short, automated tactical simulations inside a fragment of the Chaos Core. Instead of directly controlling units, the player configures **AI behavior priorities and conditional logic**, then observes how the system resolves a micro-encounter.

Mini Core reinforces Chaos Core’s core themes of **systems mastery, emergent behavior, and strategic foresight**, while providing a low-stakes environment for experimentation and learning.

---

## **Design Goals**

* Provide a **systems-driven alternative** to direct tactical combat

* Teach Chaos Core’s mechanics implicitly through observation and iteration

* Reward thoughtful tuning and optimization rather than reflexes

* Reuse existing grid, unit, and battle logic with minimal new complexity

* Offer optional progression that enhances, but does not replace, core gameplay

---

## **Access & Context**

* Mini Core is accessed from the **Base Camp** via a dedicated terminal or Core fragment.

* Fictionally, Mini Core represents running **internal simulations** within the Chaos Core to refine tactical behavior.

* Participation is **optional**, but provides meaningful long-term benefits.

---

## **Core Gameplay Loop**

1. Select **Mini Core** at base camp

2. Choose a **simulation scenario**

3. Configure unit AI behavior

4. Run the simulation

5. Observe the outcome

6. Review performance feedback

7. Receive rewards and iterate

Each simulation lasts approximately **5–10 seconds**.

---

## **Simulation Structure**

### **Board**

* Small isometric grid (4×4 or 5×5)

* Fixed terrain and elevation per scenario

* Limited unit count (initially 1 ally vs 1–3 enemies)

### **Units**

* Units use the same stats, cards, and abilities as the main game

* No direct player input during simulation

* All actions are chosen by AI logic

---

## **AI Configuration System**

### **Priority Weights**

Players assign relative importance to targeting and behavior rules.

Example categories:

* **Target Selection**

  * Closest enemy

  * Lowest HP

  * Highest threat

* **Action Preferences**

  * Attack if in range

  * Reposition

  * Defend

  * Avoid danger zones

Internally, these are treated as numeric weights used during AI decision evaluation.

---

### **Conditional Logic (Unlockable)**

As Mini Core progression advances, players unlock conditional rules:

IF \[HP \< 40%\]

THEN \[Use Guard\]

IF \[Enemy in Melee Range\]

THEN \[Disengage\]

* Conditions and actions are drawn from a limited, curated pool

* Rules are evaluated in priority order

* This system allows for expressive behavior without requiring scripting knowledge

---

### **Card Assignment**

* Cards are assigned to **AI slots** instead of being played manually

* Each card includes usage conditions (e.g. “use if enemy enters range”)

* AI determines when and whether to use cards during simulation

---

## **Simulation Resolution**

* Simulations run automatically using the existing battle engine

* Units act in initiative order

* Pathfinding, targeting, and card usage are all AI-driven

* Player observes outcomes without interruption

---

## **Results & Feedback**

After each simulation, players receive a clear breakdown:

* Victory / Defeat

* Turns elapsed

* Damage dealt / damage taken

* Cards used or wasted

* Key AI decisions

Example feedback:

“Unit moved instead of attacking due to low attack priority.”

This feedback is intended to **teach the system**, not punish the player.

---

## **Rewards & Progression**

Mini Core rewards are **supplementary**, not mandatory:

* New AI rule slots

* Additional conditional logic options

* Minor passive buffs (e.g. \+1 ACC for next battle)

* Card behavior modifiers

* Cosmetic or lore-related unlocks

Mini Core does **not** grant large XP or replace standard combat rewards.

---

## **Difficulty Scaling**

Difficulty increases through:

* More complex terrain

* Conflicting incentives

* Limited rule slots

* Turn limits or efficiency goals

Enemy stats scale minimally; challenge comes from **optimization**, not attrition.

---

## **Failure States**

* Failed simulations simply end and provide feedback

* No permanent penalties

* Encourages experimentation and iteration

---

## **Scope & Implementation Notes**

* Mini Core reuses:

  * Existing grid rendering

  * Battle resolution logic

  * Unit stats and cards

* Requires:

  * Lightweight AI configuration UI

  * Simulation runner

  * Results summary screen

Designed to be implemented incrementally and expanded over time.

---

## **Summary**

Mini Core is a compact, systems-focused minigame that deepens player understanding of Chaos Core’s mechanics while reinforcing its themes of autonomy, foresight, and emergent strategy. It offers meaningful progression for players who enjoy optimization, without disrupting the main gameplay flow.

# **ScrollLink OS Codex & Lore Archive System**

## **1\. Overview**

The Chaos Core Codex is an in-game archival system that automatically records lore, characters, factions, technology, biomes, enemies, and historical events as the player encounters them. Its core purpose is to support worldbuilding, reward exploration, and reinforce the ScrollLink OS aesthetic by presenting lore as decrypted “SLK://DATASTREAM” files rather than typical fantasy logs.

The Codex evolves across the campaign and roguelite runs, growing as players scan enemies, find datashards, decrypt operations logs, or talk to NPCs. It functions both as a gameplay progression reward and a narrative deepening tool, encouraging players to explore every corner of Ardycia.

---

## **2\. UX / Presentation Style**

The Codex is presented as a terminal-style data archive inside ScrollLink OS.

Visual Style:

* Metallic purple/blue terminal frame (same motif as ShellLink and Base Camp)

* “DATA UNLOCKED” animation when a new entry is obtained

* Lines appear with typing animation (SLK//PARSING… → SLK//DECRYPT COMPLETE)

* Image pane optionally available for:

  * Character portraits

  * Enemy sprites

  * Field biome screenshots

  * Historical artifacts

* Background scanlines & subtle CRT hum

Player Flow

Base Camp → Codex Terminal → Categories → Entries

Entries start redacted and gradually fill in as the player uncovers more info.

---

## **3\. Codex Categories**

### **3.1 Characters**

Automatically adds entries when:

* A new hero joins

* An enemy lieutenant is fought

* An NPC is spoken to

* A mercenary is recruited

Each character entry includes:

* Portrait (hand-drawn or sprite-based)

* Class & PWR

* Known history

* Relationships

* Unlock progress (“???” until fully known)

Example Entry Snippet:

SLK//CHAR\_PROFILE:: ELISE HUONG  

ACCESS\_LEVEL: PARTIAL  

NOTES: Survivor. Diver. Vows carried from another century.


---

### **3.2 Factions**

Unlocked when encountering or completing missions involving factions.

Examples:

* Mistguard

* Company of Quills

* Albatross

* Shell AI Remnants

* Kestrel Raiders

* Mossy Rock Collective

Faction entries reveal:

* Goals & ideology

* Key leaders

* Historical timeline fragments

* Relationship map ≤ other factions

Entries expand mid-campaign as new intel is decrypted.

---

### **3.3 Technology Index (“TECHNICA”)**

Covers everything related to magitech, steampunk, and post-realist science:

* VOIDWEAVING

* CRISPR-Glyph Reactors

* Spire Cores

* Greatblades vs. Staves vs. Firearms

* ScrollLink OS Protocol Structure

* Shell AI origin logs (partially redacted early game)

Players unlock these via:

* Loot

* Mission rewards

* Talking to academics

* Discovering derelict tech ruins

* Crafting items at Workshop

---

### **3.4 Bestiary (SCAN\_LIBRARY)**

Unlocked by scanning enemies in battle or defeating them.

Contains:

* Enemy sprite

* Classification

* Weaknesses (revealed after X kills)

* Battle tips

* Drop tables

* Lore

Special:

* Boss entries have multi-page logs with animated SLK data corruption fx

* Chaos-corrupted variants add “anomalous entry pages”

---

3.5 Locations & Biomes (ATLAS)

As players clear dungeon floors or visit field nodes, the Codex populates:

* Maps (ASCII \+ renders)

* Climate conditions

* Local wildlife

* Resources and yields

* Historical & mystical notes

Mystery Dungeon-style floors contribute mini-logs, e.g.:

SLK//ATLAS\_NODE\_07-B :: FLORA ANOMALY DETECTED  

Ground moss emits faint temporal residue.

---

## **4\. Unlock Methods (Gameplay Integration)**

### **4.1 Auto-Unlock on Encounter (Idea \#1)**

As soon as the player sees a thing → Codex entry created (blank or partial).  
 As the player interacts more → more pages decrypt.

### **4.2 Collectible “Datashards” (Idea \#3)**

Found in:

* Field zones

* Operation floors

* Secret rooms

* Boss rewards

Shard types:

* Faction Shards (expand histories)

* Wildlife Shards (bestiary bonuses)

* Archive Shards (old world logs)

* Tech Shards (Shell AI files)

Some shards unlock:

* Unique art

* Audio logs

* Terminal recordings

### **4.3 “Corrupted Files” / Glitch Pages (Idea \#5)**

Early game lore about Shell AI and the Collapse is mostly:

* Redacted

* Corrupted

* Fragmented

* Out of order

As operations progress, the Codex begins auto-reassembling them:

SLK//REBUILD\_STATUS: 14%

WARNING: DATA SPOOL UNSTABLE

Unlockable via:

* Operation boss kills

* Chaos Shard offerings

* Narrative beats

* High PWR unit milestones

This preserves mystery, makes the world feel alive, and rewards long-term players.

---

## **5\. Gameplay Rewards & Incentives**

### **5.1 Codex EXP & Titles**

Reading entries gives player account titles:

* Archivist

* Lorebinder

* Chaos Archivator

* Shell Splicer

* Field Researcher

Achievements tied to Codex completion encourage exploration.

### **5.2 Mechanical Unlocks**

Upon completing certain collections:

* New classes (ex: Academic, Chaosmancer)

* New crafting recipes

* New workshop blueprints

* Card creation recipes

* New base camp decorations / NPC dialogue

### **5.3 NG+ Integration**

Codex carries over between runs (except certain scrambled Shell entries).

---

## **6\. UI / Navigation Mockup**

\[BASE CAMP TERMINAL\]

   ├── SLK://CODEX

   │     ├── Characters

   │     ├── Factions

   │     ├── Bestiary

   │     ├── Technica

   │     ├── Atlas

   │     └── Shell Files (LOCKED)

Clicking an entry opens a terminal-pane on left, portrait/sprite on right.

---

## **7\. Implementation Notes**

Front-end (your stack)

* Pure HTML/TS with terminal-styled CSS (matched to ScrollLink look)

* JSON data structure for entries (easy to expand)

* Unlock flags saved in GameState

* Decryption animation handled via CSS class toggles

* Portrait & sprite image support optional in early versions

Content Pipeline

* Writers can add entries as standalone JSON files

* Engine imports them at startup

* No need for bespoke CMS yet

Memory & Scaling

Codex entries are cheap — mostly text.  
 Images and portraits can be embedded or referenced.

# **Echo Runs (Draft Mode)**

## **Overview**

**Echo Runs** are a standalone Chaos Core game mode focused on **tactical experimentation and build expression**. Unlike Story Operations, Echo Runs are **non-canonical simulations** that allow players to rapidly test unit combinations, Field synergies, and strategic approaches through a draft-driven structure.

Echo Runs emphasize **player agency over randomness**, short run length, and high replayability. They are designed as a parallel experience to Story Operations rather than a replacement.

---

## **Design Goals**

* Provide a fast, repeatable mode for testing tactics and builds.

* Encourage creative combinations of Units and Fields.

* Remove narrative and long-term progression pressure.

* Serve as a safe environment for system experimentation and balance testing.

* Reward mastery without power creep.

---

## **Core Differences from Story Operations**

| Aspect | Story Operations | Echo Runs |
| ----- | ----- | ----- |
| Narrative | Canon | Non-canonical |
| Units | Persistent, recruited | Drafted, disposable |
| Fields | Gradually unlocked | Drafted per run |
| Failure | Story consequence | Run reset |
| Progression | Long-term | Run-scoped |
| Replay Focus | Moderate | High |

---

## **Echo Run Core Loop**

1. **Start Echo Run**

2. **Initial Draft Phase**

   * Draft starting units

   * Draft an initial Field (if any)

3. **Encounter Phase**

   * Complete a sequence of tactical encounters

4. **Inter-Encounter Drafts**

   * Choose one reward per stage:

     * Unit draft

     * Field draft or upgrade

     * Tactical modifier

5. **Run Conclusion**

   * Final encounter or endurance test

   * Results summary and unlock tracking

6. **Reset**

   * All run-specific units, fields, and effects are cleared

---

## **Drafting System**

### **Initial Unit Draft**

At the start of an Echo Run, the player constructs a temporary squad via drafting:

* The player is shown **3 randomly generated Unit Cards**

* Each card displays:

  * Portrait

  * Base Class

  * PWR Band (not exact value)

  * Affinity Lean (1–2 highlighted affinities)

  * Trait or modifier (optional)

* The player selects **1 unit**

* The draft repeats until the starting squad size is reached

Unselected units are removed from the pool for that run.

---

### **Field Drafting**

Fields are a core identity component of Echo Runs.

* Fields are primarily obtained via draft choices

* Each Field provides:

  * A positional or aura-based effect

  * Clear tactical constraints and advantages

* Fields may be:

  * Newly drafted

  * Upgraded versions of existing Fields

* Field drafts often replace or supplement unit drafts in later stages

Example draft choice:

* Ember Zone — Units within gain \+Damage

* Bastion Zone — Units within gain \+Defense but reduced Movement

* Flux Zone — Units within gain bonus Movement

---

### **Draft Bias & Synergy**

Draft options are semi-random and influenced by:

* Current squad composition

* Dominant affinities

* Existing Fields

* Run progression depth

The system gently nudges toward **complementary options** without dictating optimal play.

---

## **Units in Echo Runs**

* Units are **generated for the run only**

* No permanent XP, recruitment, or story identity

* Each unit has:

  * Seeded stats

  * A starting PWR appropriate to the run depth

  * Pre-weighted affinity tendencies

* Units may be lost without long-term consequence

This allows Echo Runs to support powerful or experimental unit combinations without destabilizing Story balance.

---

## **PWR & Affinity in Echo Runs**

### **PWR**

* Used as a visible signal of unit strength

* Displayed as a **band** early in a run

* Exact values may be revealed later or in detail views

### **Affinity**

* Units start with predefined affinity biases

* Limited affinity growth may occur during the run

* Affinities:

  * Influence Field effectiveness

  * Unlock or enhance draft options

  * Modify certain tactical interactions

Affinity growth in Echo Runs is faster than in Story Operations and is fully reset at run end.

---

## **Encounters & Progression**

* Echo Runs consist of a compact sequence of encounters

* Encounter types may include:

  * Standard combat

  * Elite challenges

  * Puzzle-like tactical tests

* Between encounters, the player makes a draft decision

* Run length is intentionally shorter than Story Operations

---

## **Optional Objectives (Echo Challenges)**

Each Echo Run may present optional **Echo Challenges**:

* Short, mechanical goals:

  * Win a battle without losses

  * Trigger a Field effect multiple times

  * Complete a fight within a turn limit

* Challenges are optional and do not block progress

* Success provides:

  * Extra draft choices

  * Rerolls

  * Score multipliers

---

## **Failure & Reset**

* Failure ends the Echo Run

* No permanent loss occurs

* A results screen summarizes:

  * Encounters completed

  * Units used

  * Fields drafted

  * Echo Challenges completed

* The player may immediately start a new Echo Run

---

## **Meta-Progression (Non-Power)**

Echo Runs contribute to meta unlocks without granting raw power:

* Unlock new:

  * Unit archetypes in the draft pool

  * Field types

  * Draft modifiers

* Cosmetic rewards (future expansion)

* Score-based achievements

Meta progression broadens options rather than increasing baseline strength.

---

## **UI & Presentation**

* Echo Runs use card-based draft UI

* Choices are clear, final, and low-friction

* The interface emphasizes:

  * Readability

  * Comparison

  * Commitment

Animations and presentation reinforce experimentation without implying narrative permanence.

---

## **Summary**

**Echo Runs** provide a focused, repeatable environment for tactical exploration within Chaos Core. By isolating drafting and experimentation from Story Operations, the mode allows both systems to thrive independently while sharing core mechanics and identity.

Echo Runs are intended to be:

* Quick to start

* Deep to master

* Safe to fail

* Fun to repeat

 

# **Multiplayer**

The game has three different multiplayer modes.

###  **Co-Op Operations**

* **Overview:** Two to four players team up to complete a single Operation from the campaign mode.  
* **Structure:** Players share the same Base Camp phase, resources, and overall Operation progression. Each player controls their own squad of units, manages their own decks/equipment, and coordinates movement and strategy during battles.  
* **Difficulty Scaling:** Enemy composition, number of reinforcements, and Operation Modifiers scale based on the number of players.  
* **Key Feature:** Shared resource management encourages communication- players decide who should spend resources for repairs, who leads an assault, and who plays support roles.

### **War Map** 

* **Overview:** A large, strategic map where two or more factions (comprised of two to four players) battle for control of regions.  
* **Structure:**  
  * Each region has its own “Operation”-like set of rooms and tactical encounters.  
  * Players choose missions from the active warfront and complete them to capture or defend zones.  
  * Victory Points (VP) from completed missions contribute to faction progress toward winning the war.

### **Squad**

* **Overview:** Competitive, head-to-head tactical matches between two players (or teams of two) using a draft system.  
* **Structure:**  
  * At the start of a match, players draft from a shared pool of units and equipment cards.  
  * No pre-built decks—forces improvisation and creative builds.  
  * Single-map tactical skirmish; matches last 15–30 minutes.  
* **Win Condition:** Eliminate all enemy units or fulfill a special map objective.  
* **Key Feature:** Low-commitment, skill-based matches with a constantly shifting meta from randomized draft pools.

# **UI (“Tactical Terminal” / ScrollLink OS v.2.3)**

**Core UI Style (90% Terminal)**

1. **Look:** Chunky 90s white-on-black CRT aesthetics with slight scanlines, rounded corners, and UI “bezel” elements that feel like they’re inside a handheld PDA.

2. **Animations:** Boot-up flicker, text typing in, loading bars (hashtag progress bar), blinking cursors.

3. **Navigation:** Grid-based menus, keyboard click sounds, old-school UI chimes.

**Justification in-universe:**  
 Aeriss’ **Solarix Scrollpad** is a surviving Old Earth PDA that’s still functional due to its AI core (half-believed to be a sprite). Most dungeon navigation, comms, maps, and reports are handled through it.

**Parchment/Physical Moments (10% Special UI)**

7. **AutoMap Printouts:** Player can “print” maps from the Scrollpad onto thermal-style parchment paper. UI transition \= terminal command \> printer animation \> parchment map UI pops up. This allows the player to see specific room layouts and plan ahead of time. 

8. **Battle Result Summaries:** Instead of just a “Victory” screen, show a faux-paper military report, with typed text, creases, stamps, and signatures.

9. **Card Deck Editing:** Styled as slotting “punch cards” into a machine. Each card animates sliding into place with a mechanical click.

10. **Dispatch Node / Fairhaven Mail:** Packages and letters arrive via the cargo elevator from Fairhaven. Open with physical letter animations or box unpacking mini-interactions.

11. **Aeriss’ Sketchbook:** Accessible via the Scrollpad’s “Lore & Bestiary” menu, but rendered as scanned pages from her sketchbook with her handwriting and doodles in the margins.

**Extra Flavor**

1. Dungeon control system could appear as a grid-based tactical map in the terminal, but printing the map gives you a parchment version with your marks and annotations.

# **Art, Audio, and Presentation**

Visuals: Hand-drawn art and animation

Character sprite size: 32x32 px.

Audio: Exciting orchestral score with atmospheric dungeon ambience.

# "Gumby" battle system

# **Status effects glossary**

* **Stunned**: You can take only 1 action on your turn; reactions disabled. Clears end of your next turn.

* **Dazed**: −1 die on attacks and checks. Clears at end of round.

* **Immobilized**: Speed becomes 0; you may still pivot/attack. Clears on successful check.

* **Rooted**: You can move but cannot climb (move vertically). Clears on successful check or when not engaged.

* **Suppressed**: −1 die to Ranged attacks; moving breaks Suppressed. Clears if you didn’t attack this turn.

* **Weakened**: Your attacks deal −1 damage (min 0). Clears on a rest action.

* **Vulnerable**: Incoming damage \+1. Ends after you suffer damage once or at end of round.

* **Guarded**: \+1 Defense vs next attack; consumed when used or at end of round.

* **Marked**: A specific enemy gets \+1 die to attack you; ends if you damage or lose LoS to them.

* **Burning**: Take 1 damage at end of your turn; clears on successful check.

* **Poisoned**: At end of round, suffer 1 damage and gain 1 Strain. Clear on check or antidote.

**Stacking**: same status doesn’t stack unless stated; reapplying refreshes duration.

**Order of operations**: end-of-turn effects → end-of-round effects.

# Deck Building

Each unit in Chaos Core builds a personal deck of ability cards before battle. The deck determines the actions they can take in combat.

## Deck Size

\- Each unit's deck must contain between 15 and 60 cards.

\- Decks can include any combination of Class, Equipment, Core, and Gambit cards, as long as equipment rules are followed.

## Equipment Rules

\- Weapons: No limit on the number of weapons a unit can equip.

\- Armor: Maximum 1 Chestpiece and 1 Helmet per unit.

\- Accessories: Maximum of 2 Accessories per unit.

\- Each piece of equipment adds its associated Equipment Cards into the deck.

## Multi-Weapon Loadouts

\- Equipping multiple weapons allows a unit to access all weapon cards in their deck during battle.

## Card Types

\- Class Cards \- Core abilities from the unit's class.

\- Equipment Cards \- Skills tied to specific weapons or armor.

\- Core Cards \- Universal actions like Guard, Move+, and Basic Attacks.

\- Gambit Cards \- Powerful situational skills that can be used when certain conditions are met.

# **Rules flow**

**Round Start**

1. **Refresh**: Reset per-round limits; remove “end of round” statuses.

2. **Initiative**: Per-round units activate highest AGI first; resolve ties by coin.

**On Unit turn**

1. **Start-of-Turn Triggers**: statuses that tick now (e.g., Burning)

2. **Action Economy**: You can use one of each action; **Reactions** happen off-turn.

   * **Move** (up to AGI; terrain applies)

   * **Activate cards from hand**

   * **Item**

3. **Strain**: If Strain \> **threshold**, you become **Strained** (e.g., lose a reaction and −1 action next turn) until you drop to threshold or below.

4. **End-of-Turn**: Resolve “end of turn” statuses (Burning, Poison damage, etc.), then pass play.

**Round End**

1. Resolve end-of-round effects; check scenario scoring.

2. If victory conditions met, end game; otherwise start next round.

# **Core combat formulas (playtest v0.1)**

**Dice:** d20 (single roll).  
**Roles of stats:**

* **ACC** (attacker) \= chance to land the hit.

* **AGI** (defender) \= how hard you are to hit.

* **ATK** (attacker) \= damage push.

* **DEF** (defender) \= damage soak.

# **1\) To hit**

Facing zone: before rolling, determine the attacker’s bearing relative to the defender’s facing:

* Front: forward, forward-left, forward-right

* Side: pure left or right

* Rear: back, back-left, back-right

Facing modifiers (F):

* Front: FACC \= \+0, FCRIT \= \+0

* Side:  FACC \= \+1, FCRIT \= \+0

* Rear:  FACC \= \+2, FCRIT \= \+2  (Rear adds \+2 to your “crit margin”; see below.)

Target Number (TN)

TN \= 10 \+ AGI\_defender \+ Cover \+ Status\_DEF

Cover values

* 0 \= no cover

* \+2 \= light cover (waist-high wall, foliage, corner graze)

* \+4 \= heavy cover (solid barrier, firing slit, defender mostly hidden)

* \+6 \= fortified (barricade/shield wall; rare, scenario-defined)

Attack Total

Attack Total \= d20 \+ ACC\_attacker \+ Aim/assist \+ FACC − Reaction\_Dodge

Hit check

Hit if Attack Total ≥ TN.

Result bands

* Crit: if (Attack Total − TN) ≥ (10 − FCRIT)

   (Rear makes crits 2 points easier: threshold 8 instead of 10.)

* Hit: if Attack Total − TN ≥ 0

* Miss: if \< −2

   (Natural 20 \= Crit; Natural 1 \= Miss.)

---

# **2\) Damage**

Base Damage

Base Damage \= Weapon\_Damage \+ ATK\_attacker

Facing armor bypass (Rear only):

* Front/Side: FDEF\_IGNORE \= 0

* Rear: FDEF\_IGNORE \= 1

Effective Damage (soak)

Effective Damage \= max(0, Base Damage − max(0, DEF\_defender − FDEF\_IGNORE))

On Crit

Add \+ATK\_attacker again after soak:

Crit Damage \= Effective Damage \+ ATK\_attacker

Design note (optional clarity): If a card already says “ignore X DEF,” use the higher of X or FDEF\_IGNORE (don’t stack) to keep rear attacks potent but not runaway with armor-pierce cards. If you’d rather make rear hits punchier, allow stacking instead.

# **Range**

Each attack lists: **Range** R(min–max), **Vertical Tolerance** V, **LoS** (Direct/Indirect), and any **AoE**.

**Distance metric (diamond/Manhattan):**  
 distance \= |dx| \+ |dy|. Targeting is legal if R\_min ≤ distance ≤ R\_max.

**Vertical tolerance:**  
 Legal only if |dz| ≤ V (difference in elevation “levels” between tiles).

**Line of Sight (Direct):**

* Draw a line from the center of attacker’s tile to the center of target’s tile.

* **Blocked** if the line crosses any **Blocking** edge (walls, tall rock).

* If at least one of the two corner-to-corner lines is clear, LoS is allowed.

# 

# 

# 

# 

# 

# **Flanking**

**Grid:** square; use **face-adjacent** (orthogonal) squares for melee.

**When it applies**

* You (attacker) are **adjacent** to the target, **and**

* At least one **ally is also adjacent** to the same target.

**Notes & edges**

* Diagonals don’t count for flanking (optional variant below).

* Large bases (2×2): being adjacent to **different edges** counts. Opposite edges \= **Full Flank**.

* Cover: melee flanking **ignores light cover** (heavy stays).

* You can’t claim Flank while **Prone** or **Immobilized**.

# **Marking**

A *status* you place on an enemy to guide fire.

**Apply a Mark**

* **Action:** **Mark** (**LoS** required, **R ≤ 5**).  
* Place a **Marked** token on the target. Only **one Mark per target** (new Mark overwrites).

**Effect**

* The **next attack** from **any one** of your team against that target gets **\+2** to **Attack Total**, then remove the token.  
* **Does not stack** with other Marks; it **does** stack with Flanking

**Duration / removal**

* Persists until consumed, **end of round**, or if the target **ends a turn out of LoS** from the marker.

# **Checks**

## Immobilized (break free)

Roll: D20 \+ ATK  
TN: 30

## Rooted (clear the impediment)

Roll: D20 \+ AGI  
TN: 30

## Burning (self extinguish)

Roll: D20 \+ DEF  
TN: 30  
Auto-clear: Being doused removes Burning without a roll.

# 

# 

# Weapon Mechanics

## Clutch

Each weapon has a clutch toggle that players can choose to activate when declaring core attacks or weapon skills. Some weapons also have double clutch toggles.

## Wear

Each time a Clutch toggle is used, mark \+1 Wear.

* Wear 1: −1 ACC  
* Wear 2+ \= w: −w ACC and −w DMG

## Heat 

Overview

* Applies to **mechanical weapons**: guns, crossbows, steam-powered melee weapons, gatling devices, etc.  
* **Non-mechanical weapons** (swords, bows, greatbows, etc.) are not affected.

---

Heat Accumulation

* **When Heat Builds**:  
  * **Core Cards** that involve the weapon add \+1 Heat.  
  * **Weapon Skill Cards** add \+1–3 Heat (depending on skill power).  
  * Certain **Gambit Cards** may add more Heat (up to \+4).  
* **Marking Heat**:  
  * Each affected weapon has a **Heat Track** (0–6) on its diagram.  
  * Heat is marked per weapon, not per character.

---

Heat Relief

* **Passive Cooling**: At the start of the character’s turn, reduce Heat by **1** automatically.  
* **Active Vent**: Spend your turn to fully cool the weapon.  
  * **Cost**: The weapon vents violently, causing **self-damage** (e.g., 10% max HP) due to steam burns or recoil.

---

Overheat Effects

If Heat reaches **Max Capacity**:

1. Weapon is **jammed** for the next turn.  
2. Player takes **minor damage** (10% max HP).  
3. Heat resets to 0\.

## Ammo

Some weapons expend ammo to use core and weapon cards- these weapons have a **Quick Reload** Strain cost and a **Full Reload** Strain cost. Quick Reload refills ammo halfway (rounded up), and Full Reload refills ammo completely.

## Weapon Hits

Each mechanical weapon has the following six numbered nodes:

1. **SIGHTS / STABILIZER**

2. **BARREL / EMITTER / EDGE**

3. **ACTION / DRAW / SERVO**

4. **POWER COUPLING / TENSIONER**

5. **HEAT SINK ARRAY**

6. **FEED PATH / MAG LATCH / QUIVER**

**When can a weapon get hit?**

After a unit takes damage from a Direct attack:

* Weapon Hit check: roll d6 → on 6 a weapon is struck.

  * If the attack was a Crit, it’s automatic (no roll).

  * AoE/Indirect: no check (unless the card says it can damage gear).

* If the defender has more than one weapon equipped, the defender gets to choose the targeted weapon.

**What got hit? (roll d6 on the diagram)**

Apply the **Damaged** effect. If that same node gets hit again, it becomes **Broken** (stronger effect). A third time → **Destroyed** (weapon offline until repaired).

**1\) SIGHTS / STABILIZER**

* *Damaged:* **–1 ACC** with this weapon; **Overwatch –2 ACC**.

* *Broken:* **–2 ACC** and this weapon **can’t Overwatch**.

**2\) BARREL / EMITTER / EDGE**

* *Damaged:* **Range –1 band** (min R(1)); **Arc/AoE radius –1** (min 0). For melee: **–1 damage**.

* *Broken:* **Can’t use Arc/AoE** cards with this weapon; melee still **–1 damage**.

**3\) ACTION / DRAW / SERVO**

* *Damaged:* **Multi-attack weapon cards** (e.g., Rapid Shot, Volley, Full Barrage) are **unplayable**; core attack is fine.

* *Broken:* After you play any **weapon card** with this weapon, roll **d6**: on **1–2** it **jams/fizzles** (no effect) and you take **Strain 1**.

**4\) POWER COUPLING / TENSIONER**

* *Damaged:* First **weapon card** you play each turn with this weapon costs **\+1 Strain**.

* *Broken:* This weapon gains **\+1 Heat** whenever it attacks (even if it normally has none; if heatless, treat as \+1 Strain instead).

**5\) HEAT SINK ARRAY**

* *Damaged:* **Max Heat –2** for this weapon; any effect that removes heat with this weapon removes **1 less** (min 0).

* *Broken:* You **can’t remove more than 1 Heat/turn** with this weapon; if you hit **Max Heat**, the next attack with this weapon **can’t be declared**.

**6\) FEED PATH / MAG LATCH / QUIVER**

* *Damaged:* **AM cost \+1** for weapon attacks; **Quick Reload** restores **1 fewer** (min 1).

* *Broken:* **Quick Reload fails** (no ammo gained); **Full Reload** only restores **half** (rounded up).

Repairs (no new cards needed)

* **Field Patch (Action):** take **Strain 1** → fix **one** node **down** a step (Broken→Damaged or Damaged→Cleared).

* **Synergy fixes:** when you resolve these **existing** effects, you may repair 1 matching node **one step**:

  * Any **Reload** → repair **Feed Path** one step.

  * Any **Heat removal/vent** (e.g., Cooling Discipline, Full Vent) → repair **Heat Sink** one step.

  * A **Guard/Brace** self-buff from this weapon (e.g., Blast Shield, Magnetic Guard) → repair **Sights** or **Action** one step (your choice).

Called shots (optional, for high-skill tables)

An attacker can declare **“target the weapon”** before rolling:

* **–3 ACC** to the attack.

* On **Hit**, skip the Weapon Hit check and **roll the diagram immediately**.

* On **Crit**, escalate **two steps** (OK→Broken or Damaged→Destroyed).

# Sample Win Conditions 

### **1\. Elimination-Based**

* **Defeat All Enemies**  
  Clear the map of all opposing units to win.  
* **Leader Kill**  
  Defeat the enemy commander unit; other enemies retreat immediately.  
* **Attrition Victory**  
  Survive and maintain at least one unit alive for **X turns** while enemy reinforcements spawn.

---

### **2\. Objective Control**

* **Hold the Line**  
  Maintain control of **two or more objective squares** for **3 consecutive turns**.  
* **King of the Hill**  
  At the end of the battle, hold the central high-ground tile (highest height value).  
* **Domination**  
  Capture all objective points before turn limit expires.

---

### **3\. Timed & Escape Scenarios**

* **Timed Extraction**  
  Survive until turn **X**, then move your commander to the extraction point.  
* **Breakthrough**  
  Move **at least half** your deployed units to the far side of the map.  
* **Run the Gauntlet**  
  Move through a map with constant enemy reinforcements and exit in under **Y turns**.

---

### **4\. Resource & Rescue Missions**

* **Supply Run**  
  Collect **X resource crates** scattered across the map before the enemy secures them.  
* **Escort Duty**  
  Move an NPC unit safely from one edge of the map to another without them dying.  
* **Prisoner Rescue**  
  Reach and escort a captured ally unit to an extraction point.

# Roadmap and Checklist

Chaos Core Development Roadmap & Checklist

- [ ] 

# Appendices

# Gear Index

## Mechanical Weapons

1. Emberclaw Repeater (Repeating Rifle) – Gear ID: MW001  
    Heat Capacity: 8  
    Heat Zones: 0–3 Stable | 4–6 Barrel Glow (ACC –1) | 7–8 Critical (next shot overheats)  
    Overheat Behavior: Locks for 1 turn; takes 2 strain to clear.  
    Passive Heat Decay: 2 per turn.  
    Heat Conversion Ability: Discharge excess heat to deal 1 unblockable damage to all adjacent enemies.  
    Ammo: Max 6 | Quick Reload (Strain) 1 | Full Reload (Strain) 0 | Core/Overwatch: AM1  
    Clutch Toggle: Piercing Volley — Ignore target’s DEF for next attack.  
2. Steamburst Pike (Pneumatic Lance) – Gear ID: MW002  
    Heat Capacity: 5  
    Heat Zones: 0–2 Stable | 3–4 Pressure Surge (+1 damage, risk self-hit) | 5 Overload (forced exhaust)  
    Overheat Behavior: Pushes the user back 1 tile and deals 2 self-damage.  
    Passive Heat Decay: 1 per turn.  
    Heat Conversion Ability: Release steam to create a 2×2 smoke screen.  
    Clutch Toggle: Pierce & Pin — Attack prevents target movement next turn.  
3. Vulcan Coilgun (Gauss Rifle) – Gear ID: MW003  
    Heat Capacity: 10  
    Heat Zones: 0–4 Stable | 5–7 Coil Strain (MOV –1) | 8–10 Overcharge (next shot doubles damage, forces exhaust)  
    Overheat Behavior: Cards tied to this weapon are disabled for 2 turns.  
    Passive Heat Decay: 3 per turn.  
    Heat Conversion Ability: Redirect heat to self-heal 1 HP.  
    Ammo: Max 4 | Quick Reload (Strain) 1 | Full Reload (Strain) 0 | Core/Overwatch: AM1  
    Clutch Toggles: Power Shot — \+2 damage; Magnetic Pull — Pull target 1 tile closer.  
4. Brassback Scattergun (Steam Shotgun) – Gear ID: MW004  
    Heat Capacity: 6  
    Heat Zones: 0–2 Stable | 3–4 Spread Boost (+1 range) | 5–6 Jammed (must exhaust to clear)  
    Overheat Behavior: Skips next attack phase.  
    Passive Heat Decay: 1 per turn.  
    Heat Conversion Ability: Shunt heat into a cone blast knockback.  
    Ammo: Max 2 | Quick Reload (Strain) 1 | Full Reload (Strain) 0 | Core/Overwatch: AM1  
    Clutch Toggle: Slug Round — Range 1 but damage doubled.  
5. Ironwhisper Crossbow (Steam-Drawn Crossbow) – Gear ID: MW005  
    Heat Capacity: 4  
    Heat Zones: 0–1 Stable | 2–3 Draw Assist (+1 ACC) | 4 Burnout (lose next turn)  
    Overheat Behavior: Destroys current loaded bolt (waste card).  
    Passive Heat Decay: 2 per turn.  
    Heat Conversion Ability: Convert heat into explosive bolt (+2 damage).  
    Ammo: Max 1 | Quick Reload (Strain) 1 | Full Reload (Strain) 0 | Core/Overwatch: AM1  
    Clutch Toggle: Silenced Shot — Cannot be countered or alert enemies.  
6. Stormlash Arcstaff (Electro-Steampunk Staff) – Gear ID: MW006  
    Heat Capacity: 9  
    Heat Zones: 0–4 Stable | 5–6 Spark Chain (AOE \+1 radius) | 7–9 Surge (randomly target friend or foe)  
    Overheat Behavior: Stuns the wielder for 1 turn.  
    Passive Heat Decay: 1 per turn.  
    Heat Conversion Ability: Discharge into ground to clear traps.  
    Clutch Toggle: Overload Blast — All targets in range take 1 electric damage.  
7. Blazefang Saber (Steam-Heated Sword) – Gear ID: MW007  
    Heat Capacity: 5  
    Heat Zones: 0–2 Stable | 3–4 Blade Sear (+1 damage) | 5 Blade Warp (damage –2 until repaired)  
    Overheat Behavior: Permanently reduces max capacity by 1 for the match.  
    Passive Heat Decay: 1 per turn.  
    Heat Conversion Ability: Transfer heat to ignite ground for 1 turn.  
    Clutch Toggles: Searing Slash — Inflict Burn; Quick Draw — Attack without consuming movement.  
8. Gearspike Mortar (Steam Mortar) – Gear ID: MW008  
    Heat Capacity: 7  
    Heat Zones: 0–3 Stable | 4–6 Blast Boost (+1 tile radius) | 7 Overpressure (self-hit if in range)  
    Overheat Behavior: Self-damage 3\.  
    Passive Heat Decay: 2 per turn.  
    Heat Conversion Ability: Fire smoke rounds to obscure vision.  
    Ammo: Max 2 | Quick Reload (Strain) 1 | Full Reload (Strain) 0 | Core/Overwatch: AM1  
    Clutch Toggle: Bunker Buster — Ignores cover and destroys obstacles.  
9. Emberdrake Harpooner (Steam Harpoon Gun) – Gear ID: MW009  
    Heat Capacity: 6  
    Heat Zones: 0–2 Stable | 3–5 Reel Boost (pull \+1 tile) | 6 Snapback (stuns wielder)  
    Overheat Behavior: Cord breaks, weapon disabled for 2 turns.  
    Passive Heat Decay: 1 per turn.  
    Heat Conversion Ability: Reel heat into cord to set it alight.  
    Ammo: Max 1 | Quick Reload (Strain) 1 | Full Reload (Strain) 0 | Core/Overwatch: AM1  
    Clutch Toggle: Anchor Pull — Pull self to target.  
10. Thunderjaw Cannon (Rotary Steam Cannon) – Gear ID: MW010  
     Heat Capacity: 12  
     Heat Zones: 0–5 Stable | 6–9 Firestorm (AOE bonus damage) | 10–12 Critical Overdrive (massive damage, then exhaust)  
     Overheat Behavior: Deck loses 1 random weapon card permanently for battle.  
     Passive Heat Decay: 2 per turn.  
     Heat Conversion Ability: Vent heat as damaging shockwave to all adjacent units.  
     Ammo: Max 3 | Quick Reload (Strain) 2 | Full Reload (Strain) 1 | Core/Overwatch: AM1  
     Clutch Toggles: Full Barrage — Extra attack at –2 ACC; Suppressive Fire — Targets lose 1 MOV next turn.

## **Non-Mechanical Weapons**

**Swords**  
 11\. Iron Longsword — ATK \+2, DEF \+1, AGI 0, ACC \+1, HP 0  
 Clutch Toggle: Edge Focus — Gain \+2 ACC for the attack, but \-1 DEF until your next turn.

12. Runed Shortsword — ATK \+1, DEF 0, AGI \+2, ACC \+2, HP \-1  
     Clutch Toggle: Quick Strike — Attack first this round regardless of initiative, but suffer \-2 ACC on the attack.

13. Scissor Sword — ATK \+3, DEF \+1, AGI \-1, ACC 0, HP 0  
     Clutch Toggles: Overhand Smash — Deal \+3 ATK damage, but suffer \-3 AGI until your next turn. Defensive Guard — \+2 DEF until your next turn, but \-2 ATK.

**Bows**  
 14\. Elm Recurve Bow — ATK \+2, DEF 0, AGI \+1, ACC \+2, HP \-1  
 Ammo: Max 6 | Quick Reload (Strain) 1 | Full Reload (Strain) 0 | Core/Overwatch: AM1  
 Clutch Toggle: Piercing Arrow — Ignore 2 DEF for this shot, but \-1 ACC.

15. Composite Greatbow — ATK \+4, DEF 0, AGI \-2, ACC \+1, HP 0  
     Ammo: Max 6 | Quick Reload (Strain) 1 | Full Reload (Strain) 0 | Core/Overwatch: AM1  
     Clutch Toggle: Volley — Fire twice at \-3 ACC each shot.

16. Willow Shortbow — ATK \+1, DEF 0, AGI \+3, ACC \+2, HP \-2  
     Ammo: Max 6 | Quick Reload (Strain) 1 | Full Reload (Strain) 0 | Core/Overwatch: AM1  
     Clutch Toggles: Armor Breaker — Ignore 4 DEF on the attack. Heavy Draw — \+4 ATK damage but skip your next move action.

**Staves**

17\. Oak Battlestaff — ATK \+1, DEF \+2, AGI 0, ACC \+1, HP \+1                                            Clutch Toggle: Channel Power — Next skill costs 1 less strain, but suffer \-1 DEF until your next turn.

18\. Silver Channeling Rod — ATK \+2, DEF 0, AGI \+1, ACC \+3, HP \-1  
Clutch Toggle: Focus Shot — \+3 ACC to next skill card this turn, but \-1 AGI next turn.

19\. Blackwood Greatstaff — ATK \+3, DEF \+1, AGI \-1, ACC \+2, HP 0  
Clutch Toggles: Ward Pulse — Gain \+3 DEF until next turn. Crush Swing — \+3 ATK but \-3 ACC.

**Daggers**

20\. Steel Dagger — ATK \+1, DEF 0, AGI \+3, ACC \+2, HP \-1                                                Clutch Toggle: Lunge — Move 2 tiles before striking without provoking attacks, but \-2 ACC.

21\. Ivory Fangblade — ATK \+2, DEF 0, AGI \+2, ACC \+3, HP \-2  
Clutch Toggle: Flurry — Attack twice at \-2 ATK per hit.

22\. Weighted Dagger — ATK \+2, DEF \+1, AGI \+1, ACC \+2, HP 0  
Clutch Toggles: Precision Cut — Ignore 3 DEF. Feint — Cancel the enemy’s counterattack if the attack misses.

## Helmets

23\. Ironguard Helm — DEF \+2, HP \+1

24\. Ranger’s Hood — AGI \+2, ACC \+1

25\. Mystic Circlet — ACC \+2, ATK \+1

26\. Thief’s Bandana — AGI \+3

27\. Scholar’s Cap — LUK \+2, DEF \+1

28\. Brass Visor — DEF \+1, ACC \+2

29\. Hunter’s Coif — ACC \+1, ATK \+1, AGI \+1

30\. Steamweld Goggles — ACC \+3

31\. Battle Mask — DEF \+1, HP \+2

32\. Arcane Hood — ACC \+1, LUK \+2

33\. Marksman’s Scope Visor — ACC \+3, DEF \-1

34\. Warrior’s Crest — ATK \+2, HP \+1

## Chestpieces

35\. Steelplate Cuirass — DEF \+3, HP \+2

36\. Leather Jerkin — AGI \+1, DEF \+1

37\. Mage’s Robe — ACC \+2, LUK \+1

38\. Shadow Cloak — AGI \+2, DEF \-1, LUK \+1

39\. Scholar’s Vest — LUK \+2, DEF \+1

40\. Chainmail Hauberk — DEF \+2, HP \+1

41\. Steamline Armor — DEF \+1, AGI \+2

42\. Hunter’s Vest — ACC \+1, AGI \+2

43\. Reinforced Gambeson — DEF \+2, HP \+1

44\. Battle Harness — ATK \+2, DEF \+1

45\. Arcane Tunic — ACC \+1, LUK \+2

46\. Marksman’s Brigandine — ACC \+3, DEF \-1

## Accessories 

47\. Steel Signet Ring — DEF \+1, LUK \+1

48\. Eagle Eye Lens — ACC \+2

49\. Fleetfoot Anklet — AGI \+2

50\. Rune Pendant — LUK \+3

51\. Power Bracer — ATK \+2

52\. Vitality Charm — HP \+2

53\. Steam Valve Wristguard — DEF \+1, ACC \+1

54\. Hunter’s Talisman — ACC \+1, AGI \+1

55\. Scholar’s Quill Pendant — LUK \+2, ACC \+1

56\. Smoke Bomb Satchel — AGI \+1, DEF \-1, special escape ability

57\. Warrior’s Belt — ATK \+1, HP \+1

58\. Arcane Crystal Brooch — ACC \+1, LUK \+1, DEF \-1

# Enemy Index

### **Operation Iron Gate – Secure the Chaos Rift entrance (introductory foes)**

* **Light**  
  * Pudding – Small, chaotic blobs of Dynara energy.  
  * Skootler – Mutated spiders gnawing at supply caches.  
  * Detachable Heads – Rabid, mechanical-dynara hybrids.

* **Medium**  
  * Chaos Knight \- Bat-like humanoids.  
  * Chaos Militia – Lightly armed human cultists.  
  * Goo \- Big, chaotic blobs of Dynara energy.

* **Heavy (boss, 4x4)**  
  * Rift Guardian – A hulking crystal-imbued beast blocking the gate.

    

### **Operation Black Spire – Capture enemy artillery positions (siege escalation)**

* **Light**  
  * Watcher – Winged pyromancers that harass from range.  
  * Sapper Gremlins – Plant mines and sabotage devices.  
  * Chaos Bub – Stalk through low-visibility areas.

* **Medium**  
  * Artillery Crewmen – Operate cannons and call bombardments.  
  * Rober \-   
  * Skulta Shaman – Buff nearby enemies, weaken player units.

* **Heavy**  
  * Siege Behemoth – A living artillery engine fused with cannons.

### **Operation Ghost Run – Disrupt enemy supply lines (mobility & ambush heavy)**

* **Light**  
  * Carrion Crows – Bird swarms that dive and peck.  
  * Marauder Scouts – Hit-and-run skirmishers.  
  * Dynara Wisps – Blink across tiles and harass with magic.

* **Medium**  
  * Supply Raiders – Dual-blade fighters guarding stolen goods.  
  * Chess Knights –  
  * Rift Juggernauts – Shieldbearers that block chokepoints.

* **Heavy**  
  * Phantom Stalker – A massive cloaked predator that phases in and out.

### **Operation Ember Siege – Destroy key enemy fortifications (fortress defenders)**

* **Light**  
  * Emberlings – Fire-spitting salamanders crawling on walls.  
  * Bomb Drones – Mechanical drones that divebomb fortifications.  
  * Chaos Slaves – Shackled, unstable fighters forced into battle.

* **Medium**  
  * Scuttler  
  * Chaos Wraith – Area-denial mages creating fire zones.  
  * Chaos Golems – Medium constructs patrolling fortress walls.

* **Heavy**  
  * Infernal Colossus – A towering construct fused into the fortress wall.

### **Operation Final Dawn – Assault the enemy command center (endgame threats)**

* **Light**  
  * Rift Shades – Shadow duplicates of the player’s team.  
  * Goylej  
  * Void Drones – Machine overseers of the command chamber.

* **Medium**  
  * Rift Warlocks – High-ranking dynara sorcerers.  
  * Commander’s Guard – Elite human warriors with mixed gear.  
  * Screecher

* **Heavy**  
  * The Rift Tyrant – Command center’s final guardian, a 4x4 nightmare.

# Card Index

## Core Cards

000 — Move+ — Move 2 extra tiles this turn. Strain: 1\. Range: R(0–0), V0, N/A

001 — Basic Attack — Standard attack on enemy. Strain: 0\. Range: R(1–1), V1, Direct

002 — Aid — Restore small amount of HP to ally. Strain: 1\. Range: R(1–2), V1, Direct

003 — Overwatch — Attack enemy that enters range. Strain: 1\. Range: R(2–5), V2, Direct

## Class Cards

004 — Squire: Power Slash — Deal heavy melee damage to one enemy. Strain: 2\. Range: R(1–1), V1, Direct

005 — Squire: Shield Wall — Reduce damage taken by all allies for 1 turn. Strain: 3\. Range: R(0–0), V0, N/A

006 — Squire: Rally Cry — Boost ATK of all allies for 2 turns. Strain: 2\. Range: R(0–0), V0, N/A

007 — Ranger: Pinning Shot — Immobilize an enemy for 1 turn. Strain: 2\. Range: R(2–5), V2, Direct

008 — Ranger: Volley — Deal light damage to all enemies in range. Strain: 3\. Range: R(3–6), V2, Indirect, AoE

009 — Ranger: Scout’s Mark — Reveal all enemies and traps in range. Strain: 1\. Range: R(0–6), V3, N/A

010 — Magician: Arcane Bolt — Deal moderate magic damage to an enemy. Strain: 2\. Range: R(2–6), V3, Direct

011 — Magician: Mana Burst — Deal heavy AoE magic damage. Strain: 3\. Range: R(2–4), V2, Indirect, AoE

012 — Magician: Barrier — Grant magic shield to an ally. Strain: 2\. Range: R(1–3), V2, Direct

013 — Thief: Steal — Take an item from the target. Strain: 1\. Range: R(1–1), V1, Direct

014 — Thief: Backstab — Deal high damage if behind enemy. Strain: 2\. Range: R(1–1), V1, Direct

015 — Thief: Smoke Bomb — Reduce enemy accuracy for 2 turns. Strain: 2\. Range: R(0–2), V1, Indirect, AoE

016 — Academic: Analyze — Reveal enemy stats and weaknesses. Strain: 1\. Range: R(0–6), V3, N/A

017 — Academic: Tactics Shift — Reposition an ally instantly. Strain: 2\. Range: R(1–4), V2, Direct

018 — Academic: Inspire — Reduce strain of all allies by 1\. Strain: 2\. Range: R(0–0), V0, N/A

## Equipment Cards (grouped by equipment)

019 — Iron Longsword: **Cleave** — R(1), V1, Arc — Deal 3 damage to up to 3 adjacent enemies.

020 — Iron Longsword: **Parry Readiness** — R(1), V1, Direct — If attacked before your next turn, cancel 1 attack.

021 — Iron Longsword: **Guarded Stance** — R(Self) — \+2 DEF until your next turn.

022 — Runed Shortsword: **Twin Cut** — R(1), V1, Direct — Two attacks, each dealing 2 damage.

023 — Runed Shortsword: **Quick Reposition** — R(Self) — Move up to 3 tiles ignoring engagement.

024 — Runed Shortsword: **Arcane Guard** — R(Self) — Gain \+2 DEF against magic attacks for 1 turn.

025 — Scissor Sword: **Breaker Chop** — R(1), V1, Direct — Deal 5 damage and reduce target DEF by 1 for 1 turn.

026 — Scissor Sword: **Guard Break** — R(1), V1, Direct — Reduce target DEF by 2 for 1 turn.

027 — Scissor Sword: **Counter Brace** — R(Self) — If attacked, make a counterattack at –2 ATK.

028 — Elm Recurve Bow: **Pinpoint Shot** — R(3–6), V1, Direct — Deal 4 damage; \+1 ACC for this attack.

029 — Elm Recurve Bow: **Warning Shot** — R(3–6), V1, Direct — Target suffers –2 ACC for 1 turn.

030 — Elm Recurve Bow: **Defensive Draw** — R(Self) — \+1 DEF and \+1 ACC until your next attack.

031 — Composite Greatbow: **Overdraw** — R(4–7), V1, Direct — Deal 5 damage; –2 ACC for this attack.

032 — Composite Greatbow: **Pin Down** — R(4–7), V1, Direct — Target cannot move more than 2 tiles next turn.

033 — Composite Greatbow: **Long Sight Guard** — R(Self) — Ignore first overwatch attack against you this turn.

034 — Willow Shortbow: **Rapid Shot** — R(3–5), V1, Direct — Three attacks, each dealing 2 damage.

035 — Willow Shortbow: **Tag Mark** — R(3–5), V1, Direct — Mark target; allies gain \+2 ACC when attacking them for 1 turn.

036 — Willow Shortbow: **Quick Cover** — R(Self) — Gain \+2 DEF if you move at least 2 tiles this turn.

037 — Oak Battlestaff: **Blunt Sweep** — R(1–2), V1, Arc — Deal 3 damage to all enemies in a 90° arc.

038 — Oak Battlestaff: **Deflective Spin** — R(1), V1, Arc — Block next ranged attack from enemies in arc.

039 — Oak Battlestaff: **Ward Spin** — R(Self) — Block first melee hit until next turn.

040 — Silver Channeling Rod: **Piercing Ray** — R(2–4), V2, Direct — Deal 4 damage; ignores 1 DEF.

041 — Silver Channeling Rod: **Magic Echo** — R(2–4), V2, Direct — Target takes \+1 magic damage from all sources for 2 turns.

042 — Silver Channeling Rod: **Barrier Pulse** — R(1–2), V1, Direct — Grant \+2 DEF to ally.

043 — Blackwood Greatstaff: **Crushing End** — R(1), V1, Direct — Deal 6 damage but –2 AGI next turn.

044 — Blackwood Greatstaff: **Zone Control** — R(1–3), V1, AoE(1) — Difficult terrain for enemies for 1 turn.

045 — Blackwood Greatstaff: **Earth Ward** — R(Self) — Cannot be knocked down or moved until next turn.

046 — Steel Dagger: **Throat Jab** — R(1), V1, Direct — Deal 3 damage and reduce target ACC by 2 next turn.

047 — Steel Dagger: **Hamstring** — R(1), V1, Direct — Target loses 2 movement next turn.

048 — Steel Dagger: **Sidestep** — R(Self) — Gain \+3 AGI until end of turn.

049 — Ivory Fangblade: **Frenzy Stab** — R(1), V1, Direct — Deal 4 damage; you suffer 1 self-damage.

050 — Ivory Fangblade: **Disarm Flick** — R(1), V1, Direct — Target cannot use weapon cards next turn.

051 — Ivory Fangblade: **Retreat Guard** — R(Self) — Gain \+2 DEF if you move this turn.

052 — Weighted Dagger: **Pommel Smash** — R(1), V1, Direct — Deal 3 damage; target loses movement next turn.

053 — Weighted Dagger: **Feint Draw** — R(Self) — Gain \+2 AGI for 1 turn.

054 — Weighted Dagger: **Deflect Grip** — R(Self) — Ignore first melee attack this turn.

Helmets

055 — Ironguard Helm: **Headbutt** — R(1), V1, Direct — Deal 2 damage and stun for 1 turn.

056 — Ironguard Helm: **Shield Sight** — R(Self) — Ignore flanking penalties until your next turn.

057 — Ironguard Helm: **Shield Headbutt** — R(1), V1, Direct — Stun target for 1 turn.

058 — Ranger’s Hood: **Aimed Strike** — R(2–4), V1, Direct — Deal 3 damage with \+1 ACC.

059 — Ranger’s Hood: **Hunter’s Mark** — R(3–5), V1, Direct — Mark target; next ranged attack deals \+2 damage.

060 — Ranger’s Hood: **Hide in Shadows** — R(Self) — Gain \+2 AGI and untargetable at range for 1 turn.

061 — Mystic Circlet: **Mind Spike** — R(2–3), V2, Direct — Deal 4 magic damage.

062 — Mystic Circlet: **Spell Focus** — R(Self) — Your next magic skill gains \+3 ACC.

063 — Mystic Circlet: **Mana Barrier** — R(Self) — Reduce incoming magic damage by 2 until next turn.

064 — Thief’s Bandana: **Neck Slash** — R(1), V1, Direct — Deal 4 damage if attacking from side or rear.

065 — Thief’s Bandana: **Blind Step** — R(Self) — Move 2 tiles without provoking overwatch.

066 — Thief’s Bandana: **Evasive Step** — R(Self) — Gain \+3 AGI until your next turn.

067 — Scholar’s Cap: **Book Slam** — R(1), V1, Direct — Deal 3 damage and reduce enemy LUK by 2\.

068 — Scholar’s Cap: **Quick Study** — R(Self) — Reveal one hidden trap within 4 tiles.

069 — Scholar’s Cap: **Insight Guard** — R(Self) — Ignore first negative status effect this turn.

070 — Brass Visor: **Flash Flare** — R(2–3), V1, Cone — Deal 2 damage to all in cone; blind 1 turn.

071 — Brass Visor: **Glint Distraction** — R(2–3), V1, Cone — Enemies in cone have –1 ACC for 1 turn.

072 — Brass Visor: **Glare Shield** — R(Self) — Melee attackers suffer –1 ACC for 1 turn.

073 — Hunter’s Coif: **Quick Shot** — R(2–5), V1, Direct — Deal 3 damage.

074 — Hunter’s Coif: **Tracking Shot** — R(2–4), V1, Direct — Reveals target’s movement path for 1 turn.

075 — Hunter’s Coif: **Predator’s Brace** — R(Self) — First enemy to attack you loses 1 DEF.

076 — Steamweld Goggles: **Scald Burst** — R(1–2), V1, Cone — Deal 3 damage and inflict Burn 1 turn.

077 — Steamweld Goggles: **Steam Flash** — R(1–2), V1, Cone — Blind enemies in cone for 1 turn.

078 — Steamweld Goggles: **Flash Shield** — R(Self) — Blind melee attacker for 1 turn when hit.

079 — Battle Mask: **War Cry Strike** — R(1), V1, Direct — Deal 3 damage; gain \+1 ATK for 1 turn.

080 — Battle Mask: **War Chant** — R(Self) — Allies within 2 tiles gain \+1 ATK for 1 turn.

081 — Battle Mask: **Rally Shout** — R(Self) — All allies within 2 tiles gain \+1 DEF for 1 turn.

082 — Arcane Hood: **Mystic Lash** — R(2–4), V2, Direct — Deal 3 magic damage.

083 — Arcane Hood: **Rune Sense** — R(Self) — Next magic attack ignores LoS.

084 — Arcane Hood: **Rune Shield** — R(Self) — Gain \+2 DEF and immunity to magic debuffs this turn.

085 — Marksman’s Scope Visor: **Sniper Shot** — R(4–8), V1, Direct — Deal 5 damage; –3 ACC next turn.

086 — Marksman’s Scope Visor: **Precision Call** — R(Self) — Next attack ignores range penalties.

087 — Marksman’s Scope Visor: **Head Tilt Guard** — R(Self) — Ignore critical hits until your next turn.

088 — Warrior’s Crest: **Overhead Smash** — R(1), V1, Direct — Deal 4 damage; \+1 DEF next turn.

089 — Warrior’s Crest: **Intimidate** — R(1–2), V1, Direct — Target suffers –1 ATK for 1 turn.

090 — Warrior’s Crest: **Crest Stand** — R(Self) — If HP \< 50%, gain \+2 DEF and \+1 ATK.

Chestpieces

091 — Steelplate Cuirass: **Shoulder Charge** — R(1), V1, Direct — Deal 3 damage; push target 1 tile.

092 — Steelplate Cuirass: **Fortify** — R(Self) — Gain immunity to knockback until next turn.

093 — Steelplate Cuirass: **Fortress Form** — R(Self) — Gain \+3 DEF but movement –1 this turn.

094 — Leather Jerkin: **Knife Toss** — R(2–3), V1, Direct — Deal 2 damage; \+1 AGI next turn.

095 — Leather Jerkin: **Quick Roll** — R(Self) — Move 1 tile as a free action.

096 — Leather Jerkin: **Light Guard** — R(Self) — \+1 DEF and \+1 AGI until next turn.

097 — Mage’s Robe: **Mana Surge Strike** — R(2–3), V2, Direct — Deal 4 magic damage.

098 — Mage’s Robe: **Mana Shift** — R(Self) — Recover 1 strain.

099 — Mage’s Robe: **Arcane Veil** — R(Self) — Gain \+2 DEF vs magic for 1 turn.

100 — Shadow Cloak: **Ambush Slash** — R(1), V1, Direct — Deal 5 damage if undetected at start of turn.

101 — Shadow Cloak: **Fade** — R(Self) — Become untargetable by ranged attacks until next turn.

102 — Shadow Cloak: **Shade Guard** — R(Self) — Untargetable if you don’t move this turn.

103 — Scholar’s Vest: **Scroll Slam** — R(1), V1, Direct — Deal 2 damage and reduce target ACC by 1\.

104 — Scholar’s Vest: **Study Mark** — R(3), V1, Direct — Reveal target’s DEF and HP to all allies.

105 — Scholar’s Vest: **Knowledge Shield** — R(Self) — Ignore first status effect this turn.

106 — Chainmail Hauberk: **Chain Sweep** — R(1–2), V1, Arc — Deal 3 damage to up to 3 enemies.

107 — Chainmail Hauberk: **Hold the Line** — R(Self) — Allies adjacent gain \+1 DEF.

108 — Chainmail Hauberk: **Linked Brace** — R(Self) — Adjacent allies gain \+1 DEF.

109 — Steamline Armor: **Steam Bash** — R(1–2), V1, Direct — Deal 3 damage and \+1 heat to target mech.

110 — Steamline Armor: **Steam Vent** — R(Self) — Push adjacent enemies back 1 tile.

111 — Steamline Armor: **Pressure Guard** — R(Self) — Push back melee attacker 1 tile.

112 — Hunter’s Vest: **Quiver Barrage** — R(2–4), V1, Direct — Three attacks, each dealing 2 damage.

113 — Hunter’s Vest: **Camouflage** — R(Self) — \+3 ACC on next ranged attack.

114 — Hunter’s Vest: **Camouflage Guard** — R(Self) — Gain \+2 DEF if attacked at range.

115 — Reinforced Gambeson: **Body Slam** — R(1), V1, Direct — Deal 3 damage; target cannot move next turn.

116 — Reinforced Gambeson: **Holdfast** — R(Self) — Cannot be moved by enemy effects until next turn.

117 — Reinforced Gambeson: **Stand Fast** — R(Self) — Cannot be knocked back until next turn.

118 — Battle Harness: **Lance Thrust** — R(1–2), V2, Direct — Deal 4 damage ignoring 1 DEF.

119 — Battle Harness: **Adrenal Surge** — R(Self) — Gain \+1 movement this turn.

120 — Battle Harness: **Adrenal Guard** — R(Self) — If attacked, gain \+1 movement next turn.

121 — Arcane Tunic: **Energy Bolt** — R(2–4), V2, Direct — Deal 3 magic damage; ignore LoS.

122 — Arcane Tunic: **Glyph Recall** — R(Self) — Refresh 1 magic card from discard pile.

123 — Arcane Tunic: **Sigil Ward** — R(Self) — Magic attacks deal –1 damage to you until next turn.

124 — Marksman’s Brigandine: **Precision Volley** — R(3–5), V1, Direct — Two attacks, each dealing 3 damage.

125 — Marksman’s Brigandine: **Steady Aim** — R(Self) — \+2 ACC if you don’t move this turn.

126 — Marksman’s Brigandine: **Stagger Guard** — R(Self) — If hit, attacker suffers –1 AGI until next turn.

127 — Steel Signet Ring: **Knuckle Jab** — R(1), V1, Direct — Deal 2 damage and push target 1 tile.

128 — Steel Signet Ring: **Mark of Command** — R(Self) — All allies gain \+1 ACC next turn.

129 — Steel Signet Ring: **Signet Shield** — R(Self) — Gain \+1 DEF and \+1 LUK until next turn.

130 — Eagle Eye Lens: **Spotter’s Shot** — R(3–6), V1, Direct — Deal 4 damage; target is marked for \+1 damage from all sources next turn.

131 — Eagle Eye Lens: **Target Paint** — R(3–6), V1, Direct — Allies gain \+1 damage to target this turn.

132 — Eagle Eye Lens: **Farsight Guard** — R(Self) — Ignore overwatch this turn.

133 — Fleetfoot Anklet: **Flying Kick** — R(1–2), V1, Direct — Deal 3 damage; move through target’s tile.

134 — Fleetfoot Anklet: **Speed Burst** — R(Self) — \+2 movement this turn.

135 — Fleetfoot Anklet: **Swift Guard** — R(Self) — Move \+2 and gain \+1 DEF this turn.

136 — Rune Pendant: **Arcane Surge** — R(2–3), V2, Direct — Deal 3 magic damage and ignore 2 DEF.

137 — Rune Pendant: **Rune Recall** — R(Self) — Refresh 1 used magic card.

138 — Rune Pendant: **Rune Shield** — R(Self) — Block next magic attack.

139 — Power Bracer: **Crushing Punch** — R(1), V1, Direct — Deal 4 damage.

140 — Power Bracer: **Overgrip** — R(Self) — Next melee attack ignores 2 DEF.

141 — Power Bracer: **Brace Block** — R(Self) — Gain \+1 DEF and \+1 ATK until next turn.

142 — Vitality Charm: **Bulwark Bash** — R(1), V1, Direct — Deal 3 damage; gain \+1 HP.

143 — Vitality Charm: **Second Wind** — R(Self) — Restore 1 HP.

144 — Vitality Charm: **Life Guard** — R(Self) — Heal 1 HP and gain \+1 DEF.

145 — Steam Valve Wristguard: **Steam Jet Strike** — R(1–2), V1, Direct — Deal 3 damage; \+1 heat to self.

146 — Steam Valve Wristguard: **Steam Push** — R(1–2), V1, Direct — Push target back 1 tile.

147 — Steam Valve Wristguard: **Steam Shield** — R(Self) — Adjacent enemies suffer –1 ACC for 1 turn.

148 — Hunter’s Talisman: **Hunter’s Pounce** — R(2), V1, Direct — Deal 4 damage if target has moved this turn.

149 — Hunter’s Talisman: **Scent Mark** — R(2–4), V1, Direct — Reveal target’s location even if hidden for 2 turns.

150 — Hunter’s Talisman: **Tracker’s Guard** — R(Self) — First enemy to attack you is revealed on map.

151 — Scholar’s Quill Pendant: **Ink Slash** — R(1), V1, Direct — Deal 3 damage and blind for 1 turn.

152 — Scholar’s Quill Pendant: **Quick Notes** — R(Self) — Reduce strain of next card by 1\.

153 — Scholar’s Quill Pendant: **Quick Guard** — R(Self) — Reduce strain of next defensive card by 1\.

154 — Smoke Bomb Satchel: **Ashen Cut** — R(1), V1, Direct — Deal 3 damage; target suffers –2 ACC next turn.

155 — Smoke Bomb Satchel: **Cover Retreat** — R(Self) — Create smoke on your tile; cannot be targeted until next turn.

156 — Smoke Bomb Satchel: **Escape Guard** — R(Self) — Become untargetable for 1 turn after being hit.

157 — Warrior’s Belt: **Hip Smash** — R(1), V1, Direct — Deal 3 damage; \+1 DEF for 1 turn.

158 — Warrior’s Belt: **Berserk Prep** — R(Self) — Next attack deals \+2 damage but you take \+1 damage until next turn.

159 — Warrior’s Belt: **Belt Brace** — R(Self) — Gain \+1 DEF and \+1 HP until next turn.

160 — Arcane Crystal Brooch: **Crystal Beam** — R(2–4), V2, Direct — Deal 4 magic damage.

161 — Arcane Crystal Brooch: **Focus Crystal** — R(Self) — Next magic attack gains \+1 AoE radius.

162 — Arcane Crystal Brooch: **Crystal Shield** — R(Self) — Reflect 1 magic damage back to attacker.

163 — Emberclaw Repeater: **Piercing Volley** — R(2–5), V1, Direct — Ignore target’s DEF for next attack. Gain \+1 heat.

164 — Emberclaw Repeater: **Suppressive Spray** — R(2–5), V1, Direct — Target suffers –2 ACC and –1 movement next turn. Gain \+1 heat.

165 — Emberclaw Repeater: **Cooling Discipline** — R(Self) — Remove 2 heat from this weapon and gain \+1 DEF until next turn.

166 — Steamburst Pike: **Pierce & Pin** — R(1–2), V2, Direct — Attack prevents target movement next turn. (Gain \+1 heat if used as a weapon skill.)

167 — Steamburst Pike: **Pierce Anchor** — R(1–2), V2, Direct — Pin target in place; cannot move next turn. Gain \+1 heat.

168 — Steamburst Pike: **Steam Guard** — R(Self) — Remove 1 heat; gain immunity to push/pull effects until next turn.

169 — Vulcan Coilgun: **Power Shot** — R(3–7), V1, Direct — \+2 damage. (Gain heat per your weapon rules.)

170 — Vulcan Coilgun: **Magnetic Pull** — R(3–7), V1, Direct — Pull target 2 tiles toward you. Gain \+2 heat.

171 — Vulcan Coilgun: **Magnetic Guard** — R(Self) — Remove 2 heat; ranged attacks against you suffer –2 ACC until next turn.

172 — Brassback Scattergun: **Slug Round** — R(1), V1, Direct — Damage doubled for this shot. (Usually –range.)

173 — Brassback Scattergun: **Warning Blast** — R(1–3), V1, Cone — Push all enemies in cone back 1 tile. Gain \+1 heat.

174 — Brassback Scattergun: **Blast Shield** — R(Self) — Remove 1 heat; ignore first incoming ranged attack.

175 — Ironwhisper Crossbow: **Silenced Shot** — R(2–6), V1, Direct — Cannot be countered or alert nearby enemies.

176 — Ironwhisper Crossbow: **Tether Bolt** — R(2–6), V1, Direct — Target cannot move more than 2 tiles from current position for 2 turns. Gain \+1 heat.

177 — Ironwhisper Crossbow: **Cover Reload** — R(Self) — Remove 1 heat; gain \+2 DEF until your next attack.

178 — Stormlash Arcstaff: **Overload Blast** — R(1–3), V2, AoE(1) — All targets in range take 1 electric damage.

179 — Stormlash Arcstaff: **Static Field** — R(1–3), V2, AoE(1) — Enemies in area suffer –2 AGI for 1 turn. Gain \+2 heat.

180 — Stormlash Arcstaff: **Grounding Stance** — R(Self) — Remove 2 heat; immune to stun until next turn.

181 — Blazefang Saber: **Searing Slash** — R(1), V1, Direct — Inflict Burn status.

182 — Blazefang Saber: **Molten Mark** — R(1), V1, Direct — Mark target; next attack from any ally deals \+2 damage. Gain \+1 heat.

183 — Blazefang Saber: **Heat Parry** — R(Self) — Remove 1 heat; block the next melee attack.

184 — Gearspike Mortar: **Bunker Buster** — R(3–6), V1, AoE — Ignores cover and destroys obstacles in target area.

185 — Gearspike Mortar: **Smoke Shell** — R(3–6), V1, AoE(2) — Create smoke area; enemies in area have –3 ACC for 1 turn. Gain \+2 heat.

186 — Gearspike Mortar: **Fortified Position** — R(Self) — Remove 2 heat; gain \+1 DEF and ignore AoE damage until next turn.

187 — Emberdrake Harpooner: **Anchor Pull** — R(2–5), V1, Direct — Pull self to target instead of target to self.

188 — Emberdrake Harpooner: **Tether Reel** — R(2–5), V1, Direct — Pull target 1 tile and immobilize for 1 turn. Gain \+1 heat.

189 — Emberdrake Harpooner: **Anchor Brace** — R(Self) — Remove 1 heat; cannot be moved by enemy effects until next turn.

190 — Thunderjaw Cannon: **Full Barrage** — R(3–6), V1, Direct — Make an additional attack at –2 accuracy.

191 — Thunderjaw Cannon: **Suppressive Fire** — R(3–6), V1, AoE(1) — Reduce enemy movement by 2 for 1 turn. Gain \+2 heat.

192 — Thunderjaw Cannon: **Full Vent** — R(Self) — Remove all heat; gain \+3 DEF until your next turn.

## Gambit Cards

193 — Last Stand — Double ATK below 50% HP. Strain: 3\. Range: R(0–0), V0, N/A

194 — Perfect Strike — Guaranteed hit and crit. Strain: 3\. Range: R(1–1), V1, Direct

195 — Vengeance — Deal damage equal to HP lost. Strain: 3\. Range: R(1–3), V1, Direct

196 — Battle Frenzy — Act twice this turn. Strain: 4\. Range: R(0–0), V0, N/A

197 — Ambush — First attack of battle deals double damage. Strain: 2\. Range: R(1–1), V1, Direct

198 — Unyielding — Survive fatal hit with 1 HP. Strain: 3\. Range: R(0–0), V0, N/A

199 — Rapid Fire — Attack three times in one turn. Strain: 3\. Range: R(2–4), V1, Direct

200 — Chain Reaction — AOE damage if enemy defeated. Strain: 4\. Range: R(1–2), V1, Indirect, AoE

201 — Blood Pact — Lose HP to gain ATK for 3 turns. Strain: 2\. Range: R(0–0), V0, N/A

202 — Final Gambit — Massive AoE, self‑KO. Strain: 5\. Range: R(1–3), V1, Indirect, AoE

203 — Heroic Rally — Fully restore ally strain. Strain: 2\. Range: R(0–0), V0, N/A

204 — Piercing Lunge — Ignore armor, double damage. Strain: 3\. Range: R(2–3), V1, Direct

205 — Suppressing Fire — Reduce enemy movement by 2\. Strain: 2\. Range: R(3–5), V1, Direct

206 — Arcane Overload — Magic attacks deal double damage. Strain: 3\. Range: R(0–0), V0, N/A

207 — Smoke Veil — All allies gain evasion for 2 turns. Strain: 2\. Range: R(0–0), V0, N/A

# **Enemy Index**

### **Light Enemies (Free-Move Zones)**

* Purpose: Quick skirmishes, resource drops, introduce mechanics without overwhelming the player.  
* Count for Base Game: **10–12 types**  
* Breakdown:  
  * 2–3 melee humanoids (bandits, militia, cultists)  
  * 2–3 ranged humanoids (archers, slingers, tinkers)  
  * 2–3 beasts (wolves, boars, swamp lizards)  
  * 2–3 mechanical units (small drones, clockwork beetles, steam spiders)

### **Tactical Encounter Enemies (Battle Rooms)**

* Purpose: Core battle challenges; varied enough to keep procedural runs fresh.  
* Count for Base Game: **15–18 types**   
* Breakdown:  
  * 4–5 basic infantry  
  * 3–4 ranged/aoe units  
  * 3–4 support/debuffer units  
  * 2–3 elite melee units  
  * 3–4 heavy mechanicals

### **Boss / Elite Enemies**

* Purpose: End-of-floor encounters or key operation milestones.  
* Count for Base Game: **5 bosses** (1 per operation)

# **Item Index**

Consumables are **one-use**, **stackable**, and **buyable/sellable** at shops, with recipes for crafting.

Crafting items:

* **Scrap Metal (SM)**  
* **Chaos Shards (CS)**  
* **Medic Herbs (MH)**  
* **Treated Leather (TL)**  
* **Processed Fuel (PF)**  
* **Crystals (CR)**

| Item Name | Effect | Sell Price | Buy Price | Crafting Recipe |
| ----- | ----- | ----- | ----- | ----- |
| **Field Ration** | **Restore 2 HP to unit** | **15g** | **30g** | **2 MH \+ 1 TL** |
| **Medkit** | **Restore 5 HP to unit** | **40g** | **80g** | **4 MH \+ 1 TL** |
| **Repair Kit** | **Restore 3 HP to mechanical unit** | **20g** | **40g** | **2 SM \+ 1 PF** |
| **Overcharge Cell** | **Add \+3 Heat instantly to mechanical weapon, gain \+3 ATK next attack** | **25g** | **50g** | **2 PF \+ 1 CR** |
| **Coolant Flask** | **Remove 3 Heat from mechanical weapon** | **30g** | **60g** | **3 PF \+ 1 CR** |
| **Smoke Canister** | **Create smoke on target tile (block LoS for 1 turn)** | **25g** | **50g** | **2 PF \+ 2 TL** |
| **Throwing Knife** | **R(1–3), V1, Direct — Deal 2 damage ignoring DEF** | **10g** | **20g** | **1 SM \+ 1 TL** |
| **Firebomb** | **AoE(1) — Deal 3 Fire damage and apply Burn** | **35g** | **70g** | **3 PF \+ 1 TL \+ 1 CR** |
| **Shock Charge** | **R(1–2) AoE(1) — Deal 2 Electric damage, stun 1 turn** | **40g** | **80g** | **2 PF \+ 1 SM \+ 1 CR** |
| **Arcane Elixir** | **Restore 2 strain to target** | **30g** | **60g** | **2 AD \+ 1 CR** |
| **Focus Draught** | **Next attack gains \+2 ACC** | **15g** | **30g** | **1 AD \+ 1 MH** |
| **Battle Banner** | **All allies within 2 tiles gain \+1 ATK for 1 turn** | **45g** | **90g** | **3 TL \+ 2 MH** |

# **NPC Index**

## **Core Functional NPCs**

1. **Quartermaster Garrick** – Sells and buys gear, consumables, and crafting materials. Handles bulk supply orders.  
2. **Engineer Mara Vance** – Upgrades mechanical weapons, repairs damaged gear, and improves heat capacity or clutch toggles.  
3. **Blacksmith Rulfen** – Crafts and upgrades non-mechanical weapons, armor, and accessories.  
4. **Tactician Orren** – Manages squad formations, deck building, and multi-weapon loadouts. Provides training simulations.  
5. **Recruiter Elayne** – Allows hiring of new units, manages barracks, and handles troop dismissals.  
6. **Medic Selka** – Heals injured units, cures status effects, and sells medical supplies.  
7. **Crafter Juno** – Handles crafting consumable items from gathered resources.  
8. **Mapwright Thalos** – Unlocks and updates dungeon navigation tools, adds map modifiers, and marks hidden routes.

---

## **Narrative / Lore NPCs**

9. **Archivist Liora** – Keeps records of enemy types, lore entries, and past operations. Updates bestiary entries.  
10. **Courier Dren** – Brings letters, parcels, and “off-world” packages from Fairhaven. Sometimes delivers side-quests.  
11. **Bard Corin** – Provides rumors, flavor text, and camp atmosphere through songs and stories. May hint at hidden mechanics.  
12. **Mysterious Stranger** – Appears randomly with rare trade offers or cryptic intel about enemy activity.

---

## **Ambient / Flavor NPCs**

13. **Mess Hall Cook “Big Tova”** – Provides morale boosts, sells rations, and offers temporary buff meals.  
14. **Mechanic’s Apprentice Pip** – A flavor NPC who comments on player progress and occasionally offers a small crafting discount.  
15. **Gate Guard Fenric** – Controls entry and exit from the base camp, gives daily operational briefings.

