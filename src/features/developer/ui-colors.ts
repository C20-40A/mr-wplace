// Developer UI shared color scheme (purple/blue based)
export const DEV_COLORS = {
  primary: "140, 100, 200", // Purple base (darker for glass background)
  secondary: "80, 150, 220", // Blue accent
} as const;

export const getColor = (color: keyof typeof DEV_COLORS, alpha = 1) =>
  `rgba(${DEV_COLORS[color]}, ${alpha})`;

// Glass morphism text colors with outline for better visibility
export const TEXT_COLORS = {
  primary: "rgba(40, 30, 60, 1)", // Dark purple for primary text
  secondary: "rgba(60, 60, 80, 0.9)", // Medium gray for secondary text
  tertiary: "rgba(80, 80, 100, 0.75)", // Light gray for tertiary text
} as const;

// Text shadow for better readability on any background
export const TEXT_OUTLINE = `
  0 0 2px rgba(255, 255, 255, 0.9),
  0 0 4px rgba(255, 255, 255, 0.7),
  0 0 6px rgba(255, 255, 255, 0.5),
  1px 1px 0 rgba(255, 255, 255, 0.8),
  -1px -1px 0 rgba(255, 255, 255, 0.8),
  1px -1px 0 rgba(255, 255, 255, 0.8),
  -1px 1px 0 rgba(255, 255, 255, 0.8)
` as const;
