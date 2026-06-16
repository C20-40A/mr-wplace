/** 大量追加を想定し、SE は id -> url のレコードで管理する */
export type ArtCruiseSeId =
  | "player-shoot"
  | "boss-explosion"
  | "player-hit"
  | "player-dead"
  | "grunt-down"
  | "enemy-shot"
  | "enemy-shot-short";

export type ArtCruiseAudioUrls = {
  stage: string;
  boss: string;
  gameOver: string;
  se: Record<ArtCruiseSeId, string>;
};
