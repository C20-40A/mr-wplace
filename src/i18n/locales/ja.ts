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
  add: "追加",
  select: "選択",
  cancel: "キャンセル",
  bookmarks: "bookmarks",
  bookmark: "ブックマーク",
  draw_image: "画像",
  text_draw: "テキスト",
  text_clear: "テキストクリア",
  timetravel: "アーカイブ",
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
  location_unavailable: "位置情報を取得できませんでした。",
  location_unavailable_instruction:
    "位置情報を取得できませんでした。マップをクリックしてから保存してください。",
  enter_bookmark_name: "ブックマーク名を入力してください:",
  location_point: "地点",
  bookmark_list: "ブックマーク一覧",
  sort_by: "並び替え",
  sort_created: "追加順",
  sort_accessed: "アクセス順",

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
  current_image: "現在の画像",
  reset_edit: "編集リセット",
  reset_viewport: "ビューをリセット",
  size_reduction: "サイズ縮小",
  brightness: "明るさ",
  contrast: "コントラスト",
  saturation: "彩度",
  dithering: "ディザリング",
  include_paid_colors: "Paid色を含む",
  add_to_gallery: "ギャラリーに追加",
  download: "ダウンロード",
  clear_image_confirm: "画像をクリアして初期状態に戻しますか？",
  saved_to_gallery: "画像をギャラリーに保存しました",
  large_image_resize_confirm:
    "画像サイズが大きいため、処理が重くなる可能性があります。\n画像を縮小しますか？",
  current_size: "現在のサイズ",
  resize_to: "縮小後のサイズ",
  resize_image: "リサイズする",
  edit_image: "編集する",
  add_to_gallery_directly: "直接ギャラリーに追加",
  adjustments: "調整",
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
  image_editor: "画像を追加",
  image_detail: "画像詳細",

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
  auto_spoit_warning: `【自動スポイト機能について - 重要な注意事項】

この機能は「iボタン連打で色を取得する作業」を少し楽にするだけの単純な機能です。
ただし、以下の点に十分注意してください：

⚠ 注意事項
• この機能は開発者の検証用機能です
• この機能は一般には公開されていません
• スポイト機能のテスト目的でのみ使用してください
• これは規約で禁止されているようなBOTではありません
• 誤解を避けるため、必ず自然な速度・自然な塗り方で塗ってください
  （枠から塗る、塗りやすい部分から塗るなど人間らしい塗り方を心がけてください）
• 速すぎる動作や不自然な塗り方はピクセルのずれや誤解の原因になります

責任を持って慎重に使用することに同意しますか？`,

  // Sort Order
  sort_order_default: "デフォルト",
  sort_order_most_missing: "残りピクセルが多い",
  sort_order_least_remaining: "残りピクセルが少ない",

  // Compute Device
  compute_device_label: "処理方式",
};
