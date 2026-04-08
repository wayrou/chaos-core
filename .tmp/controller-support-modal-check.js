// src/core/themes.ts
function createTheme(id, name, description, colors, overrides) {
  const c = colors;
  const defaultBackgrounds = {
    primary: c.dark,
    secondary: c.brownDark || c.charcoal,
    tertiary: c.charcoal,
    surface: `${c.dark}f5`,
    overlay: `${c.dark}e6`,
    card: `linear-gradient(180deg, ${c.brownDark || c.charcoal} 0%, ${c.dark} 100%)`
  };
  const defaultGradients = {
    primary: `linear-gradient(180deg, ${c.dark} 0%, ${c.charcoal} 100%)`,
    secondary: `linear-gradient(180deg, ${c.charcoal} 0%, ${c.dark} 100%)`,
    button: `linear-gradient(180deg, ${c.rust} 0%, ${c.terracotta} 100%)`,
    buttonHover: `linear-gradient(180deg, ${c.gold} 0%, ${c.rust} 100%)`,
    card: `linear-gradient(180deg, ${c.brownDark || c.charcoal} 0%, ${c.dark} 100%)`,
    header: `linear-gradient(180deg, ${c.dark} 0%, ${c.charcoal} 100%)`
  };
  const defaultShadows = {
    sm: `0 1px 3px ${c.dark}4d`,
    md: `0 4px 12px ${c.dark}66`,
    lg: `0 8px 24px ${c.dark}80`,
    glow: `0 0 20px ${c.gold}4d`,
    glowAccent: `0 0 20px ${c.emerald}4d`,
    glowError: `0 0 20px ${c.crimson}4d`
  };
  const defaultBorders = {
    primary: c.brownMid || c.coolGray,
    secondary: c.charcoal,
    accent: c.gold,
    subtle: `${c.brownMid || c.coolGray}4d`
  };
  const defaultText = {
    primary: c.offWhite,
    secondary: c.sage || c.silver,
    muted: c.coolGray,
    accent: c.gold,
    highlight: c.amber
  };
  return {
    id,
    name,
    description,
    colors,
    backgrounds: overrides?.backgrounds || defaultBackgrounds,
    gradients: overrides?.gradients || defaultGradients,
    shadows: overrides?.shadows || defaultShadows,
    borders: overrides?.borders || defaultBorders,
    text: overrides?.text || defaultText
  };
}
var THEMES = {
  ardycia: createTheme(
    "ardycia",
    "Ardycia (Default)",
    "Warm earth tones with gold accents - the classic Chaos Core aesthetic",
    {
      white: "#fefefe",
      offWhite: "#ededec",
      silver: "#dcd7d9",
      mist: "#c1c3c4",
      warmGray: "#aaa0a0",
      coolGray: "#8d8c80",
      slate: "#6d6e7d",
      charcoal: "#585150",
      dark: "#252424",
      gold: "#f3a310",
      amber: "#eb9c65",
      rust: "#c5631f",
      terracotta: "#823416",
      crimson: "#c3132c",
      coral: "#f06b58",
      emerald: "#25967a",
      sky: "#84c1e6",
      ocean: "#4984ba",
      lavender: "#b076d6",
      sage: "#abbab1",
      tan: "#bd8b75",
      peach: "#e6b7a8",
      brownDark: "#4d3f34",
      brownMid: "#806d4e"
    }
  ),
  cyberpunk: createTheme(
    "cyberpunk",
    "Cyberpunk",
    "Neon blues and purples with high contrast - futuristic and vibrant",
    {
      white: "#ffffff",
      offWhite: "#e0e0ff",
      silver: "#b8b8ff",
      mist: "#9090cc",
      warmGray: "#7070aa",
      coolGray: "#505088",
      slate: "#404066",
      charcoal: "#303044",
      dark: "#1a1a2e",
      gold: "#00ffff",
      amber: "#00ccff",
      rust: "#0099cc",
      terracotta: "#006699",
      crimson: "#ff0066",
      coral: "#ff3399",
      emerald: "#00ff99",
      sky: "#00ccff",
      ocean: "#0099ff",
      lavender: "#cc66ff"
    },
    {
      gradients: {
        primary: "linear-gradient(180deg, #1a1a2e 0%, #303044 100%)",
        secondary: "linear-gradient(180deg, #303044 0%, #1a1a2e 100%)",
        button: "linear-gradient(180deg, #0099cc 0%, #006699 100%)",
        buttonHover: "linear-gradient(180deg, #00ffff 0%, #0099cc 100%)",
        card: "linear-gradient(180deg, #303044 0%, #1a1a2e 100%)",
        header: "linear-gradient(180deg, #1a1a2e 0%, #404066 100%)"
      },
      shadows: {
        sm: "0 1px 3px rgba(0, 255, 255, 0.3)",
        md: "0 4px 12px rgba(0, 255, 255, 0.4)",
        lg: "0 8px 24px rgba(0, 255, 255, 0.5)",
        glow: "0 0 20px rgba(0, 255, 255, 0.6)",
        glowAccent: "0 0 20px rgba(0, 255, 153, 0.6)",
        glowError: "0 0 20px rgba(255, 0, 102, 0.6)"
      },
      borders: {
        primary: "#505088",
        secondary: "#303044",
        accent: "#00ffff",
        subtle: "rgba(0, 255, 255, 0.3)"
      }
    }
  ),
  monochrome: createTheme(
    "monochrome",
    "Monochrome",
    "Pure black and white with grayscale - minimalist and clean",
    {
      white: "#ffffff",
      offWhite: "#f0f0f0",
      silver: "#d0d0d0",
      mist: "#b0b0b0",
      warmGray: "#909090",
      coolGray: "#707070",
      slate: "#505050",
      charcoal: "#303030",
      dark: "#101010",
      gold: "#ffffff",
      amber: "#cccccc",
      rust: "#999999",
      terracotta: "#666666",
      crimson: "#ffffff",
      coral: "#cccccc",
      emerald: "#ffffff",
      sky: "#cccccc",
      ocean: "#999999",
      lavender: "#cccccc"
    },
    {
      gradients: {
        primary: "linear-gradient(180deg, #101010 0%, #303030 100%)",
        secondary: "linear-gradient(180deg, #303030 0%, #101010 100%)",
        button: "linear-gradient(180deg, #666666 0%, #505050 100%)",
        buttonHover: "linear-gradient(180deg, #909090 0%, #707070 100%)",
        card: "linear-gradient(180deg, #303030 0%, #101010 100%)",
        header: "linear-gradient(180deg, #101010 0%, #505050 100%)"
      },
      shadows: {
        sm: "0 1px 3px rgba(0, 0, 0, 0.5)",
        md: "0 4px 12px rgba(0, 0, 0, 0.6)",
        lg: "0 8px 24px rgba(0, 0, 0, 0.7)",
        glow: "0 0 20px rgba(255, 255, 255, 0.3)",
        glowAccent: "0 0 20px rgba(255, 255, 255, 0.4)",
        glowError: "0 0 20px rgba(255, 255, 255, 0.5)"
      }
    }
  ),
  warm: createTheme(
    "warm",
    "Warm",
    "Rich oranges, reds, and browns - cozy and inviting",
    {
      white: "#fff8f0",
      offWhite: "#ffe8d0",
      silver: "#ffd8b0",
      mist: "#ffc890",
      warmGray: "#cc9966",
      coolGray: "#aa7755",
      slate: "#885544",
      charcoal: "#664433",
      dark: "#442211",
      gold: "#ff8800",
      amber: "#ff6600",
      rust: "#cc4400",
      terracotta: "#992200",
      crimson: "#ff4444",
      coral: "#ff6666",
      emerald: "#88cc44",
      sky: "#ffaa66",
      ocean: "#cc8844",
      lavender: "#cc88aa",
      brownDark: "#664433",
      brownMid: "#aa7755"
    }
  ),
  cool: createTheme(
    "cool",
    "Cool",
    "Blues, teals, and cool grays - calm and professional",
    {
      white: "#f0f8ff",
      offWhite: "#e0f0ff",
      silver: "#c0e0ff",
      mist: "#a0d0ff",
      warmGray: "#80a0cc",
      coolGray: "#6080aa",
      slate: "#406088",
      charcoal: "#304066",
      dark: "#202044",
      gold: "#66ccff",
      amber: "#44aaff",
      rust: "#2288cc",
      terracotta: "#0066aa",
      crimson: "#ff6688",
      coral: "#ff88aa",
      emerald: "#44ffaa",
      sky: "#66ccff",
      ocean: "#4488ff",
      lavender: "#aa88ff"
    }
  ),
  // NEW THEMES
  neon: createTheme(
    "neon",
    "Neon",
    "Electric pinks, purples, and cyans - high-energy and eye-catching",
    {
      white: "#ffffff",
      offWhite: "#ffe0ff",
      silver: "#ffb8ff",
      mist: "#cc90cc",
      warmGray: "#aa70aa",
      coolGray: "#885088",
      slate: "#664066",
      charcoal: "#443044",
      dark: "#221122",
      gold: "#ff00ff",
      amber: "#ff44ff",
      rust: "#cc00cc",
      terracotta: "#990099",
      crimson: "#ff0066",
      coral: "#ff3399",
      emerald: "#00ff99",
      sky: "#00ffff",
      ocean: "#0099ff",
      lavender: "#cc66ff",
      magenta: "#ff00ff",
      cyan: "#00ffff"
    },
    {
      gradients: {
        primary: "linear-gradient(180deg, #221122 0%, #443044 100%)",
        secondary: "linear-gradient(180deg, #443044 0%, #221122 100%)",
        button: "linear-gradient(180deg, #cc00cc 0%, #990099 100%)",
        buttonHover: "linear-gradient(180deg, #ff00ff 0%, #cc00cc 100%)",
        card: "linear-gradient(180deg, #443044 0%, #221122 100%)",
        header: "linear-gradient(180deg, #221122 0%, #664066 100%)"
      },
      shadows: {
        sm: "0 1px 3px rgba(255, 0, 255, 0.4)",
        md: "0 4px 12px rgba(255, 0, 255, 0.5)",
        lg: "0 8px 24px rgba(255, 0, 255, 0.6)",
        glow: "0 0 30px rgba(255, 0, 255, 0.8)",
        glowAccent: "0 0 30px rgba(0, 255, 255, 0.8)",
        glowError: "0 0 30px rgba(255, 0, 102, 0.8)"
      },
      borders: {
        primary: "#885088",
        secondary: "#443044",
        accent: "#ff00ff",
        subtle: "rgba(255, 0, 255, 0.4)"
      }
    }
  ),
  forest: createTheme(
    "forest",
    "Forest",
    "Deep greens and earth tones - natural and grounded",
    {
      white: "#f0fff0",
      offWhite: "#e0ffe0",
      silver: "#c0ffc0",
      mist: "#a0cca0",
      warmGray: "#80aa80",
      coolGray: "#608860",
      slate: "#406640",
      charcoal: "#304430",
      dark: "#202220",
      gold: "#88cc44",
      amber: "#66aa33",
      rust: "#448822",
      terracotta: "#336611",
      crimson: "#cc4444",
      coral: "#cc6666",
      emerald: "#44cc88",
      sky: "#66ccaa",
      ocean: "#4488aa",
      lavender: "#88aa88",
      forest: "#2d5a2d",
      olive: "#5a7a3a",
      brownDark: "#3a4a2a",
      brownMid: "#5a7a4a"
    },
    {
      backgrounds: {
        primary: "#202220",
        secondary: "#304430",
        tertiary: "#406640",
        surface: "#202220f5",
        overlay: "#202220e6",
        card: "linear-gradient(180deg, #304430 0%, #202220 100%)"
      },
      gradients: {
        primary: "linear-gradient(180deg, #202220 0%, #304430 100%)",
        secondary: "linear-gradient(180deg, #304430 0%, #202220 100%)",
        button: "linear-gradient(180deg, #448822 0%, #336611 100%)",
        buttonHover: "linear-gradient(180deg, #88cc44 0%, #66aa33 100%)",
        card: "linear-gradient(180deg, #304430 0%, #202220 100%)",
        header: "linear-gradient(180deg, #202220 0%, #406640 100%)"
      },
      shadows: {
        sm: "0 1px 3px rgba(68, 204, 136, 0.3)",
        md: "0 4px 12px rgba(68, 204, 136, 0.4)",
        lg: "0 8px 24px rgba(68, 204, 136, 0.5)",
        glow: "0 0 20px rgba(68, 204, 136, 0.5)",
        glowAccent: "0 0 20px rgba(136, 204, 68, 0.5)",
        glowError: "0 0 20px rgba(204, 68, 68, 0.5)"
      },
      borders: {
        primary: "#608860",
        secondary: "#304430",
        accent: "#88cc44",
        subtle: "rgba(96, 136, 96, 0.3)"
      }
    }
  ),
  sunset: createTheme(
    "sunset",
    "Sunset",
    "Vibrant oranges, pinks, and purples - dramatic and warm",
    {
      white: "#fff8f0",
      offWhite: "#ffe8e0",
      silver: "#ffd8c0",
      mist: "#ffc8a0",
      warmGray: "#cc9988",
      coolGray: "#aa7766",
      slate: "#885544",
      charcoal: "#664433",
      dark: "#442222",
      gold: "#ff8844",
      amber: "#ff6644",
      rust: "#cc4422",
      terracotta: "#992211",
      crimson: "#ff4466",
      coral: "#ff6688",
      emerald: "#88cc66",
      sky: "#ffaa88",
      ocean: "#cc8866",
      lavender: "#cc88aa",
      rose: "#ff88aa",
      magenta: "#cc66aa"
    },
    {
      gradients: {
        primary: "linear-gradient(180deg, #442222 0%, #664433 100%)",
        secondary: "linear-gradient(180deg, #664433 0%, #442222 100%)",
        button: "linear-gradient(180deg, #cc4422 0%, #992211 100%)",
        buttonHover: "linear-gradient(180deg, #ff8844 0%, #ff6644 100%)",
        card: "linear-gradient(180deg, #664433 0%, #442222 100%)",
        header: "linear-gradient(180deg, #442222 0%, #885544 100%)"
      },
      shadows: {
        sm: "0 1px 3px rgba(255, 136, 68, 0.4)",
        md: "0 4px 12px rgba(255, 136, 68, 0.5)",
        lg: "0 8px 24px rgba(255, 136, 68, 0.6)",
        glow: "0 0 25px rgba(255, 136, 68, 0.7)",
        glowAccent: "0 0 25px rgba(255, 102, 68, 0.7)",
        glowError: "0 0 25px rgba(255, 68, 102, 0.7)"
      },
      borders: {
        primary: "#aa7766",
        secondary: "#664433",
        accent: "#ff8844",
        subtle: "rgba(255, 136, 68, 0.4)"
      }
    }
  ),
  ocean: createTheme(
    "ocean",
    "Ocean",
    "Deep blues and teals - serene and immersive",
    {
      white: "#f0f8ff",
      offWhite: "#e0f0ff",
      silver: "#c0e0ff",
      mist: "#a0d0ff",
      warmGray: "#80a0cc",
      coolGray: "#6080aa",
      slate: "#406088",
      charcoal: "#304066",
      dark: "#202044",
      gold: "#44aaff",
      amber: "#2288ff",
      rust: "#0066cc",
      terracotta: "#0044aa",
      crimson: "#ff6688",
      coral: "#ff88aa",
      emerald: "#44ffaa",
      sky: "#66ccff",
      ocean: "#4488ff",
      lavender: "#8888ff",
      cyan: "#00ccff",
      navy: "#001144"
    },
    {
      backgrounds: {
        primary: "#202044",
        secondary: "#304066",
        tertiary: "#406088",
        surface: "#202044f5",
        overlay: "#202044e6",
        card: "linear-gradient(180deg, #304066 0%, #202044 100%)"
      },
      gradients: {
        primary: "linear-gradient(180deg, #202044 0%, #304066 100%)",
        secondary: "linear-gradient(180deg, #304066 0%, #202044 100%)",
        button: "linear-gradient(180deg, #0066cc 0%, #0044aa 100%)",
        buttonHover: "linear-gradient(180deg, #44aaff 0%, #2288ff 100%)",
        card: "linear-gradient(180deg, #304066 0%, #202044 100%)",
        header: "linear-gradient(180deg, #202044 0%, #406088 100%)"
      },
      shadows: {
        sm: "0 1px 3px rgba(68, 170, 255, 0.3)",
        md: "0 4px 12px rgba(68, 170, 255, 0.4)",
        lg: "0 8px 24px rgba(68, 170, 255, 0.5)",
        glow: "0 0 25px rgba(68, 170, 255, 0.6)",
        glowAccent: "0 0 25px rgba(0, 204, 255, 0.6)",
        glowError: "0 0 25px rgba(255, 102, 136, 0.6)"
      },
      borders: {
        primary: "#6080aa",
        secondary: "#304066",
        accent: "#44aaff",
        subtle: "rgba(68, 170, 255, 0.3)"
      }
    }
  ),
  void: createTheme(
    "void",
    "Void",
    "Deep purples and blacks with subtle glows - mysterious and dark",
    {
      white: "#f0f0ff",
      offWhite: "#e0e0ff",
      silver: "#c0c0ff",
      mist: "#a0a0cc",
      warmGray: "#8080aa",
      coolGray: "#606088",
      slate: "#404066",
      charcoal: "#303044",
      dark: "#1a1a2e",
      gold: "#aa88ff",
      amber: "#8866ff",
      rust: "#6644cc",
      terracotta: "#4422aa",
      crimson: "#ff66aa",
      coral: "#ff88cc",
      emerald: "#88ffaa",
      sky: "#aa88ff",
      ocean: "#8866ff",
      lavender: "#cc88ff",
      void: "#1a0a2e",
      magenta: "#cc66ff"
    },
    {
      backgrounds: {
        primary: "#1a1a2e",
        secondary: "#303044",
        tertiary: "#404066",
        surface: "#1a1a2ef5",
        overlay: "#1a1a2ee6",
        card: "linear-gradient(180deg, #303044 0%, #1a1a2e 100%)"
      },
      gradients: {
        primary: "linear-gradient(180deg, #1a1a2e 0%, #303044 100%)",
        secondary: "linear-gradient(180deg, #303044 0%, #1a1a2e 100%)",
        button: "linear-gradient(180deg, #6644cc 0%, #4422aa 100%)",
        buttonHover: "linear-gradient(180deg, #aa88ff 0%, #8866ff 100%)",
        card: "linear-gradient(180deg, #303044 0%, #1a1a2e 100%)",
        header: "linear-gradient(180deg, #1a1a2e 0%, #404066 100%)"
      },
      shadows: {
        sm: "0 1px 3px rgba(170, 136, 255, 0.4)",
        md: "0 4px 12px rgba(170, 136, 255, 0.5)",
        lg: "0 8px 24px rgba(170, 136, 255, 0.6)",
        glow: "0 0 30px rgba(170, 136, 255, 0.7)",
        glowAccent: "0 0 30px rgba(204, 136, 255, 0.7)",
        glowError: "0 0 30px rgba(255, 102, 170, 0.7)"
      },
      borders: {
        primary: "#606088",
        secondary: "#303044",
        accent: "#aa88ff",
        subtle: "rgba(170, 136, 255, 0.4)"
      }
    }
  )
};

