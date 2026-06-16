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
  // よう、メンバーが出揃ったフレームのメンバー数を固定して使う。
  let slotCount = 1;
  let formationStartedAt = -1;
  let memberCount = 0;
  let stableSince = 0;
  // メンバーは delayMs(=120ms 程度)で時間差 spawn される。最後に増えてから
  // この時間が経過したら「出揃った」とみなして整列を開始する。spawn 間隔より十分長く取る。
  const SETTLE_DELAY_S = 0.3;
  return {
    duration,
    update(enemies, elapsed) {
      // 確定前に整列すると、後から追加されるメンバーが startPos/slotCount に含まれず、
      // start 不在で整列がスキップされて画面外に取り残される(= 出てこない)。
      if (formationStartedAt < 0) {
        if (enemies.length > memberCount) {
          memberCount = enemies.length;
          stableSince = elapsed;
        }
        if (elapsed - stableSince < SETTLE_DELAY_S) return;
        startPos = enemies.map((e) => ({
          x: e.view?.x ?? 0,
          y: e.view?.y ?? 0,
        }));
        slotCount = enemies.length || 1;
        formationStartedAt = elapsed;
      }
      const t = Math.min((elapsed - formationStartedAt) / duration, 1);
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
