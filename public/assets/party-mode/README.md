# Party result assets

Source assets live here; `bun run copy-assets` copies them to `assets/party-mode/`.
Development and release packaging already copy `public/assets`.
Four transparent WebP titles, each 400px wide, total 81,528 bytes.
No extra +N asset: the existing score text keeps the mobile footprint small.

Generated with the built-in image generation tool, one prompt per title:

> Use case: stylized-concept. Asset: compact game result title for mobile UI.
> Generate ONLY the exact text "{title}" as one horizontal centered sticker,
> bold chunky playful letters, very thick black outline, yellow and gold fill
> with white highlights, small gold stars and cyan sparkles around letters.
> Transparent background with real alpha, no backdrop, no other text, no red
> pink purple. Entire sticker fits with clear margins. Wide horizontal
> composition, readable at 400px width. Match a cheerful pop arcade reward UI.

Titles: `PERFECT!!`, `GREAT!`, `NICE`, `OK`.
Trim transparent margins, resize preserving alpha, encode WebP at quality 82.

Content resolves extension URLs; inject decodes only on enable and keeps a
small cache. Unready/failed decodes use the original outlined title. Disable
invalidates pending decodes and releases the cache. Titles, score and progress
share the result container and its removal timer. No image work runs per frame.
