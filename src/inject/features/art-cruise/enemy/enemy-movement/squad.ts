import type { ArtCruisePixiEnemy } from "../types";

export type SquadCommand = {
  duration: number;
  update: (enemies: ArtCruisePixiEnemy[], elapsed: number, dt: number) => void;
};

// 全コマンド完了後、残った敵が画面内に静止し続けると次の波/ボスが出せなくなる。
// 撃ち切った squad は一律で下方向へ退出させ、isOutOfBounds で確実に除去させる。
const RETREAT_SPEED = 220;

/**
 * 複数の敵を一括で制御するためのオーケストレータークラス。
 * シーケンシャルな命令（コマンド）を実行することで、自由度の高い動きを実現する。
 */
export class ArtCruiseSquad {
  private enemies: ArtCruisePixiEnemy[] = [];
  private commands: SquadCommand[] = [];
  private currentCommandIndex = 0;
  private commandElapsed = 0;

  constructor(public readonly id: string) {}

  addMember(enemy: ArtCruisePixiEnemy) {
    enemy.squadId = this.id;
    enemy.squadIndex = this.enemies.length;
    this.enemies.push(enemy);
  }

  removeMember(enemy: ArtCruisePixiEnemy) {
    this.enemies = this.enemies.filter((e) => e !== enemy);
  }

  setCommands(commands: SquadCommand[]) {
    this.commands = commands;
    this.currentCommandIndex = 0;
    this.commandElapsed = 0;
  }

  update(_now: number, dt: number) {
    if (this.enemies.length === 0) return;

    // 全コマンドを撃ち切ったら下方向へ退出させ、画面外で除去させる
    if (this.currentCommandIndex >= this.commands.length) {
      for (const enemy of this.enemies) {
        if (enemy?.view) enemy.view.y += RETREAT_SPEED * dt;
      }
      return;
    }

    const command = this.commands[this.currentCommandIndex];
    command.update(this.enemies, this.commandElapsed, dt);

    this.commandElapsed += dt;
    if (this.commandElapsed >= command.duration) {
      this.currentCommandIndex++;
      this.commandElapsed = 0;
    }
  }

  getEnemies() {
    return this.enemies;
  }

  isDead() {
    return this.enemies.length === 0;
  }

  isComplete() {
    return this.currentCommandIndex >= this.commands.length;
  }
}
