// SEE: https://github.com/laurentpayot/minidenticons/blob/main/minidenticons.js
// 9 different colors only for easy distinction (also a sweet spot for collisions)
const COLORS_NB = 9;
const DEFAULT_SATURATION = 95;
const DEFAULT_LIGHTNESS = 45;

const MAGIC_NUMBER = 5;

const simpleHash = (str: string): number => {
  return (
    str
      .split("")
      .reduce(
        (hash, char) => (hash ^ char.charCodeAt(0)) * -MAGIC_NUMBER,
        MAGIC_NUMBER
      ) >>> 2
  ); // 32 bit unsigned integer conversion disregarding last 2 bits for better randomness
};

export const minidenticon = (
  seed = "",
  saturation = DEFAULT_SATURATION,
  lightness = DEFAULT_LIGHTNESS,
  hashFn = simpleHash
) => {
  const hash = hashFn(seed);
  const hue = (hash % COLORS_NB) * (360 / COLORS_NB);
  return (
    [...Array(seed ? 25 : 0)].reduce(
      (acc, e, i) =>
        // testing the 15 lowest weight bits of the hash
        hash & (1 << i % 15)
          ? acc +
            `<rect x="${i > 14 ? 7 - ~~(i / 5) : ~~(i / 5)}" y="${
              i % 5
            }" width="1" height="1"/>`
          : acc,
      // xmlns attribute added in case of SVG file generation https://developer.mozilla.org/en-US/docs/Web/SVG/Element/svg#sect1
      `<svg viewBox="-1.5 -1.5 8 8" xmlns="http://www.w3.org/2000/svg" fill="hsl(${hue} ${saturation}% ${lightness}%)">`
    ) + "</svg>"
  );
}
