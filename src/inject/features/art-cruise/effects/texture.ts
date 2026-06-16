import { Texture } from "pixi.js";

export type EffectTextureLoader = {
  /** ロード完了済みなら同期で Texture を返す。未ロードなら null */
  get: () => Texture | null;
  /** ロードを開始しキャッシュする（プリロード用） */
  preload: () => Promise<Texture>;
};

/** data URL から nearest スケールの Texture を一度だけ生成しキャッシュする */
export const createEffectTexture = (dataUrl: string): EffectTextureLoader => {
  let promise: Promise<Texture> | null = null;
  let texture: Texture | null = null;

  const preload = () => {
    if (!promise)
      promise = (async () => {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        const tex = Texture.from(img);
        tex.source.scaleMode = "nearest";
        texture = tex;
        return tex;
      })();
    return promise;
  };

  return {
    get: () => texture,
    preload,
  };
};
