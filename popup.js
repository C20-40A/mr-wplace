// WPlace Studio Popup Script
// 言語設定管理

document.addEventListener('DOMContentLoaded', async () => {
    const languageSelect = document.getElementById('language-select');
    const statusElement = document.getElementById('status');
    
    try {
        // 現在の言語設定を読み込み
        const result = await chrome.storage.local.get(['wplace_studio_locale']);
        const currentLocale = result.wplace_studio_locale || 'ja';
        
        languageSelect.value = currentLocale;
        updateStatus('設定を読み込みました / Settings loaded');
        
        // 言語変更イベント
        languageSelect.addEventListener('change', async (event) => {
            const newLocale = event.target.value;
            
            try {
                // 設定を保存
                await chrome.storage.local.set({ 
                    'wplace_studio_locale': newLocale 
                });
                
                // アクティブなタブに言語変更を通知
                const [activeTab] = await chrome.tabs.query({ 
                    active: true, 
                    currentWindow: true 
                });
                
                if (activeTab && activeTab.url && activeTab.url.includes('wplace.live')) {
                    await chrome.tabs.sendMessage(activeTab.id, {
                        type: 'LOCALE_CHANGED',
                        locale: newLocale
                    });
                }
                
                updateStatus(newLocale === 'ja' ? '設定を保存しました' : 'Settings saved');
                
            } catch (error) {
                console.error('Failed to save locale:', error);
                updateStatus('Error saving settings');
            }
        });
        
    } catch (error) {
        console.error('Failed to load locale:', error);
        updateStatus('Error loading settings');
    }
});

function updateStatus(message) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    
    // 2秒後にReadyに戻す
    setTimeout(() => {
        statusElement.textContent = 'Ready';
    }, 2000);
}
