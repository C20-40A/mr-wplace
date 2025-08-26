// WPlace Studio - Main Content Script
// Migrated from Tampermonkey script to Chrome Extension

import { WPlaceExtendedFavorites } from './features/favorite/index';

// Chrome拡張機能として初期化
if (typeof chrome !== 'undefined' && chrome.storage) {
    console.log('🎨 WPlace Studio: Initializing Extended Favorites...');
    new WPlaceExtendedFavorites();
} else {
    console.warn('🎨 WPlace Studio: Chrome extension APIs not available');
}
