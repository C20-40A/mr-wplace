// Developer UI shared color scheme (purple/blue based)
export const DEV_COLORS = {
  primary: "200, 180, 255", // Purple base (brighter for better visibility)
  secondary: "120, 200, 255", // Blue accent
} as const;

export const getColor = (color: keyof typeof DEV_COLORS, alpha = 1) =>
  `rgba(${DEV_COLORS[color]}, ${alpha})`;
