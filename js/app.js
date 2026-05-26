/**
 * バトエンツール - メインアプリ
 */
(function () {
  "use strict";

  let state = null;
  let playerCount = 0;
  let searchContext = null;
  let statusContext = null;
  let switchPlayerIndex = null;
  let confirmCallback = null;
  let searchTouchStartX = 0;
  let searchTouchStartY = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function imagePath(dexNo) {
    const folder = CONFIG.imageFolder || "Image";
    if (!dexNo) {
      return folder + "/" + (CONFIG.questionImage || "question.png");
    }
    return folder + "/" + dexNo + ".png";
  }

  function createEmptyPokemon() {
    return {
      dexNo: null,
      evolved: false,
      attribute: null,
      hp: CONFIG.hpInitial,
      status: null,
      move: null,
    };
  }

  function createInitialState(count, names) {
    return {
      playerCount: count,
      players: names.map((name) => ({
        name: name.trim() || "プレイヤー",
        eraserUsed: false,
        activePokemonIndex: 0,
        pokemon: [createEmptyPokemon(), createEmptyPokemon(), createEmptyPokemon()],
      })),
    };
  }

  function saveState() {
    if (!state) return;
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
    } catch (_) {
      /* ignore */
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function clearState() {
    try {
      localStorage.removeItem(CONFIG.storageKey);
    } catch (_) {
      /* ignore */
    }
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((el) => {
      el.classList.toggle("active", el.id === id);
    });
    const backCount = $("btn-back-count");
    const backNames = $("btn-back-names");
    if (backCount) backCount.hidden = id !== "screen-count";
    if (backNames) backNames.hidden = id !== "screen-names";
  }

  /** スマホ向け：タップとスクロールを区別してボタンを確実に反応させる */
  function bindActionButton(el, handler) {
    if (!el) return;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;
    let handledByTouch = false;

    el.addEventListener(
      "touchstart",
      (e) => {
        touchMoved = false;
        handledByTouch = false;
        if (e.touches.length > 0) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      },
      { passive: true }
    );

    el.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 0) return;
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        const threshold = CONFIG.touchThresholdPx || 15;
        if (dx * dx + dy * dy > threshold * threshold) {
          touchMoved = true;
        }
      },
      { passive: true }
    );

    el.addEventListener(
      "touchend",
      (e) => {
        if (touchMoved) return;
        e.preventDefault();
        handledByTouch = true;
        handler(e);
        window.setTimeout(() => {
          handledByTouch = false;
        }, 400);
      },
      { passive: false }
    );

    el.addEventListener("click", (e) => {
      if (handledByTouch) return;
      handler(e);
    });
  }

  function showConfirm(message, onYes) {
    $("dialog-message").textContent = message;
    $("dialog-confirm").classList.add("active");
    $("dialog-confirm").setAttribute("aria-hidden", "false");
    confirmCallback = onYes;
  }

  function closeConfirm() {
    $("dialog-confirm").classList.remove("active");
    $("dialog-confirm").setAttribute("aria-hidden", "true");
    confirmCallback = null;
  }

  function getActivePokemon(player) {
    return player.pokemon[player.activePokemonIndex];
  }

  function getDisplayInfo(poke) {
    if (!poke || !poke.dexNo) {
      return {
        dexNo: null,
        name: CONFIG.unassignedPokemonName,
      };
    }
    const displayDex = DataService.getDisplayDexNo(poke.dexNo, poke.evolved);
    const name = DataService.getPokemonName(displayDex) || CONFIG.unassignedPokemonName;
    return { dexNo: displayDex, name };
  }

  function isPlayerDefeated(player) {
    return player.pokemon.every((p) => p.hp <= CONFIG.hpMin);
  }

  function bindTouchTap(el, handler) {
    let startX = 0;
    let startY = 0;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      handler(e);
    });
    el.addEventListener(
      "touchstart",
      (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      },
      { passive: true }
    );
    el.addEventListener(
      "touchend",
      (e) => {
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        const threshold = CONFIG.touchThresholdPx || 15;
        if (dx * dx + dy * dy < threshold * threshold) {
          e.preventDefault();
          handler(e);
        }
      },
      { passive: false }
    );
  }

  function bindSearchResultItem(item, onSelect) {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      onSelect();
    });
    item.addEventListener(
      "touchstart",
      (e) => {
        searchTouchStartX = e.touches[0].clientX;
        searchTouchStartY = e.touches[0].clientY;
      },
      { passive: true }
    );
    item.addEventListener(
      "touchend",
      (e) => {
        const dx = e.changedTouches[0].clientX - searchTouchStartX;
        const dy = e.changedTouches[0].clientY - searchTouchStartY;
        const threshold = CONFIG.touchThresholdPx || 15;
        if (dx * dx + dy * dy < threshold * threshold) {
          e.preventDefault();
          onSelect();
        }
      },
      { passive: false }
    );
  }

  /* ---------- スタート・人数・名前 ---------- */

  function initVersionDisplay() {
    const versionEl = $("app-version");
    if (versionEl && CONFIG.appVersion) {
      versionEl.textContent = CONFIG.appVersion;
    }

    const releaseNotesEl = $("app-release-notes");
    if (releaseNotesEl) {
      const notes =
        typeof CONFIG.appReleaseNotes === "string" ? CONFIG.appReleaseNotes : "";
      if (notes.trim() === "") {
        releaseNotesEl.setAttribute("hidden", "");
        releaseNotesEl.textContent = "";
      } else {
        releaseNotesEl.removeAttribute("hidden");
        releaseNotesEl.textContent = notes;
      }
    }
  }

  function initStartScreen() {
    initVersionDisplay();
    $("btn-start").textContent = CONFIG.startButtonLabel;

    const creditsEl = $("start-credits");
    if (creditsEl && CONFIG.creditLines && CONFIG.creditLines.length) {
      creditsEl.innerHTML = CONFIG.creditLines
        .map((line) => "<p>" + escapeHtml(line) + "</p>")
        .join("");
    }

    $("btn-start").addEventListener("click", () => {
      clearState();
      state = null;
      showScreen("screen-count");
    });
    $("count-heading").textContent = CONFIG.playerCountHeading;
    $("names-heading").textContent = CONFIG.namesHeading || "名前を入力";

    document.querySelectorAll(".btn-count").forEach((btn) => {
      btn.addEventListener("click", () => {
        playerCount = parseInt(btn.getAttribute("data-count"), 10);
        renderNameForm();
        showScreen("screen-names");
      });
    });
    $("btn-game-start").textContent = CONFIG.gameStartButtonLabel;
    $("btn-game-start").addEventListener("click", startGameFromNames);
  }

  function renderNameForm() {
    const form = $("names-form");
    form.innerHTML = "";
    const maxLen = CONFIG.playerNameMaxLength;
    for (let i = 0; i < playerCount; i++) {
      const field = document.createElement("div");
      field.className = "name-field";
      const label = document.createElement("label");
      label.textContent = i + 1 + "人目の名前";
      label.setAttribute("for", "name-input-" + i);
      const input = document.createElement("input");
      input.type = "text";
      input.id = "name-input-" + i;
      input.maxLength = maxLen;
      input.placeholder = "名前を入力";
      field.appendChild(label);
      field.appendChild(input);
      form.appendChild(field);
    }
  }

  function startGameFromNames() {
    const names = [];
    for (let i = 0; i < playerCount; i++) {
      const input = $("name-input-" + i);
      names.push((input && input.value.trim()) || i + 1 + "人目");
    }
    state = createInitialState(playerCount, names);
    saveState();
    renderGameScreen();
    showScreen("screen-game");
  }

  /* ---------- ゲーム管理画面 ---------- */

  function renderGameScreen() {
    if (!state) return;
    $("game-title").textContent = CONFIG.appTitle;
    const container = $("game-players");
    container.innerHTML = "";
    const count = state.playerCount;
    container.style.setProperty("--player-count", String(count));

    state.players.forEach((player, playerIndex) => {
      const row = document.createElement("div");
      row.className = "player-row";
      if (isPlayerDefeated(player)) row.classList.add("player-defeated");
      row.dataset.playerIndex = String(playerIndex);

      const active = getActivePokemon(player);
      const display = getDisplayInfo(active);

      row.innerHTML = buildPlayerRowHtml(player, playerIndex, display);
      container.appendChild(row);
      bindPlayerRowEvents(row, playerIndex);
    });
  }

  function buildPlayerRowHtml(player, playerIndex, display) {
    const active = getActivePokemon(player);
    const statusLabel = active.status || "状態";
    const moveOptions = buildMoveSelectOptions(active.move);
    const helpMark = active.move
      ? '<button type="button" class="btn-move-help" data-action="move-help" aria-label="わざの効果">？</button>'
      : "";

    const attrDot = active.attribute === "●" ? " active" : "";
    const attrStar = active.attribute === "★" ? " active" : "";
    const eraserClass = player.eraserUsed ? " btn-pressed" : "";
    const evolveClass = active.evolved ? " btn-pressed" : "";

    const hpUpDisabled = active.hp >= CONFIG.hpMax ? " disabled" : "";
    const hpDownDisabled = active.hp <= CONFIG.hpMin ? " disabled" : "";

    return (
      '<div class="col-player">' +
      '<div class="player-name">' +
      escapeHtml(player.name) +
      "</div>" +
      '<div class="col-action-bar">' +
      '<button type="button" class="btn-eraser btn-chip' +
      eraserClass +
      '" data-action="eraser">' +
      escapeHtml(CONFIG.eraserButtonLabel || "消しゴム") +
      "</button>" +
      "</div>" +
      "</div>" +
      '<div class="col-pokemon">' +
      '<div class="pokemon-img-wrap" data-action="pick-pokemon" data-slot="' +
      player.activePokemonIndex +
      '">' +
      '<img src="' +
      escapeHtml(imagePath(display.dexNo)) +
      '" alt="" loading="lazy">' +
      "</div>" +
      '<div class="pokemon-name-label">' +
      escapeHtml(display.name) +
      "</div>" +
      '<div class="col-action-bar">' +
      '<button type="button" class="btn-switch-pokemon btn-chip" data-action="open-switch">交代</button>' +
      "</div>" +
      "</div>" +
      '<div class="col-status">' +
      '<div class="attr-row">' +
      '<button type="button" class="btn-attr' +
      attrDot +
      '" data-action="attr" data-value="●">●</button>' +
      '<button type="button" class="btn-attr' +
      attrStar +
      '" data-action="attr" data-value="★">★</button>' +
      "</div>" +
      '<button type="button" class="btn-toggle evolve' +
      evolveClass +
      '" data-action="evolve">進化</button>' +
      '<button type="button" class="btn-status" data-action="open-status">' +
      escapeHtml(statusLabel) +
      "</button>" +
      '<div class="btn-move-wrap">' +
      '<select data-action="move-select">' +
      moveOptions +
      "</select>" +
      helpMark +
      "</div>" +
      "</div>" +
      '<div class="col-hp">' +
      '<div class="hp-label">残りHP</div>' +
      '<div class="hp-value">' +
      '<select class="hp-value-select" data-action="hp-select" aria-label="残りHP">' +
      buildHpSelectOptions(active.hp) +
      "</select>" +
      "</div>" +
      '<div class="hp-buttons">' +
      '<button type="button" class="btn-hp"' +
      hpUpDisabled +
      ' data-action="hp-up">▲</button>' +
      '<button type="button" class="btn-hp"' +
      hpDownDisabled +
      ' data-action="hp-down">▼</button>' +
      "</div>" +
      "</div>"
    );
  }

  function normalizeHp(hp) {
    const step = CONFIG.hpStep;
    const min = CONFIG.hpMin;
    const max = CONFIG.hpMax;
    const v = Math.round(Number(hp) / step) * step;
    return Math.max(min, Math.min(max, v));
  }

  function buildHpSelectOptions(currentHp) {
    const min = CONFIG.hpMin;
    const max = CONFIG.hpMax;
    const step = CONFIG.hpStep;
    const normalized = normalizeHp(currentHp);
    let html = "";
    for (let v = max; v >= min; v -= step) {
      const sel = v === normalized ? " selected" : "";
      html += '<option value="' + v + '"' + sel + ">" + v + "</option>";
    }
    return html;
  }

  function buildMoveSelectOptions(selected) {
    const moves = DataService.getMoveList();
    let html = '<option value="">わざマシン</option>';
    moves.forEach((name) => {
      const sel = name === selected ? " selected" : "";
      html += '<option value="' + escapeHtml(name) + '"' + sel + ">" + escapeHtml(name) + "</option>";
    });
    return html;
  }

  function bindPlayerRowEvents(row, playerIndex) {
    const player = state.players[playerIndex];

    row.querySelector('[data-action="eraser"]').addEventListener("click", () => {
      if (!player.eraserUsed) {
        player.eraserUsed = true;
        saveState();
        renderGameScreen();
        return;
      }
      showConfirm("解除しますか？", () => {
        player.eraserUsed = false;
        saveState();
        renderGameScreen();
      });
    });

    const imgWrap = row.querySelector('[data-action="pick-pokemon"]');
    bindTouchTap(imgWrap, () => {
      openSearchOverlay(playerIndex, player.activePokemonIndex);
    });

    row.querySelector('[data-action="open-switch"]').addEventListener("click", () => {
      openSwitchOverlay(playerIndex);
    });

    row.querySelectorAll('[data-action="attr"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const active = getActivePokemon(player);
        const val = btn.getAttribute("data-value");
        active.attribute = active.attribute === val ? null : val;
        saveState();
        renderGameScreen();
      });
    });

    row.querySelector('[data-action="evolve"]').addEventListener("click", () => {
      const active = getActivePokemon(player);
      if (!active.evolved) {
        active.evolved = true;
        saveState();
        renderGameScreen();
        return;
      }
      showConfirm("解除しますか？", () => {
        active.evolved = false;
        saveState();
        renderGameScreen();
      });
    });

    row.querySelector('[data-action="open-status"]').addEventListener("click", () => {
      openStatusOverlay(playerIndex);
    });

    const moveSelect = row.querySelector('[data-action="move-select"]');
    moveSelect.addEventListener("change", () => {
      const active = getActivePokemon(player);
      active.move = moveSelect.value || null;
      saveState();
      renderGameScreen();
    });

    const helpBtn = row.querySelector('[data-action="move-help"]');
    if (helpBtn) {
      helpBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openMoveHelpOverlay(getActivePokemon(player).move);
      });
    }

    const hpSelect = row.querySelector('[data-action="hp-select"]');
    if (hpSelect) {
      hpSelect.addEventListener("change", () => {
        const active = getActivePokemon(player);
        const val = parseInt(hpSelect.value, 10);
        if (!isNaN(val)) {
          active.hp = normalizeHp(val);
          saveState();
          renderGameScreen();
        }
      });
    }

    row.querySelector('[data-action="hp-up"]').addEventListener("click", () => {
      const active = getActivePokemon(player);
      if (active.hp < CONFIG.hpMax) {
        active.hp = normalizeHp(active.hp + CONFIG.hpStep);
        saveState();
        renderGameScreen();
      }
    });

    row.querySelector('[data-action="hp-down"]').addEventListener("click", () => {
      const active = getActivePokemon(player);
      if (active.hp > CONFIG.hpMin) {
        active.hp = normalizeHp(active.hp - CONFIG.hpStep);
        saveState();
        renderGameScreen();
      }
    });
  }

  /* ---------- ポケモン検索 ---------- */

  function openSearchOverlay(playerIndex, slotIndex) {
    searchContext = { playerIndex, slotIndex };
    const overlay = $("overlay-search");
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    const searchInput = $("search-pokemon");
    searchInput.value = "";
    searchInput.focus();

    function runSearch(q) {
      const filtered = DataService.searchPokemon(q);
      const results = $("search-results");
      results.innerHTML = filtered
        .map(
          (p) =>
            '<div class="search-result-item" data-dex="' +
            escapeHtml(p.dexNo) +
            '" data-name="' +
            escapeHtml(p.name) +
            '">' +
            '<img src="' +
            escapeHtml(imagePath(p.dexNo)) +
            '" alt="">' +
            "<span>" +
            escapeHtml(p.name) +
            "</span></div>"
        )
        .join("");

      results.querySelectorAll(".search-result-item").forEach((item) => {
        const dex = item.getAttribute("data-dex");
        bindSearchResultItem(item, () => selectPokemon(dex));
      });
    }

    searchInput.oninput = () => runSearch(searchInput.value);
    runSearch("");
  }

  function closeSearchOverlay() {
    $("overlay-search").classList.remove("active");
    $("overlay-search").setAttribute("aria-hidden", "true");
    searchContext = null;
  }

  function selectPokemon(dexNo) {
    if (!searchContext || !state) return;
    const { playerIndex, slotIndex } = searchContext;
    const poke = state.players[playerIndex].pokemon[slotIndex];
    poke.dexNo = dexNo;
    saveState();
    closeSearchOverlay();
    if ($("overlay-switch").classList.contains("active")) {
      renderSwitchOverlay();
    } else {
      renderGameScreen();
    }
  }

  /* ---------- 交代 ---------- */

  function openSwitchOverlay(playerIndex) {
    switchPlayerIndex = playerIndex;
    const overlay = $("overlay-switch");
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    renderSwitchOverlay();
  }

  function closeSwitchOverlay() {
    $("overlay-switch").classList.remove("active");
    $("overlay-switch").setAttribute("aria-hidden", "true");
    switchPlayerIndex = null;
    renderGameScreen();
  }

  function renderSwitchOverlay() {
    if (switchPlayerIndex == null || !state) return;
    const player = state.players[switchPlayerIndex];
    $("switch-player-name").textContent = player.name;

    const battleIdx = player.activePokemonIndex;
    const benchIndices = [0, 1, 2].filter((i) => i !== battleIdx);

    let html = '<div class="switch-section">';
    html += '<span class="switch-label-vertical">バトル場</span>';
    html += buildSwitchSlotHtml(player, battleIdx, false);
    html += "</div>";

    html += '<div class="switch-section">';
    html += '<span class="switch-label-vertical">ベンチ</span>';
    html += '<div class="switch-bench-row">';
    benchIndices.forEach((idx) => {
      html += buildSwitchSlotHtml(player, idx, true);
    });
    html += "</div></div>";

    $("switch-body").innerHTML = html;

    $("switch-body").querySelectorAll("[data-action='pick-switch']").forEach((el) => {
      const slot = parseInt(el.getAttribute("data-slot"), 10);
      bindTouchTap(el, () => openSearchOverlay(switchPlayerIndex, slot));
    });

    $("switch-body").querySelectorAll("[data-action='do-switch']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const benchSlot = parseInt(btn.getAttribute("data-slot"), 10);
        performSwitch(switchPlayerIndex, benchSlot);
      });
    });
  }

  function buildSwitchSlotHtml(player, slotIndex, showSwitchBtn) {
    const poke = player.pokemon[slotIndex];
    const display = getDisplayInfo(poke);
    const gray = poke.hp <= CONFIG.hpMin ? " grayscale" : "";
    const isBattle = slotIndex === player.activePokemonIndex;

    let html = '<div class="switch-slot">';
    html +=
      '<div class="pokemon-img-wrap" data-action="pick-switch" data-slot="' +
      slotIndex +
      '">';
    html +=
      '<img class="' +
      gray.trim() +
      '" src="' +
      escapeHtml(imagePath(display.dexNo)) +
      '" alt="">';
    html += "</div>";
    html += '<div class="pokemon-name-label">' + escapeHtml(display.name) + "</div>";
    if (showSwitchBtn) {
      const disabled = poke.hp <= CONFIG.hpMin || isBattle ? " disabled" : "";
      html +=
        '<button type="button" class="btn-switch-bench"' +
        disabled +
        ' data-action="do-switch" data-slot="' +
        slotIndex +
        '">交代</button>';
    }
    html += "</div>";
    return html;
  }

  function performSwitch(playerIndex, benchSlotIndex) {
    const player = state.players[playerIndex];
    const battleIdx = player.activePokemonIndex;
    if (benchSlotIndex === battleIdx) return;
    const benchPoke = player.pokemon[benchSlotIndex];
    if (benchPoke.hp <= CONFIG.hpMin) return;

    const temp = player.pokemon[battleIdx];
    player.pokemon[battleIdx] = player.pokemon[benchSlotIndex];
    player.pokemon[benchSlotIndex] = temp;

    player.pokemon[battleIdx].status = null;
    player.pokemon[battleIdx].move = null;

    saveState();
    closeSwitchOverlay();
  }

  /* ---------- 状態異常 ---------- */

  function openStatusOverlay(playerIndex) {
    statusContext = { playerIndex };
    const overlay = $("overlay-status");
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    $("status-panel-title").textContent = CONFIG.statusPopupTitle;

    const active = getActivePokemon(state.players[playerIndex]);
    const container = $("status-buttons");
    container.innerHTML = "";
    CONFIG.statusConditions.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-status-choice";
      if (active.status === label) btn.classList.add("active");
      btn.textContent = label;
      btn.addEventListener("click", () => {
        active.status = label;
        saveState();
        closeStatusOverlay();
        renderGameScreen();
      });
      container.appendChild(btn);
    });
  }

  function closeStatusOverlay() {
    $("overlay-status").classList.remove("active");
    $("overlay-status").setAttribute("aria-hidden", "true");
    statusContext = null;
  }

  $("btn-clear-status").addEventListener("click", () => {
    if (statusContext && state) {
      getActivePokemon(state.players[statusContext.playerIndex]).status = null;
      saveState();
      closeStatusOverlay();
      renderGameScreen();
    }
  });

  /* ---------- わざ効果 ---------- */

  function openMoveHelpOverlay(moveName) {
    if (!moveName) return;
    const rolls = DataService.getMoveEffect(moveName);
    if (!rolls) return;
    $("move-help-title").textContent = moveName;
    const list = $("move-help-list");
    list.innerHTML = rolls
      .map(
        (text, i) =>
          '<div class="move-help-item"><span class="roll-num">' +
          (i + 1) +
          "の目</span><span>" +
          escapeHtml(text) +
          "</span></div>"
      )
      .join("");
    const overlay = $("overlay-move-help");
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  }

  function closeMoveHelpOverlay() {
    $("overlay-move-help").classList.remove("active");
    $("overlay-move-help").setAttribute("aria-hidden", "true");
  }

  /* ---------- 終了・ダイアログ ---------- */

  function initDialogs() {
    $("dialog-yes").addEventListener("click", () => {
      const cb = confirmCallback;
      closeConfirm();
      if (cb) cb();
    });
    $("dialog-no").addEventListener("click", closeConfirm);
    $("dialog-confirm").querySelector(".dialog-backdrop").addEventListener("click", closeConfirm);

    $("btn-exit").addEventListener("click", () => {
      showConfirm("ゲームを終了しますか？", () => {
        clearState();
        state = null;
        showScreen("screen-start");
      });
    });

    $("btn-close-search").addEventListener("click", closeSearchOverlay);
    $("search-pokemon").addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSearchOverlay();
    });

    $("btn-switch-back").addEventListener("click", closeSwitchOverlay);
    $("btn-status-back").addEventListener("click", closeStatusOverlay);
    $("btn-move-help-back").addEventListener("click", closeMoveHelpOverlay);
  }

  /* ---------- 起動 ---------- */

  function initNavigation() {
    const backLabel = CONFIG.backButtonLabel || "戻る";
    const btnBackCount = $("btn-back-count");
    const btnBackNames = $("btn-back-names");
    if (btnBackCount) btnBackCount.textContent = backLabel;
    if (btnBackNames) btnBackNames.textContent = backLabel;

    bindActionButton(btnBackCount, () => {
      showScreen("screen-start");
    });
    bindActionButton(btnBackNames, () => {
      showScreen("screen-count");
    });
  }

  async function boot() {
    initStartScreen();
    initNavigation();
    initDialogs();

    try {
      await DataService.loadAll();
    } catch (err) {
      console.error(err);
      $("screen-loading").querySelector(".loading-text").textContent =
        "データの読み込みに失敗しました。GitHub Pages またはローカルサーバーで開いてください。";
      return;
    }

    const saved = loadState();
    if (saved && saved.players && saved.players.length >= 2) {
      state = saved;
      playerCount = state.playerCount;
      renderGameScreen();
      showScreen("screen-game");
    } else {
      showScreen("screen-start");
    }

    /* 初期表示時の戻るボタン非表示を確実にする */
    const backCount = $("btn-back-count");
    const backNames = $("btn-back-names");
    if (backCount) backCount.hidden = true;
    if (backNames) backNames.hidden = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
