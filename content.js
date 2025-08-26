// WPlace Studio - Extended Favorites Functionality
// Migrated from Tampermonkey script to Chrome Extension

class WPlaceExtendedFavorites {
    constructor() {
        this.CONFIG = {
            selectors: {
                favoriteButton: '[title="お気に入り"]',
                toggleOpacityButton: 'button[title="Toggle art opacity"]',
                saveContainer: '.hide-scrollbar.flex.max-w-full.gap-1\\.5.overflow-x-auto'
            },
            storageKeys: {
                favorites: 'wplace_extended_favorites',
                location: 'location'
            }
        };
        this.init();
    }

    init() {
        this.observeAndInit();
    }

    observeAndInit() {
        // ボタン設定
        const buttonConfigs = [
            {
                id: 'favorite-btn',
                selector: this.CONFIG.selectors.favoriteButton,
                containerSelector: this.CONFIG.selectors.toggleOpacityButton,
                create: this.createFavoriteButton.bind(this)
            },
            {
                id: 'save-btn',
                selector: '[data-wplace-save="true"]',
                containerSelector: this.CONFIG.selectors.saveContainer,
                create: this.createSaveButton.bind(this)
            }
        ];

        // 汎用ボタン監視
        this.startButtonObserver(buttonConfigs);

        // モーダル作成
        setTimeout(() => this.createModal(), 2000);
    }

