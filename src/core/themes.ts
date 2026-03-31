// ============================================================================
// CHAOS CORE - UI THEME SYSTEM
// src/core/themes.ts
// Theme definitions and theme management
// ============================================================================

export type ThemeId = "ardycia" | "cyberpunk" | "monochrome" | "warm" | "cool" | "neon" | "forest" | "sunset" | "ocean" | "void";

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  colors: {
    // Primary palette
    white: string;
    offWhite: string;
    silver: string;
    mist: string;
    warmGray: string;
    coolGray: string;
    slate: string;
    charcoal: string;
    dark: string;
    
    // Accents
    gold: string;
    amber: string;
    rust: string;
    terracotta: string;
    
    // Status colors
    crimson: string;
    coral: string;
    emerald: string;
    sky: string;
    ocean: string;
    lavender: string;
    
    // Additional colors
    sage?: string;
    tan?: string;
    peach?: string;
    brownDark?: string;
    brownMid?: string;
    forest?: string;
    olive?: string;
    rose?: string;
    magenta?: string;
    cyan?: string;
    navy?: string;
    void?: string;
  };
  
  // Extended theme properties
  backgrounds: {
    primary: string;
    secondary: string;
    tertiary: string;
    surface: string;
    overlay: string;
    card: string;
    cardHover?: string;
  };
  
  gradients: {
    primary: string;
    secondary: string;
    button: string;
    buttonHover: string;
    card: string;
    header: string;
  };
  
  shadows: {
    sm: string;
    md: string;
    lg: string;
    glow: string;
    glowAccent: string;
    glowError: string;
  };
  
  borders: {
    primary: string;
    secondary: string;
    accent: string;
    subtle: string;
  };
  
  text: {
    primary: string;
    secondary: string;
    muted: string;
    accent: string;
    highlight: string;
  };
}

// Helper function to create theme with defaults
function createTheme(
  id: ThemeId,
  name: string,
  description: string,
  colors: Theme["colors"],
  overrides?: Partial<Omit<Theme, "id" | "name" | "description" | "colors">>
): Theme {
  const c = colors;
  
  // Default derived values
  const defaultBackgrounds = {
    primary: c.dark,
    secondary: c.brownDark || c.charcoal,
    tertiary: c.charcoal,
    surface: `${c.dark}f5`,
    overlay: `${c.dark}e6`,
    card: `linear-gradient(180deg, ${c.brownDark || c.charcoal} 0%, ${c.dark} 100%)`,
  };
  
  const defaultGradients = {
    primary: `linear-gradient(180deg, ${c.dark} 0%, ${c.charcoal} 100%)`,
    secondary: `linear-gradient(180deg, ${c.charcoal} 0%, ${c.dark} 100%)`,
    button: `linear-gradient(180deg, ${c.rust} 0%, ${c.terracotta} 100%)`,
    buttonHover: `linear-gradient(180deg, ${c.gold} 0%, ${c.rust} 100%)`,
    card: `linear-gradient(180deg, ${c.brownDark || c.charcoal} 0%, ${c.dark} 100%)`,
    header: `linear-gradient(180deg, ${c.dark} 0%, ${c.charcoal} 100%)`,
  };
  
  const defaultShadows = {
    sm: `0 1px 3px ${c.dark}4d`,
    md: `0 4px 12px ${c.dark}66`,
    lg: `0 8px 24px ${c.dark}80`,
    glow: `0 0 20px ${c.gold}4d`,
    glowAccent: `0 0 20px ${c.emerald}4d`,
    glowError: `0 0 20px ${c.crimson}4d`,
  };
  
  const defaultBorders = {
    primary: c.brownMid || c.coolGray,
    secondary: c.charcoal,
    accent: c.gold,
    subtle: `${c.brownMid || c.coolGray}4d`,
  };
  
  const defaultText = {
    primary: c.offWhite,
    secondary: c.sage || c.silver,
    muted: c.coolGray,
    accent: c.gold,
    highlight: c.amber,
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
    text: overrides?.text || defaultText,
  };
}

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

