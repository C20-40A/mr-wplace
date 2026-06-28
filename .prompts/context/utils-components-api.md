# Utils / Components API Context

- generated_at: 2026-03-08T22:51:11.575Z
- project: tsconfig.json
- targets: src/utils, src/components
- files: 26

## src/components/card.ts

- exports: 3
- top_level_declarations: 3
- declarations:
- export interface `CardConfig` (L7)
  - signature: `CardConfig`
- export variable `createCard` (L25)
  - signature: `(config: CardConfig) => string`
  - summary: 共通カードUIを生成
- export variable `attachCardScrollPassthrough` (L213)
  - signature: `(gridContainer: HTMLElement) => void`
  - summary: カード要素にスクロールパススルーを設定 グリッドコンテナ内のカード上でホイール/タッチスクロールを親に伝播させる

## src/components/color-palette/index.ts

- exports: 1
- top_level_declarations: 1
- declarations:
- export class `ColorPalette` (L26)
  - signature: `ColorPalette`
  - summary: カラーパレット表示コンポーネント NOTE: イベントリスナー管理 - インスタンス生成時にboundハンドラーを作成し、setupEventHandlers()で登録 - destroy()で必ずremoveEventListenerを呼び、メモリリークとイベント重複を防止 - 部分更新（updateColorGrid等）はinnerHTML変更のみでイベントリスナーは維持

## src/components/element-observer.ts

- exports: 2
- top_level_declarations: 11
- declarations:
- export interface `ElementConfig` (L1)
  - signature: `ElementConfig`
- interface `ObserverGroup` (L7)
  - signature: `ObserverGroup`
- variable `observerGroups` (L12)
  - signature: `ObserverGroup[]`
- variable `sharedObserver` (L13)
  - signature: `MutationObserver | null`
- variable `renderScheduled` (L14)
  - signature: `boolean`
- variable `renderMissingItems` (L16)
  - signature: `(group: ObserverGroup) => void`
- variable `renderAllGroups` (L33)
  - signature: `() => void`
- variable `scheduleRenderAllGroups` (L37)
  - signature: `() => void`
- variable `shouldRenderGroup` (L46)
  - signature: `(group: ObserverGroup, mutations: MutationRecord[]) => boolean`
- variable `ensureSharedObserver` (L54)
  - signature: `() => void`
- export variable `setupElementObserver` (L72)
  - signature: `(configs: ElementConfig[]) => void`
  - summary: Elementを監視して、存在しない場合に生成する 要素が削除された場合も再生成する

## src/components/hint-tooltip.ts

- exports: 4
- top_level_declarations: 20
- declarations:
- export type `HintPlacement` (L8)
  - signature: `"top" | "bottom" | "left" | "right"`
- export interface `HintTooltipOptions` (L10)
  - signature: `HintTooltipOptions`
- interface `ActiveHintState` (L21)
  - signature: `ActiveHintState`
- variable `STYLE_ID` (L26)
  - signature: `"mr-wplace-hint-tooltip-style"`
- variable `TOOLTIP_CLASS` (L27)
  - signature: `"mr-wplace-hint-tooltip"`
- variable `queue` (L28)
  - signature: `HintTooltipOptions[]`
- variable `pendingHintIds` (L29)
  - signature: `Set<string>`
- variable `activeHint` (L30)
  - signature: `ActiveHintState | null`
- variable `ensureStyles` (L32)
  - signature: `() => void`
- variable `getPlacementFallbacks` (L257)
  - signature: `(preferred: HintPlacement) => readonly HintPlacement[]`
- variable `choosePlacement` (L272)
  - signature: `(preferred: HintPlacement, targetRect: DOMRect, tooltipWidth: number, tooltipHeight: number, offset: number) => HintPlacement`
- variable `clamp` (L302)
  - signature: `(value: number, min: number, max: number) => number`
- variable `ARROW_HALF` (L308)
  - signature: `4`
- variable `ARROW_FULL` (L309)
  - signature: `number`
- variable `ARROW_EDGE_PADDING` (L310)
  - signature: `8`
- variable `updateArrowOffset` (L312)
  - signature: `(tooltip: HTMLDivElement, targetRect: DOMRect, placement: HintPlacement, tooltipRect: DOMRect, left: number, top: number) => void`
