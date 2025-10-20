/**
 * Firefox browser API type definitions
 * 
 * Firefoxでは`browser`オブジェクトを使用
 * Chromeの`chrome`型定義と互換性を持たせる
 */

declare global {
  const browser: typeof chrome | undefined;
}

export {};
