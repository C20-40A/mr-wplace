import { Assets, Container, Sprite, Texture } from "pixi.js";
import {
  PLAYER_BLINK_INTERVAL_MS,
  PLAYER_HIT_RADIUS,
  PLAYER_INVINCIBLE_MS,
  PLAYER_MAX_HP,
  POINTER_FOLLOW_RATE,
} from "../constants";

const SHIP_BASE_RATIO = 0.78;
const SHIP_SPRITE_SIZE = 60;
const HITBOX_SPRITE_SIZE = PLAYER_HIT_RADIUS * 2;
export const SHIP_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAA2CAYAAACMRWrdAAADHklEQVR42u2aMU7EMBBF9wScAFFxAyrQNrRcZUXJLaCjpuMolByFMxhNxLd+fmaS7MYO60AkKyTZOPMyM98Tm91uvS39tE1t6fX50LWtwW0SLD0+vWSwLcH9gzUFtd/vB2A3t/fNww3A7O/NgLG3DMzOtQyWITww27cKl8NOc6xlsHQEWGrOWzCeoSD3reZaCIZzLYZjF35oOEbY8TmDa8lr2VtkdPr8eOsa5x97tYkqXo22cwDTHGslJHvegsc88QDQuXhtyoCesQXBqoKnr8vro8AgFB4Yxre5YDOeXQ3MFQWoHyslPOmApbXBuo7ngHGIwVt2DuKB2lG9NgX2fnFVBW4KLHsBYFF+eeHI90b91wDLnQYdZwA2lvML3lLJHwFL0Ys1W0rB5U4JLCmUZ6AZziC4hpDEMV4Ch+XD4a73DANCKwZmhnEocIkUCQZD8G9RhTB8pKZ8Hd6i/spUEoDjWlAN0jKKPaUeVy9qP/ocezbbshSuVyLxREwExkbBALxpa3g5DDbWB/fFdhQFQ5jM8RjLOosPg3HIjnlMB/NqYJwvKu8MjHyIwPQe9KVRURpsAMUKxl6LDJwDpvd6/aNaKQUXgmnjh3N4ToWigimUlmHVwdQQleY5YJB8FQru69c8pp7S2SlWPhlcs3hInRjm2GoeUzXjsOJz0QCtE6e4X8WoCpgn5apUnAMMxkqGskrn7/ke/M3yzvkXDQnFwBTKM1Kvax+8ZyX1wLyxbuk8SXa5Jb0awUbj2DNEw1CrDf0YjQoB9Ge28PzkyTmG+s72+s2l+aWh5a228MCsYche1IIAULBlcY7h08MULQILvoR7570c0wqG4bwSDbaImp42o+t8B7n1G0Np8apjnldMezmt92E8tP3SxcNBrEdw0XS2F4rRNxdHiT7Tq3aKzCU6nYUVgoJp88BGKppui87XmiwNC1c+Vo9FvwteYAarOmk6Aa2GuWAyGzUI8yOfvd4SkhrNqihl2W5i2u281sY0F7Vq0Out/HuEa/gYWDMLf8d6rKnlWlU0Z87kLESh6GL7bkNbcwvpfx5sdZH4Bme4Qu+FLLGHAAAAAElFTkSuQmCC";
const HEART_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC0AAAAtCAYAAAA6GuKaAAABC0lEQVR42u3ZQQ7CMAwEwL6AFyBO/TrP4w1w41SS3fXaqVEt5VaJiRURx942X7yBdYr4gl73fbpWboCCnmEDIehkAznZHf3w8/aYLjDzudlFoOwGHHA7FsFH4DR4FBVwGKsEimfgENgRTngJGIUj6GGWM0PN9vRYVKEZ+DIwAqfRlcGgpSwf/b9GvmOzTWd5VgSh30SyTaGdFZ6Kpo9GJfoX3H40omgk2xf6QjvRLnjkkpFvwixwKlqFO67zcKGUCZYuGDRc4LRrXIFnVHq2WtoJDpWnbKhgtp62v1yiYAnd5Y3Y8jW+pO+hHou/6DC17OW17Zq27U+3nQS0nbm0nW61niO2ndgun41/ABNCJ/3IhDXdAAAAAElFTkSuQmCC";

