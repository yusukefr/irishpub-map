/** 都道府県コード・表示名・カナを、JISコード順で定義します。 */
export const PREFECTURES = [
  { code: 1, name: "北海道", kana: "ﾎｯｶｲﾄﾞｳ" },
  { code: 2, name: "青森県", kana: "ｱｵﾓﾘｹﾝ" },
  { code: 3, name: "岩手県", kana: "ｲﾜﾃｹﾝ" },
  { code: 4, name: "宮城県", kana: "ﾐﾔｷﾞｹﾝ" },
  { code: 5, name: "秋田県", kana: "ｱｷﾀｹﾝ" },
  { code: 6, name: "山形県", kana: "ﾔﾏｶﾞﾀｹﾝ" },
  { code: 7, name: "福島県", kana: "ﾌｸｼﾏｹﾝ" },
  { code: 8, name: "茨城県", kana: "ｲﾊﾞﾗｷｹﾝ" },
  { code: 9, name: "栃木県", kana: "ﾄﾁｷﾞｹﾝ" },
  { code: 10, name: "群馬県", kana: "ｸﾞﾝﾏｹﾝ" },
  { code: 11, name: "埼玉県", kana: "ｻｲﾀﾏｹﾝ" },
  { code: 12, name: "千葉県", kana: "ﾁﾊﾞｹﾝ" },
  { code: 13, name: "東京都", kana: "ﾄｳｷｮｳﾄ" },
  { code: 14, name: "神奈川県", kana: "ｶﾅｶﾞﾜｹﾝ" },
  { code: 15, name: "新潟県", kana: "ﾆｲｶﾞﾀｹﾝ" },
  { code: 16, name: "富山県", kana: "ﾄﾔﾏｹﾝ" },
  { code: 17, name: "石川県", kana: "ｲｼｶﾜｹﾝ" },
  { code: 18, name: "福井県", kana: "ﾌｸｲｹﾝ" },
  { code: 19, name: "山梨県", kana: "ﾔﾏﾅｼｹﾝ" },
  { code: 20, name: "長野県", kana: "ﾅｶﾞﾉｹﾝ" },
  { code: 21, name: "岐阜県", kana: "ｷﾞﾌｹﾝ" },
  { code: 22, name: "静岡県", kana: "ｼｽﾞｵｶｹﾝ" },
  { code: 23, name: "愛知県", kana: "ｱｲﾁｹﾝ" },
  { code: 24, name: "三重県", kana: "ﾐｴｹﾝ" },
  { code: 25, name: "滋賀県", kana: "ｼｶﾞｹﾝ" },
  { code: 26, name: "京都府", kana: "ｷｮｳﾄﾌ" },
  { code: 27, name: "大阪府", kana: "ｵｵｻｶﾌ" },
  { code: 28, name: "兵庫県", kana: "ﾋｮｳｺﾞｹﾝ" },
  { code: 29, name: "奈良県", kana: "ﾅﾗｹﾝ" },
  { code: 30, name: "和歌山県", kana: "ﾜｶﾔﾏｹﾝ" },
  { code: 31, name: "鳥取県", kana: "ﾄｯﾄﾘｹﾝ" },
  { code: 32, name: "島根県", kana: "ｼﾏﾈｹﾝ" },
  { code: 33, name: "岡山県", kana: "ｵｶﾔﾏｹﾝ" },
  { code: 34, name: "広島県", kana: "ﾋﾛｼﾏｹﾝ" },
  { code: 35, name: "山口県", kana: "ﾔﾏｸﾞﾁｹﾝ" },
  { code: 36, name: "徳島県", kana: "ﾄｸｼﾏｹﾝ" },
  { code: 37, name: "香川県", kana: "ｶｶﾞﾜｹﾝ" },
  { code: 38, name: "愛媛県", kana: "ｴﾋﾒｹﾝ" },
  { code: 39, name: "高知県", kana: "ｺｳﾁｹﾝ" },
  { code: 40, name: "福岡県", kana: "ﾌｸｵｶｹﾝ" },
  { code: 41, name: "佐賀県", kana: "ｻｶﾞｹﾝ" },
  { code: 42, name: "長崎県", kana: "ﾅｶﾞｻｷｹﾝ" },
  { code: 43, name: "熊本県", kana: "ｸﾏﾓﾄｹﾝ" },
  { code: 44, name: "大分県", kana: "ｵｵｲﾀｹﾝ" },
  { code: 45, name: "宮崎県", kana: "ﾐﾔｻﾞｷｹﾝ" },
  { code: 46, name: "鹿児島県", kana: "ｶｺﾞｼﾏｹﾝ" },
  { code: 47, name: "沖縄県", kana: "ｵｷﾅﾜｹﾝ" },
] as const;

/**
 * 都道府県名から正規化スキーマ用のコードを取得します。
 * @param {string} name - 都道府県の表示名。
 * @returns {number | undefined} 対応するJISコード。
 */
export function getPrefectureCode(name: string) {
  return PREFECTURES.find((prefecture) => prefecture.name === name)?.code;
}

/**
 * 正規化スキーマ用の都道府県コードから表示名を取得します。
 * @param {number} code - JIS都道府県コード。
 * @returns {string | undefined} 対応する都道府県名。
 */
export function getPrefectureName(code: number) {
  return PREFECTURES.find((prefecture) => prefecture.code === code)?.name;
}
