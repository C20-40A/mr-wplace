import type { ArtCruiseEnemyEntity } from "../enemy-entity";

type BossState = "waiting" | "arrival" | "hover";

const ARRIVAL_SPEED = 150;
const HOVER_SPEED = 185;
const ARRIVAL_DISTANCE = 6;

export class ArtCruiseBossController {
  private boss: ArtCruiseEnemyEntity | null = null;
  private state: BossState = "waiting";
  private elapsed = 0;

  setBoss = (boss: ArtCruiseEnemyEntity) => {
    this.boss = boss;
    this.state = "waiting";
    this.elapsed = 0;
  };

  startArrival = () => {
    if (this.state === "waiting") this.state = "arrival";
  };

  clearBoss = (boss: ArtCruiseEnemyEntity) => {
    if (this.boss === boss) this.boss = null;
  };

  reset = () => {
    this.boss = null;
    this.state = "waiting";
    this.elapsed = 0;
  };

  update = (
    deltaSeconds: number,
    bounds: { width: number; height: number },
  ) => {
    const boss = this.boss;
    if (!boss?.view) return;
    if (this.state === "waiting") return;

    this.elapsed += deltaSeconds;

    if (this.state === "arrival") {
      const target = this.getArrivalTarget(bounds);
      const distance = this.moveToward(
        boss,
        target.x,
        target.y,
        ARRIVAL_SPEED,
        deltaSeconds,
      );
      boss.view.rotation = Math.sin(this.elapsed * 1.2) * 0.025;
      if (distance <= ARRIVAL_DISTANCE) this.state = "hover";
      return;
    }

    const target = this.getHoverTarget(boss, bounds);
    this.moveToward(boss, target.x, target.y, HOVER_SPEED, deltaSeconds);
    boss.view.rotation = Math.sin(this.elapsed * 1.5) * 0.05;
  };

  private getArrivalTarget = (bounds: { width: number; height: number }) => ({
    x: bounds.width * 0.5,
    y: bounds.height * 0.25,
  });

  private getHoverTarget = (
    boss: ArtCruiseEnemyEntity,
    bounds: { width: number; height: number },
  ) => {
    const radius = Math.min(
      boss.radius,
      bounds.width * 0.42,
      bounds.height * 0.42,
    );
    const centerX = bounds.width * 0.5;
    const centerY = bounds.height * 0.25;
    const x =
      centerX +
      Math.sin(this.elapsed * 0.65 + boss.rawData.phase) *
        (bounds.width * 0.28);
    const y = centerY + Math.cos(this.elapsed * 0.85 + boss.rawData.phase) * 45;

    return {
      x: Math.max(radius, Math.min(bounds.width - radius, x)),
      y: Math.max(radius, Math.min(bounds.height - radius, y)),
    };
  };

  private moveToward = (
    boss: ArtCruiseEnemyEntity,
    targetX: number,
    targetY: number,
    speed: number,
    deltaSeconds: number,
  ) => {
    const dx = targetX - boss.view.x;
    const dy = targetY - boss.view.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001) return 0;

    const step = Math.min(speed * deltaSeconds, distance);
    boss.view.x += (dx / distance) * step;
    boss.view.y += (dy / distance) * step;
    return distance - step;
  };
}
