// mrWplace グローバル型定義

interface mrWplace {
  gallery: any;
  tileOverlay: any;
  favorites: any;
  drawing: any;
  tileSnapshot: any;
  timeTravel: {
    ui?: any;
    router?: any;
  };
  drawingLoader: any;
  colorFilter: any;
  nextLevelBadge: any;
  // Optional properties (動的に追加される可能性)
  imageEditor?: any;
}

interface ColorFilterManager {
  init(): Promise<void>;
  // 他のメソッドは必要に応じて追加
}

declare global {
  interface Window {
    mrWplace?: mrWplace;
    colorFilterManager?: ColorFilterManager;
  }
}

export {};
