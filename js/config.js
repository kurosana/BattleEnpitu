/**
 * バトエンツール - 設定ファイル
 * メンテナンス時はこのファイルだけ編集すれば多くの表示・挙動を変更できます。
 */
const CONFIG = {
  /** アプリタイトル（ヘッダー等に表示） */
  appTitle: "バトエンツール",

  /** スタート画面のボタン文言 */
  startButtonLabel: "スタート",

  /** スタート画面下部のクレジット・著作権表記 */
  creditLines: [
    "使用しているドット絵は転寝みるくさん(@komori541milk)からお借りしています。",
    "使用しているゲームの著作権及び商標権、その他知的財産権は、当該コンテンツの発信元に帰属します",
  ],

  /** 人数選択画面の見出し */
  playerCountHeading: "何人で遊びますか？",

  /** 名前入力画面のボタン文言 */
  gameStartButtonLabel: "ゲームスタート！",

  /** プレイヤー名の最大文字数 */
  playerNameMaxLength: 20,

  /** HPの初期値・最小・最大・変動幅 */
  hpInitial: 100,
  hpMin: 0,
  hpMax: 100,
  hpStep: 10,

  /** 未設定ポケモンの表示名 */
  unassignedPokemonName: "？？？？？",

  /** 消しゴムボタンの表示 */
  eraserButtonLabel: "消",

  /** 状態異常の一覧（ボタン表示順） */
  statusConditions: [
    "まひ",
    "ねむり",
    "こんらん",
    "どく",
    "やけど",
    "やどりぎ",
    "きゅうしょ",
  ],

  /** 状態異常ポップアップの見出し */
  statusPopupTitle: "状態異常を選択",

  /** 検索結果の最大件数 */
  searchResultLimit: 100,

  /** タッチ操作とスクロールを区別する距離（px） */
  touchThresholdPx: 15,

  /** localStorage のキー名 */
  storageKey: "batoen_game_state",

  /** 画像フォルダ（末尾スラッシュなし） */
  imageFolder: "Image",

  /** 未設定時の画像ファイル名 */
  questionImage: "question.png",

  /** CSV フォルダ */
  dataFolder: "Data",
};