// src/core/settings.ts
var DEFAULT_SETTINGS = {
  masterVolume: 80,
  musicVolume: 70,
  sfxVolume: 100,
  screenShake: true,
  showDamageNumbers: true,
  showGridCoordinates: false,
  animationSpeed: "normal",
  uiTheme: "ardycia",
  cardTheme: "dark",
  autosaveEnabled: true,
  confirmEndTurn: false,
  showTutorialHints: true,
  controllerEnabled: true,
  controllerVibration: true,
  controllerDeadzone: 15,
  controllerBindings: {
    confirm: [{ kind: "button", code: 0 }],
    cancel: [{ kind: "button", code: 1 }],
    menu: [{ kind: "button", code: 9 }],
    pause: [{ kind: "button", code: 9 }],
    moveUp: [
      { kind: "button", code: 12 },
      { kind: "axis", code: 1, direction: "negative", threshold: 0.35 }
    ],
    moveDown: [
      { kind: "button", code: 13 },
      { kind: "axis", code: 1, direction: "positive", threshold: 0.35 }
    ],
    moveLeft: [
      { kind: "button", code: 14 },
      { kind: "axis", code: 0, direction: "negative", threshold: 0.35 }
    ],
    moveRight: [
      { kind: "button", code: 15 },
      { kind: "axis", code: 0, direction: "positive", threshold: 0.35 }
    ],
    nextUnit: [{ kind: "button", code: 5 }],
    prevUnit: [{ kind: "button", code: 4 }],
    endTurn: [{ kind: "button", code: 3 }],
    openInventory: [{ kind: "button", code: 8 }],
    openMap: [{ kind: "button", code: 2 }],
    attack: [{ kind: "button", code: 0 }],
    interact: [{ kind: "button", code: 2 }],
    dash: [{ kind: "button", code: 5 }],
    tabPrev: [{ kind: "button", code: 4 }],
    tabNext: [{ kind: "button", code: 5 }],
    zoomOut: [{ kind: "button", code: 6 }],
    zoomIn: [{ kind: "button", code: 7 }],
    toggleSurfaceMode: [{ kind: "button", code: 10 }],
    toggleLayoutMode: [{ kind: "button", code: 11 }],
    windowPrimary: [{ kind: "button", code: 2 }],
    windowSecondary: [{ kind: "button", code: 3 }]
  },
  controllerAssignments: {
    P1: 0,
    P2: 1
  },
  highContrastMode: false,
  largeText: false,
  reducedMotion: false,
  colorblindMode: "none"
};
var currentSettings = { ...DEFAULT_SETTINGS };
var settingsListeners = /* @__PURE__ */ new Set();
function getSettings() {
  return { ...currentSettings };
}
function subscribeToSettings(listener) {
  settingsListeners.add(listener);
  return () => settingsListeners.delete(listener);
}

