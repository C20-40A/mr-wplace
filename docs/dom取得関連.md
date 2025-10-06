# カラーパレット取得（スポイト機能）

```javascript
const extractPalette = () => {
  return qsa('[id^="color-"]') // id="color-*"の要素を全て取得
    .filter((el) => !el.querySelector("svg"))
    .map((el) => {
      const id = parseInt(el.id.replace("color-", ""), 10);
      const m = (el.style.backgroundColor || "").match(/\d+/g);
      const rgb = m ? m.map(Number).slice(0, 3) : [0, 0, 0];
      return { id, rgb, element: el };
    });
};
```

**ポイント**: サイトの DOM 構造に依存。`backgroundColor`スタイルから正規表現で RGB 値を抽出。wplace の内部関数は**呼び出していません**。純粋に DOM スクレイピング。

# 色選択の自動化

```javascript
const selectColor = (id) => {
  const el = document.getElementById(`color-${id}`);
  if (el) {
    el.click(); // カラーパレットのボタンをクリック
    return true;
  }
};
```

# ホバーしたときの色の変化

黒(0,0,0)->(82, 82, 82)になった
白(255,255,255)->(235,235,235)になった
ピンク(236, 31, 128) ->(r: 224, g: 101, b: 159)になった
rgb: [210, 210, 210]　 →(r: 210, g: 210, b: 210, )になった
