/** 管理画面で選択肢として扱う都道府県マスタです。 */
export type PrefectureOption = {
  code: number;
  name: string;
};

/** 都道府県との所属関係を保持した市区町村マスタです。 */
export type MunicipalityOption = {
  code: string;
  prefectureCode: number;
  name: string;
};

/** DB上のUUIDと内部キーを表示名から分離したタグマスタです。 */
export type TagOption = {
  id: string;
  key: string;
  name: string;
};

/** DB上のコードと内部キーを表示名から分離した営業ステータスマスタです。 */
export type PubStatusOption = {
  code: number;
  key: string;
  name: string;
};
