/**
 * pokemon.csv / evolve.csv 生成スクリプト（1回実行用）
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const pokemonPath = path.join(ROOT, "Data", "pokemon.csv");

const customerList = `
リザードン●ほのお
イシツブテ★じめん
ピカチュウ●でんき
ナゾノクサ・クサイハナ★くさ
フシギバナ●くさ
コダック★みず
フーディン●エスパー
ニドラン♂★どく
ニドラン♀★どく
カメックス●みず
ポニータ★ほのお
ポッポ●ひこう
トランセル・バタフリー★むし
コラッタ●ノーマル
マンキー★ノーマル
ミニリュウ・ハクリュー●ノーマル
カイリキー★ノーマル
ガルーラ●ノーマル
ニャース★ノーマル
イーブイ●ノーマル
ベロリンガ★ノーマル
ピッピ●ノーマル
ミュウツー●エスパー
アーボック★どく
サンド●じめん
レアコイル★でんき
キャタピー●むし
フリーザー★ひこう
ブーバー●ほのお
コイキング・ギャラドス★みず
サンダー●でんき
モンジャラ★くさ
カモネギ●ひこう
イワーク★じめん
サワムラー★ノーマル
ラッキー●ノーマル
カビゴン★ノーマル
エビワラー●ノーマル
ケンタロス★ノーマル
ワンリキー・ゴーリキー●ノーマル
ナッシー★エスパー
ベトベトン●どく
スピアー★むし
カイリュー●ひこう
エレブー★でんき
カイロス●むし
ファイヤー★ほのお
ウツボット●くさ
ニョロモ・ニョロゾ★みず
プリン●ノーマル
スリープ★エスパー
ゲンガー●どく
オニドリル★ひこう
ビードル・コクーン●むし
ヒトカゲ・リザード★ほのお
ニドクイン●じめん
ビリリダマ★でんき
ゼニガメ・カメール●みず
ニドキング★じめん
メノクラゲ・ドククラゲ●どく
フシギダネ・フシギソウ★くさ
サンドパン●じめん
アーボ★どく
ケーシィ・ユンゲラー●エスパー
ピクシー★ノーマル
オムナイト・オムスター●みず
プテラ★ひこう
カブト・カブトプス●みず
ウインディ●ほのお
トサキント・アズマオウ★みず
パラス・パラセクト●くさ
サイホーン・サイドン★じめん
モルフォン★むし
ライチュウ●でんき
タマタマ★エスパー
ニドリーナ●どく
コイル★でんき
ズバット・ゴルバット●ひこう
パウワウ・ジュゴン★みず
ニドリーノ★どく
スリーパー●エスパー
ラッタ★ノーマル
ミュウ●エスパー
ベトベター★どく
ラフレシア●くさ
ゴローン・ゴローニャ★じめん
キュウコン●ほのお
オコリザル★ノーマル
シェルダー・パルシェン●みず
ゴルダック★みず
ゴース・ゴースト●どく
ヤドン・ヤドラン★エスパー
メタモン●ノーマル
ガーディ★ほのお
ヒトデマン・スターミー●みず
マダツボミ・ウツドン★くさ
ニョロボン●みず
バリヤード★エスパー
ルージュラ●エスパー
ラプラス★みず
コンパン●むし
ピジョン・ピジョット★ひこう
ロコン●ほのお
ギャロップ★ほのお
ドガース・マタドガス●どく
タッツー・シードラ●みず
ポリゴン★ノーマル
ディグダ・ダグトリオ●じめん
ドードー・ドードリオ★ひこう
オニスズメ●ひこう
ストライク★むし
ペルシアン●ノーマル
マルマイン●でんき
プクリン★ノーマル
カラカラ・ガラガラ●じめん
クラブ・キングラー★みず
`.trim();

/** リスト外だがイーブイ進化系として使用（●=イーブイと同じC、タイプは自然系） */
const extraDefaults = {
  シャワーズ: { type: "みず", symbol: "C" },
  サンダース: { type: "でんき", symbol: "C" },
  ブースター: { type: "ほのお", symbol: "C" },
};

function parseEntry(line) {
  const m = line.match(/^(.+?)([●★])(.+)$/);
  if (!m) throw new Error("parse fail: " + line);
  const names = m[1].split("・").map((s) => s.trim());
  const symbol = m[2] === "●" ? "C" : "S";
  const type = m[3].trim();
  return { names, symbol, type };
}

const nameToMeta = {};
const evolvePairs = [];

customerList.split("\n").forEach((line) => {
  const { names, symbol, type } = parseEntry(line.trim());
  names.forEach((name, i) => {
    nameToMeta[name] = { type, symbol };
    if (i > 0) {
      evolvePairs.push([names[i - 1], name]);
    }
  });
});

Object.entries(extraDefaults).forEach(([name, meta]) => {
  if (!nameToMeta[name]) nameToMeta[name] = meta;
});

const lines = fs.readFileSync(pokemonPath, "utf8").replace(/\uFEFF/g, "").split(/\r?\n/).filter(Boolean);
const out = [];
const evolveOut = [];
let listed = 0;
let unlisted = 0;

lines.forEach((line) => {
  const [dex, name] = line.split(",");
  const meta = nameToMeta[name.trim()];
  if (!meta) {
    unlisted++;
    out.push(`${dex},${name},,`);
    return;
  }
  listed++;
  out.push(`${dex},${name},${meta.type},${meta.symbol}`);
});

const nameToDex = {};
out.forEach((line) => {
  const [dex, name] = line.split(",");
  nameToDex[name] = dex;
});

evolvePairs.forEach(([from, to]) => {
  const a = nameToDex[from];
  const b = nameToDex[to];
  if (a && b) evolveOut.push(`${a},${b}`);
});

fs.writeFileSync(pokemonPath, out.join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(ROOT, "Data", "evolve.csv"), evolveOut.join("\n") + "\n", "utf8");
console.log("pokemon:", out.length, "listed:", listed, "unlisted:", unlisted, "evolve:", evolveOut.length);
