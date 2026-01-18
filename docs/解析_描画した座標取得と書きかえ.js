(() => {
  const originalMapSet = Map.prototype.set;

  // テスト用のモード設定
  // "normal": 通常通り
  // "fake": すべて指定した色に書き換える
  // "block": 特定の座標の書き込みを無視する
  let mode = "fake";

  Map.prototype.set = function (key, value) {
    // ターゲットとなるデータ（座標データ）かどうかを判定
    const isTarget = typeof key === "string" && key.startsWith("t=(");

    if (isTarget) {
      if (mode === "fake") {
        // 1. 【色の書き換えテスト】
        // どんな色が来ても、強制的に「真っ赤（r:255, g:0, b:0）」に書き換える
        if (value && value.color) {
          value.color = { r: 255, g: 0, b: 0, a: 255 };
          value.colorIdx = 1; // パレット上の番号も整合性を合わせる
          console.log("Faked color at:", key);
        }
      } else if (mode === "block") {
        // 2. 【無効化テスト】
        // originalMapSetを呼び出さずに終了することで、Mapへの保存を阻止する
        console.log("Blocked update at:", key);
        return this; // Map.setは通常自分自身(this)を返す仕様
      }
    }

    // 本物のMap.setを実行
    return originalMapSet.call(this, key, value);
  };

  console.log(`Debug Mode: ${mode} - 実行中`);
})();
