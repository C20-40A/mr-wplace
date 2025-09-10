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
  
  // メッセージ関連
  'loading': '読み込み中...',
  'no_items': 'アイテムがありません',
  'upload_success': 'アップロードが完了しました',
  'delete_confirm': '本当に削除しますか？',
  
  // ファイル関連
  'upload': 'アップロード',
  'file_select': 'ファイルを選択',
  'image_editor': '画像エディタ',
  'image_detail': '画像詳細'
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
  
  // メッセージ関連
  'loading': 'Loading...',
  'no_items': 'No items',
  'upload_success': 'Upload completed',
  'delete_confirm': 'Are you sure you want to delete?',
  
  // ファイル関連
  'upload': 'Upload',
  'file_select': 'Select File',
  'image_editor': 'Image Editor',
  'image_detail': 'Image Detail'
};

// 翻訳辞書を登録
registerTranslations('ja', jaTranslations);
registerTranslations('en', enTranslations);
