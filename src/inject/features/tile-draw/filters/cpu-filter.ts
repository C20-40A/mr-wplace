type PixelArray = Uint8ClampedArray;

interface ImageProcessorOptions {
  width?: number;
  height?: number;
  filters?: [number, number, number][]; // RGB tuples
}

const MAX_FILTERS = 64;
const rgbToInt = (r: number, g: number, b: number): number =>
  (r << 16) | (g << 8) | b;

export const processCpuColorFilter = (
  source: PixelArray,
  opts: ImageProcessorOptions = {}
): Uint8ClampedArray => {
  const { width = source.length / 4, height = 1 } = opts;
  let filters = opts.filters ?? [];

  if (filters.length > MAX_FILTERS) filters = filters.slice(0, MAX_FILTERS);
  if (filters.length === 0) return source; // フィルター未指定ならそのまま返す

  // フィルターを高速探索のためにSet化（数値キー）
  const filterSet = new Set(filters.map(([r, g, b]) => rgbToInt(r, g, b)));

  const out = new Uint8ClampedArray(source.length);
  const pixelCount = width * height;

  for (let i = 0; i < pixelCount; i++) {
    const base = i * 4;
    const r = source[base];
    const g = source[base + 1];
    const b = source[base + 2];
    const a = source[base + 3];

    // RGBがフィルターと一致する場合のみ出力
    if (filterSet.has(rgbToInt(r, g, b))) {
      out[base] = r;
      out[base + 1] = g;
      out[base + 2] = b;
      out[base + 3] = a;
    } else {
      // 非一致ピクセルは透過
      out[base + 3] = 0;
    }
  }

  return out;
};
