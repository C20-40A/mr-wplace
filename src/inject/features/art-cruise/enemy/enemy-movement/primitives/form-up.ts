import type { SquadCommand } from "../squad";

/**
 * 各機を指定した相対オフセットのライン/隊形へ整列させる。
 * slot(i) は中心からのオフセット比率 (dx, dy) を返す。
 * 中心は centerXRatio/centerYRatio で指定。
 */
export const squadFormUp = (
  centerXRatio: number,
  centerYRatio: number,
  slot: (index: number, count: number) => { dx: number; dy: number },
  duration: number,
  gameWidth: number,
  gameHeight: number,
): SquadCommand => {
  let startPos: { x: number; y: number }[] = [];
  // slot 計算は count に依存するため、敵が倒されても隊形が崩れない（瞬間移動しない）
  // よう、初回フレームのメンバー数を固定して使う。
  let slotCount = 1;
  return {
    duration,
    update(enemies, elapsed) {
      if (startPos.length === 0) {
        startPos = enemies.map((e) => ({
          x: e.view?.x ?? 0,
          y: e.view?.y ?? 0,
        }));
        slotCount = enemies.length || 1;
      }
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - (1 - t) * (1 - t); // easeOutQuad
      const cx = centerXRatio * gameWidth;
      const cy = centerYRatio * gameHeight;
      enemies.forEach((enemy, i) => {
        if (!enemy?.view) return;
        const start = startPos[i];
        if (!start) return;
        const { dx, dy } = slot(enemy.squadIndex ?? i, slotCount);
        const targetX = cx + dx * gameWidth;
        const targetY = cy + dy * gameHeight;
        enemy.view.x = start.x + (targetX - start.x) * ease;
        enemy.view.y = start.y + (targetY - start.y) * ease;
      });
    },
  };
};
