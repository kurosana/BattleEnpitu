/**
 * バトエンツール - 設定ファイル
 */
const CONFIG = {
  appTitle: "バトエンツール",

  appVersion: "v3.0.0",
  appReleaseNotes: "",

  startButtonLabel: "スタート",
  personalModeButtonLabel: "個人管理モード",

  creditLines: [
    "使用しているドット絵は転寝みるくさん(@komori541milk)からお借りしています。",
    "使用しているゲームの著作権及び商標権、その他知的財産権は、当該コンテンツの発信元に帰属します",
  ],

  bottleCountHeading: "1人何本で遊びますか？",
  playerCountHeading: "何人で遊びますか？",
  namesHeading: "名前を入力",
  personalNamesHeading: "名前を入力",
  backButtonLabel: "戻る",
  gameStartButtonLabel: "ゲームスタート！",

  playerNameMaxLength: 20,

  hpInitial: 100,
  hpMin: 0,
  hpMax: 100,
  hpStep: 10,

  unassignedPokemonName: "画像をタップ！",

  eraserButtonLabel: "消",

  statusConditions: [
    "まひ",
    "ねむり",
    "こんらん",
    "どく",
    "やけど",
    "やどりぎ",
    "きゅうしょ",
    "キャップしんか",
    "ぶんしん",
  ],

  searchResultLimit: 100,
  touchThresholdPx: 15,

  storageKey: "batoen_game_state_v2",

  imageFolder: "Image",
  questionImage: "question.png",
  iconFolder: "Image/icon",
  typeIconFolder: "Image/Type",
  dataFolder: "Data",

  moveIcon: "waza.png",
  evolveIcon: "evolve.png",
  statusIcons: {
    ねむり: "asleep_icon.png",
    やけど: "burned_Icon.png",
    まひ: "paralyzed_icon.png",
    どく: "poisoned_icon.png",
    こんらん: "confused_icon.png",
    やどりぎ: "yadorigi_icon.png",
    きゅうしょ: "critical_icon.png",
    ぶんしん: "bunsin_icon.png",
  },

  symbolMap: { C: "●", S: "★" },

  typeIcons: {
    ほのお: "fire.png",
    みず: "water.png",
    くさ: "grass.png",
    でんき: "electric.png",
    じめん: "ground.png",
    エスパー: "psychic.png",
    どく: "poison.png",
    ひこう: "flying.png",
    むし: "bug.png",
    ノーマル: "normal.png",
  },
};
