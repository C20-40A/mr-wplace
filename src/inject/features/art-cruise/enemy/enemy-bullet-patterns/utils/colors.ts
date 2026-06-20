import type { ArtCruiseBulletColor } from "../../enemy-rules/types";
import { RAINBOW_COLOR_SEQUENCE } from "../../enemy-bullet/data-urls";

/** index を色アートシーケンスに循環マップ。レインボー弾幕用。 */
export const rainbowColor = (index: number): ArtCruiseBulletColor =>
  RAINBOW_COLOR_SEQUENCE[
    ((index % RAINBOW_COLOR_SEQUENCE.length) + RAINBOW_COLOR_SEQUENCE.length) %
      RAINBOW_COLOR_SEQUENCE.length
  ];
