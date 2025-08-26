// WPlace Studio - Background Service Worker
// Basic background functionality for the extension

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('🎨 WPlace Studio: Extension installed');
        
        // 初回インストール時の設定
        chrome.storage.local.set({
            'wplace_studio_version': '1.0.0',
            'wplace_studio_installed': Date.now()
        });
    } else if (details.reason === 'update') {
        console.log('🎨 WPlace Studio: Extension updated');
    }
});

// 拡張機能のアクティブ状態を管理
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('wplace.live')) {
        console.log('🎨 WPlace Studio: WPlace.live tab detected');
        
        // バッジにアクティブ状態を表示（オプション）
        chrome.action.setBadgeText({
            tabId: tabId,
            text: '✓'
        });
        
        chrome.action.setBadgeBackgroundColor({
            tabId: tabId,
            color: '#4ade80'
        });
    }
});

// ストレージ変更の監視（デバッグ用）
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.wplace_extended_favorites) {
        console.log('🎨 WPlace Studio: Favorites data updated');
    }
});