- variable `positionTooltip` (L342)
  - signature: `(tooltip: HTMLDivElement, target: HTMLElement, preferredPlacement: HintPlacement, offset: number) => void`
- variable `dequeueAndShow` (L399)
  - signature: `() => Promise<void>`
- export variable `showHintTooltipOnce` (L557)
  - signature: `(options: HintTooltipOptions) => Promise<void>`
- export variable `hasActiveHintTooltip` (L575)
  - signature: `() => boolean`

## src/components/image-dropzone.ts

- exports: 1
- top_level_declarations: 2
- declarations:
- interface `ImageDropzoneOptions` (L3)
  - signature: `ImageDropzoneOptions`
- export class `ImageDropzone` (L13)
  - signature: `ImageDropzone`
  - summary: ドラッグ&ドロップによる画像ファイル選択コンポーネント clickでファイル選択ダイアログも開く

## src/components/image-inspector.ts

- exports: 1
- top_level_declarations: 2
- declarations:
- interface `ImageInspectorOptions` (L3)
  - signature: `ImageInspectorOptions`
- export class `ImageInspector` (L14)
  - signature: `ImageInspector`
  - summary: 画像キャンバスの詳細表示・ズーム・パン機能を提供するコンポーネント 画像を細かくチェックするための機能群

## src/components/loading-indicator.ts

- exports: 4
- top_level_declarations: 7
- declarations:
- variable `LOADING_INDICATOR_ID` (L1)
  - signature: `"loading-indicator"`
- interface `LoadingIndicatorOptions` (L3)
  - signature: `LoadingIndicatorOptions`
- variable `animateDot` (L9)
  - signature: `(dot: HTMLDivElement, delay: number) => void`
- export variable `createLoadingIndicator` (L25)
  - signature: `(options?: LoadingIndicatorOptions) => HTMLDivElement`
- export variable `mountLoadingIndicator` (L71)
  - signature: `(target: HTMLElement, options?: LoadingIndicatorOptions) => HTMLDivElement`
- export variable `renderLoadingIndicator` (L84)
  - signature: `(target: HTMLElement, options?: LoadingIndicatorOptions) => HTMLDivElement`
- export variable `removeLoadingIndicator` (L93)
  - signature: `(id?: string) => void`

## src/components/map-pin-button.ts

- exports: 4
- top_level_declarations: 5
- declarations:
- interface `MapPinButtonConfig` (L1)
  - signature: `MapPinButtonConfig`
- export variable `createMapPinButton` (L8)
  - signature: `(config: MapPinButtonConfig) => HTMLButtonElement`
- export variable `createMapPinButtonContainer` (L126)
  - signature: `() => HTMLDivElement`
- export variable `getOrCreateMapPinButtonGroup` (L140)
  - signature: `(pinContainer: Element) => HTMLElement`
  - summary: マップピン上部のボタングループを取得または作成
- export variable `createMapPinGroupButton` (L167)
  - signature: `(config: { icon?: string; iconSrc?: string; text: string; onClick: () => void; }) => HTMLButtonElement`
  - summary: グループ内で使用するボタンを作成

## src/components/modal.ts

- exports: 5
- top_level_declarations: 8
- declarations:
- export interface `ModalOptions` (L4)
  - signature: `ModalOptions`
- export interface `ModalElements` (L14)
  - signature: `ModalElements`
- type `DialogLikeElement` (L23)
  - signature: `HTMLDialogElement & {
  __dialogLike: {
    isOpen: boolean;
    returnValue: string;
  };
}`
- variable `dialogLikeStack` (L30)
  - signature: `DialogLikeElement[]`
- export variable `hasOpenModal` (L32)
  - signature: `() => boolean`
- variable `createDialogLikeModal` (L34)
  - signature: `() => HTMLDialogElement`
- export variable `showNameInputModal` (L143)
  - signature: `(title: string, placeholder: string, defaultValue?: string) => Promise<string | null>`
  - summary: 名称入力Modal - NOTE: 空文字は''。キャンセルの場合はnullを返す
- export variable `createModal` (L227)
  - signature: `(options: ModalOptions) => ModalElements`

## src/components/responsive-button.ts

