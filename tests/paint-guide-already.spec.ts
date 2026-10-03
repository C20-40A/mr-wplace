import { expect, test } from "@playwright/test";
import { build } from "esbuild";

const coord = {
  key: "1,2,0,0", tileX: 1, tileY: 2, pixelX: 0, pixelY: 0,
  color: { r: 10, g: 20, b: 30 }, timestamp: 1,
};

const createFixture = async () => {
  const mocks: Record<string, string> = {
    "@/constants/colors": "export const colorpalette = [];",
    "./tile-draw/states": "export const overlayLayers = fixture.layers; export const perTileColorStats = new Map();",
    "./beacon": "export const scheduleBeaconRecompute = () => {}; export const onBeaconPixelPainted = () => {};",
    "./map-instance/front-tile-layer": "export const upsertFrontTilePaintGuide = (...args) => fixture.dots.push(args[4]); export const clearFrontTilePaintGuide = () => {};",
    "./map-instance/painted-coordinates-capture": "export const getCapturedPaintedCoordinates = () => fixture.coordinates;",
    "./tile-draw/last-modified-cache": "export const getOriginalBlob = () => fixture.blob;",
    "@/utils/pixel-converters": "export const blobToPixels = () => { fixture.decodes++; return fixture.decoded; };",
  };
  const bundle = await build({
    entryPoints: ["src/inject/features/paint-stats-updater.ts"],
    bundle: true, write: false, format: "iife", globalName: "Updater",
    plugins: [{ name: "fixtures", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path }) =>
        path in mocks ? { path, namespace: "fixture" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) =>
        ({ contents: mocks[path], loader: "js" }));
    } }],
  });
  let resolve!: (value: { pixels: Uint8Array; width: number; height: number }) => void;
  const fixture = {
    dots: [] as string[], decodes: 0, blob: new Blob(),
    coordinates: new Map([[coord.key, coord]]),
    layers: [{ drawEnabled: true, imageKey: "template", tiles: {
      "1,2": { width: 1, height: 1 },
    } }],
    decoded: new Promise<{ pixels: Uint8Array; width: number; height: number }>(done => { resolve = done; }),
  };
  const updater = new Function("fixture", "window", "OffscreenCanvas",
    `${bundle.outputFiles[0].text}; return Updater;`)(fixture, {
      mrWplaceFrontTileLayerEnabled: true, mrWplacePaintGuideEnabled: true,
    }, class {
      getContext() { return {
        drawImage() {},
        getImageData: () => ({ data: new Uint8ClampedArray([10, 20, 30, 255]) }),
      }; }
    });
  return { fixture, updater, finish: async (rgba = [10, 20, 30, 255]) => {
    resolve({ pixels: new Uint8Array(rgba), width: 1, height: 1 });
    await fixture.decoded;
    await Promise.resolve();
    await Promise.resolve();
  } };
};

test("matching template and background produce a blue already dot on first decode and replay", async () => {
  const { fixture, updater, finish } = await createFixture();
  updater.handlePaintForStats(coord, false);
  updater.handlePaintForStats(coord, false);
  await finish();
  expect(fixture.dots).toEqual(["already", "already"]);
  expect(fixture.decodes).toBe(1);
});

test("unpainted or transparent background does not produce an already dot", async () => {
  for (const rgba of [[40, 50, 60, 255], [10, 20, 30, 0]]) {
    const { fixture, updater, finish } = await createFixture();
    updater.handlePaintForStats(coord, false);
    await finish(rgba);
    expect(fixture.dots).toEqual([]);
  }
});

test("a different paint color keeps the mismatch warning without decoding background", async () => {
  const { fixture, updater } = await createFixture();
  updater.handlePaintForStats({ ...coord, color: { r: 40, g: 50, b: 60 } }, false);
  expect(fixture.dots).toEqual(["mismatch"]);
  expect(fixture.decodes).toBe(0);
});

test("erased, recolored, and refreshed pixels ignore stale background reads", async () => {
  for (const change of ["erase", "recolor", "refresh"]) {
    const { fixture, updater, finish } = await createFixture();
    updater.handlePaintForStats(coord, false);
    if (change === "erase") fixture.coordinates.clear();
    if (change === "recolor") fixture.coordinates.set(coord.key, { ...coord, timestamp: 2 });
    if (change === "refresh") fixture.blob = new Blob();
    await finish();
    expect(fixture.dots).toEqual([]);
  }
});
