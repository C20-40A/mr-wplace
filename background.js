// WPlace Studio - Background Service Worker
console.log('WPlace Studio Background Service Worker loaded');

class WPlaceStudioBackground {
  constructor() {
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // インストール時の処理
    chrome.runtime.onInstalled.addListener((details) => {
      console.log('WPlace Studio installed:', details);
      this.setupDefaultSettings();
    });

    // メッセージ処理
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // 非同期レスポンスを有効にする
    });

    // タブ更新の監視
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url && tab.url.includes('wplace.jp')) {
        this.onWPlacePageLoaded(tabId, tab);
      }
    });
  }

  async setupDefaultSettings() {
    const defaultSettings = {
      imageProtection: false,
      rightClickDisable: false,
      uiEnhancement: false,
      autoTools: false,
      firstTime: true
    };

    try {
      const existing = await chrome.storage.sync.get(Object.keys(defaultSettings));
      const settingsToSet = {};

      // 既存の設定がない場合のみデフォルト値を設定
      Object.entries(defaultSettings).forEach(([key, value]) => {
        if (existing[key] === undefined) {
          settingsToSet[key] = value;
        }
      });

      if (Object.keys(settingsToSet).length > 0) {
        await chrome.storage.sync.set(settingsToSet);
        console.log('Default settings applied:', settingsToSet);
      }
    } catch (error) {
      console.error('Failed to setup default settings:', error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'getSettings':
          const settings = await chrome.storage.sync.get([
            'imageProtection',
            'rightClickDisable',
            'uiEnhancement',
            'autoTools'
          ]);
          sendResponse({ success: true, settings });
          break;

        case 'logActivity':
          this.logActivity(message.data);
          sendResponse({ success: true });
          break;

        case 'showNotification':
          this.showNotification(message.data);
          sendResponse({ success: true });
          break;

        default:
          console.log('Unknown message action:', message.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async onWPlacePageLoaded(tabId, tab) {
    try {
      // 設定を取得
      const settings = await chrome.storage.sync.get([
        'imageProtection',
        'rightClickDisable',
        'uiEnhancement',
        'autoTools'
      ]);

      // コンテンツスクリプトに設定を送信
      chrome.tabs.sendMessage(tabId, {
        action: 'initializeFeatures',
        settings: settings
      }).catch(error => {
        // コンテンツスクリプトがまだ準備できていない場合は無視
        console.log('Content script not ready yet:', error.message);
      });

      console.log('WPlace page loaded, settings sent:', settings);
    } catch (error) {
      console.error('Error handling page load:', error);
    }
  }

  logActivity(data) {
    console.log('Activity logged:', {
      timestamp: new Date().toISOString(),
      ...data
    });
    // 将来的にはアクティビティログをストレージに保存可能
  }

  showNotification(data) {
    // 通知機能（将来的に実装）
    console.log('Notification requested:', data);
  }
}

// バックグラウンドサービスワーカーを初期化
new WPlaceStudioBackground();