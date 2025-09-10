import { registerTranslations } from './index';

// 日本語翻訳辞書
const jaTranslations = {
  // Gallery関連
  'gallery': 'ギャラリー',
  'back': '戻る',
  'close': '閉じる',
  
  // ボタン関連
  'save': '保存',
  'delete': '削除',
  'edit': '編集',
  'add': '追加',
  'select': '選択',
  'cancel': 'キャンセル',
  'bookmarks': 'bookmarks',
  'bookmark': 'ブックマーク',
  'draw_image': '画像を描く',
  'export': 'エクスポート',
  'import': 'インポート',
  
  // メッセージ関連
  'loading': '読み込み中...',
  'no_items': 'アイテムがありません',
  'upload_success': 'アップロードが完了しました',
  'delete_confirm': '本当に削除しますか？',
  'no_favorites': 'お気に入りがありません',
  'add_favorites_instruction': '下の「保存」ボタンから追加してください',
  'saved_count': '保存済み',
  'items_unit': '件',
  'location_unavailable': '位置情報を取得できませんでした。',
  'location_unavailable_instruction': '位置情報を取得できませんでした。マップをクリックしてから保存してください。',
  'enter_favorite_name': 'お気に入り名を入力してください:',
  'location_point': '地点',
  'saved_message': 'を保存しました',
  'deleted_message': '削除しました',
  // Image Editor関連
  'drag_drop_or_click': '画像をドラッグ&ドロップまたはクリックして選択',
  'clear_image': '画像をクリア',
  'original_image': '元画像',
  'current_image': '現在の画像',
  'reset_edit': '編集リセット',
  'scroll_to_zoom': 'マウスホイールでズーム',
  'original_size': '元サイズ',
  'current_size': '現在サイズ',
  'size_reduction': 'サイズ縮小',
  'include_paid_colors': 'Paid色を含む',
  'add_to_gallery': 'ギャラリーに追加',
  'download': 'ダウンロード',
  'clear_image_confirm': '画像をクリアして初期状態に戻しますか？',
  'saved_to_gallery': '画像をギャラリーに保存しました',
  'select_image': '画像を選択',
  'click_image_to_draw': '地図に描画したい画像をクリックしてください',
  'no_draw_images': '描画用の画像がありません。',
  'no_saved_images': '保存された画像がありません',
  'delete_image_confirm': 'この画像を削除しますか？',
  
  // ファイル関連
  'upload': 'アップロード',
  'file_select': 'ファイルを選択',
  'image_editor': '画像エディタ',
  'image_detail': '画像詳細',
  
  // Favorites関連
  'bookmark_list': 'ブックマーク一覧'
};

// 英語翻訳辞書
const enTranslations = {
  // Gallery関連
  'gallery': 'Gallery',
  'back': 'Back',
  'close': 'Close',
  
  // ボタン関連
  'save': 'Save',
  'delete': 'Delete',
  'edit': 'Edit',
  'add': 'Add',
  'select': 'Select',
  'cancel': 'Cancel',
  'bookmarks': 'bookmarks',
  'bookmark': 'Bookmark',
  'draw_image': 'Draw Image',
  'export': 'Export',
  'import': 'Import',
  
  // メッセージ関連
  'loading': 'Loading...',
  'no_items': 'No items',
  'upload_success': 'Upload completed',
  'delete_confirm': 'Are you sure you want to delete?',
  'no_favorites': 'No favorites',
  'add_favorites_instruction': 'Please add from the "Save" button below',
  'saved_count': 'Saved',
  'items_unit': 'items',
  'location_unavailable': 'Could not retrieve location information.',
  'location_unavailable_instruction': 'Could not retrieve location information. Please click on the map and then save.',
  'enter_favorite_name': 'Please enter favorite name:',
  'location_point': 'Point',
  'saved_message': 'saved',
  'deleted_message': 'Deleted',
  
  // Image Editor関連
  'drag_drop_or_click': 'Drag & drop or click to select image',
  'clear_image': 'Clear image',
  'original_image': 'Original image',
  'current_image': 'Current image',
  'reset_edit': 'Reset edit',
  'scroll_to_zoom': 'Scroll to zoom',
  'original_size': 'Original size',
  'current_size': 'Current size',
  'size_reduction': 'Size reduction',
  'include_paid_colors': 'Include paid colors',
  'add_to_gallery': 'Add to gallery',
  'download': 'Download',
  'clear_image_confirm': 'Clear image and return to initial state?',
  'saved_to_gallery': 'Image saved to gallery',
  'select_image': 'Select image',
  'click_image_to_draw': 'Click on the image you want to draw on the map',
  'no_draw_images': 'No images for drawing.',
  'no_saved_images': 'No saved images',
  'delete_image_confirm': 'Do you want to delete this image?',
  
  // ファイル関連
  'upload': 'Upload',
  'file_select': 'Select File',
  'image_editor': 'Image Editor',
  'image_detail': 'Image Detail',
  
  // Favorites関連
  'bookmark_list': 'Bookmark List'
};

// 翻訳辞書を登録
registerTranslations('ja', jaTranslations);
registerTranslations('en', enTranslations);