- exports: 1
- top_level_declarations: 2
- declarations:
- interface `ResponsiveButtonConfig` (L9)
  - signature: `ResponsiveButtonConfig`
  - summary: レスポンシブボタン作成 小画面: アイコンのみ 大画面: アイコン + テキスト
- export variable `createResponsiveButton` (L17)
  - signature: `(config: ResponsiveButtonConfig) => HTMLButtonElement`

## src/components/toast.ts

- exports: 2
- top_level_declarations: 2
- declarations:
- export type `ToastType` (L1)
  - signature: `"success" | "error"`
- export class `Toast` (L3)
  - signature: `Toast`

## src/utils/area-region.ts

- exports: 12
- top_level_declarations: 12
- declarations:
- export variable `DEFAULT_AREA_COLOR` (L8)
  - signature: `"#0f766e"`
- export variable `DEFAULT_AREA_NAME_DISPLAY_MODE` (L9)
  - signature: `AreaNameDisplayMode`
- export variable `DEFAULT_AREA_NAME_STYLE_MODE` (L10)
  - signature: `AreaNameStyleMode`
- export variable `DEFAULT_AREA_NAME_FONT_SIZE_PX` (L11)
  - signature: `14`
- export variable `MIN_AREA_NAME_FONT_SIZE_PX` (L12)
  - signature: `8`
- export variable `MAX_AREA_NAME_FONT_SIZE_PX` (L13)
  - signature: `32`
- export variable `normalizeAreaColor` (L15)
  - signature: `(value: unknown, fallback?: string) => string`
- export variable `normalizeAreaNameDisplayMode` (L25)
  - signature: `(value: unknown) => AreaNameDisplayMode`
- export variable `normalizeAreaNameStyleMode` (L32)
  - signature: `(value: unknown) => AreaNameStyleMode`
- export variable `normalizeAreaNameFontSizePx` (L39)
  - signature: `(value: unknown) => number`
- export variable `getAreaBounds` (L48)
  - signature: `(vertices: AreaRegionVertex[]) => AreaRegionBounds | null`
- export variable `formatPixelArea` (L69)
  - signature: `(pixelArea: number) => string`

## src/utils/browser-api.ts

- exports: 3
- top_level_declarations: 6
- declarations:
- variable `isFirefox` (L9)
  - signature: `boolean`
  - summary: Cross-browser API wrapper for Chrome and Firefox Firefox: uses `browser` namespace with Promises Chrome: uses `chrome` namespace with callbacks (converted to Promises)
- variable `browserAPI` (L10)
  - signature: `typeof chrome`
- export variable `storage` (L13)
  - signature: `{ get: (keys: string | string[]) => Promise<Record<string, any>>; getKeys: () => Promise<string[]>; set: (items: Record<string, any>) => Promise<void>; remove: (keys: string | string[]) => Promise<void>; }`
- export variable `runtime` (L46)
  - signature: `{ getURL: (path: string) => string; sendMessage: (message: any) => Promise<any>; onMessage: chrome.events.Event<(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void>; readonly lastError: chrome.runtime.LastError | undefined; }`
- export variable `tabs` (L63)
  - signature: `{ query: (queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>; sendMessage: (tabId: number, message: any) => Promise<any>; reload: (tabId: number) => Promise<void>; }`
- variable `browserInfo` (L83)
  - signature: `{ isFirefox: boolean; isChrome: boolean; }`

## src/utils/color-filter-manager.ts

- exports: 1
- top_level_declarations: 6
- declarations:
- variable `STORAGE_KEY` (L5)
  - signature: `"color-filter-selection"`
- variable `ENHANCED_MODE_STORAGE_KEY` (L6)
  - signature: `"enhanced-mode"`
- variable `ENHANCED_COLOR_STORAGE_KEY` (L7)
  - signature: `"enhanced-marker-color"`
- variable `SHOW_UNPLACED_COLOR_STORAGE_KEY` (L8)
  - signature: `"show-unplaced-color"`
- variable `SHOW_UNPLACED_COLOR_SAVE_DEBOUNCE_MS` (L9)
  - signature: `120`
- export class `ColorFilterManager` (L11)
  - signature: `ColorFilterManager`

## src/utils/coordinate.ts

- exports: 5
- top_level_declarations: 10
- declarations:
- interface `LngLatLike` (L9)
  - signature: `LngLatLike`
