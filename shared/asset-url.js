/**
 * shared/asset-url.js
 * Compatibility shim — canonical implementations live in app/shared/asset-loader.js.
 *
 * If asset-loader.js has already run (JPShared.assets is defined), this file
 * simply re-aliases the globals to JPShared.assets.* and returns.
 *
 * If this file is somehow loaded before asset-loader.js, it provides its own
 * standalone implementations as a fallback so nothing breaks.  In practice,
 * load app/shared/asset-loader.js before this file (or instead of it).
 */
(function () {
  'use strict';

  // --- Fast path: asset-loader.js already ran ---
  if (window.JPShared && window.JPShared.assets) {
    window.getAssetUrl = function (config, filepath) {
      return window.JPShared.assets.getUrl(config, filepath);
    };
    window.getManifest = function (config) {
      return window.JPShared.assets.getManifest(config);
    };
    return;
  }

  // --- Fallback: asset-loader.js not yet loaded ---
  // Provides the same window.getAssetUrl / window.getManifest globals so
  // feature modules work even if the load order changes unexpectedly.
  // This fallback is intentionally minimal — the full API lives in asset-loader.js.

  window.getAssetUrl = function (config, filepath) {
    // >>> To switch from GitHub raw to a CDN, change this single line <<<
    var base = 'https://raw.githubusercontent.com/' +
               config.owner + '/' + config.repo + '/' + config.branch;
    return filepath ? base + '/' + filepath : base;
  };

  var _promise = null;

  window.getManifest = function (config) {
    if (_promise) return _promise;
    var url = window.getAssetUrl(config, 'manifest.json') + '?t=' + Date.now();
    _promise = fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load manifest.json: ' + r.status);
        return r.json();
      })
      .catch(function (err) {
        _promise = null; // allow retry
        throw err;
      });
    return _promise;
  };

})();
