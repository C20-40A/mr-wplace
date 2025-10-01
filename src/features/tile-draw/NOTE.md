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

## mode: "fill"

3x3 全体を塗りつぶし

```

■■■
■■■
■■■

```

## mode: "red-border"

周囲 8 ドットを赤色、中央のみ元色

```

赤赤赤
赤 ■ 赤
赤赤赤

```

## 描画パターン分類

- **Single**: dot
- **Cross 系**: cross, red-cross, dark-cross, complement-cross
- **Full 系**: fill, red-border

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