- variable `EARTH_RADIUS_METERS` (L14)
  - signature: `6378137`
- variable `toRadians` (L16)
  - signature: `(value: number) => number`
- variable `normalizeLngDeltaRadians` (L18)
  - signature: `(delta: number) => number`
- variable `normalizeLngNear` (L25)
  - signature: `(lng: number, baseLng: number) => number`
- export variable `latLngToTilePixel` (L35)
  - signature: `(lat: number, lng: number) => { TLX: number; TLY: number; PxX: number; PxY: number; }`
  - summary: 緯度・経度からタイルインデックスとタイル内ピクセル座標へ変換
- export variable `latLngToTilePixelFloat` (L44)
  - signature: `(lat: number, lng: number) => { TLX: number; TLY: number; PxX: number; PxY: number; pixelXFrac: number; pixelYFrac: number; }`
  - summary: 緯度・経度からタイルインデックスとタイル内ピクセル座標へ変換（浮動小数点版） ピクセル境界判定に使用
- export variable `tilePixelToLatLng` (L65)
  - signature: `(tileX: number, tileY: number, pxX?: number, pxY?: number) => { lat: number; lng: number; }`
  - summary: タイル座標とタイル内ピクセルオフセットから緯度・経度へ逆変換
- export variable `calculateGeodesicAreaSquareMeters` (L87)
  - signature: `(vertices: LngLatLike[]) => number`
  - summary: 緯度経度ポリゴンの測地面積を球面近似で計算 (m²)
- export variable `calculatePixelAreaSquare` (L114)
  - signature: `(vertices: LngLatLike[]) => number`
  - summary: Wplace world pixel 座標系でのポリゴン面積 (px²)

## src/utils/gallery-helpers.ts

- exports: 2
- top_level_declarations: 2
- declarations:
- export interface `ItemWithCoords` (L13)
  - signature: `ItemWithCoords`
  - summary: 座標を持つアイテムの共通インターフェース
- export variable `findNearestGalleryItem` (L24)
  - signature: `<T extends ItemWithCoords>(items: T[]) => T | null`
  - summary: 現在位置から最寄りのギャラリーアイテムを取得
  - tags: @param - coords を持つアイテムのリスト | @returns 最寄りのアイテムID、または null（アイテムが空 or 現在位置が取得できない場合）

## src/utils/geo-converter.ts

- exports: 10
- top_level_declarations: 23
- declarations:
- export variable `TILE_SIZE` (L5)
  - signature: `1000`
- variable `REGION_SIZE_TILES` (L6)
  - signature: `4`
- export variable `ZOOM_LEVEL` (L7)
  - signature: `11`
- variable `EARTH_RADIUS_METERS` (L10)
  - signature: `6378137`
- variable `EARTH_HALF_CIRCUMFERENCE_METERS` (L13)
  - signature: `number`
- variable `initialResolution` (L15)
  - signature: `number`
- variable `latLonToMeters` (L22)
  - signature: `(lat: number, lon: number) => [number, number]`
- export variable `metersToLatLon` (L39)
  - signature: `(metersX: number, metersY: number) => [number, number]`
- variable `resolution` (L58)
  - signature: `(zoom?: number) => number`
- export variable `pixelsToMeters` (L65)
  - signature: `(pixelX: number, pixelY: number, zoom?: number) => [number, number]`
- variable `metersToPixels` (L81)
  - signature: `(metersX: number, metersY: number, zoom?: number) => [number, number]`
- export variable `latLonToPixels` (L96)
  - signature: `(lat: number, lon: number, zoom?: number) => [number, number]`
- variable `latLonToPixelsFloor` (L109)
  - signature: `(lat: number, lon: number, zoom?: number) => [number, number]`
- variable `pixelsToTile` (L122)
  - signature: `(pixelX: number, pixelY: number) => [number, number]`
- export variable `latLonToTile` (L130)
  - signature: `(lat: number, lon: number, zoom?: number) => [number, number]`
- export variable `pixelsToTileLocal` (L143)
  - signature: `(pixelX: number, pixelY: number) => { tile: [number, number]; pixel: [number, number]; }`
- variable `tileBounds` (L157)
  - signature: `(tileX: number, tileY: number, zoom?: number) => { min: [number, number]; max: [number, number]; }`
