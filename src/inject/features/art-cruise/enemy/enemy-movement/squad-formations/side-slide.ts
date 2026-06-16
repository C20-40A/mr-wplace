import type { SquadCommand } from "../squad";
import { squadMove } from "../primitives";

export type SideSlideOptions = {
  /** 最初に進む横方向。"left" で画面左へ、"right" で右へ */
  dir?: "left" | "right";
  /** 横移動の速度 (px/s) */
  speed?: number;
  /** 1回のスライドで進む縦の量 (px/s) */
  descend?: number;
  /** 端で折り返す回数 */
  bounces?: number;
  /** 各スライドの所要時間 (s) */
  segmentDuration?: number;
};

/**
 * 横にスライドしながら少しずつ降下し、端で折り返すジグザグ movement。
 * 方向・速度・往復回数を引数で調整できる。
 */
export const sideSlideCommands = ({
  dir = "left",
  speed = 80,
  descend = 60,
  bounces = 3,
  segmentDuration = 2.0,
}: SideSlideOptions = {}): SquadCommand[] => {
  const sign = dir === "left" ? -1 : 1;
  return Array.from({ length: bounces }, (_, i) => {
    // 折り返しごとに横方向を反転。両端は半分の振り幅で自然な反転に。
    const isEdge = i === 0 || i === bounces - 1;
    const dirSign = sign * (i % 2 === 0 ? 1 : -1);
    const amount = isEdge ? speed : speed * 2;
    return squadMove(dirSign * amount, descend, segmentDuration);
  });
};
