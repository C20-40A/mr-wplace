// WPlace Studio - Content Script
console.log('WPlace Studio Content Script loaded on:', window.location.href);

class WPlaceStudioContent {
  constructor() {
    this.features = {
      imageProtection: false,
      rightClickDisable: false,
      uiEnhancement: false,
      autoTools: false
    };
    
    this.initialize();
  }

  async initialize() {
    // メッセージリスナーを設定
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });

    // 設定を取得して初期化
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (response.success) {
        this.features = { ...this.features, ...response.settings };
        this.applyAllFeatures();
      }
    } catch (error) {
      console.error('Failed to get initial settings:', error);
    }

    // WPlace Studio の UI要素を追加
    this.injectStudioUI();
    
    // お気に入り機能を初期化
    this.initFavorites();
    
    console.log('WPlace Studio initialized with features:', this.features);
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'toggleFeature':
        this.toggleFeature(message.feature, message.enabled);
        sendResponse({ success: true });
        break;

      case 'initializeFeatures':
        this.features = { ...this.features, ...message.settings };
        this.applyAllFeatures();
        sendResponse({ success: true });
        break;

      default:
        console.log('Unknown message:', message);
        sendResponse({ success: false });
    }
  }

  toggleFeature(feature, enabled) {
    this.features[feature] = enabled;
    
    switch (feature) {
      case 'imageProtection':
        this.toggleImageProtection(enabled);
        break;
      case 'rightClickDisable':
        this.toggleRightClickProtection(enabled);
        break;
      case 'uiEnhancement':
        this.toggleUIEnhancement(enabled);
        break;
      case 'autoTools':
        this.toggleAutoTools(enabled);
        break;
    }

    this.logActivity(`Feature ${feature} ${enabled ? 'enabled' : 'disabled'}`);
  }

  applyAllFeatures() {
    Object.entries(this.features).forEach(([feature, enabled]) => {
      if (enabled) {
        this.toggleFeature(feature, true);
      }
    });
  }

  // 画像保護機能
  toggleImageProtection(enabled) {
    if (enabled) {
      this.enableImageProtection();
    } else {
      this.disableImageProtection();
    }
  }

  enableImageProtection() {
    // 画像の右クリック防止
    document.querySelectorAll('img').forEach(img => {
      img.addEventListener('contextmenu', this.preventContextMenu);
      img.addEventListener('dragstart', this.preventDrag);
      img.style.userSelect = 'none';
      img.style.webkitUserSelect = 'none';
      img.style.mozUserSelect = 'none';
      img.style.msUserSelect = 'none';
    });

    // 新しく追加される画像にも適用
    this.imageProtectionObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const images = node.tagName === 'IMG' ? [node] : node.querySelectorAll?.('img') || [];
            images.forEach(img => {
              img.addEventListener('contextmenu', this.preventContextMenu);
              img.addEventListener('dragstart', this.preventDrag);
              img.style.userSelect = 'none';
            });
          }
        });
      });
    });

    this.imageProtectionObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.showToast('画像保護が有効になりました');
  }

  disableImageProtection() {
    document.querySelectorAll('img').forEach(img => {
      img.removeEventListener('contextmenu', this.preventContextMenu);
      img.removeEventListener('dragstart', this.preventDrag);
      img.style.userSelect = '';
    });

    if (this.imageProtectionObserver) {
      this.imageProtectionObserver.disconnect();
    }

    this.showToast('画像保護が無効になりました');
  }

  // 右クリック防止機能
  toggleRightClickProtection(enabled) {
    if (enabled) {
      document.addEventListener('contextmenu', this.preventContextMenu);
      this.showToast('右クリック防止が有効になりました');
    } else {
      document.removeEventListener('contextmenu', this.preventContextMenu);
      this.showToast('右クリック防止が無効になりました');
    }
  }

  // UI改善機能
  toggleUIEnhancement(enabled) {
    if (enabled) {
      this.applyUIEnhancements();
      this.showToast('UI改善が有効になりました');
    } else {
      this.removeUIEnhancements();
      this.showToast('UI改善が無効になりました');
    }
  }

  applyUIEnhancements() {
    // カスタムCSSを追加
    if (!document.getElementById('wplace-studio-enhancements')) {
      const style = document.createElement('style');
      style.id = 'wplace-studio-enhancements';
      style.textContent = `
        /* WPlace Studio UI Enhancements */
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        
        /* スムーズなスクロール */
        html {
          scroll-behavior: smooth;
        }
        
        /* ボタンのホバーエフェクト改善 */
        button, .btn, [role="button"] {
          transition: all 0.2s ease !important;
        }
        
        button:hover, .btn:hover, [role="button"]:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  removeUIEnhancements() {
    const style = document.getElementById('wplace-studio-enhancements');
    if (style) {
      style.remove();
    }
  }

  // 自動化ツール
  toggleAutoTools(enabled) {
    if (enabled) {
      this.enableAutoTools();
      this.showToast('自動化ツールが有効になりました');
    } else {
      this.disableAutoTools();
      this.showToast('自動化ツールが無効になりました');
    }
  }

  enableAutoTools() {
    // 自動スクロール機能などを追加予定
    console.log('Auto tools enabled');
  }

  disableAutoTools() {
    console.log('Auto tools disabled');
  }

  // WPlace Studio UI要素を注入
  injectStudioUI() {
    // Studio indicator を追加
    const indicator = document.createElement('div');
    indicator.id = 'wplace-studio-indicator';
    indicator.innerHTML = '🎨 WPlace Studio';
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 8px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      z-index: 10000;
      opacity: 0.8;
      pointer-events: none;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(indicator);

    // 3秒後に薄くする
    setTimeout(() => {
      indicator.style.opacity = '0.3';
    }, 3000);
  }

  // ヘルパーメソッド
  preventContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  preventDrag = (e) => {
    e.preventDefault();
    return false;
  }

  showToast(message) {
    // トースト通知を表示
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 10001;
      font-size: 14px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      animation: slideIn 0.3s ease;
    `;

    // アニメーション用CSS
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(toast);

    // 3秒後に削除
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  logActivity(message) {
    chrome.runtime.sendMessage({
      action: 'logActivity',
      data: {
        message,
        url: window.location.href,
        timestamp: new Date().toISOString()
      }
    }).catch(error => {
      console.error('Failed to log activity:', error);
    });
  }

  // お気に入り機能を初期化
  initFavorites() {
    // WPlace.liveサイトでのみ実行
    if (!window.location.href.includes('wplace.live')) return;
    
    // 保存ボタンを追加
    this.addSaveButton();
  }

  // 保存ボタンを追加
  addSaveButton() {
    // ボタンを追加する場所を探す
    const checkAndAddButton = () => {
      // 既にボタンが存在する場合はスキップ
      if (document.querySelector('#wplace-studio-save-btn')) return;
      
      // 適当な場所にボタンを追加（右上あたり）
      const button = document.createElement('button');
      button.id = 'wplace-studio-save-btn';
      button.innerHTML = '⭐ 保存';
      button.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        transition: all 0.2s ease;
      `;
      
      // ホバーエフェクト
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      });
      
      // クリックイベント
      button.addEventListener('click', () => {
        this.saveCurrentLocation();
      });
      
      document.body.appendChild(button);
      console.log('⭐ Save button added');
    };
    
    // すぐに実行＋定期チェック
    checkAndAddButton();
    setInterval(checkAndAddButton, 3000);
  }

  // 現在位置を保存
  async saveCurrentLocation() {
    try {
      // URLから位置情報を取得
      const url = new URL(window.location.href);
      const lat = parseFloat(url.searchParams.get('lat'));
      const lng = parseFloat(url.searchParams.get('lng'));
      const zoom = parseFloat(url.searchParams.get('zoom')) || 14;
      
      if (isNaN(lat) || isNaN(lng)) {
        this.showToast('位置情報が見つかりません。マップを移動してから保存してください。');
        return;
      }
      
      const name = prompt(`お気に入り名を入力してください:`, `地点 (${lat.toFixed(3)}, ${lng.toFixed(3)})`);
      if (!name) return;
      
      const favorite = {
        id: Date.now(),
        name: name,
        lat: lat,
        lng: lng,
        zoom: zoom,
        date: new Date().toLocaleDateString('ja-JP'),
        url: window.location.href
      };
      
      // Chrome Storageに保存
      const result = await chrome.storage.local.get(['wplace_favorites']);
      const favorites = result.wplace_favorites || [];
      favorites.push(favorite);
      
      await chrome.storage.local.set({ 'wplace_favorites': favorites });
      
      this.showToast(`"${name}" を保存しました (${favorites.length}件目)`);
      
    } catch (error) {
      console.error('保存エラー:', error);
      this.showToast('保存に失敗しました');
    }
  }
}

// コンテンツスクリプトを初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new WPlaceStudioContent();
  });
} else {
  new WPlaceStudioContent();
}