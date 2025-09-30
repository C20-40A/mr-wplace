# 流れ

1. inject.js から window.postMessage で タイルの blob と座標が飛んでくる(source:"wplace-studio-tile")
2. content.js で作られた src/features/tile-overlay/index.ts が描画の仲介役を担う
3. ...
