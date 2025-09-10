import { t, I18nManager } from './manager';

// 基本的な使用例
export function basicExample(): void {
  // 初期化（通常はcontent.tsで実行される）
  I18nManager.init('ja');

  // 単純な翻訳
  const galleryTitle = t`${'gallery'}`;
  console.log(galleryTitle); // "ギャラリー"

  // HTML内での使用
  const buttonHtml = t`<button>${'save'}</button>`;
  console.log(buttonHtml); // "<button>保存</button>"

  // 動的な値との組み合わせ
  const count = 5;
  const message = t`${count} items found: ${'loading'}`;
  console.log(message); // "5 items found: 読み込み中..."

  // ロケール切り替え
  I18nManager.switchLocale();
  const englishTitle = t`${'gallery'}`;
  console.log(englishTitle); // "Gallery"
}

// HTMLテンプレート内での使用例
export function htmlTemplateExample(): string {
  return t`
    <div class="modal-box">
      <h3>${'gallery'}</h3>
      <div class="actions">
        <button class="btn">${'save'}</button>
        <button class="btn">${'cancel'}</button>
      </div>
    </div>
  `;
}

// 複雑なケースの例
export function complexExample(): void {
  const userName = "田中";
  const itemCount = 3;
  
  // 翻訳されない動的コンテンツと翻訳キーの組み合わせ
  const welcomeMessage = t`Welcome ${userName}! You have ${itemCount} items. ${'loading'}`;
  // "Welcome 田中! You have 3 items. 読み込み中..."
  
  console.log(welcomeMessage);
}
