export const TAU = Math.PI * 2;

export const LAUNCHER_MARGIN = 42;
export const BULLET_MOTION_SCALE = 74;

export const axisPosition = (
  start: number,
  end: number,
  index: number,
  count: number,
) =>
  count <= 1
    ? (start + end) / 2
    : start + ((end - start) * index) / (count - 1);