- variable `tileBoundsLatLon` (L183)
  - signature: `(tileX: number, tileY: number, zoom?: number) => { min: [number, number]; max: [number, number]; }`
- variable `metersToTile` (L203)
  - signature: `(metersX: number, metersY: number, zoom?: number) => [number, number]`
- export variable `latLonToTileAndPixel` (L220)
  - signature: `(lat: number, lon: number, zoom?: number) => { tile: [number, number]; pixel: [number, number]; }`
- variable `pixelBounds` (L244)
  - signature: `(pixelX: number, pixelY: number, zoom?: number) => { min: [number, number]; max: [number, number]; }`
- export variable `pixelToBoundsLatLon` (L259)
  - signature: `(pixelX: number, pixelY: number, zoom?: number) => { min: [number, number]; max: [number, number]; }`
- export variable `latLonToRegionAndPixel` (L290)
  - signature: `(lat: number, lon: number, zoom?: number, regionSizeTiles?: number) => { region: [number, number]; pixel: [number, number]; }`

## src/utils/image-bitmap-compat.ts

- exports: 6
- top_level_declarations: 9
- declarations:
- type `ImageSource` (L8)
  - signature: `| HTMLImageElement 
  | Blob 
  | ImageData 
  | HTMLCanvasElement 
  | OffscreenCanvas
  | ImageBitmap`
  - summary: ImageBitmap compatibility utilities Provides wrapper functions for createImageBitmap with common options and potential future fallback support for older browsers
- interface `ResizeOptions` (L16)
  - signature: `ResizeOptions`
- interface `CropOptions` (L22)
  - signature: `CropOptions`
- export variable `createCleanImageBitmap` (L33)
  - signature: `(source: ImageSource) => Promise<ImageBitmap>`
  - summary: Standard ImageBitmap creation with premultiplyAlpha: "none" Use this for all basic conversions to maintain color accuracy
- export variable `createResizedImageBitmap` (L43)
  - signature: `(source: Exclude<ImageSource, ImageBitmap>, options: ResizeOptions) => Promise<ImageBitmap>`
  - summary: Create ImageBitmap with resize Common pattern for image scaling operations
- export variable `createCroppedImageBitmap` (L59)
  - signature: `(source: ImageBitmap, options: CropOptions) => Promise<ImageBitmap>`
  - summary: Create ImageBitmap with cropping Common pattern for tile splitting operations
- export variable `ensureImageBitmap` (L77)
  - signature: `(source: File | Blob | ImageBitmap) => Promise<ImageBitmap>`
  - summary: Ensure source is ImageBitmap Converts File/Blob to ImageBitmap if needed
- export variable `createImageBitmapFromImageData` (L89)
  - signature: `(imageData: ImageData) => Promise<ImageBitmap>`
  - summary: Create ImageBitmap from ImageData Common pattern for canvas processing results
- export variable `createImageBitmapFromCanvas` (L99)
  - signature: `(canvas: HTMLCanvasElement | OffscreenCanvas) => Promise<ImageBitmap>`
  - summary: Create ImageBitmap from Canvas Common pattern for final rendering results

## src/utils/indexed-db-bridge.ts

- exports: 7
- top_level_declarations: 7
- declarations:
- export variable `getImageDataUrl` (L26)
  - signature: `(item: GalleryItem, options?: { showToastOnError?: boolean; logContext?: string; }) => Promise<string | null>`
  - summary: Get full-size image dataUrl from GalleryItem
  - tags: @param - Gallery item to get dataUrl from | @param - Options for error handling | @returns dataUrl string or null if not found
- export variable `getThumbnailDataUrl` (L63)
  - signature: `(key: string) => Promise<string | null>`
  - summary: Get thumbnail dataUrl from GalleryItem key
  - tags: @param - Gallery item key | @returns thumbnail dataUrl or null if not found
- export variable `saveImage` (L76)
  - signature: `(key: string, imageDataUrl: string, metadata: { title?: string; coords?: { TLX: number; TLY: number; PxX: number; PxY: number; }; visible?: boolean; zIndex?: number; timestamp?: number; }) => Promise<void>`
  - summary: Save image to gallery storage
  - tags: @param - Unique key for the item | @param - Full image as dataUrl | @param - Item metadata
