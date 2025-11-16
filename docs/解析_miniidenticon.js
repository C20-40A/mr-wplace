// これ使っている
//NOTE: https://github.com/laurentpayot/minidenticons/blob/main/minidenticons.js

const Pe = 9; // 元のコードの Pe は 9
const SATURATION = 95; // io
const LIGHTNESS = 45; // lo
const Ee = 5; // ハッシュ関数で使用する定数を追加

function HASH_FUNCTION(userId) {
  // 元のコード: e.split("").reduce( (o, t) => (o ^ t.charCodeAt(0)) * -Ee, Ee) >>> 2
  // アキュムレータの初期値は Ee (5)
  // 乗算する値は -Ee (-5)
  const hash = userId.split("").reduce((accumulator, char) => {
    return (accumulator ^ char.charCodeAt(0)) * -Ee;
  }, Ee);
  return hash >>> 2;
}

function generateUserIconSvg(userId) {
  // 1. ハッシュ値 i の計算
  // userIdは文字列であることを想定。元のコードも e.split("") のため。
  const hashValue = HASH_FUNCTION(userId.toString());

  // 2. 色相 c の計算
  const hue = (hashValue % Pe) * (360 / Pe);

  // 3. SVGの開始タグ
  const svgStart = `<svg viewBox="-1.5 -1.5 8 8" xmlns="http://www.w3.org/2000/svg" fill="hsl(${hue} ${SATURATION}% ${LIGHTNESS}%)" shape-rendering="crispEdges">`;

  // 4. <rect>要素の生成
  // 元のコード: i & 1 << a % 15
  // 現在の Pe は 9 ですが、ビットマスクの範囲は元のコードに合わせて 15 のままにする必要があります。
  // これは、5x5 のグリッドを左右反転で表現するために、最大で 3x5 + 2x5 = 25 の情報が必要で、
  // 3x5=15 のビットがあれば左右反転で表現できるためです。
  const rects = [...Array(userId ? 25 : 0)].reduce((accumulator, _, index) => {
    // a % 15 の計算は維持
    const isSet = hashValue & (1 << index % 15);

    if (isSet) {
      // x="${a > 14 ? 7 - ~~(a / 5) : ~~(a / 5)}"
      const x = index > 14 ? 7 - Math.floor(index / 5) : Math.floor(index / 5);
      // y="${a % 5}"
      const y = index % 5;

      return accumulator + `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
    return accumulator;
  }, svgStart);

  // 5. SVGの終了タグ
  return rects + "</svg>";
}
