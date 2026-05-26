/**
 * データ読み込み・CSV解析・ポケモン検索
 * すべてローカル（同一オリジン）の Data フォルダから fetch します。
 */
const DataService = (function () {
  const BASE = "./";

  let pokemonList = [];
  let evolveMap = {};
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
      }));

    evolveMap = {};
    if (evolveCsv && evolveCsv.trim()) {
      parseCSV(evolveCsv)
        .filter((row) => row[0] && row[1] && /^\d+$/.test(String(row[0]).trim()))
        .forEach((row) => {
          evolveMap[String(row[0]).trim()] = String(row[1]).trim();
        });
    }

    moveList = parseCSV(moveCsv)
      .filter((row) => row[0])
      .map((row) => ({
        name: row[0].trim(),
        rolls: [
          row[1] || "",
          row[2] || "",
          row[3] || "",
          row[4] || "",
          row[5] || "",
          row[6] || "",
        ],
      }));

    ready = true;
  }

  function toKatakana(str) {
    return str.replace(/[\u3041-\u3096]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 0x60)
    );
  }

  function getPokemonList() {
    return pokemonList;
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

  function searchPokemon(query) {
    const limit = CONFIG.searchResultLimit || 100;
    const q = toKatakana((query || "").trim().toLowerCase());
    if (!q) return pokemonList.slice(0, limit);
    return pokemonList
      .filter((p) => toKatakana(p.name.toLowerCase()).includes(q))
      .slice(0, limit);
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
    if (!m) return null;
    return m.rolls;
  }

  function isReady() {
    return ready;
  }

  return {
    loadAll,
    isReady,
    getPokemonList,
    getPokemonByDexNo,
    getPokemonName,
    searchPokemon,
    getEvolvedDexNo,
    getDisplayDexNo,
    getMoveList,
    getMoveEffect,
  };
})();