    // 汎用ボタン監視システム
    startButtonObserver(configs) {
        const ensureButtons = () => {
            configs.forEach(config => {
                if (!document.querySelector(config.selector)) {
                    const container = document.querySelector(config.containerSelector);
                    if (container) {
                        config.create(container);
                    }
                }
            });
        };

        // DOM変更監視
        const observer = new MutationObserver(() => {
            setTimeout(ensureButtons, 100);
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // 初期配置 & 定期チェック
        setTimeout(ensureButtons, 1000);
        setInterval(ensureButtons, 5000);
    }

    // お気に入りボタン作成
    createFavoriteButton(toggleButton) {
        const container = toggleButton.parentElement;
        if (!container) return;

        const button = document.createElement('button');
        button.className = 'btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 ml-2 z-30';
        button.title = 'お気に入り';
        button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-5">
            <path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z"/>
        </svg>
    `;
        button.addEventListener('click', () => this.openModal());
        container.appendChild(button);
        console.log('⭐ WPlace Studio: Favorite button added');
    }

    // 保存ボタン作成
    createSaveButton(container) {
        const button = document.createElement('button');
        button.className = 'btn btn-primary btn-soft';
        button.setAttribute('data-wplace-save', 'true');
        button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4.5">
            <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/>
        </svg>
        保存
    `;
        button.addEventListener('click', () => this.addFavorite());
        container.appendChild(button);
        console.log('⭐ WPlace Studio: Save button added');
    }

    // モーダルを作成
    createModal() {
        const modal = document.createElement('dialog');
        modal.id = 'wplace-studio-favorite-modal';
        modal.className = 'modal';

        modal.innerHTML = `
        <div class="modal-box max-w-4xl">
            <form method="dialog">
                <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            </form>

            <div class="flex items-center gap-1.5 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-5">
                    <path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z"/>
                </svg>
                <h3 class="text-lg font-bold">WPlace Studio - お気に入り</h3>
            </div>

            <!-- エクスポート・インポートボタン -->
            <div class="flex gap-2 mb-4">
                <button id="wps-export-btn" class="btn btn-outline btn-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
                        <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
                    </svg>
                    エクスポート
                </button>
                <button id="wps-import-btn" class="btn btn-outline btn-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
                        <path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H520q-33 0-56.5-23.5T440-240v-206l-64 62-56-56 160-160 160 160-56 56-64-62v206h220q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h100v80H260Z"/>
                    </svg>
                    インポート
                </button>
                <input type="file" id="wps-import-file" accept=".json" style="display: none;">
            </div>

            <div id="wps-favorites-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
                <!-- ここにお気に入りが表示される -->
            </div>

            <div id="wps-favorites-count" class="text-center text-sm text-base-content/80 mt-4">
                <!-- 件数表示 -->
            </div>
        </div>

        <form method="dialog" class="modal-backdrop">
            <button>close</button>
        </form>
    `;

        document.body.appendChild(modal);

        // イベントリスナー（既存のグリッドクリック）
        modal.querySelector('#wps-favorites-grid').addEventListener('click', (e) => {
            const card = e.target.closest('.wps-favorite-card');
            const deleteBtn = e.target.closest('.wps-delete-btn');

            if (deleteBtn) {
                const id = parseInt(deleteBtn.dataset.id);
                this.deleteFavorite(id);
            } else if (card) {
                const lat = parseFloat(card.dataset.lat);
                const lng = parseFloat(card.dataset.lng);
                const zoom = parseFloat(card.dataset.zoom);
                this.goTo(lat, lng, zoom);
                modal.close();
            }
        });

        // エクスポート・インポートのイベントリスナー
        modal.querySelector('#wps-export-btn').addEventListener('click', () => this.exportFavorites());
        modal.querySelector('#wps-import-btn').addEventListener('click', () => this.importFavorites());
    }

    // Chrome Storage API を使用したストレージ操作
    async setValue(key, value) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, () => {
                resolve();
            });
        });
    }

    async getValue(key, defaultValue = null) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key] !== undefined ? result[key] : defaultValue);
            });
        });
    }

    // エクスポート機能
    async exportFavorites() {
        try {
            const favorites = await this.getFavorites();

            if (favorites.length === 0) {
                this.showToast('エクスポートするお気に入りがありません');
                return;
            }

            const exportData = {
                version: "1.0",
                exportDate: new Date().toISOString(),
                count: favorites.length,
                favorites: favorites,
                source: "WPlace Studio Chrome Extension"
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `wplace-studio-favorites-${new Date().toISOString().split('T')[0]}.json`;
            link.click();

            this.showToast(`${favorites.length}件のお気に入りをエクスポートしました`);

        } catch (error) {
            console.error('WPlace Studio: エクスポートエラー:', error);
            this.showToast('エクスポートに失敗しました');
        }
    }

    // インポート機能
    importFavorites() {
        const fileInput = document.getElementById('wps-import-file');
        fileInput.click();

        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const importData = JSON.parse(text);

                // データ形式チェック
                if (!importData.favorites || !Array.isArray(importData.favorites)) {
                    throw new Error('無効なファイル形式です');
                }

                const currentFavorites = await this.getFavorites();
                const importCount = importData.favorites.length;

                if (!confirm(`${importCount}件のお気に入りをインポートしますか？\n既存のデータは保持されます。`)) {
                    return;
                }

                // 重複チェック（座標が同じものは除外）
                const newFavorites = importData.favorites.filter(importFav => {
                    return !currentFavorites.some(existing =>
                        Math.abs(existing.lat - importFav.lat) < 0.001 &&
                        Math.abs(existing.lng - importFav.lng) < 0.001
                    );
                });

                // IDを新規採番（整数で）
                newFavorites.forEach((fav, index) => {
                    fav.id = Date.now() + index;
                });

                // マージして保存
                const mergedFavorites = [...currentFavorites, ...newFavorites];
                await this.setValue(this.CONFIG.storageKeys.favorites, JSON.stringify(mergedFavorites));

                this.renderFavorites();
                this.showToast(`${newFavorites.length}件のお気に入りをインポートしました`);

            } catch (error) {
                console.error('WPlace Studio: インポートエラー:', error);
                this.showToast('インポートに失敗しました: ' + error.message);
            }

            // ファイル入力をクリア
            fileInput.value = '';
        };
    }

    // モーダルを開く
    openModal() {
        this.renderFavorites();
        document.getElementById('wplace-studio-favorite-modal').showModal();
    }

    // 現在位置を取得
    getCurrentPosition() {
        try {
            const locationStr = localStorage.getItem(this.CONFIG.storageKeys.location);
            if (locationStr) {
                const location = JSON.parse(locationStr);
                return {
                    lat: location.lat,
                    lng: location.lng,
                    zoom: location.zoom
                };
            }
        } catch (error) {
            console.error('WPlace Studio: 位置取得エラー:', error);
        }
        return null;
    }

    // お気に入りを追加
    async addFavorite() {
        const position = this.getCurrentPosition();
        if (!position) {
            alert('位置情報を取得できませんでした。マップをクリックしてから保存してください。');
            return;
        }

        const name = prompt('お気に入り名を入力してください:', `地点 (${position.lat.toFixed(3)}, ${position.lng.toFixed(3)})`);
        if (!name) return;

        const favorite = {
            id: Date.now(),
            name: name,
            lat: position.lat,
            lng: position.lng,
            zoom: position.zoom || 14,
            date: new Date().toLocaleDateString('ja-JP')
        };

        const favorites = await this.getFavorites();
        favorites.push(favorite);
        await this.setValue(this.CONFIG.storageKeys.favorites, JSON.stringify(favorites));

        // 通知
        this.showToast(`"${name}" を保存しました`);
    }

    // お気に入り一覧を取得
    async getFavorites() {
        try {
            const stored = await this.getValue(this.CONFIG.storageKeys.favorites, '[]');
            return JSON.parse(stored);
        } catch (error) {
            console.error('WPlace Studio: お気に入り取得エラー:', error);
            return [];
        }
    }

    // お気に入り一覧を表示
    async renderFavorites() {
        const favorites = await this.getFavorites();
        const grid = document.getElementById('wps-favorites-grid');
        const count = document.getElementById('wps-favorites-count');

        if (!grid || !count) return;

        count.textContent = `保存済み: ${favorites.length} 件`;

        if (favorites.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-12 mx-auto mb-4 text-base-content/50">
                        <path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z"/>
                    </svg>
                    <p class="text-base-content/80">お気に入りがありません</p>
                    <p class="text-sm text-base-content/60">下の「保存」ボタンから追加してください</p>
                </div>
            `;
            return;
        }

        // 新しい順にソート
        favorites.sort((a, b) => b.id - a.id);

        grid.innerHTML = favorites.map(fav => `
            <div class="wps-favorite-card card bg-base-200 shadow-sm hover:shadow-md cursor-pointer transition-all relative"
                 data-lat="${fav.lat}" data-lng="${fav.lng}" data-zoom="${fav.zoom}">
                <button class="wps-delete-btn btn btn-ghost btn-xs btn-circle absolute right-1 top-1 z-10"
                        data-id="${fav.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-3">
                        <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
                    </svg>
                </button>
                <div class="card-body p-3">
                    <h4 class="card-title text-sm line-clamp-2">${fav.name}</h4>
                    <div class="text-xs text-base-content/70 space-y-1">
                        <div>📍 ${fav.lat.toFixed(3)}, ${fav.lng.toFixed(3)}</div>
                        <div>📅 ${fav.date}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 位置へ移動
    goTo(lat, lng, zoom) {
        const url = new URL(window.location);
        url.searchParams.set('lat', lat);
        url.searchParams.set('lng', lng);
        url.searchParams.set('zoom', zoom);
        window.location.href = url.toString();
    }

    // お気に入り削除
    async deleteFavorite(id) {
        if (!confirm('このお気に入りを削除しますか？')) return;

        const favorites = await this.getFavorites();
        const filtered = favorites.filter(fav => fav.id !== id);
        await this.setValue(this.CONFIG.storageKeys.favorites, JSON.stringify(filtered));

        this.renderFavorites();
        this.showToast('削除しました');
    }

    // トースト通知
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast toast-top toast-end z-50';
        toast.innerHTML = `
            <div class="alert alert-success">
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// Chrome拡張機能として初期化
if (typeof chrome !== 'undefined' && chrome.storage) {
    console.log('🎨 WPlace Studio: Initializing Extended Favorites...');
    new WPlaceExtendedFavorites();
} else {
    console.warn('🎨 WPlace Studio: Chrome extension APIs not available');
}
