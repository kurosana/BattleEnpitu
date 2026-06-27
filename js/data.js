/**
 * データ読み込み・CSV解析・ポケモン検索
 */
const DataService = (function () {
  const BASE = "./";

  let pokemonList = [];
  let evolveMap = {};
  let evolveTargetDexNos = new Set();
  let moveList = [];
  let ready = false;

  function parseCSV(text) {
    const raw = text.replace(/\uFEFF/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = raw.split("\n").filter((l) => l.trim());
    return lines.map((line) => {
      const parts = [];
      let cur = "";
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuote = !inQuote;
        } else if (c === "," && !inQuote) {
          parts.push(cur.trim());
          cur = "";
        } else {
          cur += c;
        }
      }
      parts.push(cur.trim());
      return parts;
    });
  }

  async function fetchText(path) {
    const url = path.startsWith("/") ? path : BASE.replace(/\/?$/, "/") + path;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load: " + path);
    return res.text();
  }

  function symbolToDisplay(code) {
    if (!code) return "";
    return (CONFIG.symbolMap && CONFIG.symbolMap[code]) || code;
  }

  async function loadAll() {
    if (ready) return;

    const dataFolder = CONFIG.dataFolder || "Data";
    const [pokemonCsv, evolveCsv, moveCsv] = await Promise.all([
      fetchText(dataFolder + "/pokemon.csv"),
      fetchText(dataFolder + "/evolve.csv").catch(() => ""),
      fetchText(dataFolder + "/move.csv"),
    ]);

    pokemonList = parseCSV(pokemonCsv)
      .filter((row) => row[0] && row[1])
      .map((row) => ({
        dexNo: String(row[0]).trim(),
        name: row[1].trim(),
        type: (row[2] || "").trim(),
        symbol: (row[3] || "").trim(),
      }));

    evolveMap = {};
    evolveTargetDexNos = new Set();
    if (evolveCsv && evolveCsv.trim()) {
      parseCSV(evolveCsv)
        .filter((row) => row[0] && row[1] && /^\d+$/.test(String(row[0]).trim()))
        .forEach((row) => {
          const from = String(row[0]).trim();
          const to = String(row[1]).trim();
          evolveMap[from] = to;
          evolveTargetDexNos.add(to);
        });
    }

    moveList = parseCSV(moveCsv)
      .filter((row) => row[0])
      .map((row) => ({
        name: row[0].trim(),
        rolls: [row[1] || "", row[2] || "", row[3] || "", row[4] || "", row[5] || "", row[6] || ""],
      }));

    ready = true;
  }

  function toKatakana(str) {
    return str.replace(/[\u3041-\u3096]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 0x60)
    );
  }

  function getPokemonByDexNo(dexNo) {
    if (dexNo == null || dexNo === "") return null;
    const key = String(dexNo).trim();
    return pokemonList.find((p) => p.dexNo === key) || null;
  }

  function getPokemonName(dexNo) {
    const p = getPokemonByDexNo(dexNo);
    return p ? p.name : null;
  }

  function getSymbol(dexNo) {
    const p = getPokemonByDexNo(dexNo);
    return p ? symbolToDisplay(p.symbol) : "";
  }

  function getType(dexNo) {
    const p = getPokemonByDexNo(dexNo);
    return p ? p.type : "";
  }

  function getTypeIconPath(typeName) {
    if (!typeName) return null;
    const file = CONFIG.typeIcons && CONFIG.typeIcons[typeName];
    if (!file) return null;
    const folder = CONFIG.typeIconFolder || "Image/Type";
    return folder + "/" + file;
  }

  function getTypeIconPathByDex(dexNo) {
    return getTypeIconPath(getType(dexNo));
  }

  function isSearchable(p) {
    return Boolean(p.type);
  }

  function getTypeList() {
    const seen = new Set();
    const list = [];
    pokemonList.forEach((p) => {
      if (isSearchable(p) && p.type && !seen.has(p.type)) {
        seen.add(p.type);
        list.push(p.type);
      }
    });
    return list;
  }

  function isEvolveTarget(dexNo) {
    return evolveTargetDexNos.has(String(dexNo).trim());
  }

  function sortSearchResults(list) {
    const base = [];
    const targets = [];
    list.forEach((p) => {
      if (isEvolveTarget(p.dexNo)) targets.push(p);
      else base.push(p);
    });
    return base.concat(targets);
  }

  function searchPokemon(query, typeFilter) {
    const limit = CONFIG.searchResultLimit || 100;
    let list = pokemonList.filter(isSearchable);
    if (typeFilter) {
      list = list.filter((p) => p.type === typeFilter);
    }
    const q = toKatakana((query || "").trim().toLowerCase());
    if (!q) {
      return sortSearchResults(list).slice(0, limit);
    }
    return sortSearchResults(
      list.filter((p) => toKatakana(p.name.toLowerCase()).includes(q))
    ).slice(0, limit);
  }

  function getEvolvedDexNo(dexNo) {
    if (dexNo == null) return null;
    return evolveMap[String(dexNo).trim()] || null;
  }

  function getDisplayDexNo(dexNo, evolved) {
    if (!dexNo) return null;
    if (evolved) {
      const evolvedDex = getEvolvedDexNo(dexNo);
      if (evolvedDex) return evolvedDex;
    }
    return String(dexNo).trim();
  }

  function getMoveList() {
    return moveList.map((m) => m.name);
  }

  function getMoveEffect(moveName) {
    const m = moveList.find((x) => x.name === moveName);
    return m ? m.rolls : null;
  }

  return {
    loadAll,
    getPokemonByDexNo,
    getPokemonName,
    getSymbol,
    getType,
    getTypeIconPath,
    getTypeIconPathByDex,
    getTypeList,
    searchPokemon,
    getEvolvedDexNo,
    getDisplayDexNo,
    getMoveList,
    getMoveEffect,
  };
})();
