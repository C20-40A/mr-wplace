interface FillRenderOptions {
  data: Uint8ClampedArray;
  comparisonData: Uint8ClampedArray | null;
  width: number;
  height: number;
  bgData: Uint8ClampedArray;
  bgWidth: number;
  offsetX: number;
  offsetY: number;
  skipBackgroundComparison: boolean;
  showUnplacedOnly: boolean;
  showUnplacedColor: readonly [number, number, number];
}

/**
 * fillモード用のx1出力を生成する。
 * x3へのnearest-neighbor拡大はCanvasへ委譲し、RGBA計算は従来経路と同一に保つ。
 */
export const renderFillAt1x = ({
  data,
  comparisonData,
  width,
  height,
  bgData,
  bgWidth,
  offsetX,
  offsetY,
  skipBackgroundComparison,
  showUnplacedOnly,
  showUnplacedColor,
}: FillRenderOptions): Uint8ClampedArray => {
  const output = new Uint8ClampedArray(data.length);
  const useOriginalComparison = showUnplacedOnly && comparisonData !== null;
  const [placedR, placedG, placedB] = showUnplacedColor;

  for (let y = 0; y < height; y++) {
    let srcI = y * width * 4;
    let bgI = ((offsetY + y) * bgWidth + offsetX) * 4;

    for (let x = 0; x < width; x++, srcI += 4, bgI += 4) {
      const r = data[srcI];
      const g = data[srcI + 1];
      const b = data[srcI + 2];
      const a = data[srcI + 3];

      if (!useOriginalComparison && a === 0) continue;

      const cmpR = useOriginalComparison ? comparisonData[srcI] : r;
      const cmpG = useOriginalComparison ? comparisonData[srcI + 1] : g;
      const cmpB = useOriginalComparison ? comparisonData[srcI + 2] : b;
      const cmpA = useOriginalComparison ? comparisonData[srcI + 3] : a;
      if (cmpA === 0) continue;

      let colorMatches = false;
      if (!skipBackgroundComparison) {
        if (bgI + 3 >= bgData.length) continue;
        colorMatches =
          bgData[bgI + 3] > 0 &&
          cmpR === bgData[bgI] &&
          cmpG === bgData[bgI + 1] &&
          cmpB === bgData[bgI + 2];
      }

      if (colorMatches && !showUnplacedOnly) continue;

      if (showUnplacedOnly && colorMatches) {
        output[srcI] = (placedR * 224 + cmpR * 32) >> 8;
        output[srcI + 1] = (placedG * 224 + cmpG * 32) >> 8;
        output[srcI + 2] = (placedB * 224 + cmpB * 32) >> 8;
        output[srcI + 3] = 255;
        continue;
      }

      if (a === 0) continue;
      output[srcI] = r;
      output[srcI + 1] = g;
      output[srcI + 2] = b;
      output[srcI + 3] = a;
    }
  }

  return output;
};
