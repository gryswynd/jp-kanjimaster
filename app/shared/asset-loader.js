/**
 * app/shared/asset-loader.js
 * Canonical home for URL building, manifest loading, JSON fetching, and
 * image preloading.  Self-contained — no dependency on shared/asset-url.js.
 *
 * Absorbs the implementations previously in shared/asset-url.js and fills
 * the TODO stubs from the original scaffold.
 *
 * API (window.JPShared.assets.*):
 *   getUrl(config, relativePath)   — build a GitHub raw URL
 *   getManifest(config)            — fetch + cache manifest.json
 *   clearManifestCache()           — reset the cache (for testing)
 *   fetchJSON(url)                 — cache-busted single JSON fetch
 *   fetchAll(urls)                 — parallel JSON fetches
 *   preloadImages(urls)            — parallel image preloads (never rejects)
 *   load(config, filepath)         — getUrl + fetchJSON convenience wrapper
 *
 * Backward-compatible global aliases (set at the bottom of this file):
 *   window.getAssetUrl  → JPShared.assets.getUrl
 *   window.getManifest  → JPShared.assets.getManifest
 *
 * Modules that currently duplicate fetch logic and will migrate here:
 *   - Lesson.js   — parallel fetch(glossaryUrl) + fetch(conjUrl)
 *   - Practice.js — fetch(MASTER_URL + '?t=' + Date.now())
 *   - Review.js   — parallel fetch for quiz + glossary + conjugations
 *   - Story.js    — parallel fetch(mdUrl + '?t=') + fetch(jsonUrl + '?t=')
 *   - Compose.js  — Promise.all of four fetch calls
 *   - Game.js     — fetch(dayUrl).then(r => r.json()) + image preloading
 *
 * Load this file before any feature module scripts
 * (after tts.js, text-processor.js, progress.js).
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // One promise covers both the in-flight request and the settled (cached)
  // result.  A resolved Promise returned by .then() is microtask-synchronous
  // for subsequent callers, so no separate _manifestCache variable is needed.
  var _manifestPromise = null;

  window.JPShared.assets = {

    // -------------------------------------------------------------------------
    // URL building
    // -------------------------------------------------------------------------

    /**
     * Build a full URL for a repo-hosted file.
     * All modules call this instead of constructing GitHub raw URLs directly.
     * To switch from GitHub raw to a CDN, change this single method.
     *
     * @param {Object} config          - { owner, repo, branch }
     * @param {string} [relativePath]  - path relative to repo root
     *                                   (e.g. "data/N4/lessons/N4.7.json")
     * @returns {string} full URL
     */
    getUrl: function (config, relativePath) {
      // >>> To switch from GitHub raw to a CDN, change this single line <<<
      var base = 'https://raw.githubusercontent.com/' +
                 config.owner + '/' + config.repo + '/' + config.branch;
      return relativePath ? base + '/' + relativePath : base;
    },

    // -------------------------------------------------------------------------
    // Manifest
    // -------------------------------------------------------------------------

    /**
     * Fetch manifest.json and cache the promise for the session.
     * Multiple simultaneous callers share a single request.
     * On network failure the cache is cleared so the next call can retry.
     *
     * @param {Object} config - { owner, repo, branch }
     * @returns {Promise<Object>} parsed manifest
     */
    getManifest: function (config) {
      if (_manifestPromise) return _manifestPromise;

      var self = this;
      var url = self.getUrl(config, 'manifest.json') + '?t=' + Date.now();
      console.log('[asset-loader] Fetching manifest:', url);

      _manifestPromise = fetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error('Failed to load manifest.json: ' + r.status);
          return r.json();
        })
        .then(function (data) {
          console.log('[asset-loader] Manifest loaded — levels:', data.levels);
          return data;
        })
        .catch(function (err) {
          _manifestPromise = null; // allow retry after transient failure
          throw err;
        });

      return _manifestPromise;
    },

    /**
     * Reset the manifest cache.
     * Useful in tests or when you need to force a fresh fetch mid-session.
     */
    clearManifestCache: function () {
      _manifestPromise = null;
    },

    // -------------------------------------------------------------------------
    // JSON fetching
    // -------------------------------------------------------------------------

    /**
     * Fetch a single JSON file with a cache-busting timestamp query param.
     *
     * @param {string} url - full URL to the JSON resource
     * @returns {Promise<Object>} parsed JSON
     */
    fetchJSON: function (url) {
      return fetch(url + '?t=' + Date.now())
        .then(function (r) {
          if (!r.ok) throw new Error('Failed to load ' + url + ': ' + r.status);
          return r.json();
        });
    },

    /**
     * Fetch multiple JSON files in parallel, preserving order.
     *
     * @param {string[]} urls - array of full URLs
     * @returns {Promise<Object[]>} parsed JSON objects in the same order as urls
     */
    fetchAll: function (urls) {
      var self = this;
      return Promise.all(urls.map(function (url) {
        return self.fetchJSON(url);
      }));
    },

    // -------------------------------------------------------------------------
    // Image preloading
    // -------------------------------------------------------------------------

    /**
     * Preload an array of image URLs.
     * Always resolves (never rejects) — failed images resolve with an Image
     * element whose src is set but whose naturalWidth is 0, so callers can
     * detect failures if needed without a rejected promise crashing the chain.
     *
     * @param {string[]} urls - image URLs to preload
     * @returns {Promise<HTMLImageElement[]>} loaded Image elements
     */
    preloadImages: function (urls) {
      return Promise.all(urls.map(function (url) {
        return new Promise(function (resolve) {
          var img = new Image();
          img.onload  = function () { resolve(img); };
          img.onerror = function () { resolve(img); }; // resolve even on failure
          img.src = url;
        });
      }));
    },

    // -------------------------------------------------------------------------
    // Convenience wrapper
    // -------------------------------------------------------------------------

    /**
     * Build a repo asset URL and immediately fetch it as JSON.
     * Equivalent to: fetchJSON(getUrl(config, filepath))
     *
     * @param {Object} config   - { owner, repo, branch }
     * @param {string} filepath - path relative to repo root
     * @returns {Promise<Object>} parsed JSON
     */
    load: function (config, filepath) {
      return this.fetchJSON(this.getUrl(config, filepath));
    }

  };

  // -------------------------------------------------------------------------
  // Backward-compatible global aliases
  //
  // All existing call sites (Lesson.js, Practice.js, Review.js, Story.js,
  // Compose.js, Game.js) continue to work without modification.
  // Future phases can migrate call sites to window.JPShared.assets.* directly.
  // -------------------------------------------------------------------------

  window.getAssetUrl = function (config, filepath) {
    return window.JPShared.assets.getUrl(config, filepath);
  };

  window.getManifest = function (config) {
    return window.JPShared.assets.getManifest(config);
  };

})();