export const THEMES: Record<ThemeId, Theme> = {
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
      brownMid: "#806d4e",
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
      lavender: "#cc66ff",
    },
    {
      gradients: {
        primary: "linear-gradient(180deg, #1a1a2e 0%, #303044 100%)",
        secondary: "linear-gradient(180deg, #303044 0%, #1a1a2e 100%)",
        button: "linear-gradient(180deg, #0099cc 0%, #006699 100%)",
        buttonHover: "linear-gradient(180deg, #00ffff 0%, #0099cc 100%)",
        card: "linear-gradient(180deg, #303044 0%, #1a1a2e 100%)",
        header: "linear-gradient(180deg, #1a1a2e 0%, #404066 100%)",
      },
      shadows: {
        sm: "0 1px 3px rgba(0, 255, 255, 0.3)",
        md: "0 4px 12px rgba(0, 255, 255, 0.4)",
        lg: "0 8px 24px rgba(0, 255, 255, 0.5)",
        glow: "0 0 20px rgba(0, 255, 255, 0.6)",
        glowAccent: "0 0 20px rgba(0, 255, 153, 0.6)",
        glowError: "0 0 20px rgba(255, 0, 102, 0.6)",
      },
      borders: {
        primary: "#505088",
        secondary: "#303044",
        accent: "#00ffff",
        subtle: "rgba(0, 255, 255, 0.3)",
      },
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
      lavender: "#cccccc",
    },
    {
      gradients: {
        primary: "linear-gradient(180deg, #101010 0%, #303030 100%)",
        secondary: "linear-gradient(180deg, #303030 0%, #101010 100%)",
        button: "linear-gradient(180deg, #666666 0%, #505050 100%)",
        buttonHover: "linear-gradient(180deg, #909090 0%, #707070 100%)",
        card: "linear-gradient(180deg, #303030 0%, #101010 100%)",
        header: "linear-gradient(180deg, #101010 0%, #505050 100%)",
      },
      shadows: {
        sm: "0 1px 3px rgba(0, 0, 0, 0.5)",
        md: "0 4px 12px rgba(0, 0, 0, 0.6)",
        lg: "0 8px 24px rgba(0, 0, 0, 0.7)",
        glow: "0 0 20px rgba(255, 255, 255, 0.3)",
        glowAccent: "0 0 20px rgba(255, 255, 255, 0.4)",
        glowError: "0 0 20px rgba(255, 255, 255, 0.5)",
      },
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
      brownMid: "#aa7755",
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
      lavender: "#aa88ff",
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
      cyan: "#00ffff",
    },
    {
      gradients: {
        primary: "linear-gradient(180deg, #221122 0%, #443044 100%)",
        secondary: "linear-gradient(180deg, #443044 0%, #221122 100%)",
        button: "linear-gradient(180deg, #cc00cc 0%, #990099 100%)",
        buttonHover: "linear-gradient(180deg, #ff00ff 0%, #cc00cc 100%)",
        card: "linear-gradient(180deg, #443044 0%, #221122 100%)",
        header: "linear-gradient(180deg, #221122 0%, #664066 100%)",
      },
      shadows: {
        sm: "0 1px 3px rgba(255, 0, 255, 0.4)",
        md: "0 4px 12px rgba(255, 0, 255, 0.5)",
        lg: "0 8px 24px rgba(255, 0, 255, 0.6)",
        glow: "0 0 30px rgba(255, 0, 255, 0.8)",
        glowAccent: "0 0 30px rgba(0, 255, 255, 0.8)",
        glowError: "0 0 30px rgba(255, 0, 102, 0.8)",
      },
      borders: {
        primary: "#885088",
        secondary: "#443044",
        accent: "#ff00ff",
        subtle: "rgba(255, 0, 255, 0.4)",
      },
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
      brownMid: "#5a7a4a",
    },
    {
      backgrounds: {
        primary: "#202220",
        secondary: "#304430",
        tertiary: "#406640",
        surface: "#202220f5",
        overlay: "#202220e6",
        card: "linear-gradient(180deg, #304430 0%, #202220 100%)",
      },
      gradients: {
        primary: "linear-gradient(180deg, #202220 0%, #304430 100%)",
        secondary: "linear-gradient(180deg, #304430 0%, #202220 100%)",
        button: "linear-gradient(180deg, #448822 0%, #336611 100%)",
        buttonHover: "linear-gradient(180deg, #88cc44 0%, #66aa33 100%)",
        card: "linear-gradient(180deg, #304430 0%, #202220 100%)",
        header: "linear-gradient(180deg, #202220 0%, #406640 100%)",
      },
      shadows: {
        sm: "0 1px 3px rgba(68, 204, 136, 0.3)",
        md: "0 4px 12px rgba(68, 204, 136, 0.4)",
        lg: "0 8px 24px rgba(68, 204, 136, 0.5)",
        glow: "0 0 20px rgba(68, 204, 136, 0.5)",
        glowAccent: "0 0 20px rgba(136, 204, 68, 0.5)",
        glowError: "0 0 20px rgba(204, 68, 68, 0.5)",
      },
      borders: {
        primary: "#608860",
        secondary: "#304430",
        accent: "#88cc44",
        subtle: "rgba(96, 136, 96, 0.3)",
      },
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
      magenta: "#cc66aa",
    },
    {
      gradients: {
        primary: "linear-gradient(180deg, #442222 0%, #664433 100%)",
        secondary: "linear-gradient(180deg, #664433 0%, #442222 100%)",
        button: "linear-gradient(180deg, #cc4422 0%, #992211 100%)",
        buttonHover: "linear-gradient(180deg, #ff8844 0%, #ff6644 100%)",
        card: "linear-gradient(180deg, #664433 0%, #442222 100%)",
        header: "linear-gradient(180deg, #442222 0%, #885544 100%)",
      },
      shadows: {
        sm: "0 1px 3px rgba(255, 136, 68, 0.4)",
        md: "0 4px 12px rgba(255, 136, 68, 0.5)",
        lg: "0 8px 24px rgba(255, 136, 68, 0.6)",
        glow: "0 0 25px rgba(255, 136, 68, 0.7)",
        glowAccent: "0 0 25px rgba(255, 102, 68, 0.7)",
        glowError: "0 0 25px rgba(255, 68, 102, 0.7)",
      },
      borders: {
        primary: "#aa7766",
        secondary: "#664433",
        accent: "#ff8844",
        subtle: "rgba(255, 136, 68, 0.4)",
      },
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
      navy: "#001144",
    },
    {
      backgrounds: {
        primary: "#202044",
        secondary: "#304066",
        tertiary: "#406088",
        surface: "#202044f5",
        overlay: "#202044e6",
        card: "linear-gradient(180deg, #304066 0%, #202044 100%)",
      },
      gradients: {
        primary: "linear-gradient(180deg, #202044 0%, #304066 100%)",
        secondary: "linear-gradient(180deg, #304066 0%, #202044 100%)",
        button: "linear-gradient(180deg, #0066cc 0%, #0044aa 100%)",
        buttonHover: "linear-gradient(180deg, #44aaff 0%, #2288ff 100%)",
        card: "linear-gradient(180deg, #304066 0%, #202044 100%)",
        header: "linear-gradient(180deg, #202044 0%, #406088 100%)",
      },
      shadows: {
        sm: "0 1px 3px rgba(68, 170, 255, 0.3)",
        md: "0 4px 12px rgba(68, 170, 255, 0.4)",
        lg: "0 8px 24px rgba(68, 170, 255, 0.5)",
        glow: "0 0 25px rgba(68, 170, 255, 0.6)",
        glowAccent: "0 0 25px rgba(0, 204, 255, 0.6)",
        glowError: "0 0 25px rgba(255, 102, 136, 0.6)",
      },
      borders: {
        primary: "#6080aa",
        secondary: "#304066",
        accent: "#44aaff",
        subtle: "rgba(68, 170, 255, 0.3)",
      },
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
      magenta: "#cc66ff",
    },
    {
      backgrounds: {
        primary: "#1a1a2e",
        secondary: "#303044",
        tertiary: "#404066",
        surface: "#1a1a2ef5",
        overlay: "#1a1a2ee6",
        card: "linear-gradient(180deg, #303044 0%, #1a1a2e 100%)",
      },
      gradients: {
        primary: "linear-gradient(180deg, #1a1a2e 0%, #303044 100%)",
        secondary: "linear-gradient(180deg, #303044 0%, #1a1a2e 100%)",
        button: "linear-gradient(180deg, #6644cc 0%, #4422aa 100%)",
        buttonHover: "linear-gradient(180deg, #aa88ff 0%, #8866ff 100%)",
        card: "linear-gradient(180deg, #303044 0%, #1a1a2e 100%)",
        header: "linear-gradient(180deg, #1a1a2e 0%, #404066 100%)",
      },
      shadows: {
        sm: "0 1px 3px rgba(170, 136, 255, 0.4)",
        md: "0 4px 12px rgba(170, 136, 255, 0.5)",
        lg: "0 8px 24px rgba(170, 136, 255, 0.6)",
        glow: "0 0 30px rgba(170, 136, 255, 0.7)",
        glowAccent: "0 0 30px rgba(204, 136, 255, 0.7)",
        glowError: "0 0 30px rgba(255, 102, 170, 0.7)",
      },
      borders: {
        primary: "#606088",
        secondary: "#303044",
        accent: "#aa88ff",
        subtle: "rgba(170, 136, 255, 0.4)",
      },
    }
  ),
};

