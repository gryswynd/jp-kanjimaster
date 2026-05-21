window.GameModule = (function() {
  'use strict';

  let container = null;
  let config = null;
  let onExit = null;

  let dayDir = '';
  let dayData = null;

  function getDayAssetUrl(filename) {
    if (filename.startsWith('assets/') || filename.startsWith('shared/')) {
      return window.getAssetUrl(config, filename);
    }
    return window.getAssetUrl(config, dayDir + '/' + filename);
  }

  function getSharedAssetUrl(filepath) {
    return window.getAssetUrl(config, filepath);
  }

  function start(containerElement, repoConfig, exitCallback) {
    container = containerElement;
    config = repoConfig;
    onExit = exitCallback;

    initializeGame();
  }

  function initializeGame() {
    // --- Styles ---
    const styleId = 'jp-game-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .jp-game-container {
          font-family: 'Poppins', 'Noto Sans JP', sans-serif;
          background: #1a1a2e;
          border-radius: 12px;
          overflow: hidden;
          max-width: 900px;
          margin: 0 auto;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          position: relative;
        }
        .jp-game-header {
          background: rgba(0,0,0,0.5);
          padding: 15px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .jp-game-title {
          color: white;
          font-weight: 700;
          font-size: 1.1rem;
        }
        .jp-game-back-btn {
          background: rgba(255,255,255,0.1);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: background 0.2s;
        }
        @media (hover: hover) { .jp-game-back-btn:hover { background: rgba(255,255,255,0.2); } }
        .jp-game-canvas-wrapper {
          position: relative;
          background: #000;
        }
        .jp-game-canvas {
          display: block;
          width: 100%;
          height: auto;
          image-rendering: pixelated;
          image-rendering: -moz-crisp-edges;
          image-rendering: crisp-edges;
        }
        .jp-game-ui {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          text-align: center;
          max-width: 80%;
          display: none;
          pointer-events: auto;
          z-index: 10;
        }
        .jp-term {
          color: #4e54c8;
          font-weight: 700;
          cursor: pointer;
          border-bottom: 2px solid rgba(78,84,200,0.2);
          margin-right: 1px;
          transition: background 0.15s, border-color 0.15s;
        }
        @media (hover: hover) {
          .jp-term:hover {
            background: rgba(78,84,200,0.08);
            border-bottom-color: #4e54c8;
          }
        }
        .jp-conversation-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-size: cover;
          background-position: center;
          display: none;
          flex-direction: row;
          align-items: stretch;
          padding: 0;
        }
        .jp-convo-container {
          display: flex;
          flex-direction: row;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: space-between;
          padding: 30px;
          gap: 30px;
        }
        .jp-speech-bubble {
          flex: 1;
          max-width: 55%;
          background: white;
          border: 4px solid #2f3542;
          border-radius: 30px;
          padding: 30px 35px;
          position: relative;
          box-shadow: 0 8px 20px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.8);
          min-height: 180px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-bottom: 0;
          align-self: center;
        }
        .jp-speech-bubble::after {
          content: '';
          position: absolute;
          bottom: -30px;
          right: 80px;
          width: 0;
          height: 0;
          border-left: 40px solid transparent;
          border-right: 20px solid transparent;
          border-top: 35px solid #2f3542;
        }
        .jp-speech-bubble::before {
          content: '';
          position: absolute;
          bottom: -22px;
          right: 85px;
          width: 0;
          height: 0;
          border-left: 35px solid transparent;
          border-right: 15px solid transparent;
          border-top: 28px solid white;
          z-index: 1;
        }
        .jp-speech-bubble .text {
          font-size: 18px;
          line-height: 1.7;
          color: #2f3542;
          white-space: pre-line;
          font-weight: 500;
        }
        .jp-line-en {
          display: block;
          font-size: 13px;
          color: #888;
          margin-top: 6px;
          font-style: italic;
          font-weight: 400;
        }
        .jp-speech-bubble .continue {
          margin-top: 15px;
          font-size: 13px;
          color: #666;
          text-align: right;
          font-style: italic;
        }
        .jp-character-portrait {
          width: auto;
          height: 100%;
          max-height: none;
          object-fit: contain;
          object-position: bottom right;
          align-self: stretch;
          filter: drop-shadow(0 10px 25px rgba(0,0,0,0.5));
        }
        .jp-game-loading {
          text-align: center;
          padding: 60px 20px;
          color: white;
        }
        .jp-loading-spinner {
          display: inline-block;
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .jp-rotate-overlay {
          display: none;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: #1a1a2e;
          z-index: 1000;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          text-align: center;
          padding: 20px;
          box-sizing: border-box;
        }
        @media (pointer: coarse) and (orientation: portrait) {
          .jp-rotate-overlay {
            display: flex;
          }
        }
        .jp-rotate-icon {
          font-size: 60px;
          display: inline-block;
          animation: tilt-phone 2s ease-in-out infinite;
          margin-bottom: 16px;
        }
        @keyframes tilt-phone {
          0%, 30% { transform: rotate(0deg); }
          60%, 100% { transform: rotate(90deg); }
        }
        .jp-rotate-message {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .jp-rotate-sub {
          font-size: 13px;
          opacity: 0.65;
        }
        @media (pointer: coarse) and (orientation: landscape) {
          .jp-game-canvas-wrapper {
            overflow: hidden;
          }
          .jp-game-canvas {
            height: calc(100vh - 56px);
            width: auto;
            max-width: 100%;
            margin: 0 auto;
          }
          .jp-touch-controls {
            bottom: 8px;
            padding: 0 12px;
          }
          .jp-dpad {
            width: 110px;
            height: 110px;
          }
          .jp-dpad-btn {
            width: 36px;
            height: 36px;
            font-size: 16px;
          }
          .jp-interact-btn {
            width: 60px;
            height: 60px;
            font-size: 12px;
          }
          .jp-convo-container {
            padding: 12px 20px;
            gap: 16px;
            align-items: center;
          }
          .jp-speech-bubble {
            min-height: 60px;
            padding: 10px 14px;
            align-self: center;
          }
          .jp-speech-bubble .text {
            font-size: 13px;
            line-height: 1.4;
          }
          .jp-speech-bubble .continue {
            font-size: 10px;
            margin-top: 6px;
          }
          .jp-character-portrait {
            height: 100%;
            max-height: none;
            align-self: stretch;
          }
          .jp-speech-bubble::after {
            bottom: -16px;
            border-top-width: 18px;
            border-left-width: 28px;
            border-right-width: 14px;
          }
          .jp-speech-bubble::before {
            bottom: -10px;
            border-top-width: 14px;
            border-left-width: 24px;
            border-right-width: 10px;
          }
        }
        .jp-touch-controls {
          position: absolute;
          bottom: 20px;
          left: 0;
          right: 0;
          display: none;
          justify-content: space-between;
          padding: 0 20px;
          pointer-events: none;
        }
        @media (pointer: coarse) {
          .jp-touch-controls {
            display: flex;
          }
        }
        .jp-dpad {
          position: relative;
          width: 140px;
          height: 140px;
          pointer-events: auto;
        }
        .jp-dpad-btn {
          position: absolute;
          width: 45px;
          height: 45px;
          background: rgba(255, 255, 255, 0.3);
          border: 2px solid rgba(255, 255, 255, 0.5);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 20px;
          font-weight: bold;
          user-select: none;
          touch-action: none;
          cursor: pointer;
        }
        .jp-dpad-btn:active {
          background: rgba(255, 255, 255, 0.5);
          transform: scale(0.95);
        }
        .jp-dpad-up {
          top: 0;
          left: 50%;
          transform: translateX(-50%);
        }
        .jp-dpad-down {
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
        }
        .jp-dpad-left {
          left: 0;
          top: 50%;
          transform: translateY(-50%);
        }
        .jp-dpad-right {
          right: 0;
          top: 50%;
          transform: translateY(-50%);
        }
        .jp-interact-btn {
          width: 80px;
          height: 80px;
          background: rgba(76, 209, 55, 0.8);
          border: 3px solid rgba(255, 255, 255, 0.8);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          font-weight: bold;
          user-select: none;
          touch-action: none;
          cursor: pointer;
          pointer-events: auto;
          align-self: flex-end;
        }
        .jp-interact-btn:active {
          background: rgba(76, 209, 55, 1);
          transform: scale(0.95);
        }
      `;
      document.head.appendChild(style);
    }

    // --- HTML Structure ---
    container.innerHTML = `
      <div class="jp-game-container">
        <div class="jp-game-header">
          <div class="jp-game-title">🎮 House Adventure</div>
          <button class="jp-game-back-btn" id="jp-game-exit">← Back to Menu</button>
        </div>
        <div class="jp-game-loading">
          <div class="jp-loading-spinner"></div>
          <div>Loading game assets...</div>
        </div>
      </div>
    `;

    document.getElementById('jp-game-exit').addEventListener('click', () => {
      if (onExit) onExit();
    });

    loadGame();
  }

  function loadGame() {
    const gameContainer = container.querySelector('.jp-game-container');

    // --- Term / Glossary State ---
    let termMap = {};
    let conjugationRules = null;
    let counterRules = null;
    let _surfaceIndex = null;

    function getSurfaceIndex() {
      if (!_surfaceIndex) {
        _surfaceIndex = {};
        Object.values(termMap).forEach(t => {
          if (t.surface) _surfaceIndex[t.surface] = t.id;
          // Do NOT index readings — short hiragana readings match particles everywhere
        });
      }
      return _surfaceIndex;
    }

    function processGameText(text) {
      if (!window.JPShared || !window.JPShared.textProcessor) return text;
      const index = getSurfaceIndex();

      // Collect unique term IDs whose surface appears in text
      const seen = new Set();
      const termIds = [];
      Object.keys(index).forEach(surface => {
        if (text.includes(surface)) {
          const id = index[surface];
          if (!seen.has(id)) { seen.add(id); termIds.push(id); }
        }
      });
      if (!termIds.length) return text;

      // Drop shorter terms whose surface is entirely inside a longer matched surface
      // (prevents nesting spans when e.g. both 今 and 今日 are matched)
      const matchedSurfaces = termIds.map(id => termMap[id] && termMap[id].surface).filter(Boolean);
      const filtered = termIds.filter(id => {
        const s = termMap[id] && termMap[id].surface;
        return s && !matchedSurfaces.some(other => other !== s && other.includes(s));
      });
      if (!filtered.length) return text;

      return window.JPShared.textProcessor.processText(
        text, filtered, termMap, conjugationRules || {}, counterRules
      );
    }

    // --- Game State ---
    const game = {
      images: {},
      player: {
        x: 200,
        y: 200,
        width: 63,
        height: 90,
        speed: 2,
        direction: 'down',
        frame: 0,
        frameTimer: 0,
        frameDelay: 8,
        moving: false
      },
      camera: { x: 0, y: 0 },
      keys: {},
      mapData: null,
      collisionData: null,
      interactiveObjects: [],
      npcs: [],
      doors: {},
      inspected: new Set(),
      voidSeen: false,
      voidAsked: {},
      inConversation: false,
      currentConversation: null,
      conversationIndex: 0
    };

    // --- Chroma Key: strips magenta (#FF00FF) background, returns new transparent Image ---
    function chromaKey(sourceImg) {
      const offscreen = document.createElement('canvas');
      offscreen.width = sourceImg.width;
      offscreen.height = sourceImg.height;
      const offCtx = offscreen.getContext('2d');
      offCtx.drawImage(sourceImg, 0, 0);

      const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // Tolerance of 30 to catch near-magenta anti-aliasing fringe pixels
        if (r > 200 && g < 80 && b > 200) {
          data[i + 3] = 0; // Set alpha to transparent
        }
      }

      offCtx.putImageData(imageData, 0, 0);

      const newImg = new Image();
      newImg.src = offscreen.toDataURL();
      return newImg;
    }

    // --- Image Loading ---
    function loadImages() {
      const assets = dayData.assets;

      // Build image list from day.json: day-level assets + NPC sprites + shared player sprite
      const imagesToLoad = {
        map:            getDayAssetUrl(assets.map),
        collision:      getDayAssetUrl(assets.collision),
        playerSheet:    getSharedAssetUrl(dayData._playerSprite)
      };

      // Load all conversation backgrounds from the convoBackgrounds map
      if (assets.convoBackgrounds) {
        Object.entries(assets.convoBackgrounds).forEach(([key, path]) => {
          imagesToLoad['convoBg_' + key] = getDayAssetUrl(path);
        });
      }

      // Add per-NPC sprites and conversation portraits
      dayData.npcs.forEach(npc => {
        imagesToLoad['sprite_' + npc.name] = getDayAssetUrl(npc.sprite);
        imagesToLoad['convo_' + npc.name] = getDayAssetUrl(npc.convoPortrait);
      });

      // Add player conversation portrait
      if (dayData.meConvoPortrait) {
        imagesToLoad['meConvo'] = getDayAssetUrl(dayData.meConvoPortrait);
      }

      // Load alternate portraits (shocked, angry, etc.)
      if (dayData.altPortraits) {
        Object.entries(dayData.altPortraits).forEach(([key, path]) => {
          imagesToLoad['alt_' + key] = getDayAssetUrl(path);
        });
      }

      // Door sprite
      imagesToLoad['door'] = getSharedAssetUrl('door.png');

      let loadedImages = 0;
      const totalImages = Object.keys(imagesToLoad).length;

      Object.entries(imagesToLoad).forEach(([key, url]) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          loadedImages++;
          if (loadedImages === totalImages) {
            // Strip magenta background from player sprite sheet before starting game
            if (game.images.playerSheet) {
              const stripped = chromaKey(game.images.playerSheet);
              stripped.onload = () => {
                game.images.playerSheet = stripped;
                initGame();
              };
            } else {
              initGame();
            }
          }
        };
        img.onerror = () => {
          console.error(`Failed to load: ${url}`);
          loadedImages++;
          if (loadedImages === totalImages) {
            // Still attempt chroma key even on partial load
            if (game.images.playerSheet) {
              const stripped = chromaKey(game.images.playerSheet);
              stripped.onload = () => {
                game.images.playerSheet = stripped;
                initGame();
              };
            } else {
              initGame();
            }
          }
        };
        img.src = url;
        game.images[key] = img;
      });
    }

    // --- Collision Detection ---
    function getPixelColor(imageData, x, y) {
      const idx = (Math.floor(y) * imageData.width + Math.floor(x)) * 4;
      return {
        r: imageData.data[idx],
        g: imageData.data[idx + 1],
        b: imageData.data[idx + 2],
        a: imageData.data[idx + 3]
      };
    }

    function isCollision(x, y) {
      if (!game.collisionData) return false;
      if (x < 0 || y < 0 || x >= game.collisionData.width || y >= game.collisionData.height) return true;
      const color = getPixelColor(game.collisionData, x, y);
      return color.r > 200 && color.g < 50 && color.b < 50;
    }

    function getInteractiveObject(x, y) {
      if (!game.collisionData) return null;
      if (x < 0 || y < 0 || x >= game.collisionData.width || y >= game.collisionData.height) return null;
      const color = getPixelColor(game.collisionData, x, y);
      if (color.b > 200 && color.r < 50 && color.g < 50) {
        for (let obj of game.interactiveObjects) {
          const dx = x - obj.x;
          const dy = y - obj.y;
          if (dx >= 0 && dx < obj.width && dy >= 0 && dy < obj.height) {
            return obj;
          }
        }
      }
      return null;
    }

    // --- Game Initialization ---
    function initGame() {
      // Replace loading with game canvas
      gameContainer.querySelector('.jp-game-loading').remove();

      const canvasWrapper = document.createElement('div');
      canvasWrapper.className = 'jp-game-canvas-wrapper';
      canvasWrapper.innerHTML = `
        <canvas class="jp-game-canvas" id="game-canvas" width="800" height="600"></canvas>
        <div class="jp-game-ui" id="game-ui"></div>
        <div class="jp-conversation-overlay" id="conversation-overlay">
          <div class="jp-convo-container">
            <div class="jp-speech-bubble">
              <div class="text" id="convo-text"></div>
              <div class="continue">Tap to continue</div>
            </div>
            <img class="jp-character-portrait" id="convo-portrait" src="" alt="">
          </div>
        </div>
        <div class="jp-touch-controls">
          <div class="jp-dpad">
            <div class="jp-dpad-btn jp-dpad-up" data-direction="up">▲</div>
            <div class="jp-dpad-btn jp-dpad-down" data-direction="down">▼</div>
            <div class="jp-dpad-btn jp-dpad-left" data-direction="left">◀</div>
            <div class="jp-dpad-btn jp-dpad-right" data-direction="right">▶</div>
          </div>
          <div class="jp-interact-btn">
            <span>▶</span>
          </div>
        </div>
        <div class="jp-rotate-overlay">
          <div class="jp-rotate-icon">📱</div>
          <div class="jp-rotate-message">Rotate your device</div>
          <div class="jp-rotate-sub">This game is designed for landscape mode</div>
        </div>
      `;

      gameContainer.appendChild(canvasWrapper);

      const canvas = document.getElementById('game-canvas');
      const ctx = canvas.getContext('2d');
      const gameUI = document.getElementById('game-ui');
      const convoOverlay = document.getElementById('conversation-overlay');
      const convoText = document.getElementById('convo-text');
      const convoPortrait = document.getElementById('convo-portrait');

      // Extract collision data from collision image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = game.images.collision.width;
      tempCanvas.height = game.images.collision.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(game.images.collision, 0, 0);
      game.collisionData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

      // Build interactive objects from day.json
      game.interactiveObjects = dayData.objects.map(obj => ({
        ...obj,
        centerX: obj.x + obj.width / 2,
        centerY: obj.y + obj.height / 2
      }));

      game.interactiveObjects.forEach(obj => {
        if (obj.isDoor) {
          game.doors[obj.name] = { open: false };
        }
      });

      // Build NPCs from day.json
      game.npcs = dayData.npcs.map(npc => {
        const spriteImg = game.images['sprite_' + npc.name];
        let width = 72, height = 108;
        if (spriteImg && spriteImg.complete) {
          const aspectRatio = spriteImg.width / spriteImg.height;
          height = 108;
          width = height * aspectRatio;
        }
        return {
          name: npc.name,
          x: npc.x,
          y: npc.y,
          sprite: spriteImg,
          conversation: npc.conversation,
          convoPortrait: game.images['convo_' + npc.name],
          convoBackground: npc.convoBackground ? game.images['convoBg_' + npc.convoBackground] : null,
          width: width,
          height: height
        };
      });

      // Set player start position from day.json
      game.player.x = dayData.playerStart.x;
      game.player.y = dayData.playerStart.y;

      // --- Input Handling ---
      function handleKeyDown(e) {
        game.keys[e.key] = true;

        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (game.inConversation) {
            advanceConversation();
          } else {
            handleInteraction();
          }
        }
      }

      function handleKeyUp(e) {
        game.keys[e.key] = false;
      }

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      // --- Touch Controls ---
      const dpadButtons = document.querySelectorAll('.jp-dpad-btn');
      const interactBtn = document.querySelector('.jp-interact-btn');

      // Handle D-pad touches
      dpadButtons.forEach(btn => {
        const direction = btn.getAttribute('data-direction');

        // Map directions to key codes
        const directionKeys = {
          'up': 'ArrowUp',
          'down': 'ArrowDown',
          'left': 'ArrowLeft',
          'right': 'ArrowRight'
        };

        const handleTouchStart = (e) => {
          e.preventDefault();
          game.keys[directionKeys[direction]] = true;
        };

        const handleTouchEnd = (e) => {
          e.preventDefault();
          game.keys[directionKeys[direction]] = false;
        };

        btn.addEventListener('touchstart', handleTouchStart, { passive: false });
        btn.addEventListener('touchend', handleTouchEnd, { passive: false });
        btn.addEventListener('touchcancel', handleTouchEnd, { passive: false });
      });

      // Handle interact button
      const handleInteractTouch = (e) => {
        e.preventDefault();
        if (game.inConversation) {
          advanceConversation();
        } else {
          handleInteraction();
        }
      };

      interactBtn.addEventListener('touchstart', handleInteractTouch, { passive: false });

      // Handle taps on conversation overlay to advance
      convoOverlay.addEventListener('touchstart', (e) => {
        if (game.inConversation && e.target === convoOverlay) {
          e.preventDefault();
          advanceConversation();
        }
      }, { passive: false });

      // Handle taps directly on canvas (for NPCs and objects)
      canvas.addEventListener('touchstart', (e) => {
        if (game.inConversation) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const touch = e.touches[0];
        const canvasX = (touch.clientX - rect.left) * scaleX;
        const canvasY = (touch.clientY - rect.top) * scaleY;

        // Convert to world coordinates
        const worldX = canvasX + game.camera.x;
        const worldY = canvasY + game.camera.y;

        // Check if tapped on an NPC
        for (let npc of game.npcs) {
          const npcLeft = npc.x - npc.width / 2;
          const npcRight = npc.x + npc.width / 2;
          const npcTop = npc.y - npc.height;
          const npcBottom = npc.y;

          if (worldX >= npcLeft && worldX <= npcRight &&
              worldY >= npcTop && worldY <= npcBottom) {
            // Check if player is close enough
            const dx = game.player.x - npc.x;
            const dy = game.player.y - npc.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 100) {
              handleNpcInteraction(npc);
              e.preventDefault();
              return;
            }
          }
        }

        // Check if tapped on an interactive object — delegate to handleInteraction
        for (let obj of game.interactiveObjects) {
          if (worldX >= obj.x && worldX <= obj.x + obj.width &&
              worldY >= obj.y && worldY <= obj.y + obj.height) {
            const dx = game.player.x - obj.centerX;
            const dy = game.player.y - obj.centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 100) {
              handleObjectInteraction(obj);
              e.preventDefault();
              return;
            }
          }
        }
      }, { passive: false });

      // Store cleanup function
      game.cleanup = () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        if (game.animationFrame) {
          cancelAnimationFrame(game.animationFrame);
        }
      };

      // --- Interaction System ---
      function getNearbyInteractable() {
        const interactDistance = 50;

        // Check for NPCs
        for (let npc of game.npcs) {
          const dx = game.player.x - npc.x;
          const dy = game.player.y - npc.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < interactDistance + 20) {
            return { type: 'npc', target: npc };
          }
        }

        // Check for interactive objects in direction player is facing
        let checkX = game.player.x;
        let checkY = game.player.y;

        if (game.player.direction === 'up') checkY -= interactDistance;
        if (game.player.direction === 'down') checkY += interactDistance;
        if (game.player.direction === 'left') checkX -= interactDistance;
        if (game.player.direction === 'right') checkX += interactDistance;

        for (let obj of game.interactiveObjects) {
          // Skip disabled doors (e.g. front door after void scene)
          if (obj.isDoor && game.doors[obj.name] && game.doors[obj.name].disabled) continue;

          // Calculate distance to nearest edge of object (not center)
          // This allows interaction with tall/wide objects like doors
          const nearestX = Math.max(obj.x, Math.min(checkX, obj.x + obj.width));
          const nearestY = Math.max(obj.y, Math.min(checkY, obj.y + obj.height));
          const dx = checkX - nearestX;
          const dy = checkY - nearestY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < interactDistance) {
            return { type: 'object', target: obj };
          }
        }

        return null;
      }

      function handleObjectInteraction(obj) {
        game.inspected.add(obj.name);

        if (obj.isDoor) {
          toggleDoor(obj);
        } else if (obj.name === 'Toilet' && game.doors['Bath_Door'] && game.doors['Bath_Door'].open) {
          // Dad yells if you try to use the toilet with the door open
          startConversation([
            { speaker: 'dad', jp: 'おい！ドアをしめて！', en: 'Hey! Close the door!' },
            { speaker: 'りきぞ', jp: 'す、すみません…！', en: 'S-sorry…!' }
          ], {
            backgroundImage: 'living',
            portraitOverrides: { 'dad': game.images['alt_dadAngry'] }
          });
        } else if (obj.message) {
          showMessage(obj.message);
        }
      }

      function handleNpcInteraction(npc) {
        game.inspected.add(npc.name);
        var convo = npc.conversation;
        var opts = { backgroundImage: npc.convoBackground };

        if (game.voidSeen && !game.voidAsked[npc.name]) {
          game.voidAsked[npc.name] = true;
          if (npc.name === 'mom') {
            convo = [
              { speaker: 'りきぞ', jp: 'お母さん…！', en: 'Mom…!' },
              { speaker: 'りきぞ', jp: 'そとに…なにも…！', en: 'Outside… nothing…!' },
              { speaker: 'mom', jp: 'なに？', en: 'What?' },
              { speaker: 'mom', jp: 'りきぞはいい先生ですよ。', en: 'Rikizo, you\'re a good teacher.' },
              { speaker: 'りきぞ', jp: '…はい。', en: '…OK.' }
            ];
            opts.portraitOverrides = { 'りきぞ': game.images['alt_meShocked'] };
          } else if (npc.name === 'dad') {
            convo = [
              { speaker: 'りきぞ', jp: 'お父さん！', en: 'Dad!' },
              { speaker: 'りきぞ', jp: 'そとに…なにもない…！', en: 'Outside… there\'s nothing…!' },
              { speaker: 'dad', jp: 'ん？', en: 'Hm?' },
              { speaker: 'dad', jp: 'りきぞ、先生ですよ。', en: 'Rikizo, you\'re a teacher.' },
              { speaker: 'りきぞ', jp: '…はい。', en: '…OK.' }
            ];
            opts.portraitOverrides = { 'りきぞ': game.images['alt_meShocked'] };
          }
        }

        startConversation(convo, opts);
      }

      function handleInteraction() {
        const nearby = getNearbyInteractable();
        if (!nearby) return;

        if (nearby.type === 'npc') {
          handleNpcInteraction(nearby.target);
        } else if (nearby.type === 'object') {
          handleObjectInteraction(nearby.target);
        }
      }

      function toggleDoor(doorObj) {
        if (game.doors[doorObj.name]) {
          // Front door: special void conversation, then lock it
          if (doorObj.name === 'Front_Door' && !game.doors[doorObj.name].disabled) {
            game.doors[doorObj.name].disabled = true;
            startConversation([
              { speaker: 'りきぞ', jp: 'え…？', en: 'Huh…?' },
              { speaker: 'りきぞ', jp: 'な…なにもない…！', en: 'Th-there\'s nothing there…!' },
              { speaker: 'りきぞ', jp: 'なんですか、これ…？！', en: 'What is this…?!' }
            ], {
              backgroundImage: 'void',
              portraitOverrides: { 'りきぞ': game.images['alt_meShocked'] },
              onEnd: function() {
                game.doors[doorObj.name].open = false;
                game.voidSeen = true;
              }
            });
            return;
          }

          if (game.doors[doorObj.name].disabled) return;

          game.doors[doorObj.name].open = !game.doors[doorObj.name].open;
          const status = game.doors[doorObj.name].open ? 'opened' : 'closed';
          showMessage(`${doorObj.name} ${status}.`);

          // Push player out if they're inside a door that just closed
          if (!game.doors[doorObj.name].open) {
            const px = game.player.x;
            const py = game.player.y;
            if (px + 12 > doorObj.x && px - 12 < doorObj.x + doorObj.width &&
                py + 10 > doorObj.y && py - 20 < doorObj.y + doorObj.height) {
              // Move player to the side they're closest to
              const doorCenterY = doorObj.y + doorObj.height / 2;
              if (py < doorCenterY) {
                game.player.y = doorObj.y - 21;
              } else {
                game.player.y = doorObj.y + doorObj.height + 11;
              }
            }
          }
        }
      }

      function showMessage(message) {
        if (message && typeof message === 'object') {
          const jpHtml = processGameText(message.jp || '');
          const enHtml = message.en ? `<span class="jp-line-en">${message.en}</span>` : '';
          gameUI.innerHTML = jpHtml + enHtml;
        } else {
          gameUI.innerHTML = processGameText(message);
        }
        gameUI.style.display = 'block';
        setTimeout(() => {
          gameUI.style.display = 'none';
        }, 3000);
      }

      // --- Conversation System ---
      // Build portrait lookup from NPC data
      const portraitMap = {};
      game.npcs.forEach(npc => {
        portraitMap[npc.name] = npc.convoPortrait;
      });
      if (game.images.meConvo) {
        portraitMap['りきぞ'] = game.images.meConvo;
      }

      // Resolve a convoBackground: Image object used directly, string key looked up in convoBackgrounds map
      function getConvoBackgroundUrl(bg) {
        if (!bg) return null;
        if (bg.src) return bg.src; // already a loaded Image
        // Fallback: look up by key in loaded images
        var img = game.images['convoBg_' + bg];
        return img ? img.src : null;
      }

      function startConversation(conversationData, options) {
        game.inConversation = true;
        game.currentConversation = conversationData;
        game.conversationIndex = 0;
        game.onConversationEnd = (options && options.onEnd) || null;
        // portraitOverrides: map of speaker name → Image for alternate portraits
        game.conversationPortraitOverrides = (options && options.portraitOverrides) || null;

        var bgUrl = (options && options.backgroundImage) ? getConvoBackgroundUrl(options.backgroundImage) : null;
        if (bgUrl) {
          convoOverlay.style.backgroundImage = `url(${bgUrl})`;
        } else {
          // Fallback: first available background
          var keys = Object.keys(dayData.assets.convoBackgrounds || {});
          var fallbackImg = keys.length ? game.images['convoBg_' + keys[0]] : null;
          convoOverlay.style.backgroundImage = fallbackImg ? `url(${fallbackImg.src})` : 'none';
        }
        convoOverlay.style.display = 'flex';

        displayConversationLine();
      }

      function displayConversationLine() {
        if (!game.currentConversation || game.conversationIndex >= game.currentConversation.length) {
          endConversation();
          return;
        }

        const line = game.currentConversation[game.conversationIndex];
        const jpHtml = processGameText(line.jp || line.text || '');
        const enHtml = line.en ? `<span class="jp-line-en">${line.en}</span>` : '';
        convoText.innerHTML = jpHtml + enHtml;

        const overridePortrait = game.conversationPortraitOverrides && game.conversationPortraitOverrides[line.speaker];
        const portrait = overridePortrait || portraitMap[line.speaker];
        convoPortrait.src = portrait ? portrait.src : '';
      }

      function advanceConversation() {
        game.conversationIndex++;
        displayConversationLine();
      }

      function endConversation() {
        game.inConversation = false;
        game.currentConversation = null;
        game.conversationIndex = 0;
        game.conversationPortraitOverrides = null;
        convoOverlay.style.display = 'none';
        if (game.onConversationEnd) {
          const cb = game.onConversationEnd;
          game.onConversationEnd = null;
          cb();
        }
      }

      // --- Player Movement ---
      function updatePlayer() {
        if (game.inConversation) return;

        game.player.moving = false;
        let newX = game.player.x;
        let newY = game.player.y;

        if (game.keys['ArrowUp'] || game.keys['w'] || game.keys['W']) {
          newY -= game.player.speed;
          game.player.direction = 'up';
          game.player.moving = true;
        }
        if (game.keys['ArrowDown'] || game.keys['s'] || game.keys['S']) {
          newY += game.player.speed;
          game.player.direction = 'down';
          game.player.moving = true;
        }
        if (game.keys['ArrowLeft'] || game.keys['a'] || game.keys['A']) {
          newX -= game.player.speed;
          game.player.direction = 'left';
          game.player.moving = true;
        }
        if (game.keys['ArrowRight'] || game.keys['d'] || game.keys['D']) {
          newX += game.player.speed;
          game.player.direction = 'right';
          game.player.moving = true;
        }

        // Check collision with doors (use same small offsets as wall collision)
        let canMove = true;
        const doorPad = 12;
        for (let obj of game.interactiveObjects) {
          if (obj.isDoor && !game.doors[obj.name].open) {
            if (newX + doorPad > obj.x && newX - doorPad < obj.x + obj.width &&
                newY + 10 > obj.y && newY - 20 < obj.y + obj.height) {
              canMove = false;
              break;
            }
          }
        }

        // Check collision with walls
        if (canMove) {
          const points = [
            { x: newX - 12, y: newY },
            { x: newX + 12, y: newY },
            { x: newX, y: newY - 20 },
            { x: newX, y: newY + 10 }
          ];

          for (let point of points) {
            if (isCollision(point.x, point.y)) {
              canMove = false;
              break;
            }
          }
        }

        if (canMove) {
          game.player.x = newX;
          game.player.y = newY;
        }

        // Update animation
        if (game.player.moving) {
          game.player.frameTimer++;
          if (game.player.frameTimer >= game.player.frameDelay) {
            game.player.frameTimer = 0;
            game.player.frame = (game.player.frame + 1) % 6;
          }
        } else {
          game.player.frame = 0;
          game.player.frameTimer = 0;
        }

        // Update camera
        game.camera.x = game.player.x - canvas.width / 2;
        game.camera.y = game.player.y - canvas.height / 2;
      }

      // --- Rendering ---
      function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw map
        if (game.images.map) {
          ctx.drawImage(game.images.map, -game.camera.x, -game.camera.y);
        }

        // Draw closed doors
        if (game.images.door) {
          for (let obj of game.interactiveObjects) {
            if (obj.isDoor && !game.doors[obj.name].open) {
              ctx.drawImage(
                game.images.door,
                obj.x - game.camera.x,
                obj.y - game.camera.y,
                obj.width,
                obj.height
              );
            }
          }
        }

        // Draw NPCs
        for (let npc of game.npcs) {
          if (npc.sprite) {
            ctx.drawImage(
              npc.sprite,
              npc.x - game.camera.x - npc.width/2,
              npc.y - game.camera.y - npc.height,
              npc.width,
              npc.height
            );
          }
        }

        // Draw player
        if (game.images.playerSheet) {
          const spriteWidth = 204;
          const spriteHeight = 293;
          let row = 0;

          if (game.player.direction === 'down') row = 0;
          else if (game.player.direction === 'left') row = 1;
          else if (game.player.direction === 'right') row = 2;
          else if (game.player.direction === 'up') row = 3;

          ctx.drawImage(
            game.images.playerSheet,
            game.player.frame * spriteWidth,
            row * spriteHeight,
            spriteWidth,
            spriteHeight,
            game.player.x - game.camera.x - game.player.width/2,
            game.player.y - game.camera.y - game.player.height,
            game.player.width,
            game.player.height
          );
        }

        // Draw interaction indicator
        if (!game.inConversation) {
          const nearby = getNearbyInteractable();
          if (nearby) {
            const targetX = nearby.type === 'npc' ? nearby.target.x : nearby.target.centerX;
            const targetY = nearby.type === 'npc' ? nearby.target.y - nearby.target.height - 10 : nearby.target.centerY - 30;

            const screenX = targetX - game.camera.x;
            const screenY = targetY - game.camera.y;

            // Draw prompt
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(screenX - 50, screenY - 20, 100, 25);

            const isDoor = nearby.type === 'object' && nearby.target.isDoor;
            let promptLabel;
            if (isDoor) {
              promptLabel = game.doors[nearby.target.name].open ? '開いている' : '閉まっている';
            } else if (game.inspected.has(nearby.target.name)) {
              promptLabel = nearby.target.nameJp || nearby.target.name;
            } else {
              promptLabel = '？？？';
            }

            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(promptLabel, screenX, screenY - 7.5);
          }
        }
      }

      // --- Game Loop ---
      function gameLoop() {
        updatePlayer();
        render();
        game.animationFrame = requestAnimationFrame(gameLoop);
      }

      gameLoop();

      // Attempt to lock orientation to landscape on mobile devices
      if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        if (screen.orientation && typeof screen.orientation.lock === 'function') {
          screen.orientation.lock('landscape').catch(() => {
            // Lock unavailable in this context — rotate overlay handles it
          });
        }
      }
    }

    // Fetch manifest → day.json + glossary + conj rules → then load images
    const cacheBust = '?t=' + Date.now();
    let playerSpritePath = 'assets/characters/rikizo/rikizo_sheet.png';

    window.getManifest(config)
      .then(manifest => {
        // Use first game day from N5 (day-01-home)
        const gameEntry = manifest.data.N5.game[0];
        dayDir = gameEntry.dir;
        playerSpritePath = manifest.shared.playerSprite;
        const dayUrl = getSharedAssetUrl(dayDir + '/day.json') + cacheBust;
        const conjUrl     = getSharedAssetUrl(manifest.globalFiles.conjugationRules) + cacheBust;
        const counterUrl  = getSharedAssetUrl(manifest.globalFiles.counterRules) + cacheBust;
        const particleUrl   = getSharedAssetUrl(manifest.shared.particles) + cacheBust;
        const characterUrl  = getSharedAssetUrl(manifest.shared.characters) + cacheBust;
        const glossUrls = manifest.levels.map(lvl => getSharedAssetUrl(manifest.data[lvl].glossary) + cacheBust);
        return Promise.all([
          fetch(dayUrl).then(r => r.json()),
          fetch(conjUrl).then(r => r.json()),
          fetch(counterUrl).then(r => r.json()),
          fetch(particleUrl).then(r => r.json()),
          fetch(characterUrl).then(r => r.json()),
          ...glossUrls.map(url => fetch(url).then(r => r.json()))
        ]).then(([day, conj, counter, particleData, characterData, ...glossParts]) => {
          glossParts.forEach(g => g.entries.forEach(e => { termMap[e.id] = e; }));
          (particleData.particles || []).forEach(p => {
            termMap[p.id] = { id: p.id, surface: p.particle, reading: p.reading, meaning: p.role, notes: p.explanation, type: 'particle', matches: p.matches || [] };
          });
          (characterData.characters || []).forEach(c => {
            termMap[c.id] = Object.assign({}, c, { portraitUrl: getSharedAssetUrl(c.portrait) });
          });
          // Preload portrait images in the background so they appear instantly on first tap
          if (window.JPShared && window.JPShared.assets && window.JPShared.assets.preloadImages) {
            window.JPShared.assets.preloadImages(
              (characterData.characters || []).map(c => getSharedAssetUrl(c.portrait)).filter(Boolean)
            );
          }
          conjugationRules = conj;
          counterRules = counter;
          return day;
        });
      })
      .then(data => {
        dayData = data;
        dayData._playerSprite = playerSpritePath;
        if (window.JPShared && window.JPShared.termModal) {
          window.JPShared.termModal.inject();
          window.JPShared.termModal.setTermMap(termMap);
        }
        loadImages();
      })
      .catch(err => {
        console.error('Failed to load game data:', err);
        const loading = gameContainer.querySelector('.jp-game-loading');
        if (loading) loading.innerHTML = `<div style="color:#ff4757">Error loading game: ${err.message}</div>`;
      });
  }

  return {
    start: start
  };
})();
