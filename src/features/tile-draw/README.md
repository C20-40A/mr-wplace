# EnhancedConfig DrawMode 視覚定義

## mode: "dot"

中央 1 ドットのみ描画

```
□□□
□■□
□□□
```

## mode: "cross"

同色で十字形描画

```
□■□
■■■
□■□
```

## mode: "fill"

3x3 全体を塗りつぶし

```

■■■
■■■
■■■

```

## mode: "red-cross"

中央+上下左右を赤色で描画

```
□ 赤 □
赤 ■ 赤
□ 赤 □
```

## mode: "cyan-cross"

中央+上下左右をシアン(0,255,255)で描画

```
□シ□
シ■シ
□シ□
```

## mode: "dark-cross"

中央+上下左右を暗色で描画

```

□ 暗 □
暗 ■ 暗
□ 暗 □

```

## mode: "complement-cross"

中央+上下左右を補色で描画

```

□ 補 □
補 ■ 補
□ 補 □

```

## mode: "red-border"

周囲 8 ドットを赤色、中央のみ元色

```

赤赤赤
赤 ■ 赤
赤赤赤

```

# パターン別の仕様

次のような仕様

- タイルの上に色をオーバーレイする
- 色は「オーバーレイ色」「透過(タイル色)」「補助色」の ３パターンあるとする
- dot, cross, fill の３つは、「オーバーレイ色」のみ
  - これは「オーバーレイ色」「透過(タイル色)」のみ利用
  - パターン
    - 「タイル色」と「オーバーレイ色」が違う　 → 　「オーバーレイ色」で塗る
    - 「タイル色」と「オーバーレイ色」が同じ　 → 「オーバーレイ色」で塗る、または透過
  - これらは、単純に塗るだけでよい。したがって、色の比較は不要
- ほかのパターンは、「オーバーレイ色」「透過(タイル色)」「補助色」の３つを利用
  - 補助色は、オーバーレイ色とタイル色が異なっている場合「のみ」表示
  - パターン
    - 「タイル色」と「オーバーレイ色」が違う　 → 「オーバーレイ色」＋「補助色」で塗る
    - 「タイル色」と「オーバーレイ色」が同じ　 → 「透過(タイル色)」または、なにもしない(「オーバーレイ色」で塗る)
  - これらは、比較が必ず必要

# 処理の流れ

```
1. fetch ハイジャック → タイル取得して処理開始
2. タイルに描画すべき画像をピックアップ
3. 複数タイルにまたがる画像用に、画像を分割 これを、Template ではなく、「PreparedOverlayImage」と呼ぶ
4. 事前計算ループ（ループ対象ピクセルを作成）
  - 色フィルターが ON の場合：対象色ではない→continue
  - フィルターモードに「補助色」がある場合：タイルと画像の差分を比較→差分がない→continue
  - ピクセルx-yを保存
7. 「画像」を x3 に拡大する(3x3=9 マスのグリッド)
8. オーバーレイ画像（PreparedOverlayImage）を編集する
  - フィルターモードに「補助色」がない&色フィルターがない： すべてループ
  - フィルターモードに「補助色」がある場合： 事前計算の配列をループして、対象ピクセルをEditする
```

# 流れ

inject.js fetch("tiles/520/218.png")ハイジャック
↓
tileBlob 取得（背景タイル）
↓
postMessage({tileBlob, tileX, tileY})
↓
drawOverlayLayersOnTile(tileBlob, [tileX, tileY]) ← この時点で背景あり

1. inject.js から window.postMessage で タイルの blob と座標が飛んでくる(source:"wplace-studio-tile")
2. content.js で作られた src/features/tile-overlay/index.ts が描画の仲介役を担う
3. ...

# ピクセルの編集

```js:これが基本
if (!enhanced?.enabled) {
  // 基本処理: 中央ピクセル抽出
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4; // (ピクセル位置) * RGBA倍

      // 中央ピクセル以外透明化 (現在位置のXとYのどちらも1余る=中央)
      if (x % pixelScale !== 1 || y % pixelScale !== 1) {
        data[i + 3] = 0; // 0 = 透明
      }
    }
  }
}
```

```js:これは動作していない(あとで設置するか検討中)
// #deface色 → チェッカーボード
else if (data[i] === 222 && data[i + 1] === 250 && data[i + 2] === 206) {
  const isEven = (x + y) % 2 === 0;
  data[i] = data[i + 1] = data[i + 2] = isEven ? 0 : 255;
  data[i + 3] = 32;
}
```

```js: Enhanced処理 - 選択色周りに赤ドット(作成時)
if (enhanced?.enabled) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4; // (ピクセル位置) * RGBA倍

      // ４隅なら透明(X列が中央ではない　かつ　Y列が中央ではない)
      if (!(x % pixelScale === 1 || y % pixelScale === 1)) {
        data[i + 3] = 0; // 0 = 透明
        continue;
      }

      // 中央ピクセルならスキップ(元の色を保持)
      if (x % pixelScale === 1 && y % pixelScale === 1) {
        continue;
      }

      // 十字の腕部分を赤で塗る
      data[i] = enhanced.color[0];
      data[i + 1] = enhanced.color[1];
      data[i + 2] = enhanced.color[2];
      data[i + 3] = 255; // 不透明
    }
  }
}
```

```js:周囲を暗くする
  // 中央そのまま
  if (x % pixelScale === 1 && y % pixelScale === 1) {
    continue;
  }
  // ４隅なら透明(X列が中央ではない　かつ　Y列が中央ではない)
  if (!(x % pixelScale === 1)) {
    data[i + 3] = 0; // 0 = 透明
    continue;
  }
  data[i] -= 40;
  data[i + 1] -= 40;
  data[i + 2] -= 40;
  data[i + 3] = 255; // 不透明
```
