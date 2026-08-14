export type PubStatus = "open" | "temporarily_closed" | "closed" | "unknown";

export type Pub = {
  id: string;
  name: string;
  kana?: string;
  prefecture: string;
  city?: string;
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

    return item;
  });
}

function isPub(value: unknown): value is Pub {
  if (!value || typeof value !== "object") {
    return false;
  }

  const pub = value as Partial<Pub>;

  return (
    typeof pub.id === "string" &&
    typeof pub.name === "string" &&
    isOptionalString(pub.kana) &&
    typeof pub.prefecture === "string" &&
    typeof pub.address === "string" &&
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
  return value === undefined || typeof value === "string";
}

function isOptionalUrl(value: unknown) {
  return value === undefined || value === null || typeof value === "string";
}

function isLatitude(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isLongitude(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}
