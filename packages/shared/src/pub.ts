export type PubStatus = "open" | "temporarily_closed" | "closed" | "unknown";

export type Pub = {
  id: string;
  name: string;
  kana?: string | null;
  prefecture: string;
  city?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  websiteUrl?: string | null;
  googleMapsUrl?: string | null;
  instagramUrl?: string | null;
  tags: string[];
  status: PubStatus;
};

/** 未検証の値を店舗配列として検証し、重複IDを含む不正データを拒否します。 */
export function asPubs(value: unknown): Pub[] {
  if (!Array.isArray(value)) {
    throw new Error("Pub data must be an array.");
  }

  const ids = new Set<string>();

  return value.map((item) => {
    if (!isPub(item) || ids.has(item.id)) {
      throw new Error("Invalid pub data found.");
    }

    ids.add(item.id);

    return normalizePub(item);
  });
}

function isPub(value: unknown): value is Pub {
  if (!value || typeof value !== "object") {
    return false;
  }

  const pub = value as Partial<Pub>;

  return (
    isPubId(pub.id) &&
    isNonEmptyString(pub.name) &&
    isOptionalString(pub.kana) &&
    isNonEmptyString(pub.prefecture) &&
    isNonEmptyString(pub.address) &&
    isOptionalString(pub.city) &&
    isLatitude(pub.latitude) &&
    isLongitude(pub.longitude) &&
    isOptionalUrl(pub.websiteUrl) &&
    isOptionalUrl(pub.googleMapsUrl) &&
    isOptionalUrl(pub.instagramUrl) &&
    Array.isArray(pub.tags) &&
    pub.tags.every((tag) => typeof tag === "string") &&
    isPubStatus(pub.status)
  );
}

function isPubStatus(value: unknown): value is PubStatus {
  return value === "open" || value === "temporarily_closed" || value === "closed" || value === "unknown";
}

function isOptionalString(value: unknown) {
  return value === undefined || value === null || typeof value === "string";
}

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalUrl(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && (value.trim() === "" || /^https?:\/\//i.test(value.trim())))
  );
}

function isLatitude(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isLongitude(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 店舗 ID が RFC 4122 の UUID 形式かを判定します。 */
function normalizePub(pub: Pub): Pub {
  return {
    ...pub,
    kana: normalizeOptionalText(pub.kana),
    city: normalizeOptionalText(pub.city),
    websiteUrl: normalizeOptionalUrl(pub.websiteUrl),
    googleMapsUrl: normalizeOptionalUrl(pub.googleMapsUrl),
    instagramUrl: normalizeOptionalUrl(pub.instagramUrl),
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

function normalizeOptionalUrl(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim() : value;
  return normalized || null;
}
export function isPubId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
