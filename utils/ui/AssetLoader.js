// utils/ui/AssetLoader.js
/**
 * AssetLoader handles loading and caching of game textures/images.
 */
function AssetLoader() {
  this.assets = {};
  this.loadingCount = 0;
  this.totalCount = 0;
  this.onProgress = null;
  this.onComplete = null;
}

AssetLoader.prototype.load = function(assetMap, onComplete, onProgress) {
  const keys = Object.keys(assetMap);
  if (keys.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  this.assets = {};
  this.totalCount = keys.length;
  this.loadingCount = 0;
  this.onComplete = onComplete;
  this.onProgress = onProgress;

  keys.forEach(key => {
    const src = assetMap[key];
    const img = wx.createImage();
    
    img.onload = () => {
      this.assets[key] = img;
      this.loadingCount++;
      
      if (this.onProgress) {
        this.onProgress(this.loadingCount / this.totalCount);
      }
      
      if (this.loadingCount === this.totalCount) {
        if (this.onComplete) this.onComplete(this.assets);
      }
    };
    
    img.onerror = (err) => {
      console.error(`Failed to load asset: ${key} (${src})`, err);
      this.loadingCount++;
      if (this.loadingCount === this.totalCount) {
        if (this.onComplete) this.onComplete(this.assets);
      }
    };
    
    img.src = src;
  });
};

AssetLoader.prototype.get = function(key) {
  return this.assets[key] || null;
};

module.exports = AssetLoader;