- export variable `getFullImageDataUrl` (L103)
  - signature: `(item: GalleryItem, options?: { showToastOnError?: boolean; logContext?: string; }) => Promise<string | null>`
  - tags: @deprecated Use getImageDataUrl instead
- export variable `saveImageToIndexedDB` (L108)
  - signature: `(key: string, blob: Blob, coords?: { TLX: number; TLY: number; PxX: number; PxY: number; }) => Promise<boolean>`
  - tags: @deprecated Use saveImage instead
- export variable `fetchFullImageFromIndexedDB` (L128)
  - signature: `(key: string) => Promise<string | null>`
  - tags: @deprecated Use getImageDataUrl instead
- export variable `generateThumbnailFromIndexedDB` (L137)
  - signature: `(key: string) => Promise<string | null>`
  - tags: @deprecated Use getThumbnailDataUrl instead

## src/utils/inject-bridge.ts

- exports: 17
- top_level_declarations: 22
- declarations:
- variable `requestIdCounter` (L9)
  - signature: `number`
- variable `generateRequestId` (L10)
  - signature: `() => string`
- export variable `getAggregatedColorStats` (L19)
  - signature: `(imageKeys: string[]) => Promise<Record<string, { matched: number; total: number; }>>`
  - summary: Request aggregated color stats from inject side Used by: paint-stats, color-filter
  - tags: @param - Array of image keys to get stats for | @returns Promise resolving to color stats (RGB key → matched/total counts)
- export variable `getOverlayPixelColor` (L65)
  - signature: `(lat: number, lng: number) => Promise<{ r: number; g: number; b: number; a: number; } | null>`
  - summary: Request overlay pixel color from inject side Used by: auto-spoit (pixel color detection)
  - tags: @param - Latitude coordinate | @param - Longitude coordinate | @returns Promise resolving to RGBA color or null if no overlay at position
- export variable `getPerTileColorStatsAll` (L111)
  - signature: `() => Promise<Record<string, Record<string, { matched: Record<string, number>; total: Record<string, number>; }>>>`
  - summary: Request per-tile color stats from inject side Returns statistics organized by image key and tile key
  - tags: @returns Promise resolving to nested stats structure
- export variable `getStatsPerImage` (L155)
  - signature: `(imageKeys: string[]) => Promise<Record<string, { matched: Record<string, number>; total: Record<string, number>; }>>`
  - summary: Request per-image aggregated stats from inject side Used by: gallery list (progress bars)
  - tags: @param - Array of image keys to get stats for | @returns Promise resolving to stats per image (image key → color stats)
- export variable `sendSnapshotsToInject` (L200)
  - signature: `() => Promise<void>`
  - summary: Send active snapshot draw states to inject side for overlay rendering Used by: time-travel feature Note: Only sends draw state info (snapshotId, tileX, tileY). Inject side loads actual snapshot data from IndexedDB.
- export variable `sendSnapshotCaptureToInject` (L231)
  - signature: `(enabled: boolean) => void`
  - summary: Toggle tmp tile snapshot capture in inject context Used by: time-travel modal open/close
- export interface `SnapshotMetadata` (L245)
  - signature: `SnapshotMetadata`
- export variable `getAllSnapshotMetadata` (L256)
  - signature: `() => Promise<SnapshotMetadata[]>`
  - summary: Get all snapshot metadata from inject side IndexedDB
- export variable `getSnapshotMetadataByTile` (L287)
  - signature: `(tileX: number, tileY: number) => Promise<SnapshotMetadata[]>`
  - summary: Get snapshot metadata by tile coordinates
- export variable `getSnapshotDataUrl` (L324)
  - signature: `(id: string) => Promise<string | null>`
  - summary: Get snapshot blob as dataUrl
- export variable `saveSnapshotToInject` (L355)
  - signature: `(id: string, dataUrl: string, metadata: SnapshotMetadata) => Promise<boolean>`
  - summary: Save snapshot with metadata to inject side IndexedDB
- export variable `deleteSnapshotFromInject` (L393)
  - signature: `(id: string) => Promise<boolean>`
  - summary: Delete snapshot with metadata from inject side IndexedDB