// ============================================================================
// THEME APPLICATION
// ============================================================================

/**
 * Apply a theme by updating CSS custom properties
 */
export function applyTheme(themeId: ThemeId): void {
  const theme = THEMES[themeId];
  if (!theme) {
    console.warn(`[THEME] Theme not found: ${themeId}, using default`);
    return;
  }
  
  const root = document.documentElement;
  const c = theme.colors;
  
  // Base color variables
  root.style.setProperty("--ard-white", c.white);
  root.style.setProperty("--ard-off-white", c.offWhite);
  root.style.setProperty("--ard-silver", c.silver);
  root.style.setProperty("--ard-mist", c.mist);
  root.style.setProperty("--ard-warm-gray", c.warmGray);
  root.style.setProperty("--ard-cool-gray", c.coolGray);
  root.style.setProperty("--ard-slate", c.slate);
  root.style.setProperty("--ard-charcoal", c.charcoal);
  root.style.setProperty("--ard-dark", c.dark);
  root.style.setProperty("--ard-gold", c.gold);
  root.style.setProperty("--ard-amber", c.amber);
  root.style.setProperty("--ard-rust", c.rust);
  root.style.setProperty("--ard-terracotta", c.terracotta);
  root.style.setProperty("--ard-crimson", c.crimson);
  root.style.setProperty("--ard-coral", c.coral);
  root.style.setProperty("--ard-emerald", c.emerald);
  root.style.setProperty("--ard-sky", c.sky);
  root.style.setProperty("--ard-ocean", c.ocean);
  root.style.setProperty("--ard-lavender", c.lavender);
  
  // Additional colors
  if (c.sage) root.style.setProperty("--ard-sage", c.sage);
  if (c.tan) root.style.setProperty("--ard-tan", c.tan);
  if (c.peach) root.style.setProperty("--ard-peach", c.peach);
  if (c.brownDark) root.style.setProperty("--ard-brown-dark", c.brownDark);
  if (c.brownMid) root.style.setProperty("--ard-brown-mid", c.brownMid);
  if (c.forest) root.style.setProperty("--ard-forest", c.forest);
  if (c.olive) root.style.setProperty("--ard-olive", c.olive);
  if (c.rose) root.style.setProperty("--ard-rose", c.rose);
  if (c.magenta) root.style.setProperty("--ard-magenta", c.magenta);
  if (c.cyan) root.style.setProperty("--ard-cyan", c.cyan);
  if (c.navy) root.style.setProperty("--ard-navy", c.navy);
  if (c.void) root.style.setProperty("--ard-void", c.void);
  
  // Backgrounds
  root.style.setProperty("--bg-primary", theme.backgrounds.primary);
  root.style.setProperty("--bg-secondary", theme.backgrounds.secondary);
  root.style.setProperty("--bg-tertiary", theme.backgrounds.tertiary);
  root.style.setProperty("--bg-surface", theme.backgrounds.surface);
  root.style.setProperty("--bg-overlay", theme.backgrounds.overlay);
  root.style.setProperty("--bg-card", theme.backgrounds.card);
  if (theme.backgrounds.cardHover) {
    root.style.setProperty("--bg-card-hover", theme.backgrounds.cardHover);
  }
  
  // Gradients
  root.style.setProperty("--gradient-primary", theme.gradients.primary);
  root.style.setProperty("--gradient-secondary", theme.gradients.secondary);
  root.style.setProperty("--gradient-button", theme.gradients.button);
  root.style.setProperty("--gradient-button-hover", theme.gradients.buttonHover);
  root.style.setProperty("--gradient-card", theme.gradients.card);
  root.style.setProperty("--gradient-header", theme.gradients.header);
  
  // Shadows
  root.style.setProperty("--shadow-sm", theme.shadows.sm);
  root.style.setProperty("--shadow-md", theme.shadows.md);
  root.style.setProperty("--shadow-lg", theme.shadows.lg);
  root.style.setProperty("--shadow-glow", theme.shadows.glow);
  root.style.setProperty("--shadow-glow-accent", theme.shadows.glowAccent);
  root.style.setProperty("--shadow-glow-error", theme.shadows.glowError);
  root.style.setProperty("--shadow-glow-gold", theme.shadows.glow);
  root.style.setProperty("--shadow-glow-emerald", theme.shadows.glowAccent);
  root.style.setProperty("--shadow-glow-crimson", theme.shadows.glowError);
  
  // Borders
  root.style.setProperty("--border-primary", theme.borders.primary);
  root.style.setProperty("--border-secondary", theme.borders.secondary);
  root.style.setProperty("--border-accent", theme.borders.accent);
  root.style.setProperty("--border-subtle", theme.borders.subtle);
  
  // Text
  root.style.setProperty("--text-primary", theme.text.primary);
  root.style.setProperty("--text-secondary", theme.text.secondary);
  root.style.setProperty("--text-muted", theme.text.muted);
  root.style.setProperty("--text-accent", theme.text.accent);
  root.style.setProperty("--text-highlight", theme.text.highlight);
  
  console.log(`[THEME] Applied theme: ${theme.name}`);
}

/**
 * Get theme by ID
 */
export function getTheme(themeId: ThemeId): Theme {
  return THEMES[themeId] || THEMES.ardycia;
}

/**
 * Get all available themes
 */
export function getAllThemes(): Theme[] {
  return Object.values(THEMES);
}
