// 日本語翻訳辞書
export const jaTranslations = {
  // Gallery関連
  gallery: "ギャラリー",
  back: "戻る",
  close: "閉じる",

  // ボタン関連
  save: "保存",
  delete: "削除",
  edit: "編集",
  update: "更新",
  updated: "更新しました",
  add: "追加",
  select: "選択",
  cancel: "キャンセル",
  bookmarks: "bookmarks",
  bookmark: "ブックマーク",
  save_location: "現在地を保存",
  draw: "描画",
  draw_image: "画像",
  text_draw: "テキスト",
  text_clear: "テキストクリア",
  timetravel: "アーカイブ",
  export: "エクスポート",
  import: "インポート",

  // Gallery Export/Import関連
  gallery_data: "ギャラリーデータ",
  import_gallery: "ギャラリーをインポート",
  export_gallery: "ギャラリーをエクスポート",
  reset_gallery: "ギャラリーをリセット",
  exporting: "エクスポート中...",
  importing: "インポート中...",
  resetting: "リセット中...",
  export_success: "{count}件の画像をエクスポートしました",
  export_failed: "エクスポートに失敗しました",
  import_success: "{count}件の画像をインポートしました",
  import_failed: "インポートに失敗しました",
  reset_failed: "リセットに失敗しました",
  gallery_reset_success: "ギャラリーをリセットしました",
  no_images_to_export:
    "エクスポートする画像がありません（座標付き画像が必要です）",
  no_valid_images_in_zip: "ZIP内に有効な画像が見つかりませんでした",
  confirm_import: "インポートしますか？新しい画像がギャラリーに追加されます。",
  confirm_reset:
    "ギャラリーの全画像をリセットしますか？この操作は取り消せません。",

  // メッセージ関連
  loading: "読み込み中...",
  no_items: "アイテムがありません",
  delete_confirm: "本当に削除しますか？",
  deleted_message: "削除しました",

  // ブックマーク
  no_bookmarks: "ブックマークがありません",
  add_bookmark_instruction:
    "マップをクリックし、「ブックマーク」ボタンで追加してください",
  location_unavailable: "位置情報を取得できませんでした。",
  location_unavailable_instruction:
    "位置情報を取得できませんでした。マップをクリックしてから保存してください。",
  enter_bookmark_name: "ブックマーク名を入力してください:",
  location_point: "地点",
  bookmark_list: "ブックマーク一覧",
  sort_created: "追加順",
  sort_accessed: "アクセス順",
  sort_tag: "タグ順",
  sort_distance: "距離が近い順",
  sort_last_updated: "最近保存した順",
  sort_tile_count: "タイル数が多い順",
  sort_name: "名前順",
  sort_layer: "レイヤー順",

  // Import/Export関連
  import_export: "インポート/エクスポート",
  import_description: "JSONファイルからブックマークをインポート",
  export_all: "全てエクスポート",
  export_all_description: "全てのブックマークをエクスポート",
  export_by_tag: "タグを選んでエクスポート",
  export_by_tag_description: "選択したタグのブックマークのみエクスポート",
  export_selected_tags: "選択したタグをエクスポート",
  no_tags_available: "タグがありません",
  no_name: "名前なし",
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
  timetravel_current_position: "現在位置のアーカイブ一覧",
  timetravel_tile_list: "タイル一覧",
  timetravel_tile_snapshots: "タイルスナップショット",
  save_current_snapshot: "現在のタイルを保存",
  snapshot_detail: "スナップショット詳細",
  snapshot_share: "スナップショット シェア",
  snapshot_timestamp: "スナップショット時刻",
  snapshot_share_description:
    "このファイル名には座標・時刻情報が含まれています。タイル一覧から再インポートすると、同じ位置・時刻のスナップショットとして登録されます。",
  return_to_current: "描画を元に戻す",
  enter_snapshot_name: "スナップショット名を入力（空の場合は日時表示）:",
  enter_tile_name: "タイル名を入力（空の場合は座標表示）:",

  // Image Editor関連
  drag_drop_or_click: "画像をドラッグ&ドロップまたはクリックして選択",
  clear_image: "画像をクリア",
  original_image: "元画像",
  click_or_drop_to_change: "クリックまたはドロップで変更",
  current_image: "現在の画像",
  reset_edit: "編集リセット",
  reset_viewport: "ビューをリセット",
  size_reduction: "サイズ縮小",
  brightness: "明るさ",
  contrast: "コントラスト",
  saturation: "彩度",
  sharpness: "シャープネス",
  dithering: "ディザリング",
  quantization_method: "色の変換方法",
  quantization_rgb_euclidean: "RGB距離（高速・デフォルト）",
  quantization_weighted_rgb: "重み付きRGB（中速・自然）",
  quantization_lab: "Lab色空間（低速・高品質）",
  include_paid_colors: "Paid色を含む",
  add_to_gallery: "ギャラリーに追加",
  download: "ダウンロード",
  clear_image_confirm: "画像をクリアして初期状態に戻しますか？",
  saved_to_gallery: "画像をギャラリーに保存しました",
  large_image_resize_confirm:
    "画像サイズが大きいため、処理が重くなる可能性があります。\n画像を縮小しますか？",
  current_size: "現在のサイズ",
  resize_to: "縮小後のサイズ",
  resize_image: "リサイズして編集",
  edit_image: "そのまま編集する",
  edit_image_mode: "画像を編集",
  add_to_gallery_directly: "直接ギャラリーに追加",
  select_image: "画像を選択",
  click_image_to_draw: "地図に描画したい画像をクリックしてください",
  no_draw_images: "描画用の画像がありません。",
  no_saved_images: "保存された画像がありません",
  empty_gallery_message:
    "マップに画像を表示するには、まず画像を追加してください",
  add_first_image: "最初の画像を追加",
  unplaced_images: "未配置画像",
  layers: "レイヤー",
  no_layers: "レイヤーなし",
  delete_image_confirm: "この画像を削除しますか？",

  // Drawing/Loading関連
  drawing_image: "更新中...",
  processing_image: "画像を処理中...",
  waiting_for_update: "更新を待っています...",

  // ファイル関連
  upload: "アップロード",
  file_select: "ファイルを選択",
  image_editor: "画像を追加",
  add_image: "画像を追加",
  image_detail: "画像詳細",
  title: "タイトル",
  edit_image_title: "画像タイトルを編集",
  image_title_placeholder: "画像の名前（任意）",
  title_updated: "タイトルを更新しました",

  // 描画関連
  draw_enabled: "描画ON",
  draw_disabled: "描画OFF",
  draw_state: "描画状態",
  draw_this_tile: "このタイルを描画",
  enabled: "有効",
  disabled: "無効",
  invalid_coordinates: "無効な座標",
  coordinates_updated: "座標を更新しました",
  goto_map: "マップへ移動",
  share: "シェア",
  image_share: "画像シェア",
  tile_coordinate: "タイル座標",
  pixel_coordinate: "ピクセル座標",
  lat_lng: "緯度経度",
  coordinates: "座標",
  share_description:
    "この画像ファイル名には座標情報が含まれています。ダウンロードした画像を再度ギャラリーに追加すると、自動的に同じ位置に配置されます。",
  no_position_data: "位置情報がありません",
  download_success: "ダウンロード成功",
  error: "エラー",
  deleted: "削除しました",

  // popup専用
  buy_me_coffee: "作者にコーヒーをおごる",

  // Color Filter
  color_filter: "カラーフィルター",
  enable_all: "すべて有効",
  disable_all: "すべて無効",
  free_colors_only: "無料色",
  owned_colors_only: "所持色",
  enhanced: "強化",

  // User Status (Notification Modal)
  user_status_details: "ステータス",
  level_progress: "レベル",
  current_level: "現在のレベル",
  pixels_painted: "塗りつぶしたピクセル",
  next_level: "次のレベル",
  charge_status: "チャージ",
  time_to_full: "フルチャージまで",
  full_charge_at: "チャージ完了時刻",
  fully_charged: "⚡ チャージ完了！",
  alarm_active: "⏰ アラーム作動中",
  scheduled: "予定時刻",
  no_alarm_set: "😴 アラーム未設定",
  charge_alarm: "🔔 アラーム",
  alarm_browser_warning: "※ ブラウザを閉じると通知されません",
  loading_alarm_settings: "アラーム設定を読み込み中...",
  notification_threshold: "通知しきい値",
  estimated_time: "予想時刻",
  already_reached: "到達済み",
  enable_alarm: "アラーム有効化",
  disable_alarm: "アラーム無効化",
  add_to_calendar_title: "Googleカレンダー",
  wplace_charged_event: "WPlace チャージ完了 ⚡",

  // Theme Toggle
  theme_toggle: "テーマ切り替え",
  theme_light: "ライトテーマ",
  theme_dark: "ダークテーマ",
  theme_switched: "テーマを切り替えました",

  // Enhanced Draw Modes
  enhanced_mode_label: "描画モード",
  enhanced_mode_dot: "ドット",
  enhanced_mode_cross: "十字",
  enhanced_mode_fill: "塗りつぶし",
  enhanced_mode_red_cross: "赤十字",
  enhanced_mode_cyan_cross: "シアン十字",
  enhanced_mode_dark_cross: "暗色十字",
  enhanced_mode_complement_cross: "補色十字",
  enhanced_mode_red_border: "赤枠",

  // Auto Spoit
  auto_spoit: "オートスポイト",
  auto_spoit_tooltip: "自動色取得",

  auto_dotter_warning: `
• この機能は「赤いところにマウスをあてるとSpaceボタンが押される」という実験的な謎機能です
• この機能は開発者の検証用機能です
• テスト目的でのみ使用してください
• 速すぎる不自然な塗り方はBOTだと誤解される原因になります
• 自己責任で使用してください
`,
  //   auto_spoit_warning: `【自動スポイト機能について - 重要な注意事項】

  // この機能は「iボタン連打で色を取得する作業」を少し楽にするだけの単純な機能です。
  // ただし、以下の点に十分注意してください：

  // ⚠ 注意事項
  // • この機能は開発者の検証用機能です
  // • この機能は一般には公開されていません
  // • スポイト機能のテスト目的でのみ使用してください
  // • 自己責任で使用してください
  // • BOTと誤解されるのを避けるため、必ず自然な速度・自然な塗り方で塗ってください
  //   （枠から塗る、塗りやすい部分から塗るなど、人間らしい塗り方をしてください）
  // • 速すぎる動作や不自然な塗り方はピクセルのずれや誤解の原因になります
  // `,

  // Sort Order
  sort_order_default: "デフォルト",
  sort_order_most_missing: "残りピクセルが多い",
  sort_order_least_remaining: "残りピクセルが少ない",

  // Compute Device
  compute_device_label: "処理方式",

  // Show Unplaced Only
  show_unplaced_only: "未配置のみ",

  // Tile Merge
  tile_merge: "タイルマージ",
  merge_tiles: "タイルをマージ",
  export_png: "PNG出力",
  clear_selection: "選択をクリア",
  selected: "選択中",

  // Tile Statistics
  tile_statistics: "タイル統計",
  statistics: "統計",
  calculating: "計算中",
  total_pixels: "総ピクセル数",
  color_distribution: "色分布",

  // Bookmark Tags
  existing_tags: "既存のタグ",
  remove_tag: "タグをはずす",
  bookmark_name: "ブックマーク名",
  tag_name: "タグ名",
  tag_color: "タグ色",
  optional: "任意",
  required: "必須",
  edit_tag: "タグを編集",
  tag_edit_title: "タグ編集",
  tag_edit_description:
    "このタグを使用しているすべてのブックマークが更新されます",
  tag_delete_confirm:
    "このタグを削除しますか？タグを使用しているブックマークからタグが削除されます。",

  // Coordinate Jumper
  coordinate_jumper: "座標ジャンプ",
  geographic_coordinates: "地理座標",
  tile_coordinates: "タイル座標",
  jump_to_coordinates: "座標へジャンプ",

  // Location Search
  location_search: "地名検索",
  search_location: "地名を検索",
  enter_place_name: "場所名を入力してください",
  searching: "検索中...",
  no_results_found: "結果が見つかりませんでした",
  search_results: "検索結果",

  // Coordinate Input (Image Editor)
  coordinate_input_optional: "座標入力（任意）",
  tile_x: "タイルX",
  tile_y: "タイルY",
  pixel_x: "ピクセルX",
  pixel_y: "ピクセルY",
  coordinate_input_hint:
    "座標を入力すると、ギャラリー追加時に自動的にその位置に配置されます",

  // Data Saver
  data_saver: "データセーバー",
  data_saver_on: "データセーバー ON",
  data_saver_off: "データセーバー OFF",
  data_saver_rendering_paused: "画像更新停止中",
  storage_usage: "ストレージ使用量",
  cache_usage: "キャッシュ使用量",
  offline_cache_settings: "オフラインキャッシュ設定",
  maximum_cache_size: "最大キャッシュサイズ",
  clear_all_cache: "すべてのキャッシュをクリア",
  clearing: "クリア中...",
  cache_cleared: "キャッシュをクリアしました!",
  tiles: "タイル",

  // Friends Book
  friends_book: "友人帳",
  add_to_friends: "友人帳に追加",
  add_friend: "友人を追加",
  edit_friend: "友人を編集",
  user_id: "ユーザーID",
  user_id_placeholder: "例: 12345",
  user_name: "ユーザー名",
  user_name_placeholder: "例: PlayerName",
  please_enter_id_and_name: "IDと名前を入力してください",
  description: "説明",
  description_placeholder: "説明を入力...",
  tag: "タグ",
  tags: "タグ",
  new_tag: "新しいタグ",
  create_new_tag: "新しいタグを作成",
  clear_tag: "タグをクリア",
  tag_name_placeholder: "例: 友達、ライバル、etc...",
  select_color: "色を選択",
  create: "作成",
  no_friends: "友人がいません",
  sort_added: "追加順",
  sort_id: "ID順",
  import_merge_confirm:
    "件の友人をインポートしますか？\n既存のデータと統合されます（同じIDは上書き）。",
  import_merge_description: "既存のデータは保持されます。",
  import_friends_description: "CSVファイルからプレイヤーリストをインポート",
  export_all_friends_description: "全ての友人をCSVファイルでエクスポート",
  export_friends_by_tag_description: "選択したタグの友人のみCSVでエクスポート",
  online_sync: "オンライン取り込み",
  online_sync_description:
    "GoogleスプレッドシートなどのCSV URLから友人リストを取り込み",
  sync_merge: "追加取り込み",
  sync_replace: "上書き取り込み",
  please_enter_sync_url: "取り込み元のURLを入力してください",
  sync_failed: "取り込みに失敗しました",
  sync_replace_confirm:
    "本当に上書き取り込みしますか？\n既存の友人リストは全て削除され、URLのデータで置き換えられます。",
  open_url: "URLを開く",
};