- export variable `getOriginalTileDataUrl` (L430)
  - signature: `(tileX: number, tileY: number) => Promise<string | null>`
  - summary: Get original tile image as dataUrl from inject side Uses in-memory cache first and backend fetch as fallback
- export variable `getMapCenter` (L473)
  - signature: `() => Promise<{ lat: number; lng: number; } | null>`
  - summary: Get map center coordinates from inject side Returns null if map instance is not available
- type `ScreenPoint` (L501)
  - signature: `{ x: number; y: number }`
- type `MapPixelPoint` (L502)
  - signature: `{ pixelX: number; pixelY: number }`
- variable `requestProjectionPoints` (L504)
  - signature: `<TRequestPoint, TResponsePoint>(params: { requestSource: string; responseSource: string; timeoutMessage: string; points: TRequestPoint[]; }) => Promise<TResponsePoint[]>`
- export variable `projectScreenPointsToMapPixels` (L548)
  - signature: `(points: ScreenPoint[]) => Promise<MapPixelPoint[]>`
  - summary: Project viewport client points to wplace pixel coordinates via inject map instance
- export variable `projectMapPixelsToScreenPoints` (L562)
  - signature: `(points: MapPixelPoint[]) => Promise<ScreenPoint[]>`
  - summary: Project wplace pixel coordinates to viewport client points via inject map instance
- export variable `setMapProjectionTracking` (L577)
  - signature: `(enabled: boolean) => void`
  - summary: Enable/disable inject-side map projection tracking events. When enabled, inject posts "mr-wplace-map-view-changed" on map movement.

## src/utils/map-pin-helper.ts

- exports: 1
- top_level_declarations: 2
- declarations:
- interface `MapPinButtonConfig` (L6)
  - signature: `MapPinButtonConfig`
- export variable `addMapPinButton` (L17)
  - signature: `(container: Element, config: MapPinButtonConfig) => HTMLButtonElement | null`
  - summary: マップピングループにボタンを追加（重複チェック付き）

## src/utils/miniidenticon.ts

- exports: 1
- top_level_declarations: 6
- declarations:
- variable `COLORS_NB` (L3)
  - signature: `9`
- variable `DEFAULT_SATURATION` (L4)
  - signature: `95`
- variable `DEFAULT_LIGHTNESS` (L5)
  - signature: `45`
- variable `MAGIC_NUMBER` (L7)
  - signature: `5`
- variable `simpleHash` (L9)
  - signature: `(str: string) => number`
- export variable `minidenticon` (L20)
  - signature: `(seed?: string, saturation?: number, lightness?: number, hashFn?: (str: string) => number) => string`

## src/utils/pixel-converters.ts

- exports: 1
- top_level_declarations: 4
- declarations:
- variable `blobToPixelsWithImageDecoder` (L2)
  - signature: `(blob: Blob) => Promise<{ pixels: Uint8Array; width: number; height: number; }>`
- variable `blobToPixelsWithCanvas` (L18)
  - signature: `(blob: Blob) => Promise<{ pixels: Uint8Array; width: number; height: number; }>`
- variable `useImageDecoder` (L47)
  - signature: `boolean`
- export variable `blobToPixels` (L49)
  - signature: `(blob: Blob) => Promise<{ pixels: Uint8Array; width: number; height: number; }>`

## src/utils/position.ts

- exports: 2
- top_level_declarations: 3
- declarations:
- variable `LOCATION_KEY` (L7)
  - signature: `"location"`
- export variable `getCurrentPosition` (L9)
  - signature: `() => Position | null`
- export variable `gotoPosition` (L17)
  - signature: `({ lat, lng, zoom }: Position) => Promise<void>`

## src/utils/router.ts

- exports: 1
- top_level_declarations: 2
- declarations:
- interface `HeaderElements` (L3)
  - signature: `HeaderElements`
- export class `Router` (L8)
  - signature: `Router`

## src/utils/thumbnail.ts

- exports: 2
- top_level_declarations: 2
- declarations:
- export variable `generateThumbnail` (L8)
  - signature: `(blob: Blob, size?: number) => Promise<string>`
  - summary: Thumbnail generation utilities
- export variable `generateThumbnailFromDataUrl` (L50)
  - signature: `(dataUrl: string, size?: number) => Promise<string>`
  - summary: Generate thumbnail from data URL