// src/core/controllerSupport.ts
var BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15
};
var AXIS = {
  LEFT_X: 0,
  LEFT_Y: 1,
  RIGHT_X: 2,
  RIGHT_Y: 3
};
var GAME_ACTIONS = [
  "confirm",
  "cancel",
  "menu",
  "moveUp",
  "moveDown",
  "moveLeft",
  "moveRight",
  "nextUnit",
  "prevUnit",
  "endTurn",
  "openInventory",
  "openMap",
  "pause",
  "attack",
  "interact",
  "dash",
  "tabPrev",
  "tabNext",
  "zoomIn",
  "zoomOut",
  "toggleSurfaceMode",
  "toggleLayoutMode",
  "windowPrimary",
  "windowSecondary"
];
var DEFAULT_CONTROLLER_BINDINGS = {
  confirm: [{ kind: "button", code: BUTTON.A }],
  cancel: [{ kind: "button", code: BUTTON.B }],
  menu: [{ kind: "button", code: BUTTON.START }],
  moveUp: [
    { kind: "button", code: BUTTON.DPAD_UP },
    { kind: "axis", code: AXIS.LEFT_Y, direction: "negative", threshold: 0.35 }
  ],
  moveDown: [
    { kind: "button", code: BUTTON.DPAD_DOWN },
    { kind: "axis", code: AXIS.LEFT_Y, direction: "positive", threshold: 0.35 }
  ],
  moveLeft: [
    { kind: "button", code: BUTTON.DPAD_LEFT },
    { kind: "axis", code: AXIS.LEFT_X, direction: "negative", threshold: 0.35 }
  ],
  moveRight: [
    { kind: "button", code: BUTTON.DPAD_RIGHT },
    { kind: "axis", code: AXIS.LEFT_X, direction: "positive", threshold: 0.35 }
  ],
  nextUnit: [{ kind: "button", code: BUTTON.RB }],
  prevUnit: [{ kind: "button", code: BUTTON.LB }],
  endTurn: [{ kind: "button", code: BUTTON.Y }],
  openInventory: [{ kind: "button", code: BUTTON.SELECT }],
  openMap: [{ kind: "button", code: BUTTON.X }],
  pause: [{ kind: "button", code: BUTTON.START }],
  attack: [{ kind: "button", code: BUTTON.A }],
  interact: [{ kind: "button", code: BUTTON.X }],
  dash: [{ kind: "button", code: BUTTON.RB }],
  tabPrev: [{ kind: "button", code: BUTTON.LB }],
  tabNext: [{ kind: "button", code: BUTTON.RB }],
  zoomIn: [{ kind: "button", code: BUTTON.RT }],
  zoomOut: [{ kind: "button", code: BUTTON.LT }],
  toggleSurfaceMode: [{ kind: "button", code: BUTTON.L3 }],
  toggleLayoutMode: [{ kind: "button", code: BUTTON.R3 }],
  windowPrimary: [{ kind: "button", code: BUTTON.X }],
  windowSecondary: [{ kind: "button", code: BUTTON.Y }]
};
var DEFAULT_BINDINGS = Object.fromEntries(
  GAME_ACTIONS.map((action) => [
    action,
    DEFAULT_CONTROLLER_BINDINGS[action].filter((binding) => binding.kind === "button").map((binding) => binding.code)
  ])
);
var isEnabled = true;
var deadzone = 0.15;
var vibrationEnabled = true;
var currentBindings = normalizeBindingMap(DEFAULT_SETTINGS.controllerBindings);
var controllerAssignments = {
  P1: DEFAULT_SETTINGS.controllerAssignments.P1,
  P2: DEFAULT_SETTINGS.controllerAssignments.P2
};
var lastInputMode = "keyboard";
var actionListeners = /* @__PURE__ */ new Set();
var focusableElements = [];
var currentFocusIndex = 0;
var focusObserver = null;
var focusRefreshRaf = null;
var currentContext = null;
var currentMode = "focus";
var suppressFocusRefresh = false;
var captureState = null;
var animationFrameId = null;
var initialized = false;
var navCooldown = 0;
var NAV_COOLDOWN_MS = 150;
var lastFrameTime = 0;
var BUTTON_PRESS_THRESHOLD = 0.35;
var previousActionStatesByPad = {};
var previousButtonStatesByPad = [];
var previousAxisDigitalByPad = {};
var DEBUG_OVERLAY_ID = "controllerDebugOverlay";
var FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[data-controller-focusable='true']"
].join(", ");
function initControllerSupport() {
  if (initialized) {
    return;
  }
  try {
    applySettings(getSettings());
  } catch {
    applySettings(DEFAULT_SETTINGS);
  }
  subscribeToSettings((settings) => {
    applySettings(settings);
  });
  window.addEventListener("gamepadconnected", onGamepadConnected);
  window.addEventListener("gamepaddisconnected", onGamepadDisconnected);
  startPolling();
  ensureFocusObserver();
  ensureDebugOverlay();
  syncDebugOverlay();
  initialized = true;
  console.log("[CONTROLLER] Initialized");
}
function shutdownControllerSupport() {
  stopPolling();
  focusObserver?.disconnect();
  focusObserver = null;
  clearScheduledFocusRefresh();
  window.removeEventListener("gamepadconnected", onGamepadConnected);
  window.removeEventListener("gamepaddisconnected", onGamepadDisconnected);
  currentContext = null;
  focusableElements = [];
  initialized = false;
}
function applySettings(settings) {
  isEnabled = settings.controllerEnabled;
  vibrationEnabled = settings.controllerVibration;
  deadzone = Math.max(0, Math.min(0.9, settings.controllerDeadzone / 100));
  currentBindings = normalizeBindingMap(settings.controllerBindings);
  controllerAssignments = {
    P1: settings.controllerAssignments?.P1 ?? DEFAULT_SETTINGS.controllerAssignments.P1,
    P2: settings.controllerAssignments?.P2 ?? DEFAULT_SETTINGS.controllerAssignments.P2
  };
  scheduleFocusRefresh();
  syncDebugOverlay();
}
function startPolling() {
  if (animationFrameId !== null) {
    return;
  }
  lastFrameTime = performance.now();
  pollLoop();
}
function stopPolling() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}
function pollLoop() {
  animationFrameId = requestAnimationFrame(pollLoop);
  if (!isEnabled || typeof navigator.getGamepads !== "function") {
    return;
  }
  const now = performance.now();
  const deltaTime = now - lastFrameTime;
  lastFrameTime = now;
  if (navCooldown > 0) {
    navCooldown = Math.max(0, navCooldown - deltaTime);
  }
  const gamepads = navigator.getGamepads();
  for (let index = 0; index < gamepads.length; index++) {
    const gamepad = gamepads[index];
    if (!gamepad) {
      continue;
    }
    processGamepad(gamepad, index);
  }
}
function processGamepad(gamepad, gamepadIndex) {
  const previousButtons = previousButtonStatesByPad[gamepadIndex] ?? new Array(gamepad.buttons.length).fill(false);
  const previousActionStates = previousActionStatesByPad[gamepadIndex] ?? {};
  const previousAxisDigital = previousAxisDigitalByPad[gamepadIndex] ?? {};
  const assignedPlayer = getAssignedPlayerForGamepad(gamepadIndex);
  if (captureState) {
    const captureBinding = detectCapturedBinding(gamepad, previousButtons, previousAxisDigital);
    updatePreviousRawStates(gamepad, gamepadIndex);
    if (captureBinding) {
      const activeCapture = captureState;
      captureState = null;
      activeCapture.onCapture(captureBinding);
      syncDebugOverlay();
    }
    return;
  }
  const currentActionStates = {};
  for (const action of GAME_ACTIONS) {
    const active = isActionActiveForGamepad(gamepad, action);
    currentActionStates[action] = active;
    const wasActive = Boolean(previousActionStates[action]);
    if (isNavigationAction(action)) {
      if (active && (!wasActive || navCooldown <= 0)) {
        triggerAction(action, assignedPlayer ?? void 0);
        navCooldown = NAV_COOLDOWN_MS;
      }
      continue;
    }
    if (active && !wasActive) {
      triggerAction(action, assignedPlayer ?? void 0);
    }
  }
  previousActionStatesByPad[gamepadIndex] = currentActionStates;
  updatePreviousRawStates(gamepad, gamepadIndex);
}
function updatePreviousRawStates(gamepad, gamepadIndex) {
  previousButtonStatesByPad[gamepadIndex] = gamepad.buttons.map((button) => isGamepadButtonPressed(button));
  const axisDigital = {};
  Object.values(AXIS).forEach((axisIndex) => {
    axisDigital[`${axisIndex}:positive`] = isAxisDirectionActive(gamepad.axes[axisIndex] ?? 0, "positive", 0.35);
    axisDigital[`${axisIndex}:negative`] = isAxisDirectionActive(gamepad.axes[axisIndex] ?? 0, "negative", 0.35);
  });
  previousAxisDigitalByPad[gamepadIndex] = axisDigital;
}
function normalizeBinding(binding) {
  return {
    kind: binding.kind === "axis" ? "axis" : "button",
    code: Number(binding.code ?? 0),
    direction: binding.kind === "axis" ? binding.direction === "positive" ? "positive" : "negative" : void 0,
    threshold: binding.kind === "axis" ? clampThreshold(binding.threshold) : void 0
  };
}
function normalizeBindingMap(bindings) {
  const normalized = {};
  GAME_ACTIONS.forEach((action) => {
    const nextBindings = bindings?.[action];
    normalized[action] = nextBindings && nextBindings.length > 0 ? nextBindings.map(normalizeBinding) : DEFAULT_CONTROLLER_BINDINGS[action].map(normalizeBinding);
  });
  return normalized;
}
function clampThreshold(value) {
  const threshold = Number.isFinite(value) ? Number(value) : 0.35;
  return Math.max(0.15, Math.min(0.95, threshold));
}
function isAxisDirectionActive(value, direction, threshold) {
  return direction === "positive" ? value >= threshold : value <= -threshold;
}
function isGamepadButtonPressed(button, threshold = BUTTON_PRESS_THRESHOLD) {
  if (!button) {
    return false;
  }
  return Boolean(button.pressed || button.value >= threshold);
}
function isBindingActive(gamepad, binding) {
  if (binding.kind === "button") {
    return isGamepadButtonPressed(gamepad.buttons[binding.code]);
  }
  const axisValue = gamepad.axes[binding.code] ?? 0;
  return isAxisDirectionActive(axisValue, binding.direction ?? "positive", clampThreshold(binding.threshold));
}
function isActionActiveForGamepad(gamepad, action) {
  const bindings = currentBindings[action] ?? DEFAULT_CONTROLLER_BINDINGS[action];
  return bindings.some((binding) => isBindingActive(gamepad, binding));
}
function detectCapturedBinding(gamepad, previousButtons, previousAxisDigital) {
  if (!captureState) {
    return null;
  }
  const hasAnyActiveRawInput = gamepad.buttons.some((button) => isGamepadButtonPressed(button)) || gamepad.axes.some((axis) => Math.abs(axis) >= Math.max(deadzone + 0.05, 0.35));
  if (!captureState.primed) {
    if (!hasAnyActiveRawInput) {
      captureState.primed = true;
    }
    return null;
  }
  for (let buttonIndex = 0; buttonIndex < gamepad.buttons.length; buttonIndex++) {
    const pressed = isGamepadButtonPressed(gamepad.buttons[buttonIndex]);
    const wasPressed = Boolean(previousButtons[buttonIndex]);
    if (pressed && !wasPressed) {
      return { kind: "button", code: buttonIndex };
    }
  }
  const threshold = Math.max(deadzone + 0.05, 0.4);
  for (const axisIndex of Object.values(AXIS)) {
    const axisValue = gamepad.axes[axisIndex] ?? 0;
    const positiveKey = `${axisIndex}:positive`;
    const negativeKey = `${axisIndex}:negative`;
    const positiveActive = isAxisDirectionActive(axisValue, "positive", threshold);
    const negativeActive = isAxisDirectionActive(axisValue, "negative", threshold);
    if (positiveActive && !previousAxisDigital[positiveKey]) {
      return { kind: "axis", code: axisIndex, direction: "positive", threshold };
    }
    if (negativeActive && !previousAxisDigital[negativeKey]) {
      return { kind: "axis", code: axisIndex, direction: "negative", threshold };
    }
  }
  return null;
}
function isNavigationAction(action) {
  return action === "moveUp" || action === "moveDown" || action === "moveLeft" || action === "moveRight";
}
function getButtonBindings() {
  return Object.fromEntries(
    GAME_ACTIONS.map((action) => [
      action,
      (currentBindings[action] ?? []).filter((binding) => binding.kind === "button").map((binding) => binding.code)
    ])
  );
}
function getControllerBindings() {
  return Object.fromEntries(
    GAME_ACTIONS.map((action) => [action, (currentBindings[action] ?? []).map((binding) => ({ ...binding }))])
  );
}
function getControllerAssignments() {
  return {
    P1: controllerAssignments.P1,
    P2: controllerAssignments.P2
  };
}
function getControllerActionLabel(action) {
  return getControllerActionLabelForPlayer(action);
}
function getControllerActionLabelForPlayer(action, playerId) {
  const bindings = currentBindings[action] ?? DEFAULT_CONTROLLER_BINDINGS[action];
  if (bindings.length <= 0) {
    return "UNBOUND";
  }
  const gamepadId = playerId ? getAssignedGamepad(playerId)?.id ?? null : null;
  return bindings.map((binding) => getBindingLabel(binding, gamepadId)).join(" / ");
}
function getBindingLabel(binding, gamepadId) {
  if (binding.kind === "button") {
    return getButtonName(binding.code, gamepadId);
  }
  const axisName = binding.code === AXIS.LEFT_X ? "LS H" : binding.code === AXIS.LEFT_Y ? "LS V" : binding.code === AXIS.RIGHT_X ? "RS H" : binding.code === AXIS.RIGHT_Y ? "RS V" : `AXIS ${binding.code}`;
  const direction = binding.direction === "negative" ? binding.code === AXIS.LEFT_X || binding.code === AXIS.RIGHT_X ? "-" : "UP" : binding.code === AXIS.LEFT_X || binding.code === AXIS.RIGHT_X ? "+" : "DOWN";
  return `${axisName} ${direction}`;
}
function findActionsUsingBinding(binding, options) {
  return GAME_ACTIONS.filter((action) => {
    if (options?.excludeAction && action === options.excludeAction) {
      return false;
    }
    return (currentBindings[action] ?? []).some((entry) => bindingsMatch(entry, binding));
  });
}
function bindingsMatch(left, right) {
  return left.kind === right.kind && left.code === right.code && (left.direction ?? void 0) === (right.direction ?? void 0);
}
function startControllerBindingCapture(config) {
  captureState = {
    ...config,
    primed: false
  };
  syncDebugOverlay();
}
function cancelControllerBindingCapture() {
  if (!captureState) {
    return;
  }
  const nextCapture = captureState;
  captureState = null;
  nextCapture.onCancel?.();
  syncDebugOverlay();
}
function isControllerBindingCaptureActive() {
  return Boolean(captureState);
}
function triggerAction(action, playerId) {
  markControllerInputActive();
  console.log(`[CONTROLLER] Action: ${action}${playerId ? ` (${playerId})` : ""}`);
  if (handleGlobalModalAction(action)) {
    return;
  }
  if (handleContextAction(action, playerId)) {
    return;
  }
  if (!currentContext && handleDefaultFocusAction(action)) {
    return;
  }
  for (const listener of actionListeners) {
    listener(action, playerId);
  }
}
function handleGlobalModalAction(action) {
  const modal = document.querySelector(".game-confirm-modal-backdrop");
  if (!modal) {
    return false;
  }
  switch (action) {
    case "moveUp":
      navigateFocus("up");
      return true;
    case "moveDown":
      navigateFocus("down");
      return true;
    case "moveLeft":
    case "tabPrev":
    case "prevUnit":
      navigateFocus("left");
      return true;
    case "moveRight":
    case "tabNext":
    case "nextUnit":
      navigateFocus("right");
      return true;
    case "confirm":
      activateFocusedElement();
      return true;
    case "cancel": {
      const dismissTarget = modal.querySelector(
        [
          "[data-confirm-dialog-action='cancel']",
          "[data-alert-dialog-action='dismiss']",
          "[data-opmap-confirm-action='cancel']",
          "[data-theater-exit-confirm-action='cancel']",
          "[data-battle-exit-confirm-action='cancel']",
          ".game-confirm-modal__actions .game-confirm-modal__btn:not(.game-confirm-modal__btn--primary)",
          ".game-confirm-modal__actions .game-confirm-modal__btn"
        ].join(", ")
      );
      dismissTarget?.click();
      return true;
    }
    default:
      return false;
  }
}
function handleContextAction(action, playerId) {
  if (!ensureCurrentContextIsMounted()) {
    return false;
  }
  if (!currentContext) {
    return false;
  }
  if (action === "toggleLayoutMode" && currentContext.onLayoutAction) {
    setControllerMode(currentMode === "layout" ? currentContext.onCursorAction ? "cursor" : "focus" : "layout");
    return true;
  }
  if (action === "toggleSurfaceMode" && currentContext.onCursorAction) {
    setControllerMode(currentMode === "cursor" ? "focus" : "cursor");
    return true;
  }
  if (action === "cancel" && currentMode === "layout") {
    setControllerMode(currentContext.onCursorAction ? "cursor" : "focus");
    return true;
  }
  if (currentMode === "layout" && currentContext.onLayoutAction?.(action, playerId)) {
    return true;
  }
  if (currentMode === "cursor" && currentContext.onCursorAction?.(action, playerId)) {
    return true;
  }
  if (currentMode === "focus") {
    if (currentContext.onFocusAction?.(action, playerId)) {
      return true;
    }
    if (handleDefaultFocusAction(action)) {
      return true;
    }
  }
  return currentContext.onAction?.(action, playerId, currentMode) ?? false;
}
function handleDefaultFocusAction(action) {
  switch (action) {
    case "moveUp":
      navigateFocus("up");
      return true;
    case "moveDown":
      navigateFocus("down");
      return true;
    case "moveLeft":
      navigateFocus("left");
      return true;
    case "moveRight":
      navigateFocus("right");
      return true;
    case "confirm":
      activateFocusedElement();
      return true;
    case "tabPrev":
    case "prevUnit":
      navigateFocus("left");
      return true;
    case "tabNext":
    case "nextUnit":
      navigateFocus("right");
      return true;
    default:
      return false;
  }
}
function registerControllerContext(context) {
  currentContext = context;
  currentMode = context.defaultMode ?? "focus";
  scheduleFocusRefresh();
  currentContext.onModeChange?.(currentMode);
  syncDebugOverlay();
  return () => {
    if (currentContext?.id === context.id) {
      currentContext = null;
      currentMode = "focus";
      scheduleFocusRefresh();
      syncDebugOverlay();
    }
  };
}
function clearControllerContext(contextId) {
  if (!currentContext) {
    return;
  }
  if (contextId && currentContext.id !== contextId) {
    return;
  }
  currentContext = null;
  currentMode = "focus";
  scheduleFocusRefresh();
  syncDebugOverlay();
}
function getControllerMode() {
  return currentMode;
}
function setControllerMode(mode) {
  if (currentMode === mode) {
    return;
  }
  currentMode = mode;
  currentContext?.onModeChange?.(currentMode);
  scheduleFocusRefresh();
  syncDebugOverlay();
}
function getLastInputMode() {
  return lastInputMode;
}
function markKeyboardInputActive() {
  lastInputMode = "keyboard";
  syncDebugOverlay();
}
function markControllerInputActive() {
  lastInputMode = "controller";
  syncDebugOverlay();
}
function shouldSuppressGameplayInput(playerId) {
  ensureCurrentContextIsMounted();
  if (!currentContext) {
    return false;
  }
  if (typeof currentContext.suppressGameplayInput === "function") {
    return currentContext.suppressGameplayInput(playerId, currentMode);
  }
  return Boolean(currentContext.suppressGameplayInput);
}
function ensureDebugOverlay() {
  if (!import.meta?.env?.DEV) {
    return;
  }
  if (document.getElementById(DEBUG_OVERLAY_ID)) {
    return;
  }
  const overlay = document.createElement("div");
  overlay.id = DEBUG_OVERLAY_ID;
  overlay.className = "controller-debug-overlay";
  overlay.setAttribute("aria-hidden", "true");
  document.body.appendChild(overlay);
}
function syncDebugOverlay() {
  const overlay = document.getElementById(DEBUG_OVERLAY_ID);
  if (!overlay) {
    return;
  }
  const assignments = `P1:${controllerAssignments.P1 ?? "NONE"} P2:${controllerAssignments.P2 ?? "NONE"}`;
  const contextId = currentContext?.id ?? "none";
  const debugState = currentContext?.getDebugState?.() ?? {};
  const screen = document.body.getAttribute("data-screen") ?? document.querySelector("[data-screen]")?.getAttribute("data-screen") ?? "unknown";
  const focusLabel = debugState.focus ?? getFocusedElementDebugLabel() ?? "none";
  const hoverLabel = debugState.hovered ?? "none";
  const windowLabel = debugState.window ?? "none";
  const coords = Number.isFinite(debugState.x) && Number.isFinite(debugState.y) ? `${debugState.x},${debugState.y}` : "--";
  overlay.innerHTML = `
    <div>CURSOR_PROOF_CONTROLLER_COUCH screen:${escapeHtml(screen)} context:${escapeHtml(contextId)} mode:${escapeHtml(currentMode)} input:${escapeHtml(lastInputMode)}</div>
    <div>focus:${escapeHtml(focusLabel)} hovered:${escapeHtml(hoverLabel)} window:${escapeHtml(windowLabel)} coords:${escapeHtml(coords)} controllers:${escapeHtml(assignments)}</div>
  `;
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function getFocusedElementDebugLabel() {
  const element = focusableElements[currentFocusIndex] ?? document.activeElement;
  if (!element) {
    return null;
  }
  const text = (element.getAttribute("aria-label") || element.textContent || element.getAttribute("data-controller-window") || element.id || element.className || "").trim().replace(/\s+/g, " ");
  return text.slice(0, 56) || element.tagName.toLowerCase();
}
function ensureFocusObserver() {
  if (focusObserver || typeof MutationObserver === "undefined") {
    return;
  }
  const startObserver = () => {
    const target = document.body;
    if (!target) {
      window.setTimeout(startObserver, 50);
      return;
    }
    focusObserver = new MutationObserver(() => {
      if (suppressFocusRefresh) {
        return;
      }
      scheduleFocusRefresh();
    });
    focusObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "hidden", "class", "style", "data-controller-exclude", "data-controller-focusable"]
    });
  };
  startObserver();
}
function clearScheduledFocusRefresh() {
  if (focusRefreshRaf !== null) {
    cancelAnimationFrame(focusRefreshRaf);
    focusRefreshRaf = null;
  }
}
function scheduleFocusRefresh() {
  clearScheduledFocusRefresh();
  focusRefreshRaf = requestAnimationFrame(() => {
    focusRefreshRaf = null;
    updateFocusableElements();
  });
}
function updateFocusableElements() {
  const root = resolveFocusRoot();
  const nextFocusable = Array.from(
    root.querySelectorAll(currentContext?.focusSelector || FOCUSABLE_SELECTOR)
  ).filter(isElementFocusable);
  const previousFocus = focusableElements[currentFocusIndex] ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  focusableElements = nextFocusable;
  focusableElements.forEach((element, index) => {
    element.classList.add("controller-focusable");
    element.dataset.focusIndex = String(index);
  });
  if (focusableElements.length <= 0) {
    currentFocusIndex = 0;
    syncDebugOverlay();
    return;
  }
  const existingIndex = previousFocus ? focusableElements.findIndex((element) => element === previousFocus) : -1;
  if (existingIndex >= 0) {
    currentFocusIndex = existingIndex;
    focusableElements[currentFocusIndex]?.classList.add("controller-focused");
    syncDebugOverlay();
    return;
  }
  const defaultFocus = resolveDefaultFocusable(root);
  if (defaultFocus) {
    setFocusByElement(defaultFocus);
    return;
  }
  currentFocusIndex = clampIndex(currentFocusIndex, focusableElements.length);
  setFocus(currentFocusIndex);
}
function resolveFocusRoot() {
  ensureCurrentContextIsMounted();
  const configuredRoot = typeof currentContext?.focusRoot === "function" ? currentContext.focusRoot() : currentContext?.focusRoot;
  return configuredRoot ?? document;
}
function ensureCurrentContextIsMounted() {
  if (!currentContext) {
    return false;
  }
  const configuredRoot = typeof currentContext.focusRoot === "function" ? currentContext.focusRoot() : currentContext.focusRoot;
  if (!configuredRoot) {
    return true;
  }
  if (configuredRoot.isConnected) {
    return true;
  }
  currentContext = null;
  currentMode = "focus";
  scheduleFocusRefresh();
  syncDebugOverlay();
  return false;
}
function resolveDefaultFocusable(root) {
  const selector = currentContext?.defaultFocusSelector ?? "[data-controller-default-focus='true']";
  if (!selector) {
    return null;
  }
  const candidate = root.querySelector(selector);
  return candidate && isElementFocusable(candidate) ? candidate : null;
}
function isElementFocusable(element) {
  if (element.dataset.controllerExclude === "true") {
    return false;
  }
  if (element.hasAttribute("disabled")) {
    return false;
  }
  if (element.getAttribute("aria-hidden") === "true") {
    return false;
  }
  if (element.tabIndex < 0 && element.dataset.controllerFocusable !== "true") {
    const tagName = element.tagName.toLowerCase();
    if (!["button", "input", "select", "textarea", "a"].includes(tagName)) {
      return false;
    }
  }
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
function navigateFocus(direction) {
  if (focusableElements.length <= 0) {
    updateFocusableElements();
  }
  if (focusableElements.length <= 0) {
    return;
  }
  const current = focusableElements[currentFocusIndex] ?? focusableElements[0];
  const currentRect = current.getBoundingClientRect();
  const currentCenterX = currentRect.left + currentRect.width / 2;
  const currentCenterY = currentRect.top + currentRect.height / 2;
  let bestIndex = currentFocusIndex;
  let bestScore = Number.POSITIVE_INFINITY;
  focusableElements.forEach((candidate, index) => {
    if (index === currentFocusIndex) {
      return;
    }
    const rect = candidate.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = centerX - currentCenterX;
    const deltaY = centerY - currentCenterY;
    if (direction === "up" && deltaY >= -4) return;
    if (direction === "down" && deltaY <= 4) return;
    if (direction === "left" && deltaX >= -4) return;
    if (direction === "right" && deltaX <= 4) return;
    const primaryDistance = direction === "left" || direction === "right" ? Math.abs(deltaX) : Math.abs(deltaY);
    const secondaryDistance = direction === "left" || direction === "right" ? Math.abs(deltaY) : Math.abs(deltaX);
    const score = primaryDistance + secondaryDistance * 0.35;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  if (bestIndex !== currentFocusIndex) {
    setFocus(bestIndex);
    return;
  }
  const wrappedIndex = direction === "up" || direction === "left" ? currentFocusIndex - 1 : currentFocusIndex + 1;
  setFocus((wrappedIndex + focusableElements.length) % focusableElements.length);
}
function setFocusByElement(element) {
  const index = focusableElements.findIndex((candidate) => candidate === element);
  if (index >= 0) {
    setFocus(index);
  }
}
function setFocus(index) {
  if (focusableElements.length <= 0) {
    return;
  }
  focusableElements.forEach((element2) => element2.classList.remove("controller-focused"));
  currentFocusIndex = clampIndex(index, focusableElements.length);
  const element = focusableElements[currentFocusIndex];
  if (!element) {
    syncDebugOverlay();
    return;
  }
  suppressFocusRefresh = true;
  element.classList.add("controller-focused");
  element.focus({ preventScroll: true });
  suppressFocusRefresh = false;
  element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  syncDebugOverlay();
}
function activateFocusedElement() {
  const element = focusableElements[currentFocusIndex];
  if (!element) {
    return;
  }
  if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
    element.click();
  } else if (typeof element.click === "function") {
    element.click();
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus();
  }
  vibrate(50, 0.3);
}
function clampIndex(index, length) {
  if (length <= 0) {
    return 0;
  }
  if (!Number.isFinite(index)) {
    return 0;
  }
  return Math.max(0, Math.min(length - 1, index));
}
function isControllerConnected() {
  return typeof navigator.getGamepads === "function" ? Array.from(navigator.getGamepads()).some((gamepad) => gamepad !== null) : false;
}
function getConnectedControllers() {
  if (typeof navigator.getGamepads !== "function") {
    return [];
  }
  const controllers = [];
  for (const gamepad of navigator.getGamepads()) {
    if (!gamepad) {
      continue;
    }
    controllers.push({
      connected: true,
      id: gamepad.id,
      index: gamepad.index,
      assignedPlayer: getAssignedPlayerForGamepad(gamepad.index),
      buttons: gamepad.buttons.map((button, buttonIndex) => ({
        pressed: isGamepadButtonPressed(button),
        value: button.value,
        justPressed: isGamepadButtonPressed(button) && !(previousButtonStatesByPad[gamepad.index]?.[buttonIndex] ?? false),
        justReleased: !isGamepadButtonPressed(button) && Boolean(previousButtonStatesByPad[gamepad.index]?.[buttonIndex])
      })),
      axes: [...gamepad.axes]
    });
  }
  return controllers;
}
function bindControllerToPlayer(playerId, gamepadIndex) {
  controllerAssignments[playerId] = gamepadIndex;
  syncDebugOverlay();
}
function getControllerBindingForPlayer(playerId) {
  return controllerAssignments[playerId];
}
function getAssignedPlayerForGamepad(gamepadIndex) {
  for (const playerId of Object.keys(controllerAssignments)) {
    if (controllerAssignments[playerId] === gamepadIndex) {
      return playerId;
    }
  }
  return null;
}
function bindUnassignedController(gamepadIndex) {
  if (getAssignedPlayerForGamepad(gamepadIndex)) {
    return;
  }
  if (controllerAssignments.P1 === null) {
    controllerAssignments.P1 = gamepadIndex;
    return;
  }
  if (controllerAssignments.P2 === null) {
    controllerAssignments.P2 = gamepadIndex;
  }
}
function getAssignedGamepad(playerId) {
  const gamepadIndex = controllerAssignments[playerId];
  if (gamepadIndex === null || typeof navigator.getGamepads !== "function") {
    return null;
  }
  return navigator.getGamepads()[gamepadIndex] ?? null;
}
function isGamepadActionActive(playerId, action) {
  const gamepad = getAssignedGamepad(playerId);
  if (!gamepad || !isEnabled) {
    return false;
  }
  return isActionActiveForGamepad(gamepad, action);
}
function vibrate(durationMs, intensity = 1) {
  if (!vibrationEnabled || typeof navigator.getGamepads !== "function") {
    return;
  }
  const gamepads = navigator.getGamepads();
  for (const gamepad of gamepads) {
    if (!gamepad?.vibrationActuator) {
      continue;
    }
    gamepad.vibrationActuator.playEffect("dual-rumble", {
      startDelay: 0,
      duration: durationMs,
      weakMagnitude: intensity * 0.5,
      strongMagnitude: intensity
    }).catch(() => {
    });
  }
}
var VIBRATION_PATTERNS = {
  confirm: () => vibrate(50, 0.3),
  cancel: () => vibrate(30, 0.2),
  hit: () => vibrate(100, 0.7),
  criticalHit: () => vibrate(200, 1),
  damage: () => vibrate(150, 0.8),
  error: () => {
    vibrate(50, 0.5);
    setTimeout(() => vibrate(50, 0.5), 100);
  }
};
function getControllerGlyphProfile(gamepadId) {
  const normalizedId = String(gamepadId ?? "").toLowerCase();
  if (normalizedId.includes("dualsense") || normalizedId.includes("dualsense edge") || normalizedId.includes("wireless controller") || normalizedId.includes("playstation") || normalizedId.includes("sony")) {
    return "playstation";
  }
  return "generic";
}
function getButtonName(buttonIndex, gamepadId) {
  const profile = getControllerGlyphProfile(gamepadId);
  const names = profile === "playstation" ? {
    [BUTTON.A]: "CROSS",
    [BUTTON.B]: "CIRCLE",
    [BUTTON.X]: "SQUARE",
    [BUTTON.Y]: "TRIANGLE",
    [BUTTON.LB]: "L1",
    [BUTTON.RB]: "R1",
    [BUTTON.LT]: "L2",
    [BUTTON.RT]: "R2",
    [BUTTON.SELECT]: "CREATE",
    [BUTTON.START]: "OPTIONS",
    [BUTTON.L3]: "L3",
    [BUTTON.R3]: "R3",
    [BUTTON.DPAD_UP]: "DPAD UP",
    [BUTTON.DPAD_DOWN]: "DPAD DOWN",
    [BUTTON.DPAD_LEFT]: "DPAD LEFT",
    [BUTTON.DPAD_RIGHT]: "DPAD RIGHT"
  } : {
    [BUTTON.A]: "A",
    [BUTTON.B]: "B",
    [BUTTON.X]: "X",
    [BUTTON.Y]: "Y",
    [BUTTON.LB]: "LB",
    [BUTTON.RB]: "RB",
    [BUTTON.LT]: "LT",
    [BUTTON.RT]: "RT",
    [BUTTON.SELECT]: "VIEW",
    [BUTTON.START]: "MENU",
    [BUTTON.L3]: "L3",
    [BUTTON.R3]: "R3",
    [BUTTON.DPAD_UP]: "DPAD UP",
    [BUTTON.DPAD_DOWN]: "DPAD DOWN",
    [BUTTON.DPAD_LEFT]: "DPAD LEFT",
    [BUTTON.DPAD_RIGHT]: "DPAD RIGHT"
  };
  return names[buttonIndex] ?? `BTN ${buttonIndex}`;
}
function getActionName(action) {
  const names = {
    confirm: "Confirm",
    cancel: "Cancel / Back",
    menu: "Menu",
    moveUp: "Navigate Up",
    moveDown: "Navigate Down",
    moveLeft: "Navigate Left",
    moveRight: "Navigate Right",
    nextUnit: "Next Unit",
    prevUnit: "Previous Unit",
    endTurn: "End Turn",
    openInventory: "Open Inventory",
    openMap: "Open Map",
    pause: "Pause",
    attack: "Attack",
    interact: "Interact",
    dash: "Dash",
    tabPrev: "Previous Tab",
    tabNext: "Next Tab",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    toggleSurfaceMode: "Toggle Surface Mode",
    toggleLayoutMode: "Toggle Layout Mode",
    windowPrimary: "Window Primary",
    windowSecondary: "Window Secondary"
  };
  return names[action] ?? action;
}
function onGamepadConnected(event) {
  console.log(`[CONTROLLER] Connected: ${event.gamepad.id}`);
  bindUnassignedController(event.gamepad.index);
  scheduleFocusRefresh();
  syncDebugOverlay();
  vibrate(100, 0.5);
}
function onGamepadDisconnected(event) {
  console.log(`[CONTROLLER] Disconnected: ${event.gamepad.id}`);
  previousButtonStatesByPad[event.gamepad.index] = [];
  previousActionStatesByPad[event.gamepad.index] = {};
  previousAxisDigitalByPad[event.gamepad.index] = {};
  for (const playerId of Object.keys(controllerAssignments)) {
    if (controllerAssignments[playerId] === event.gamepad.index) {
      controllerAssignments[playerId] = null;
    }
  }
  document.querySelectorAll(".controller-focused").forEach((element) => {
    element.classList.remove("controller-focused");
  });
  scheduleFocusRefresh();
  syncDebugOverlay();
}
function onControllerAction(listener) {
  actionListeners.add(listener);
  return () => actionListeners.delete(listener);
}
export {
  AXIS,
  BUTTON,
  DEFAULT_BINDINGS,
  DEFAULT_CONTROLLER_BINDINGS,
  GAME_ACTIONS,
  VIBRATION_PATTERNS,
  bindControllerToPlayer,
  cancelControllerBindingCapture,
  clearControllerContext,
  findActionsUsingBinding,
  getActionName,
  getAssignedGamepad,
  getBindingLabel,
  getButtonBindings,
  getButtonName,
  getConnectedControllers,
  getControllerActionLabel,
  getControllerActionLabelForPlayer,
  getControllerAssignments,
  getControllerBindingForPlayer,
  getControllerBindings,
  getControllerMode,
  getLastInputMode,
  initControllerSupport,
  isControllerBindingCaptureActive,
  isControllerConnected,
  isGamepadActionActive,
  markControllerInputActive,
  markKeyboardInputActive,
  onControllerAction,
  registerControllerContext,
  setControllerMode,
  shouldSuppressGameplayInput,
  shutdownControllerSupport,
  startControllerBindingCapture,
  updateFocusableElements,
  vibrate
};
