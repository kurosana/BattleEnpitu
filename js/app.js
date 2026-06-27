/**
 * バトエンツール v2 - メインアプリ
 */
(function () {
  "use strict";

  let state = null;
  let setupMode = "versus";
  let playerCount = 0;
  let bottles = 3;
  let searchContext = null;
  let searchTypeFilter = null;
  let editPlayerIndex = null;
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
    if (!dexNo) return folder + "/" + (CONFIG.questionImage || "question.png");
    return folder + "/" + dexNo + ".png";
  }

  function iconPath(filename) {
    const folder = CONFIG.iconFolder || "Image/icon";
    return folder + "/" + filename;
  }

  function createEmptyPokemon() {
    return { dexNo: null, evolved: false, hp: CONFIG.hpInitial, status: null, move: null };
  }

  function createInitialState(count, names, mode, bottleCount) {
    return {
      mode: mode,
      bottles: bottleCount,
      playerCount: count,
      players: names.map((name) => ({
        name: name.trim() || "プレイヤー",
        eraserUsed: false,
        rank: null,
        activePokemonIndex: 0,
        pokemon: Array.from({ length: bottleCount }, () => createEmptyPokemon()),
      })),
    };
  }

  function saveState() {
    if (!state) return;
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
    } catch (_) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.players || !s.bottles) return null;
      return s;
    } catch (_) {
      return null;
    }
  }

  function clearState() {
    try {
      localStorage.removeItem(CONFIG.storageKey);
      localStorage.removeItem("batoen_game_state");
    } catch (_) {}
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((el) => {
      el.classList.toggle("active", el.id === id);
    });
    const backBottles = $("btn-back-bottles");
    const backCount = $("btn-back-count");
    const backNames = $("btn-back-names");
    if (backBottles) backBottles.hidden = id !== "screen-bottles";
    if (backCount) backCount.hidden = id !== "screen-count";
    if (backNames) backNames.hidden = id !== "screen-names";
  }

  function bindActionButton(el, handler) {
    if (!el) return;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;
    let handledByTouch = false;

    el.addEventListener("touchstart", (e) => {
      touchMoved = false;
      handledByTouch = false;
      if (e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    el.addEventListener("touchmove", (e) => {
      if (e.touches.length === 0) return;
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      const th = CONFIG.touchThresholdPx || 15;
      if (dx * dx + dy * dy > th * th) touchMoved = true;
    }, { passive: true });

    el.addEventListener("touchend", (e) => {
      if (touchMoved) return;
      e.preventDefault();
      handledByTouch = true;
      handler(e);
      window.setTimeout(() => { handledByTouch = false; }, 400);
    }, { passive: false });

    el.addEventListener("click", (e) => {
      if (handledByTouch) return;
      handler(e);
    });
  }

  function bindTouchTap(el, handler) {
    if (!el) return;
    let startX = 0;
    let startY = 0;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      handler(e);
    });
    el.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const th = CONFIG.touchThresholdPx || 15;
      if (dx * dx + dy * dy < th * th) {
        e.preventDefault();
        handler(e);
      }
    }, { passive: false });
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
      return { dexNo: null, name: CONFIG.unassignedPokemonName, symbol: "", typeIcon: null };
    }
    const displayDex = DataService.getDisplayDexNo(poke.dexNo, poke.evolved);
    const name = DataService.getPokemonName(displayDex) || CONFIG.unassignedPokemonName;
    const symbol = DataService.getSymbol(displayDex);
    const typeIcon = DataService.getTypeIconPathByDex(displayDex);
    return { dexNo: displayDex, name, symbol, typeIcon };
  }

  function isPlayerDefeated(player) {
    return player.pokemon.every((p) => p.hp <= CONFIG.hpMin);
  }

  function normalizeHp(hp) {
    const step = CONFIG.hpStep;
    const v = Math.round(Number(hp) / step) * step;
    return Math.max(CONFIG.hpMin, Math.min(CONFIG.hpMax, v));
  }

  function buildHpSelectOptions(currentHp) {
    const normalized = normalizeHp(currentHp);
    let html = "";
    for (let v = CONFIG.hpMax; v >= CONFIG.hpMin; v -= CONFIG.hpStep) {
      html += '<option value="' + v + '"' + (v === normalized ? " selected" : "") + ">" + v + "</option>";
    }
    return html;
  }

  function buildMetaHtml(displayDex, name) {
    const symbol = displayDex ? DataService.getSymbol(displayDex) : "";
    const typeIcon = displayDex ? DataService.getTypeIconPathByDex(displayDex) : null;
    let html = '<span class="poke-name-text">' + escapeHtml(name) + "</span>";
    if (symbol) html += '<span class="poke-symbol">' + escapeHtml(symbol) + "</span>";
    if (typeIcon) {
      html += '<img class="poke-type-icon" src="' + escapeHtml(typeIcon) + '" alt="">';
    }
    return html;
  }

  function buildStatusIconsHtml(poke) {
    if (!poke) return "";
    const icons = [];
    const folder = CONFIG.iconFolder || "Image/icon";
    const showEvolveIcon = poke.evolved || poke.status === "キャップしんか";
    if (showEvolveIcon && CONFIG.evolveIcon) {
      icons.push(
        '<img class="status-icon status-icon-evolve" src="' +
        escapeHtml(folder + "/" + CONFIG.evolveIcon) +
        '" alt="">'
      );
    }
    if (poke.status && poke.status !== "キャップしんか" && CONFIG.statusIcons && CONFIG.statusIcons[poke.status]) {
      icons.push(
        '<img class="status-icon" src="' +
        escapeHtml(folder + "/" + CONFIG.statusIcons[poke.status]) +
        '" alt="">'
      );
    }
    if (poke.move && CONFIG.moveIcon) {
      icons.push(
        '<img class="status-icon status-icon-move" src="' +
        escapeHtml(folder + "/" + CONFIG.moveIcon) +
        '" alt="">'
      );
    }
    if (!icons.length) return "";
    return '<div class="poke-status-icons">' + icons.join("") + "</div>";
  }

  function buildMoveSelectOptions(selected) {
    let html = '<option value="">わざマシン</option>';
    DataService.getMoveList().forEach((name) => {
      html += '<option value="' + escapeHtml(name) + '"' + (name === selected ? " selected" : "") + ">" + escapeHtml(name) + "</option>";
    });
    return html;
  }

  function buildStatusSelectOptions(selected) {
    let html = '<option value="">じょうたい</option>';
    CONFIG.statusConditions.forEach((label) => {
      html += '<option value="' + escapeHtml(label) + '"' + (label === selected ? " selected" : "") + ">" + escapeHtml(label) + "</option>";
    });
    return html;
  }

  function buildRankOptions(current, maxRank) {
    let html = '<option value="">順位</option>';
    for (let i = 1; i <= maxRank; i++) {
      html += '<option value="' + i + '"' + (current === i ? " selected" : "") + ">" + i + "位</option>";
    }
    return html;
  }

  function setExclusiveCap(poke, field, value) {
    if (field === "status") {
      poke.status = value || null;
      if (value) poke.move = null;
    } else if (field === "move") {
      poke.move = value || null;
      if (value) poke.status = null;
    }
  }

  function performSwitch(playerIndex, benchSlotIndex) {
    const player = state.players[playerIndex];
    const battleIdx = player.activePokemonIndex;
    if (benchSlotIndex === battleIdx) return;

    const temp = player.pokemon[battleIdx];
    player.pokemon[battleIdx] = player.pokemon[benchSlotIndex];
    player.pokemon[benchSlotIndex] = temp;

    player.pokemon[battleIdx].status = null;
    player.pokemon[battleIdx].move = null;

    saveState();
    renderActiveScreen();
  }

  /* ---------- Setup screens ---------- */

  function initVersionDisplay() {
    const versionEl = $("app-version");
    if (versionEl && CONFIG.appVersion) versionEl.textContent = CONFIG.appVersion;
    const releaseNotesEl = $("app-release-notes");
    if (releaseNotesEl) {
      const notes = typeof CONFIG.appReleaseNotes === "string" ? CONFIG.appReleaseNotes : "";
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
    $("btn-personal").textContent = CONFIG.personalModeButtonLabel || "個人管理モード";
    $("bottles-heading").textContent = CONFIG.bottleCountHeading;
    $("count-heading").textContent = CONFIG.playerCountHeading;

    const creditsEl = $("start-credits");
    if (creditsEl && CONFIG.creditLines) {
      creditsEl.innerHTML = CONFIG.creditLines.map((line) => "<p>" + escapeHtml(line) + "</p>").join("");
    }

    $("btn-start").addEventListener("click", () => {
      clearState();
      state = null;
      setupMode = "versus";
      showScreen("screen-bottles");
    });

    $("btn-personal").addEventListener("click", () => {
      clearState();
      state = null;
      setupMode = "personal";
      showScreen("screen-bottles");
    });

    document.querySelectorAll("[data-bottles]").forEach((btn) => {
      btn.addEventListener("click", () => {
        bottles = parseInt(btn.getAttribute("data-bottles"), 10);
        if (setupMode === "personal") {
          playerCount = 1;
          renderNameForm();
          showScreen("screen-names");
        } else {
          showScreen("screen-count");
        }
      });
    });

    document.querySelectorAll("[data-count]").forEach((btn) => {
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
    $("names-heading").textContent =
      setupMode === "personal" ? CONFIG.personalNamesHeading || "名前を入力" : CONFIG.namesHeading;
    const maxLen = CONFIG.playerNameMaxLength;
    for (let i = 0; i < playerCount; i++) {
      const field = document.createElement("div");
      field.className = "name-field";
      const label = document.createElement("label");
      label.textContent = setupMode === "personal" ? "名前" : i + 1 + "人目の名前";
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
    state = createInitialState(playerCount, names, setupMode, bottles);
    saveState();
    renderActiveScreen();
  }

  function renderActiveScreen() {
    if (!state) return;
    if (state.mode === "personal") {
      renderPersonalScreen();
      showScreen("screen-personal");
    } else {
      renderGameScreen();
      showScreen("screen-game");
    }
  }

  /* ---------- Game screen ---------- */

  function applyPlayerRowGrid(row, bottleCount) {
    if (state.mode === "personal") return;
    const playerCol = "minmax(2.5rem, 0.48fr)";
    const battleCol = "minmax(0, 1.15fr)";
    const hpCol = "minmax(0, 0.72fr)";
    if (bottleCount <= 1) {
      row.style.gridTemplateColumns = playerCol + " " + battleCol + " " + hpCol;
    } else {
      row.style.gridTemplateColumns =
        playerCol + " " + battleCol + " " + hpCol + " minmax(0, 1.35fr)";
    }
  }

  function buildPlayerColHtml(player) {
    const eraserClass = player.eraserUsed ? " btn-pressed" : "";
    if (state.mode === "personal") {
      return (
        '<div class="col-player col-player-inline">' +
        '<div class="player-name-row">' +
        '<div class="player-name">' + escapeHtml(player.name) + "</div>" +
        '<button type="button" class="btn-eraser btn-chip btn-eraser-inline' + eraserClass + '" data-action="eraser">' +
        escapeHtml(CONFIG.eraserButtonLabel || "消") + "</button>" +
        "</div></div>"
      );
    }
    return (
      '<div class="col-player">' +
      '<div class="player-name">' + escapeHtml(player.name) + "</div>" +
      '<button type="button" class="btn-eraser btn-chip' + eraserClass + '" data-action="eraser">' +
      escapeHtml(CONFIG.eraserButtonLabel || "消") + "</button>" +
      (state.mode === "versus"
        ? '<select class="rank-select" data-action="rank-select">' + buildRankOptions(player.rank, state.playerCount) + "</select>"
        : "") +
      "</div>"
    );
  }

  function buildBenchPairHtml(player, slotIndex) {
    const poke = player.pokemon[slotIndex];
    return (
      '<div class="bench-pair" data-bench-slot="' + slotIndex + '">' +
      buildPokemonSlotHtml(player, slotIndex, false) +
      buildHpBlockHtml(poke, false) +
      "</div>"
    );
  }

  function buildPokemonSlotHtml(player, slotIndex, isBattle) {
    const poke = player.pokemon[slotIndex];
    const display = getDisplayInfo(poke);
    const gray = poke.hp <= CONFIG.hpMin ? " grayscale" : "";
    const slotClass = isBattle ? "slot-battle" : "slot-bench";
    return (
      '<div class="pokemon-slot ' + slotClass + '" data-slot="' + slotIndex + '">' +
      '<div class="slot-label">' + (isBattle ? "バトル場" : "ベンチ") + "</div>" +
      '<div class="pokemon-img-wrap" data-action="poke-tap" data-slot="' + slotIndex + '">' +
      buildStatusIconsHtml(isBattle ? poke : null) +
      '<img class="' + gray.trim() + '" src="' + escapeHtml(imagePath(display.dexNo)) + '" alt="">' +
      "</div>" +
      '<div class="pokemon-name-label poke-meta">' + buildMetaHtml(display.dexNo, display.name) + "</div>" +
      "</div>"
    );
  }

  function buildHpBlockHtml(poke, editable) {
    if (editable) {
      const upDis = poke.hp >= CONFIG.hpMax ? " disabled" : "";
      const downDis = poke.hp <= CONFIG.hpMin ? " disabled" : "";
      return (
        '<div class="col-hp hp-editable">' +
        '<div class="hp-label">残りHP</div>' +
        '<div class="hp-value"><select class="hp-value-select" data-action="hp-select">' +
        buildHpSelectOptions(poke.hp) +
        "</select></div>" +
        '<div class="hp-buttons">' +
        '<button type="button" class="btn-hp"' + upDis + ' data-action="hp-up">▲</button>' +
        '<button type="button" class="btn-hp"' + downDis + ' data-action="hp-down">▼</button>' +
        "</div></div>"
      );
    }
    return (
      '<div class="col-hp hp-readonly">' +
      '<div class="hp-label">HP</div>' +
      '<div class="hp-readonly-value">' + poke.hp + "</div></div>"
    );
  }

  function buildPlayerRowHtml(player, playerIndex) {
    const battleIdx = player.activePokemonIndex;
    const battlePoke = player.pokemon[battleIdx];
    const benchPairs = [];
    for (let i = 0; i < state.bottles; i++) {
      if (i === battleIdx) continue;
      benchPairs.push(buildBenchPairHtml(player, i));
    }

    return (
      buildPlayerColHtml(player) +
      buildPokemonSlotHtml(player, battleIdx, true) +
      buildHpBlockHtml(battlePoke, true) +
      (benchPairs.length ? '<div class="col-bench-area">' + benchPairs.join("") + "</div>" : "")
    );
  }

  function renderGameScreen() {
    if (!state) return;
    $("game-title").textContent = CONFIG.appTitle;
    const container = $("game-players");
    container.innerHTML = "";
    state.players.forEach((player, playerIndex) => {
      const row = document.createElement("div");
      row.className = "player-row";
      if (isPlayerDefeated(player)) row.classList.add("player-defeated");
      row.dataset.playerIndex = String(playerIndex);
      row.innerHTML = buildPlayerRowHtml(player, playerIndex);
      applyPlayerRowGrid(row, state.bottles);
      container.appendChild(row);
      bindPlayerRowEvents(row, playerIndex);
    });
  }

  function bindPlayerRowEvents(row, playerIndex) {
    const player = state.players[playerIndex];

    row.querySelector('[data-action="eraser"]').addEventListener("click", () => {
      if (!player.eraserUsed) {
        player.eraserUsed = true;
        saveState();
        renderActiveScreen();
        return;
      }
      showConfirm("解除しますか？", () => {
        player.eraserUsed = false;
        saveState();
        renderActiveScreen();
      });
    });

    const rankSelect = row.querySelector('[data-action="rank-select"]');
    if (rankSelect) {
      rankSelect.addEventListener("change", () => {
        const v = rankSelect.value;
        player.rank = v ? parseInt(v, 10) : null;
        saveState();
      });
    }

    row.querySelectorAll('[data-action="poke-tap"]').forEach((el) => {
      const slot = parseInt(el.getAttribute("data-slot"), 10);
      const isBattle = slot === player.activePokemonIndex;
      bindTouchTap(el, () => {
        if (isBattle) {
          const poke = player.pokemon[slot];
          if (!poke.dexNo) {
            openSearchOverlay(playerIndex, slot, "battle_init");
          } else {
            openEditOverlay(playerIndex);
          }
        } else {
          const poke = player.pokemon[slot];
          if (!poke.dexNo) {
            openSearchOverlay(playerIndex, slot, "bench_init");
          } else {
            performSwitch(playerIndex, slot);
          }
        }
      });
    });

    const hpSelect = row.querySelector('[data-action="hp-select"]');
    if (hpSelect) {
      hpSelect.addEventListener("change", () => {
        const active = getActivePokemon(player);
        const val = parseInt(hpSelect.value, 10);
        if (!isNaN(val)) {
          active.hp = normalizeHp(val);
          saveState();
          renderActiveScreen();
        }
      });
    }

    const hpUp = row.querySelector('[data-action="hp-up"]');
    if (hpUp) {
      hpUp.addEventListener("click", () => {
        const active = getActivePokemon(player);
        if (active.hp < CONFIG.hpMax) {
          active.hp = normalizeHp(active.hp + CONFIG.hpStep);
          saveState();
          renderActiveScreen();
        }
      });
    }

    const hpDown = row.querySelector('[data-action="hp-down"]');
    if (hpDown) {
      hpDown.addEventListener("click", () => {
        const active = getActivePokemon(player);
        if (active.hp > CONFIG.hpMin) {
          active.hp = normalizeHp(active.hp - CONFIG.hpStep);
          saveState();
          renderActiveScreen();
        }
      });
    }
  }

  /* ---------- Personal screen ---------- */

  function renderPersonalScreen() {
    if (!state || !state.players[0]) return;
    $("personal-title").textContent = state.players[0].name + " - 個人管理";
    const body = $("personal-body");
    const player = state.players[0];
    const wrapper = document.createElement("div");
    wrapper.className = "personal-player";
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = buildPlayerRowHtml(player, 0);
    applyPlayerRowGrid(row, state.bottles);
    wrapper.appendChild(row);
    body.innerHTML = "";
    body.appendChild(wrapper);
    bindPlayerRowEvents(row, 0);
  }

  /* ---------- Edit overlay ---------- */

  function openEditOverlay(playerIndex) {
    editPlayerIndex = playerIndex;
    const player = state.players[playerIndex];
    const poke = getActivePokemon(player);
    const display = getDisplayInfo(poke);
    $("edit-player-name").textContent = player.name;
    const evolveClass = poke.evolved ? " btn-pressed" : "";

    $("edit-body").innerHTML =
      '<div class="edit-left">' +
      '<div class="edit-img-wrap">' +
      buildStatusIconsHtml(poke) +
      '<img src="' + escapeHtml(imagePath(display.dexNo)) + '" alt="">' +
      "</div>" +
      '<div class="edit-name poke-meta">' + buildMetaHtml(display.dexNo, display.name) + "</div>" +
      '<button type="button" class="btn-secondary btn-change-pokemon" data-action="edit-change">ポケモン変更</button>' +
      "</div>" +
      '<div class="edit-right">' +
      '<button type="button" class="btn-toggle evolve' + evolveClass + '" data-action="edit-evolve">進化</button>' +
      '<select class="edit-select" data-action="edit-status">' + buildStatusSelectOptions(poke.status) + "</select>" +
      '<div class="edit-move-wrap">' +
      '<select class="edit-select" data-action="edit-move">' + buildMoveSelectOptions(poke.move) + "</select>" +
      (poke.move ? '<button type="button" class="btn-move-help" data-action="edit-move-help">？</button>' : "") +
      "</div></div>";

    $("overlay-edit").classList.add("active");
    $("overlay-edit").setAttribute("aria-hidden", "false");
    bindEditEvents();
  }

  function closeEditOverlay() {
    $("overlay-edit").classList.remove("active");
    $("overlay-edit").setAttribute("aria-hidden", "true");
    editPlayerIndex = null;
    renderActiveScreen();
  }

  function bindEditEvents() {
    if (editPlayerIndex == null) return;
    const player = state.players[editPlayerIndex];
    const poke = getActivePokemon(player);

    $("edit-body").querySelector('[data-action="edit-change"]').addEventListener("click", () => {
      openSearchOverlay(editPlayerIndex, player.activePokemonIndex, "edit_change");
    });

    $("edit-body").querySelector('[data-action="edit-evolve"]').addEventListener("click", () => {
      if (!poke.evolved) {
        poke.evolved = true;
        saveState();
        openEditOverlay(editPlayerIndex);
        return;
      }
      showConfirm("解除しますか？", () => {
        poke.evolved = false;
        saveState();
        openEditOverlay(editPlayerIndex);
      });
    });

    $("edit-body").querySelector('[data-action="edit-status"]').addEventListener("change", (e) => {
      setExclusiveCap(poke, "status", e.target.value || null);
      saveState();
      openEditOverlay(editPlayerIndex);
    });

    $("edit-body").querySelector('[data-action="edit-move"]').addEventListener("change", (e) => {
      setExclusiveCap(poke, "move", e.target.value || null);
      saveState();
      openEditOverlay(editPlayerIndex);
    });

    const helpBtn = $("edit-body").querySelector('[data-action="edit-move-help"]');
    if (helpBtn) {
      helpBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openMoveHelpOverlay(poke.move);
      });
    }
  }

  /* ---------- Search overlay ---------- */

  function setSearchOverlayMode(mode) {
    const inner = document.querySelector(".search-overlay-inner");
    if (inner) inner.classList.toggle("results-mode", mode === "results");
  }

  function showTypeList() {
    searchTypeFilter = null;
    setSearchOverlayMode("types");
    $("type-list").hidden = false;
    $("search-results").hidden = true;
    $("btn-search-back-types").hidden = true;
    $("search-pokemon").value = "";

    const types = DataService.getTypeList();
    $("type-list").innerHTML = types.map((t) => {
      const icon = DataService.getTypeIconPath(t);
      const iconHtml = icon ? '<img src="' + escapeHtml(icon) + '" alt="">' : "";
      return '<button type="button" class="type-btn" data-type="' + escapeHtml(t) + '">' + iconHtml + "<span>" + escapeHtml(t) + "</span></button>";
    }).join("");

    $("type-list").querySelectorAll(".type-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        searchTypeFilter = btn.getAttribute("data-type");
        showSearchResults("");
      });
    });
  }

  function showSearchResults(query) {
    setSearchOverlayMode("results");
    $("type-list").hidden = true;
    $("search-results").hidden = false;
    $("btn-search-back-types").hidden = false;

    const filtered = DataService.searchPokemon(query, searchTypeFilter);
    $("search-results").innerHTML = filtered.map((p) => {
      const sym = DataService.getSymbol(p.dexNo);
      const typeIcon = DataService.getTypeIconPathByDex(p.dexNo);
      return (
        '<div class="search-result-item" data-dex="' + escapeHtml(p.dexNo) + '">' +
        '<img class="result-poke-img" src="' + escapeHtml(imagePath(p.dexNo)) + '" alt="">' +
        '<span class="result-name">' + escapeHtml(p.name) + "</span>" +
        (sym ? '<span class="result-symbol">' + escapeHtml(sym) + "</span>" : "") +
        (typeIcon ? '<img class="result-type-icon" src="' + escapeHtml(typeIcon) + '" alt="">' : "") +
        "</div>"
      );
    }).join("");

    $("search-results").querySelectorAll(".search-result-item").forEach((item) => {
      const dex = item.getAttribute("data-dex");
      bindSearchResultItem(item, () => selectPokemon(dex));
    });
  }

  function bindSearchResultItem(item, onSelect) {
    item.addEventListener("click", (e) => { e.preventDefault(); onSelect(); });
    item.addEventListener("touchstart", (e) => {
      searchTouchStartX = e.touches[0].clientX;
      searchTouchStartY = e.touches[0].clientY;
    }, { passive: true });
    item.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - searchTouchStartX;
      const dy = e.changedTouches[0].clientY - searchTouchStartY;
      const th = CONFIG.touchThresholdPx || 15;
      if (dx * dx + dy * dy < th * th) {
        e.preventDefault();
        onSelect();
      }
    }, { passive: false });
  }

  function openSearchOverlay(playerIndex, slotIndex, purpose) {
    searchContext = { playerIndex, slotIndex, purpose };
    $("overlay-search").classList.add("active");
    $("overlay-search").setAttribute("aria-hidden", "false");
    showTypeList();
    $("search-pokemon").oninput = () => {
      if ($("search-pokemon").value.trim()) {
        searchTypeFilter = null;
        showSearchResults($("search-pokemon").value);
      } else if (searchTypeFilter) {
        showSearchResults("");
      } else {
        showTypeList();
      }
    };
  }

  function closeSearchOverlay() {
    $("overlay-search").classList.remove("active");
    $("overlay-search").setAttribute("aria-hidden", "true");
    setSearchOverlayMode("types");
    searchContext = null;
    searchTypeFilter = null;
  }

  function selectPokemon(dexNo) {
    if (!searchContext || !state) return;
    const { playerIndex, slotIndex, purpose } = searchContext;
    const player = state.players[playerIndex];
    const poke = player.pokemon[slotIndex];
    poke.dexNo = dexNo;
    saveState();
    closeSearchOverlay();

    if (purpose === "edit_change") {
      openEditOverlay(playerIndex);
    } else {
      renderActiveScreen();
    }
  }

  /* ---------- Move help ---------- */

  function openMoveHelpOverlay(moveName) {
    if (!moveName) return;
    const rolls = DataService.getMoveEffect(moveName);
    if (!rolls) return;
    $("move-help-title").textContent = moveName;
    $("move-help-list").innerHTML = rolls.map((text, i) =>
      '<div class="move-help-item"><span class="roll-num">' + (i + 1) + 'の目</span><span>' + escapeHtml(text) + "</span></div>"
    ).join("");
    $("overlay-move-help").classList.add("active");
    $("overlay-move-help").setAttribute("aria-hidden", "false");
  }

  function closeMoveHelpOverlay() {
    $("overlay-move-help").classList.remove("active");
    $("overlay-move-help").setAttribute("aria-hidden", "true");
  }

  /* ---------- Dialogs & navigation ---------- */

  function initDialogs() {
    $("dialog-yes").addEventListener("click", () => {
      const cb = confirmCallback;
      closeConfirm();
      if (cb) cb();
    });
    $("dialog-no").addEventListener("click", closeConfirm);
    $("dialog-confirm").querySelector(".dialog-backdrop").addEventListener("click", closeConfirm);

    function exitGame() {
      showConfirm("ゲームを終了しますか？", () => {
        clearState();
        state = null;
        showScreen("screen-start");
      });
    }
    $("btn-exit").addEventListener("click", exitGame);
    $("btn-exit-personal").addEventListener("click", exitGame);

    $("btn-close-search").addEventListener("click", closeSearchOverlay);
    $("btn-search-back-types").addEventListener("click", showTypeList);
    $("search-pokemon").addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSearchOverlay();
    });

    $("btn-edit-back").addEventListener("click", closeEditOverlay);
    $("btn-move-help-back").addEventListener("click", closeMoveHelpOverlay);
  }

  function initNavigation() {
    const backLabel = CONFIG.backButtonLabel || "戻る";
    ["btn-back-bottles", "btn-back-count", "btn-back-names"].forEach((id) => {
      const el = $(id);
      if (el) el.textContent = backLabel;
    });

    bindActionButton($("btn-back-bottles"), () => showScreen("screen-start"));
    bindActionButton($("btn-back-count"), () => showScreen("screen-bottles"));
    bindActionButton($("btn-back-names"), () => {
      showScreen(setupMode === "personal" ? "screen-bottles" : "screen-count");
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
    if (saved && saved.players && saved.players.length >= 1) {
      state = saved;
      playerCount = state.playerCount;
      bottles = state.bottles;
      setupMode = state.mode || "versus";
      renderActiveScreen();
    } else {
      showScreen("screen-start");
    }

    ["btn-back-bottles", "btn-back-count", "btn-back-names"].forEach((id) => {
      const el = $(id);
      if (el) el.hidden = true;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
