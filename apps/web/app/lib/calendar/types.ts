/** カレンダーが対応するイベント分類です。 */
export type CalendarCategory =
  "public_holiday" | "culture" | "tradition" | "language" | "literature" | "history" | "religion";

/** 曜日をJavaScriptの`getUTCDay()`と同じ0（日曜）〜6（土曜）で表します。 */
export type CalendarWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** タイムゾーンを持たない暦上の日付です。 */
export type CalendarDate = Readonly<{ year: number; month: number; day: number }>;

/** 日英の表示文言です。 */
export type CalendarLocalizedText = Readonly<{ ja: string; en: string }>;

type MonthDay = Readonly<{ month: number; day: number }>;

/** 毎年同じ月日に発生するルールです。 */
export type FixedDateRule = Readonly<{ type: "fixed"; month: number; day: number }>;
/** 開始月日から終了月日までを含む期間ルールです。 */
export type DateRangeRule = Readonly<{ type: "date_range"; start: MonthDay; end: MonthDay }>;
/** 指定月の第N曜日を選ぶルールです。 */
export type NthWeekdayRule = Readonly<{
  type: "nth_weekday";
  month: number;
  weekday: CalendarWeekday;
  nth: number;
}>;
/** 指定月の最後の曜日を選ぶルールです。 */
export type LastWeekdayRule = Readonly<{
  type: "last_weekday";
  month: number;
  weekday: CalendarWeekday;
}>;
/** 復活祭からの日数差で指定するルールです。 */
export type RelativeToEasterRule = Readonly<{ type: "relative_to_easter"; offsetDays: number }>;
/** 基準日当日以降の最初の指定曜日を選ぶルールです。 */
export type WeekdayOnOrAfterRule = Readonly<{
  type: "weekday_on_or_after";
  month: number;
  day: number;
  weekday: CalendarWeekday;
}>;
/** 基準日に最も近い指定曜日を選ぶルールです。 */
export type ClosestWeekdayRule = Readonly<{
  type: "closest_weekday_to_date";
  month: number;
  day: number;
  weekday: CalendarWeekday;
}>;

/** 条件ルールから選択できる、具体日へ解決可能な単一日ルールです。 */
export type ConcreteSingleDateRule =
  FixedDateRule | NthWeekdayRule | LastWeekdayRule | RelativeToEasterRule | WeekdayOnOrAfterRule | ClosestWeekdayRule;

/** 条件ルールの適用可否を判定する条件です。 */
export type RuleSetCondition =
  | Readonly<{
      type: "fixed_date_weekday";
      month: number;
      day: number;
      weekday: CalendarWeekday;
    }>
  | Readonly<{ type: "otherwise" }>;

/** JSON記載順で最初に成立した条件のルールを使います。 */
export type RuleSetDateRule = Readonly<{
  type: "rule_set";
  rules: readonly Readonly<{ when: RuleSetCondition; use: ConcreteSingleDateRule }>[];
}>;

/** 開催月の目安だけが分かり、年ごとの公式発表を必要とするルールです。 */
export type AnnualVariableRule = Readonly<{
  type: "annual_variable";
  usualMonth: number;
  requiresOfficialConfirmation: boolean;
}>;

/** JSONで利用できる全日付ルールです。 */
export type CalendarDateRule = ConcreteSingleDateRule | DateRangeRule | RuleSetDateRule | AnnualVariableRule;

/** 検証済みのイベントです。 */
export type CalendarEvent = Readonly<{
  id: string;
  name: CalendarLocalizedText;
  date: CalendarDateRule;
  category: CalendarCategory;
  isPublicHoliday: boolean;
  featured: boolean;
  description: CalendarLocalizedText;
  aliases?: readonly string[];
  source?: string;
}>;

/** 検証済みのカレンダーデータ全体です。 */
export type CalendarData = Readonly<{
  schemaVersion: 1;
  country: "IE";
  scope: string;
  categories: Readonly<Record<CalendarCategory, CalendarLocalizedText>>;
  dateRuleTypes: readonly CalendarDateRule["type"][];
  events: readonly CalendarEvent[];
}>;

/** 具体的な開始日と終了日を持つ解決結果です。 */
export type ResolvedCalendarDate = Readonly<{
  status: "resolved";
  start: CalendarDate;
  end: CalendarDate;
}>;

/** 公式発表まで具体日を持たない解決結果です。 */
export type UnresolvedCalendarDate = Readonly<{
  status: "unresolved";
  usualMonth: number;
  requiresOfficialConfirmation: boolean;
}>;

/** 日付ルールの解決結果です。 */
export type CalendarDateResolution = ResolvedCalendarDate | UnresolvedCalendarDate;

/** イベントと解決済み・未解決の日付を組み合わせた検索結果です。 */
export type CalendarEventOccurrence = Readonly<{ event: CalendarEvent; date: CalendarDateResolution }>;
