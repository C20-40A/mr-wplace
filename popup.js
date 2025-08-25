// WPlace Studio - Popup Script
console.log('WPlace Studio Popup loaded');

class WPlaceStudioPopup {
  constructor() {
    this.initializeEventListeners();
    this.loadSettings();
  }

  initializeEventListeners() {
    // 保護機能のトグル
    document.getElementById('image-protection').addEventListener('change', (e) => {
      this.toggleFeature('imageProtection', e.target.checked);
    });

    document.getElementById('right-click-disable').addEventListener('change', (e) => {
      this.toggleFeature('rightClickDisable', e.target.checked);
    });

    // 拡張機能のトグル
    document.getElementById('ui-enhancement').addEventListener('change', (e) => {
      this.toggleFeature('uiEnhancement', e.target.checked);
    });

    document.getElementById('auto-tools').addEventListener('change', (e) => {
      this.toggleFeature('autoTools', e.target.checked);
    });

    // 設定ボタン
    document.getElementById('settings').addEventListener('click', () => {
      this.openSettings();
    });
  }

  async toggleFeature(feature, enabled) {
    try {
      // 設定を保存
      await chrome.storage.sync.set({ [feature]: enabled });
      
      // アクティブなタブに変更を送信
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.url.includes('wplace.jp')) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleFeature',
          feature: feature,
          enabled: enabled
        });
      }

      this.updateStatus(`${feature} ${enabled ? '有効' : '無効'}にしました`);
    } catch (error) {
      console.error('Feature toggle error:', error);
      this.updateStatus('エラーが発生しました');
    }
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get([
        'imageProtection',
        'rightClickDisable',
        'uiEnhancement',
        'autoTools'
      ]);

      // UIに設定を反映
      Object.entries(settings).forEach(([key, value]) => {
        const checkbox = document.getElementById(this.camelToKebab(key));
        if (checkbox) {
          checkbox.checked = value || false;
        }
      });

      this.updateStatus('設定を読み込みました');
    } catch (error) {
      console.error('Settings load error:', error);
      this.updateStatus('設定の読み込みに失敗しました');
    }
  }

  camelToKebab(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  updateStatus(message) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    
    // 3秒後に元に戻す
    setTimeout(() => {
      statusElement.textContent = '準備完了';
    }, 3000);
  }

  openSettings() {
    // 今後実装予定の設定画面
    this.updateStatus('設定画面は開発中です');
  }
}

// DOMが読み込まれたら初期化
document.addEventListener('DOMContentLoaded', () => {
  new WPlaceStudioPopup();
});