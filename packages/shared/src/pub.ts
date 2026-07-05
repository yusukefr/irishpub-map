export type PubStatus = "open" | "temporarily_closed" | "closed" | "unknown";

export type Pub = {
  id: string;
  name: string;
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

export function asPubs(value: unknown): Pub[] {
  if (!Array.isArray(value)) {
    throw new Error("Pub data must be an array.");
  }

  return value.map((item) => {
    if (!isPub(item)) {
      throw new Error("Invalid pub data found.");
    }

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
    typeof pub.prefecture === "string" &&
    typeof pub.address === "string" &&
    typeof pub.latitude === "number" &&
    typeof pub.longitude === "number" &&
    Array.isArray(pub.tags) &&
    pub.tags.every((tag) => typeof tag === "string") &&
    isPubStatus(pub.status)
  );
}

function isPubStatus(value: unknown): value is PubStatus {
  return value === "open" || value === "temporarily_closed" || value === "closed" || value === "unknown";
}
