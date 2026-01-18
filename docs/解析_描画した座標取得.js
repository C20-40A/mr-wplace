(() => {
  // 元のMap.setを保存
  const originalMapSet = Map.prototype.set;

  // Map.setをフック
  Map.prototype.set = function (key, value) {
    // "t=(tileX,tileY);p=(pixelX,pixelY);s=0"
    if (
      typeof key === "string" &&
      key.startsWith("t=(") &&
      key.includes(";p=(") &&
      value &&
      value.color &&
      Array.isArray(value.tile) &&
      Array.isArray(value.pixel)
    ) {
      console.log(key, value);
    }

    // 元の Map.set を呼び出す
    return originalMapSet.call(this, key, value);
  };
})();
