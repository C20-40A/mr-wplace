import type {
  ArtCruiseEnemyBulletPatternId,
  ArtCruiseEnemyConfig,
  ArtCruiseEnemyDefinition,
  ArtCruiseEnemyMovementId,
} from "./types";
import { getBulletPatternIdsByRank } from "../enemy-bullet-patterns";

const GRUNT_MOVEMENTS: ArtCruiseEnemyMovementId[] = [
  "frontCross",
  "downLine",
  "diagonalLeft",
  "diagonalRight",
  "sidePeek",
];
const GRUNT_BULLET_PATTERNS: ArtCruiseEnemyBulletPatternId[] = [
  "aimedFan",
  "burst",
];

const pickRandom = <T>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)];

export const getRandomBossBulletPattern = (): ArtCruiseEnemyBulletPatternId =>
  pickRandom(getBulletPatternIdsByRank("boss"));

const getRandomGruntMovement = (): ArtCruiseEnemyMovementId =>
  pickRandom(GRUNT_MOVEMENTS);

const getRandomGruntBulletPattern = (): ArtCruiseEnemyBulletPatternId =>
  pickRandom(GRUNT_BULLET_PATTERNS);

type NamedDefinition = ArtCruiseEnemyDefinition & { _id: string };

const DEFINITIONS: NamedDefinition[] = [
  {
    _id: "gruntDrone",
    get movement() {
      return getRandomGruntMovement();
    },
    getBulletPattern: getRandomGruntBulletPattern,
    createConfig: (): ArtCruiseEnemyConfig => ({
      rank: "grunt",
      hp: 12,
      score: { damage: 10, defeat: 500 },
    }),
  },
  {
    _id: "bossDrone",
    movement: "none" as ArtCruiseEnemyMovementId,
    getBulletPattern: getRandomBossBulletPattern,
    createConfig: (): ArtCruiseEnemyConfig => ({
      rank: "boss",
      // 実戦ボス HP は boss-level-config の phase hp で上書きする。
      hp: 1,
      score: { damage: 20, defeat: 10000 },
    }),
  },
];

const REGISTRY = new Map<string, ArtCruiseEnemyDefinition>(
  DEFINITIONS.map((d) => [d._id, d]),
);

export const getEnemyDefinition = (id: string) => REGISTRY.get(id);

export const getRandomGruntDefinition = () => {
  const grunts = DEFINITIONS.filter((d) => d.createConfig().rank === "grunt");
  return grunts[Math.floor(Math.random() * grunts.length)];
};
