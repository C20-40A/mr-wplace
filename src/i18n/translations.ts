import { registerTranslations } from "./index";

// 日本語翻訳辞書
const jaTranslations = {
  // Gallery関連
  gallery: "ギャラリー",
  back: "戻る",
  close: "閉じる",

  // ボタン関連
  save: "保存",
  delete: "削除",
  edit: "編集",
  add: "追加",
  select: "選択",
  cancel: "キャンセル",
  bookmarks: "bookmarks",
  bookmark: "ブックマーク",
  draw_image: "画像を描く",
  timetravel: "タイムマシン",
  export: "エクスポート",
  import: "インポート",

  // メッセージ関連
  loading: "読み込み中...",
  no_items: "アイテムがありません",
  delete_confirm: "本当に削除しますか？",
  saved_message: "を保存しました",
  deleted_message: "削除しました",

  // ブックマーク
  no_bookmarks: "ブックマークがありません",
  add_bookmark_instruction:
    "マップをクリックし、「ブックマーク」ボタンで追加してください",
  saved_count: "保存済み",
  items_unit: "件",
  location_unavailable: "位置情報を取得できませんでした。",
  location_unavailable_instruction:
    "位置情報を取得できませんでした。マップをクリックしてから保存してください。",
  enter_bookmark_name: "ブックマーク名を入力してください:",
  location_point: "地点",
  bookmark_list: "ブックマーク一覧",

  // Import/Export関連
  no_export_bookmarks: "エクスポートするお気に入りがありません",
  bookmarks_exported: "件のお気に入りをエクスポートしました",
  file_input_not_found: "ファイル入力が見つかりません",
  no_file_selected: "ファイルが選択されませんでした",
  invalid_file_format: "無効なファイル形式です",
  import_confirm:
    "件のお気に入りをインポートしますか？\n既存のデータは保持されます。",
  import_cancelled: "インポートがキャンセルされました",
  bookmarks_imported: "件のお気に入りをインポートしました",

  // スナップショット
  timetravel_modal_title: "タイムマシン",
  timetravel_current_position: "現在位置のスナップショット",
  timetravel_tile_list: "タイル一覧",
  timetravel_tile_snapshots: "タイルスナップショット",
  save_current_snapshot: "現在のタイルを保存",
  snapshot_detail: "スナップショット詳細",
  return_to_current: "描画を元に戻す",
  enter_snapshot_name: "スナップショット名を入力（空の場合は日時表示）:",
  enter_tile_name: "タイル名を入力（空の場合は座標表示）:",

  // Image Editor関連
  drag_drop_or_click: "画像をドラッグ&ドロップまたはクリックして選択",
  clear_image: "画像をクリア",
  original_image: "元画像",
  current_image: "現在の画像",
  reset_edit: "編集リセット",
  reset_viewport: "ビューをリセット",
  scroll_to_zoom: "マウスホイールでズーム",
  original_size: "元サイズ",
  current_size: "現在サイズ",
  size_reduction: "サイズ縮小",
  include_paid_colors: "Paid色を含む",
  add_to_gallery: "ギャラリーに追加",
  download: "ダウンロード",
  clear_image_confirm: "画像をクリアして初期状態に戻しますか？",
  saved_to_gallery: "画像をギャラリーに保存しました",
  select_image: "画像を選択",
  click_image_to_draw: "地図に描画したい画像をクリックしてください",
  no_draw_images: "描画用の画像がありません。",
  no_saved_images: "保存された画像がありません",
  delete_image_confirm: "この画像を削除しますか？",

  // Drawing/Loading関連
  drawing_image: "画像を描画中...",
  processing_image: "画像を処理中...",
  waiting_for_update: "更新を待っています...",

  // ファイル関連
  upload: "アップロード",
  file_select: "ファイルを選択",
  image_editor: "画像エディタ",
  image_detail: "画像詳細",

  // 描画関連
  draw_enabled: "描画ON",
  draw_disabled: "描画OFF",
  draw_state: "描画状態",
  enabled: "有効",
  disabled: "無効",
  goto_map: "マップへ移動",
  error: "エラー",
  deleted: "削除しました",

  // popup専用
  buy_me_coffee: "作者にコーヒーをおごる",
};

