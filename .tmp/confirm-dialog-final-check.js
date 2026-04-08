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
var currentBindings = normalizeBindingMap(DEFAULT_SETTINGS.controllerBindings);
var controllerAssignments = {
  P1: DEFAULT_SETTINGS.controllerAssignments.P1,
  P2: DEFAULT_SETTINGS.controllerAssignments.P2
};
var lastInputMode = "keyboard";
var focusableElements = [];
var currentFocusIndex = 0;
var focusRefreshRaf = null;
var currentContext = null;
var currentMode = "focus";
var suppressFocusRefresh = false;
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
function clampIndex(index, length) {
  if (length <= 0) {
    return 0;
  }
  if (!Number.isFinite(index)) {
    return 0;
  }
  return Math.max(0, Math.min(length - 1, index));
}

// src/ui/components/confirmDialog.ts
var DIALOG_FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[data-controller-focusable='true']"
].join(", ");
function escapeHtml2(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function resolveMountTarget(explicitTarget) {
  if (typeof explicitTarget === "function") {
    return resolveMountTarget(explicitTarget());
  }
  if (explicitTarget) {
    return explicitTarget;
  }
  const app = document.getElementById("app");
  const screenRoot = app?.firstElementChild;
  return screenRoot ?? app ?? document.body ?? document.documentElement;
}
function showConfirmDialog(options) {
  const mountTarget = resolveMountTarget(options.mount);
  if (!mountTarget) {
    return Promise.resolve(false);
  }
  const previousMode = getControllerMode();
  const previousActiveElement = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "game-confirm-modal-backdrop";
  overlay.innerHTML = `
    <div class="game-confirm-modal game-confirm-modal--${escapeHtml2(options.variant ?? "default")}" role="dialog" aria-modal="true" aria-labelledby="gameConfirmDialogTitle">
      <div class="game-confirm-modal__header">
        <div class="game-confirm-modal__kicker">CONFIRM ACTION</div>
        <h2 class="game-confirm-modal__title" id="gameConfirmDialogTitle">${escapeHtml2(options.title)}</h2>
      </div>
      <div class="game-confirm-modal__copy">${escapeHtml2(options.message)}</div>
      <div class="game-confirm-modal__actions">
        <button class="game-confirm-modal__btn game-confirm-modal__btn--primary" type="button" data-confirm-dialog-action="confirm" data-controller-default-focus="true">
          ${escapeHtml2(options.confirmLabel ?? "CONFIRM")}
        </button>
        <button class="game-confirm-modal__btn" type="button" data-confirm-dialog-action="cancel">
          ${escapeHtml2(options.cancelLabel ?? "CANCEL")}
        </button>
      </div>
    </div>
  `;
  const mutatedElements = Array.from(mountTarget.querySelectorAll(DIALOG_FOCUSABLE_SELECTOR)).filter((element) => !overlay.contains(element)).map((element) => ({
    element,
    previousExclude: element.getAttribute("data-controller-exclude")
  }));
  mutatedElements.forEach(({ element }) => {
    element.setAttribute("data-controller-exclude", "true");
  });
  mountTarget.appendChild(overlay);
  setControllerMode("focus");
  updateFocusableElements();
  const confirmBtn = overlay.querySelector('[data-confirm-dialog-action="confirm"]');
  const cancelBtn = overlay.querySelector('[data-confirm-dialog-action="cancel"]');
  requestAnimationFrame(() => {
    confirmBtn?.focus();
    updateFocusableElements();
  });
  return new Promise((resolve) => {
    const cleanup = () => {
      overlay.removeEventListener("click", handleOverlayClick);
      window.removeEventListener("keydown", handleKeyDown, true);
      overlay.remove();
      mutatedElements.forEach(({ element, previousExclude }) => {
        if (previousExclude === null) {
          element.removeAttribute("data-controller-exclude");
        } else {
          element.setAttribute("data-controller-exclude", previousExclude);
        }
      });
      setControllerMode(previousMode);
      updateFocusableElements();
      requestAnimationFrame(() => {
        const restoreTarget = options.restoreFocusSelector ? document.querySelector(options.restoreFocusSelector) : previousActiveElement;
        restoreTarget?.focus();
      });
    };
    const finish = (accepted) => {
      cleanup();
      resolve(accepted);
    };
    const handleOverlayClick = (event) => {
      const target = event.target;
      if (event.target === overlay) {
        finish(false);
        return;
      }
      const action = target?.closest("[data-confirm-dialog-action]")?.getAttribute("data-confirm-dialog-action");
      if (action === "confirm") {
        finish(true);
      } else if (action === "cancel") {
        finish(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      } else if (event.key === "Enter") {
        const activeElement = document.activeElement;
        if (activeElement?.closest("[data-confirm-dialog-action='cancel']")) {
          event.preventDefault();
          finish(false);
        } else if (activeElement?.closest("[data-confirm-dialog-action='confirm']")) {
          event.preventDefault();
          finish(true);
        }
      }
    };
    overlay.addEventListener("click", handleOverlayClick);
    window.addEventListener("keydown", handleKeyDown, true);
  });
}
function showAlertDialog(options) {
  const mountTarget = resolveMountTarget(options.mount);
  if (!mountTarget) {
    return Promise.resolve();
  }
  const previousMode = getControllerMode();
  const previousActiveElement = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "game-confirm-modal-backdrop";
  overlay.innerHTML = `
    <div class="game-confirm-modal game-confirm-modal--${escapeHtml2(options.variant ?? "default")}" role="dialog" aria-modal="true" aria-labelledby="gameAlertDialogTitle">
      <div class="game-confirm-modal__header">
        <div class="game-confirm-modal__kicker">SYSTEM NOTICE</div>
        <h2 class="game-confirm-modal__title" id="gameAlertDialogTitle">${escapeHtml2(options.title ?? "NOTICE")}</h2>
      </div>
      <div class="game-confirm-modal__copy">${escapeHtml2(options.message)}</div>
      <div class="game-confirm-modal__actions">
        <button class="game-confirm-modal__btn game-confirm-modal__btn--primary" type="button" data-alert-dialog-action="dismiss" data-controller-default-focus="true">
          ${escapeHtml2(options.acknowledgeLabel ?? "OK")}
        </button>
      </div>
    </div>
  `;
  const mutatedElements = Array.from(mountTarget.querySelectorAll(DIALOG_FOCUSABLE_SELECTOR)).filter((element) => !overlay.contains(element)).map((element) => ({
    element,
    previousExclude: element.getAttribute("data-controller-exclude")
  }));
  mutatedElements.forEach(({ element }) => {
    element.setAttribute("data-controller-exclude", "true");
  });
  mountTarget.appendChild(overlay);
  setControllerMode("focus");
  updateFocusableElements();
  const dismissBtn = overlay.querySelector('[data-alert-dialog-action="dismiss"]');
  requestAnimationFrame(() => {
    dismissBtn?.focus();
    updateFocusableElements();
  });
  return new Promise((resolve) => {
    const cleanup = () => {
      overlay.removeEventListener("click", handleOverlayClick);
      window.removeEventListener("keydown", handleKeyDown, true);
      overlay.remove();
      mutatedElements.forEach(({ element, previousExclude }) => {
        if (previousExclude === null) {
          element.removeAttribute("data-controller-exclude");
        } else {
          element.setAttribute("data-controller-exclude", previousExclude);
        }
      });
      setControllerMode(previousMode);
      updateFocusableElements();
      requestAnimationFrame(() => {
        const restoreTarget = options.restoreFocusSelector ? document.querySelector(options.restoreFocusSelector) : previousActiveElement;
        restoreTarget?.focus();
      });
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    const handleOverlayClick = (event) => {
      const target = event.target;
      if (event.target === overlay) {
        finish();
        return;
      }
      const action = target?.closest("[data-alert-dialog-action]")?.getAttribute("data-alert-dialog-action");
      if (action === "dismiss") {
        finish();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        finish();
      }
    };
    overlay.addEventListener("click", handleOverlayClick);
    window.addEventListener("keydown", handleKeyDown, true);
  });
}
var nativeAlertOverrideInstalled = false;
function installNativeDialogOverrides() {
  if (nativeAlertOverrideInstalled) {
    return;
  }
  window.alert = (message) => {
    void showAlertDialog({
      title: "NOTICE",
      message: typeof message === "string" ? message : String(message ?? "")
    });
  };
  nativeAlertOverrideInstalled = true;
}
export {
  installNativeDialogOverrides,
  showAlertDialog,
  showConfirmDialog
};