export class ArtCruiseShip {
  public readonly view = new Container();
  private readonly sprite: Sprite;
  private readonly hitboxSprite: Sprite;

  private hp = PLAYER_MAX_HP;
  private invincibleUntil = 0;
  private dead = false;

  constructor(screenWidth: number, screenHeight: number) {
    this.sprite = new Sprite(Texture.EMPTY);
    this.sprite.anchor.set(0.5);

    this.hitboxSprite = new Sprite(Texture.EMPTY);
    this.hitboxSprite.anchor.set(0.5);

    this.view.addChild(this.sprite, this.hitboxSprite);

    // Defer texture setup until it is ready to avoid zero-size scaling issues
    Assets.load(SHIP_IMAGE_DATA_URL).then((texture) => {
      this.sprite.texture = texture;
      this.sprite.texture.source.scaleMode = "nearest";
      this.sprite.width = SHIP_SPRITE_SIZE;
      this.sprite.height = SHIP_SPRITE_SIZE;
    });

    Assets.load(HEART_IMAGE_DATA_URL).then((texture) => {
      this.hitboxSprite.texture = texture;
      this.hitboxSprite.texture.source.scaleMode = "nearest";
      this.hitboxSprite.width = HITBOX_SPRITE_SIZE;
      this.hitboxSprite.height = HITBOX_SPRITE_SIZE;
    });

    this.view.position.set(screenWidth * 0.5, screenHeight * SHIP_BASE_RATIO);
  }

  update(targetX: number, targetY: number, now: number) {
    // 1. 移動前の現在の座標を記憶しておく
    const previousX = this.view.x;

    // 2. 座標を更新（既存の追従処理）
    this.view.x += (targetX - this.view.x) * POINTER_FOLLOW_RATE;
    this.view.y += (targetY - this.view.y) * POINTER_FOLLOW_RATE;
    this.view.scale.set(1);

    // 3. このフレームでの移動量を計算
    const movementX = this.view.x - previousX;

    // 4. 移動量に応じて傾ける（0.05 は傾き具合の調整用。お好みで変更してください）
    // 右に動いたら右に傾く（逆方向にしたい場合はマイナスにしてください）
    this.view.rotation = movementX * 0.05;

    // 5. 死亡中は非表示のまま維持。無敵中は点滅させる
    if (!this.dead)
      this.view.alpha = this.isInvincible(now)
        ? Math.floor(now / PLAYER_BLINK_INTERVAL_MS) % 2 === 0
          ? 0.3
          : 1
        : 1;
  }

  /** 被弾時に呼ぶ。無敵中・死亡済みは無視。HP を減らし、死亡なら true を返す */
  takeHit(now: number): { damaged: boolean; dead: boolean } {
    if (this.dead || this.isInvincible(now))
      return { damaged: false, dead: false };

    this.hp = Math.max(0, this.hp - 1);
    this.invincibleUntil = now + PLAYER_INVINCIBLE_MS;
    if (this.hp <= 0) {
      this.dead = true;
      this.view.alpha = 0;
      return { damaged: true, dead: true };
    }
    return { damaged: true, dead: false };
  }

  addLife(amount = 1) {
    if (this.dead) return;
    this.hp += amount;
  }

  reset() {
    this.hp = PLAYER_MAX_HP;
    this.invincibleUntil = 0;
    this.dead = false;
    this.view.alpha = 1;
  }

  isInvincible(now: number) {
    return now < this.invincibleUntil;
  }

  get isDead() {
    return this.dead;
  }

  get currentHp() {
    return this.hp;
  }

  get x() {
    return this.view.x;
  }

  get y() {
    return this.view.y;
  }

  static get BASE_RATIO() {
    return SHIP_BASE_RATIO;
  }
}