// 英語翻訳辞書
const enTranslations = {
  // Gallery
  gallery: "Gallery",
  back: "Back",
  close: "Close",

  // Buttons
  save: "Save",
  delete: "Delete",
  edit: "Edit",
  add: "Add",
  select: "Select",
  cancel: "Cancel",
  bookmarks: "bookmarks",
  bookmark: "Bookmark",
  draw_image: "Draw Image",
  timetravel: "Time Machine",
  export: "Export",
  import: "Import",

  // Messages
  loading: "Loading...",
  no_items: "No items",
  delete_confirm: "Are you sure you want to delete?",
  saved_message: "saved",
  deleted_message: "Deleted",

  // Bookmarks
  no_bookmarks: "No bookmarks",
  add_bookmark_instruction:
    'Click on the map and use the "Bookmark" button to add',
  saved_count: "Saved",
  items_unit: "items",
  location_unavailable: "Could not retrieve location information.",
  location_unavailable_instruction:
    "Could not retrieve location information. Please click on the map and then save.",
  enter_bookmark_name: "Please enter bookmark name:",
  location_point: "Point",
  bookmark_list: "Bookmark List",

  // Import/Export関連
  no_export_bookmarks: "No favorites to export",
  bookmarks_exported: " favorites exported",
  file_input_not_found: "File input not found",
  no_file_selected: "No file selected",
  invalid_file_format: "Invalid file format",
  import_confirm:
    "Are you sure you want to import favorites?\nExisting data will be preserved.",
  import_cancelled: "Import cancelled",
  bookmarks_imported: " favorites imported",

  // Snapshots
  timetravel_modal_title: "Time Machine",
  timetravel_current_position: "Current Position Snapshots",
  timetravel_tile_list: "Tile List",
  timetravel_tile_snapshots: "Tile Snapshots",
  save_current_snapshot: "Save Current Snapshot",
  snapshot_detail: "Snapshot Detail",
  return_to_current: "Return to Current",
  enter_snapshot_name: "Enter snapshot name (empty for timestamp):",
  enter_tile_name: "Enter tile name (empty for coordinates):",

  // Image Editor
  drag_drop_or_click: "Drag & drop or click to select image",
  clear_image: "Clear image",
  original_image: "Original image",
  current_image: "Current image",
  reset_edit: "Reset edit",
  reset_viewport: "Reset View",
  scroll_to_zoom: "Scroll to zoom",
  original_size: "Original size",
  current_size: "Current size",
  size_reduction: "Size reduction",
  include_paid_colors: "Include paid colors",
  add_to_gallery: "Add to gallery",
  download: "Download",
  clear_image_confirm: "Clear image and return to initial state?",
  saved_to_gallery: "Image saved to gallery",
  select_image: "Select image",
  click_image_to_draw: "Click on the image you want to draw on the map",
  no_draw_images: "No images for drawing.",
  no_saved_images: "No saved images",
  delete_image_confirm: "Do you want to delete this image?",

  // Drawing/Loading
  drawing_image: "Drawing image...",
  processing_image: "Processing image...",
  waiting_for_update: "Waiting for update...",

  // File related
  upload: "Upload",
  file_select: "Select File",
  image_editor: "Image Editor",
  image_detail: "Image Detail",

  // Drawing
  draw_enabled: "Draw ON",
  draw_disabled: "Draw OFF",
  draw_state: "Draw State",
  enabled: "Enabled",
  disabled: "Disabled",
  goto_map: "Go to Map",
  error: "Error",
  deleted: "Deleted",

  // popup専用
  buy_me_coffee: "Buy me a coffee",
};

// ポルトガル語翻訳辞書（空）
const ptTranslations = {};

// スペイン語翻訳辞書（空）
const esTranslations = {};

// 翻訳辞書を登録
registerTranslations("ja", jaTranslations);
registerTranslations("en", enTranslations);
registerTranslations("pt", ptTranslations);
registerTranslations("es", esTranslations);
