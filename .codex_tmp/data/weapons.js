function createClutch(id, label, description, effects) {
    return { id, label, description, effects };
}
function createHeatProfile(capacity, passiveDecay, zones, overheatSummary, overheatEffects) {
    return {
        capacity,
        passiveDecay,
        zones,
        overheatSummary,
        overheatEffects,
    };
}
function createAmmoProfile(max, quickReloadStrain, fullReloadStrain, defaultAttackAmmoCost = 1) {
    return {
        max,
        quickReloadStrain,
        fullReloadStrain,
        defaultAttackAmmoCost,
    };
}
function legacyHeatZones(profile) {
    return profile.zones.map((zone) => ({
        min: zone.min,
        max: zone.max,
        name: zone.name,
        effect: zone.effectText,
    }));
}
const emberclawHeat = createHeatProfile(8, 2, [
    { min: 0, max: 3, name: "Stable", effectText: null },
    { min: 4, max: 6, name: "Barrel Glow", effectText: "ACC -1", modifiers: { accuracyDelta: -1 } },
    { min: 7, max: 8, name: "Critical", effectText: "Next shot overheats", modifiers: { nextShotOverheats: true } },
], "Locks for 1 turn and takes 2 strain to clear.", [{ kind: "weapon_card_lock_turns", turns: 1 }, { kind: "self_strain", amount: 2 }]);
const steamburstHeat = createHeatProfile(5, 1, [
    { min: 0, max: 2, name: "Stable", effectText: null },
    { min: 3, max: 4, name: "Pressure Surge", effectText: "+1 damage, risk self-hit", modifiers: { damageDelta: 1 } },
    { min: 5, max: 5, name: "Overload", effectText: "Forced exhaust" },
], "Pushes the user back 1 tile and deals 2 self-damage.", [{ kind: "push_self", tiles: 1 }, { kind: "self_damage_flat", amount: 2 }]);
const vulcanHeat = createHeatProfile(10, 3, [
    { min: 0, max: 4, name: "Stable", effectText: null },
    { min: 5, max: 7, name: "Coil Strain", effectText: "MOV -1", modifiers: { movementDelta: -1 } },
    { min: 8, max: 10, name: "Overcharge", effectText: "Next shot doubles damage, then forces exhaust", modifiers: { damageDelta: 3, nextShotOverheats: true } },
], "Cards tied to this weapon are disabled for 2 turns.", [{ kind: "weapon_card_lock_turns", turns: 2 }]);
const brassbackHeat = createHeatProfile(6, 1, [
    { min: 0, max: 2, name: "Stable", effectText: null },
    { min: 3, max: 4, name: "Spread Boost", effectText: "+1 range" },
    { min: 5, max: 6, name: "Jammed", effectText: "Must exhaust to clear" },
], "Skips the next attack phase.", [{ kind: "skip_attack_turns", turns: 1 }]);
const ironwhisperHeat = createHeatProfile(4, 2, [
    { min: 0, max: 1, name: "Stable", effectText: null },
    { min: 2, max: 3, name: "Draw Assist", effectText: "+1 ACC", modifiers: { accuracyDelta: 1 } },
    { min: 4, max: 4, name: "Burnout", effectText: "Lose next turn" },
], "Destroys the currently loaded bolt.", [{ kind: "waste_ammo", amount: 1 }]);
const stormlashHeat = createHeatProfile(9, 1, [
    { min: 0, max: 4, name: "Stable", effectText: null },
    { min: 5, max: 6, name: "Spark Chain", effectText: "AOE +1 radius", modifiers: { areaRadiusDelta: 1 } },
    { min: 7, max: 9, name: "Surge", effectText: "Randomly target friend or foe" },
], "Stuns the wielder for 1 turn.", [{ kind: "apply_status_self", status: "stunned", duration: 1 }]);
const blazefangHeat = createHeatProfile(5, 1, [
    { min: 0, max: 2, name: "Stable", effectText: null },
    { min: 3, max: 4, name: "Blade Sear", effectText: "+1 damage", modifiers: { damageDelta: 1 } },
    { min: 5, max: 5, name: "Blade Warp", effectText: "Damage -2 until repaired", modifiers: { damageDelta: -2 } },
], "Permanently reduces max heat by 1 for the battle.", [{ kind: "reduce_max_heat", amount: 1 }]);
const gearspikeHeat = createHeatProfile(7, 2, [
    { min: 0, max: 3, name: "Stable", effectText: null },
    { min: 4, max: 6, name: "Blast Boost", effectText: "+1 tile radius", modifiers: { areaRadiusDelta: 1 } },
    { min: 7, max: 7, name: "Overpressure", effectText: "Self-hit if in range" },
], "Deals 3 self-damage.", [{ kind: "self_damage_flat", amount: 3 }]);
const emberdrakeHeat = createHeatProfile(6, 1, [
    { min: 0, max: 2, name: "Stable", effectText: null },
    { min: 3, max: 5, name: "Reel Boost", effectText: "Pull +1 tile" },
    { min: 6, max: 6, name: "Snapback", effectText: "Stuns wielder" },
], "Cord breaks and the weapon is disabled for 2 turns.", [{ kind: "weapon_disable_turns", turns: 2 }]);
const thunderjawHeat = createHeatProfile(12, 2, [
    { min: 0, max: 5, name: "Stable", effectText: null },
    { min: 6, max: 9, name: "Firestorm", effectText: "AOE bonus damage", modifiers: { damageDelta: 1 } },
    { min: 10, max: 12, name: "Critical Overdrive", effectText: "Massive damage, then exhaust", modifiers: { damageDelta: 2, nextShotOverheats: true } },
], "Lose 1 random weapon card for the battle.", [{ kind: "remove_random_weapon_card", count: 1 }]);
const emberclawAmmo = createAmmoProfile(6, 1, 0);
const vulcanAmmo = createAmmoProfile(4, 1, 0);
const brassbackAmmo = createAmmoProfile(2, 1, 0);
const ironwhisperAmmo = createAmmoProfile(1, 1, 0);
const gearspikeAmmo = createAmmoProfile(2, 1, 0);
const emberdrakeAmmo = createAmmoProfile(1, 1, 0);
const thunderjawAmmo = createAmmoProfile(3, 2, 1);
const elmAmmo = createAmmoProfile(6, 1, 0);
const greatbowAmmo = createAmmoProfile(6, 1, 0);
const willowAmmo = createAmmoProfile(6, 1, 0);
export const STARTER_WEAPONS = [
    {
        id: "weapon_iron_longsword",
        name: "Iron Longsword",
        slot: "weapon",
        weaponType: "sword",
        isMechanical: false,
        stats: { atk: 2, def: 1, agi: 0, acc: 1, hp: 0 },
        cardsGranted: ["card_cleave", "card_parry_readiness", "card_guarded_stance"],
        clutchToggle: "Edge Focus - Gain +2 ACC for the attack, but -1 DEF until your next turn.",
        clutches: [
            createClutch("edge_focus", "Edge Focus", "Gain +2 ACC for the attack, but -1 DEF until your next turn.", [
                { kind: "accuracy", amount: 2 },
                { kind: "self_debuff", stat: "def", amount: 1, duration: 1 },
            ]),
        ],
        wear: 0,
    },
    {
        id: "weapon_elm_recurve_bow",
        name: "Elm Recurve Bow",
        slot: "weapon",
        weaponType: "bow",
        isMechanical: false,
        stats: { atk: 2, def: 0, agi: 1, acc: 2, hp: -1 },
        cardsGranted: ["card_pinpoint_shot", "card_warning_shot", "card_defensive_draw"],
        clutchToggle: "Piercing Arrow - Ignore 2 DEF for this shot, but -1 ACC.",
        clutches: [
            createClutch("piercing_arrow", "Piercing Arrow", "Ignore 2 DEF for this shot, but -1 ACC.", [
                { kind: "ignore_def", amount: 2 },
                { kind: "accuracy", amount: -1 },
            ]),
        ],
        ammoProfile: elmAmmo,
        ammoMax: elmAmmo.max,
        quickReloadStrain: elmAmmo.quickReloadStrain,
        fullReloadStrain: elmAmmo.fullReloadStrain,
        wear: 0,
    },
    {
        id: "weapon_oak_battlestaff",
        name: "Oak Battlestaff",
        slot: "weapon",
        weaponType: "staff",
        isMechanical: false,
        stats: { atk: 1, def: 2, agi: 0, acc: 1, hp: 1 },
        cardsGranted: ["card_blunt_sweep", "card_deflective_spin", "card_ward_spin"],
        clutchToggle: "Channel Power - Next skill costs 1 less strain, but suffer -1 DEF until your next turn.",
        clutches: [
            createClutch("channel_power", "Channel Power", "Next skill costs 1 less strain, but suffer -1 DEF until your next turn.", [
                { kind: "next_card_modifier", strainDelta: -1 },
                { kind: "self_debuff", stat: "def", amount: 1, duration: 1 },
            ]),
        ],
        wear: 0,
    },
    {
        id: "weapon_steel_dagger",
        name: "Steel Dagger",
        slot: "weapon",
        weaponType: "dagger",
        isMechanical: false,
        stats: { atk: 1, def: 0, agi: 3, acc: 2, hp: -1 },
        cardsGranted: ["card_throat_jab", "card_hamstring", "card_sidestep"],
        clutchToggle: "Lunge - Move 2 tiles before striking without provoking attacks, but -2 ACC.",
        clutches: [
            createClutch("lunge", "Lunge", "Move 2 tiles before striking without provoking attacks, but -2 ACC.", [
                { kind: "move_before_attack", tiles: 2 },
                { kind: "accuracy", amount: -2 },
            ]),
        ],
        wear: 0,
    },
    {
        id: "weapon_emberclaw_repeater",
        name: "Emberclaw Repeater",
        slot: "weapon",
        weaponType: "gun",
        isMechanical: true,
        stats: { atk: 3, def: 0, agi: -1, acc: 2, hp: 0 },
        cardsGranted: ["card_piercing_volley", "card_suppressive_spray", "card_cooling_discipline"],
        clutchToggle: "Piercing Volley - Ignore target DEF for the next attack.",
        clutches: [
            createClutch("piercing_volley", "Piercing Volley", "Ignore target DEF for the next attack.", [
                { kind: "ignore_def", amount: 99 },
            ]),
        ],
        heatProfile: emberclawHeat,
        heatCapacity: emberclawHeat.capacity,
        heatZones: legacyHeatZones(emberclawHeat),
        passiveHeatDecay: emberclawHeat.passiveDecay,
        ammoProfile: emberclawAmmo,
        ammoMax: emberclawAmmo.max,
        quickReloadStrain: emberclawAmmo.quickReloadStrain,
        fullReloadStrain: emberclawAmmo.fullReloadStrain,
        wear: 0,
    },
    {
        id: "weapon_blazefang_saber",
        name: "Blazefang Saber",
        slot: "weapon",
        weaponType: "sword",
        isMechanical: true,
        stats: { atk: 3, def: 1, agi: 0, acc: 1, hp: 0 },
        cardsGranted: ["card_searing_slash", "card_molten_mark", "card_heat_parry"],
        clutchToggle: "Searing Slash - Inflict Burn on hit.",
        doubleClutch: "Quick Draw - Attack without consuming movement.",
        clutches: [
            createClutch("searing_slash", "Searing Slash", "Inflict Burn on hit.", [
                { kind: "apply_status_on_hit", status: "burning", duration: 2 },
            ]),
            createClutch("quick_draw", "Quick Draw", "Attack without consuming movement.", [
                { kind: "free_attack_move" },
            ]),
        ],
        heatProfile: blazefangHeat,
        heatCapacity: blazefangHeat.capacity,
        heatZones: legacyHeatZones(blazefangHeat),
        passiveHeatDecay: blazefangHeat.passiveDecay,
        wear: 0,
    },
    {
        id: "weapon_runed_shortsword",
        name: "Runed Shortsword",
        slot: "weapon",
        weaponType: "shortsword",
        isMechanical: false,
        stats: { atk: 1, def: 0, agi: 2, acc: 2, hp: -1 },
        cardsGranted: ["card_rune_strike", "card_spell_parry", "card_phase_step"],
        clutchToggle: "Quick Strike - Attack first this round regardless of initiative, but suffer -2 ACC on the attack.",
        clutches: [
            createClutch("quick_strike", "Quick Strike", "Attack first this round regardless of initiative, but suffer -2 ACC on the attack.", [
                { kind: "accuracy", amount: -2 },
                { kind: "unsupported", note: "Initiative reordering is not modeled in the current battle system." },
            ]),
        ],
        wear: 0,
    },
    {
        id: "weapon_scissor_sword",
        name: "Scissor Sword",
        slot: "weapon",
        weaponType: "sword",
        isMechanical: false,
        stats: { atk: 3, def: 1, agi: -1, acc: 0, hp: 0 },
        cardsGranted: ["card_scissor_snip", "card_rending_slash", "card_blade_catch"],
        clutchToggle: "Overhand Smash - Deal +3 damage, but suffer -3 AGI until your next turn.",
        doubleClutch: "Defensive Guard - Gain +2 DEF until your next turn, but -2 ATK.",
        clutches: [
            createClutch("overhand_smash", "Overhand Smash", "Deal +3 damage, but suffer -3 AGI until your next turn.", [
                { kind: "damage", amount: 3 },
                { kind: "self_debuff", stat: "agi", amount: 3, duration: 1 },
            ]),
            createClutch("defensive_guard", "Defensive Guard", "Gain +2 DEF until your next turn, but -2 ATK.", [
                { kind: "self_buff", stat: "def", amount: 2, duration: 1 },
                { kind: "self_debuff", stat: "atk", amount: 2, duration: 1 },
            ]),
        ],
        wear: 0,
    },
    {
        id: "weapon_composite_greatbow",
        name: "Composite Greatbow",
        slot: "weapon",
        weaponType: "greatbow",
        isMechanical: false,
        stats: { atk: 4, def: 0, agi: -2, acc: 1, hp: 0 },
        cardsGranted: ["card_heavy_draw", "card_piercing_shot", "card_brace_stance"],
        clutchToggle: "Volley - Fire twice at -3 ACC each shot.",
        clutches: [
            createClutch("volley", "Volley", "Fire twice at -3 ACC each shot.", [
                { kind: "accuracy", amount: -3 },
                { kind: "extra_attack", count: 1, accuracyDelta: -3 },
            ]),
        ],
        ammoProfile: greatbowAmmo,
        ammoMax: greatbowAmmo.max,
        quickReloadStrain: greatbowAmmo.quickReloadStrain,
        fullReloadStrain: greatbowAmmo.fullReloadStrain,
        wear: 0,
    },
    {
        id: "weapon_willow_shortbow",
        name: "Willow Shortbow",
        slot: "weapon",
        weaponType: "bow",
        isMechanical: false,
        stats: { atk: 1, def: 0, agi: 3, acc: 2, hp: -2 },
        cardsGranted: ["card_snap_shot", "card_mobile_fire", "card_evasive_roll"],
        clutchToggle: "Armor Breaker - Ignore 4 DEF on the attack.",
        doubleClutch: "Heavy Draw - Deal +4 damage but skip your next move action.",
        clutches: [
            createClutch("armor_breaker", "Armor Breaker", "Ignore 4 DEF on the attack.", [
                { kind: "ignore_def", amount: 4 },
            ]),
            createClutch("heavy_draw", "Heavy Draw", "Deal +4 damage but skip your next move action.", [
                { kind: "damage", amount: 4 },
                { kind: "unsupported", note: "Skipping the next move action is not separately modeled from the current attack-action flow." },
            ]),
        ],
        ammoProfile: willowAmmo,
        ammoMax: willowAmmo.max,
        quickReloadStrain: willowAmmo.quickReloadStrain,
        fullReloadStrain: willowAmmo.fullReloadStrain,
        wear: 0,
    },
    {
        id: "weapon_silver_channeling_rod",
        name: "Silver Channeling Rod",
        slot: "weapon",
        weaponType: "staff",
        isMechanical: false,
        stats: { atk: 2, def: 0, agi: 1, acc: 3, hp: -1 },
        cardsGranted: ["card_mana_bolt", "card_silver_ward", "card_focus_energy"],
        clutchToggle: "Focus Shot - +3 ACC to the next skill card this turn, but -1 AGI next turn.",
        clutches: [
            createClutch("focus_shot", "Focus Shot", "+3 ACC to the next skill card this turn, but -1 AGI next turn.", [
                { kind: "next_card_modifier", accuracyDelta: 3 },
                { kind: "self_debuff", stat: "agi", amount: 1, duration: 1 },
            ]),
        ],
        wear: 0,
    },
    {
        id: "weapon_blackwood_greatstaff",
        name: "Blackwood Greatstaff",
        slot: "weapon",
        weaponType: "greatstaff",
        isMechanical: false,
        stats: { atk: 3, def: 1, agi: -1, acc: 2, hp: 0 },
        cardsGranted: ["card_crushing_blow", "card_earth_shatter", "card_wood_bark_barrier"],
        clutchToggle: "Ward Pulse - Gain +3 DEF until next turn.",
        doubleClutch: "Crush Swing - Deal +3 damage but -3 ACC.",
        clutches: [
            createClutch("ward_pulse", "Ward Pulse", "Gain +3 DEF until next turn.", [
                { kind: "self_buff", stat: "def", amount: 3, duration: 1 },
            ]),
            createClutch("crush_swing", "Crush Swing", "Deal +3 damage but -3 ACC.", [
                { kind: "damage", amount: 3 },
                { kind: "accuracy", amount: -3 },
            ]),
        ],
        wear: 0,
    },
    {
        id: "weapon_ivory_fangblade",
        name: "Ivory Fangblade",
        slot: "weapon",
        weaponType: "dagger",
        isMechanical: false,
        stats: { atk: 2, def: 0, agi: 2, acc: 3, hp: -2 },
        cardsGranted: ["card_fang_bite", "card_poison_tip", "card_feral_lunge"],
        clutchToggle: "Flurry - Attack twice at -2 damage per hit.",
        clutches: [
            createClutch("flurry", "Flurry", "Attack twice at -2 damage per hit.", [
                { kind: "damage", amount: -2 },
                { kind: "extra_attack", count: 1, damageDelta: -2 },
            ]),
        ],
        wear: 0,
    },
    {
        id: "weapon_weighted_dagger",
        name: "Weighted Dagger",
        slot: "weapon",
        weaponType: "dagger",
        isMechanical: false,
        stats: { atk: 2, def: 1, agi: 1, acc: 2, hp: 0 },
        cardsGranted: ["card_hilt_smash", "card_precise_throw", "card_balance_shift"],
        clutchToggle: "Precision Cut - Ignore 3 DEF.",
        doubleClutch: "Feint - Cancel the enemy counterattack if the attack misses.",
        clutches: [
            createClutch("precision_cut", "Precision Cut", "Ignore 3 DEF.", [
                { kind: "ignore_def", amount: 3 },
            ]),
            createClutch("feint", "Feint", "Cancel the enemy counterattack if the attack misses.", [
                { kind: "unsupported", note: "Counterattack cancellation is not modeled in the current battle system." },
            ]),
        ],
        wear: 0,
    },
    {
        id: "weapon_steamburst_pike",
        name: "Steamburst Pike",
        slot: "weapon",
        weaponType: "greatsword",
        isMechanical: true,
        stats: { atk: 4, def: 0, agi: -1, acc: 0, hp: 0 },
        cardsGranted: ["card_steam_thrust", "card_vent_blast", "card_pike_brace"],
        clutchToggle: "Pierce & Pin - Attack prevents target movement next turn.",
        clutches: [
            createClutch("pierce_and_pin", "Pierce & Pin", "Attack prevents target movement next turn.", [
                { kind: "apply_status_on_hit", status: "rooted", duration: 1 },
            ]),
        ],
        heatProfile: steamburstHeat,
        heatCapacity: steamburstHeat.capacity,
        heatZones: legacyHeatZones(steamburstHeat),
        passiveHeatDecay: steamburstHeat.passiveDecay,
        wear: 0,
    },
    {
        id: "weapon_vulcan_coilgun",
        name: "Vulcan Coilgun",
        slot: "weapon",
        weaponType: "gun",
        isMechanical: true,
        stats: { atk: 5, def: -1, agi: -2, acc: 2, hp: 0 },
        cardsGranted: ["card_rail_slug", "card_magnetic_shield", "card_charge_capacitor"],
        clutchToggle: "Power Shot - Deal +2 damage.",
        doubleClutch: "Magnetic Pull - Pull target 1 tile closer.",
        clutches: [
            createClutch("power_shot", "Power Shot", "Deal +2 damage.", [
                { kind: "damage", amount: 2 },
            ]),
            createClutch("magnetic_pull", "Magnetic Pull", "Pull target 1 tile closer.", [
                { kind: "pull_target", tiles: 1 },
            ]),
        ],
        heatProfile: vulcanHeat,
        heatCapacity: vulcanHeat.capacity,
        heatZones: legacyHeatZones(vulcanHeat),
        passiveHeatDecay: vulcanHeat.passiveDecay,
        ammoProfile: vulcanAmmo,
        ammoMax: vulcanAmmo.max,
        quickReloadStrain: vulcanAmmo.quickReloadStrain,
        fullReloadStrain: vulcanAmmo.fullReloadStrain,
        wear: 0,
    },
    {
        id: "weapon_brassback_scattergun",
        name: "Brassback Scattergun",
        slot: "weapon",
        weaponType: "gun",
        isMechanical: true,
        stats: { atk: 3, def: 0, agi: 0, acc: -1, hp: 0 },
        cardsGranted: ["card_buckshot", "card_shrapnel_blast", "card_brass_plating"],
        clutchToggle: "Slug Round - Range 1 but damage doubled.",
        clutches: [
            createClutch("slug_round", "Slug Round", "Range 1 but damage doubled.", [
                { kind: "range_override", amount: 1 },
                { kind: "damage_multiplier", multiplier: 2 },
            ]),
        ],
        heatProfile: brassbackHeat,
        heatCapacity: brassbackHeat.capacity,
        heatZones: legacyHeatZones(brassbackHeat).map((zone) => zone.name === "Spread Boost" ? { ...zone, effect: "+1 range" } : zone),
        passiveHeatDecay: brassbackHeat.passiveDecay,
        ammoProfile: brassbackAmmo,
        ammoMax: brassbackAmmo.max,
        quickReloadStrain: brassbackAmmo.quickReloadStrain,
        fullReloadStrain: brassbackAmmo.fullReloadStrain,
        wear: 0,
    },
    {
        id: "weapon_ironwhisper_crossbow",
        name: "Ironwhisper Crossbow",
        slot: "weapon",
        weaponType: "bow",
        isMechanical: true,
        stats: { atk: 3, def: 0, agi: 1, acc: 3, hp: 0 },
        cardsGranted: ["card_silent_bolt", "card_grapple_shot", "card_auto_reload"],
        clutchToggle: "Silenced Shot - Cannot be countered or alert enemies.",
        clutches: [
            createClutch("silenced_shot", "Silenced Shot", "Cannot be countered or alert enemies.", [
                { kind: "unsupported", note: "Counter and alert systems are not modeled in the current battle flow." },
            ]),
        ],
        heatProfile: ironwhisperHeat,
        heatCapacity: ironwhisperHeat.capacity,
        heatZones: legacyHeatZones(ironwhisperHeat),
        passiveHeatDecay: ironwhisperHeat.passiveDecay,
        ammoProfile: ironwhisperAmmo,
        ammoMax: ironwhisperAmmo.max,
        quickReloadStrain: ironwhisperAmmo.quickReloadStrain,
        fullReloadStrain: ironwhisperAmmo.fullReloadStrain,
        wear: 0,
    },
    {
        id: "weapon_stormlash_arcstaff",
        name: "Stormlash Arcstaff",
        slot: "weapon",
        weaponType: "staff",
        isMechanical: true,
        stats: { atk: 4, def: 0, agi: 0, acc: 1, hp: 0 },
        cardsGranted: ["card_chain_lightning", "card_static_field", "card_arc_whip"],
        clutchToggle: "Overload Blast - All targets in range take 1 electric damage.",
        clutches: [
            createClutch("overload_blast", "Overload Blast", "All targets in range take 1 electric damage.", [
                { kind: "splash_in_range", amount: 1 },
            ]),
        ],
        heatProfile: stormlashHeat,
        heatCapacity: stormlashHeat.capacity,
        heatZones: legacyHeatZones(stormlashHeat),
        passiveHeatDecay: stormlashHeat.passiveDecay,
        wear: 0,
    },
    {
        id: "weapon_gearspike_mortar",
        name: "Gearspike Mortar",
        slot: "weapon",
        weaponType: "gun",
        isMechanical: true,
        stats: { atk: 6, def: -2, agi: -3, acc: 0, hp: 0 },
        cardsGranted: ["card_lob_shell", "card_shatter_ground", "card_deploy_bipod"],
        clutchToggle: "Bunker Buster - Ignore cover and destroy obstacles.",
        clutches: [
            createClutch("bunker_buster", "Bunker Buster", "Ignore cover and destroy obstacles.", [
                { kind: "ignore_cover" },
            ]),
        ],
        heatProfile: gearspikeHeat,
        heatCapacity: gearspikeHeat.capacity,
        heatZones: legacyHeatZones(gearspikeHeat),
        passiveHeatDecay: gearspikeHeat.passiveDecay,
        ammoProfile: gearspikeAmmo,
        ammoMax: gearspikeAmmo.max,
        quickReloadStrain: gearspikeAmmo.quickReloadStrain,
        fullReloadStrain: gearspikeAmmo.fullReloadStrain,
        wear: 0,
    },
    {
        id: "weapon_emberdrake_harpooner",
        name: "Emberdrake Harpooner",
        slot: "weapon",
        weaponType: "gun",
        isMechanical: true,
        stats: { atk: 4, def: 0, agi: -1, acc: 1, hp: 0 },
        cardsGranted: ["card_harpoon_shot", "card_drag_target", "card_flame_vent"],
        clutchToggle: "Anchor Pull - Pull yourself to the target.",
        clutches: [
            createClutch("anchor_pull", "Anchor Pull", "Pull yourself to the target.", [
                { kind: "pull_self", tiles: 99 },
            ]),
        ],
        heatProfile: emberdrakeHeat,
        heatCapacity: emberdrakeHeat.capacity,
        heatZones: legacyHeatZones(emberdrakeHeat),
        passiveHeatDecay: emberdrakeHeat.passiveDecay,
        ammoProfile: emberdrakeAmmo,
        ammoMax: emberdrakeAmmo.max,
        quickReloadStrain: emberdrakeAmmo.quickReloadStrain,
        fullReloadStrain: emberdrakeAmmo.fullReloadStrain,
        wear: 0,
    },
    {
        id: "weapon_thunderjaw_cannon",
        name: "Thunderjaw Cannon",
        slot: "weapon",
        weaponType: "gun",
        isMechanical: true,
        stats: { atk: 7, def: -2, agi: -3, acc: -1, hp: 0 },
        cardsGranted: ["card_cannon_blast", "card_deafening_roar", "card_braced_fire"],
        clutchToggle: "Full Barrage - Extra attack at -2 ACC.",
        doubleClutch: "Suppressive Fire - Targets lose movement next turn.",
        clutches: [
            createClutch("full_barrage", "Full Barrage", "Extra attack at -2 ACC.", [
                { kind: "extra_attack", count: 1, accuracyDelta: -2 },
            ]),
            createClutch("suppressive_fire", "Suppressive Fire", "Targets lose movement next turn.", [
                { kind: "apply_status_on_hit", status: "rooted", duration: 1 },
            ]),
        ],
        heatProfile: thunderjawHeat,
        heatCapacity: thunderjawHeat.capacity,
        heatZones: legacyHeatZones(thunderjawHeat),
        passiveHeatDecay: thunderjawHeat.passiveDecay,
        ammoProfile: thunderjawAmmo,
        ammoMax: thunderjawAmmo.max,
        quickReloadStrain: thunderjawAmmo.quickReloadStrain,
        fullReloadStrain: thunderjawAmmo.fullReloadStrain,
        wear: 0,
    },
];
