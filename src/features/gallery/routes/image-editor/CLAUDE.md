# Gallery Image Editor

## Goal

- Edit one image for gallery save/download.
- Keep UI state in `controller.ts`.
- Keep file IO in `file-handler.ts`.
- Keep pixel processing in `canvas-processor.ts` + `canvas-processor/*`.
- Keep WebGL backend in `gpu-image-processor.ts`.

## Mental model

`canvas-processor.ts` is not "CPU only". It is the public processing entry.

Flow:

1. `controller.ts`
   - owns editor state
   - caches resized bitmap and outline bitmap
   - decides when re-render is needed
2. `canvas-processor/processing.ts`
   - receives a bitmap + options
   - decides backend: GPU or CPU
3. `gpu-image-processor.ts`
   - only handles adjustment + quantization backend
   - no storage, no DOM state, no UI logic

Important:

- GPU toggle affects only the final image-processing backend.
- Resize, `createImageBitmap`, `OffscreenCanvas`, and outline precompose may still use browser internals that are hardware accelerated, but app-level WebGL processing is skipped when `useGpu = false`.
- So "GPU off" means "do not use `gpuProcessImage()`", not "never touch any browser GPU path".

## File map

- `index.ts`
  - wires UI + controller
- `ui.ts`
  - DOM creation and event binding
- `controller.ts`
  - source of truth for editor state
  - render orchestration
  - bitmap caches
  - delegates transparency mask editing
- `file-handler.ts`
  - file read/write helpers
- `transparency-mask-editor.ts`
  - transparency flood-fill selection state
  - boundary expand/shrink logic
  - preview + committed mask application
- `canvas-processor.ts`
  - stable barrel; keep imports pointed here from controller/ui
- `canvas-processor/types.ts`
  - shared processing types
- `canvas-processor/color-utils.ts`
  - Lab conversion and color distance helpers
- `canvas-processor/outline.ts`
  - outline mask extraction and outline-preserved bitmap creation
- `canvas-processor/quantization.ts`
  - CPU palette quantization, dithering, transparent-color pass
- `canvas-processor/processing.ts`
  - backend selection and shared processing entrypoints
- `gpu-image-processor.ts`
  - WebGL2 pipeline for adjustments + quantization

## Runtime pipeline

`controller.updateScaledImage()` does:

1. ensure resized bitmap cache exists for current scale
2. optionally build/use outline bitmap cache
3. call `createProcessedCanvasFromBitmap(...)`
4. apply transparency mask on resulting canvas
5. update visible output
6. recalculate palette pixel stats

Backend selection inside `createProcessedCanvasFromBitmap(...)`:

- GPU path when `useGpu === true` and dithering is `ordered` or disabled
- CPU path when `useGpu === false`
- CPU path when dithering is `floyd-steinberg`
- CPU fallback when WebGL2 processing throws

So:

- outline feature runs before backend selection
- transparency mask runs after backend selection
- GPU toggle does not disable outline generation or browser bitmap resizing

## Why GPU toggle exists

Likely reason: platform-specific rendering bugs or readback differences.

Observed code-level reason:

- GPU backend depends on WebGL2
- final pixels are read back to CPU (`readPixels`)
- mobile Safari / iPhone class bugs are plausible here
- CPU fallback already exists and is intentionally preserved

Inference:

- your guess is reasonable; this toggle is consistent with "some devices produce wrong colors or unstable output on GPU"

## Performance notes

Fast parts:

- resized bitmap cache avoids repeated resize work on slider changes
- outline bitmap cache avoids repeated line extraction when only color adjustments change
- GPU backend is efficient for repeated adjust + quantize on larger images

Expensive parts:

- outline creation scans full image and builds masks
- Floyd-Steinberg dithering is CPU only and writes diffusion errors pixel-by-pixel
- `processedCanvas.toDataURL()` on mobile path is expensive
- `updateColorPaletteWithPixelCounts()` reads whole canvas every render
- transparency preview / flood fill is CPU-side

Practical reading:

- `useGpu` helps most for large images when outline cache is already valid
- if palette stats feel slow, they can dominate after the main processing is done
- if iPhone is problematic, disabling GPU only removes the WebGL stage, not all bitmap/canvas work

## Safe refactor direction

Best low-risk boundaries:

- keep `controller.ts` as orchestration and cache owner
- keep one public processing entry (`canvas-processor.ts`)
- keep GPU backend isolated behind `processing.ts`

Next safe split for `controller.ts`:

- extract render pipeline helpers
- keep save/load and gallery integration in controller for now

Avoid for now:

- merging GPU logic into controller
- duplicating CPU/GPU option-shaping in multiple places
- letting UI directly call processor modules

## High-signal APIs

Controller-facing:

```ts
createOutlinePreservedBitmap(source, scale, outlineOptions)
createProcessedCanvasFromBitmap(bitmap, adjustments, selectedColorIds, ditheringEnabled, ditheringThreshold, ditheringMethod, useGpu, quantizationMethod, transparentColors)
```

CPU processing internals:

```ts
applyImageAdjustments(imageData, adjustments)
quantizeToColorPalette(imageData, selectedColorIds, method)
quantizeWithDithering(imageData, selectedColorIds, threshold, method, ditheringMethod)
applyTransparentColors(imageData, transparentColors)
```

## Editing guidance

- If changing UI state flow, start in `controller.ts`.
- If changing pixel math, start in `canvas-processor/*`.
- If changing WebGL behavior only, start in `gpu-image-processor.ts`.
- Preserve `canvas-processor.ts` as a barrel unless all imports are updated together.
- Do not remove CPU fallback.
- Treat iPhone/Safari rendering differences as real unless verified otherwise.
