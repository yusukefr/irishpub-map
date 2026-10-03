import { z } from "zod";

// OpenAPI の GET response で必須の情報を検証し、Tool Result には検証済みフィールドだけを残す。
const uuid = z.uuid();
const dateTime = z.iso.datetime({ offset: true });
const nullableDateTime = dateTime.nullable();
const prefectureCode = z.number().int().min(1).max(47);
const municipalityCode = z.string().regex(/^\d{6}$/);
const status = z.enum(["open", "temporarily_closed", "closed", "unknown"]);
const contentKind = z.enum(["story", "guide"]).nullable();
const contentCategory = z.enum(["history", "culture", "pub-culture", "food-drink"]).nullable();
const contentStatus = z.enum(["draft", "published"]);
const quizCategory = z
  .enum([
    "ireland-basics",
    "pub-guinness",
    "irish-whiskey",
    "irish-music",
    "irish-sports",
    "literature",
    "myth-folklore",
    "history",
  ])
  .nullable();
const specialDate = z
  .object({ month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) })
  .nullable();
const mediaAsset = z
  .object({
    id: uuid,
    url: z.string(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    width: z.number().int(),
    height: z.number().int(),
    fileSize: z.number().int(),
    createdAt: dateTime,
  })
  .strict();

export const prefecturesResponse = z
  .object({
    prefectures: z.array(z.object({ code: prefectureCode, name: z.string() }).strict()),
  })
  .strict();
export const municipalitiesResponse = z.object({
  municipalities: z.array(z.object({ code: municipalityCode, prefectureCode, name: z.string() }).strict()),
});
export const tagsResponse = z.object({
  tags: z.array(
    z.object({
      id: uuid,
      key: z
        .string()
        .max(64)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      translations: z.object({ ja: z.string().max(100), en: z.string().max(100).optional() }),
      pubCount: z.number().int().min(0),
    }),
  ),
});
export const statusesResponse = z.object({
  statuses: z.array(z.object({ code: z.number().int(), key: status, name: z.string() }).strict()),
});

const contentBase = z.object({
  id: uuid,
  kind: contentKind,
  slug: z.string().nullable(),
  category: contentCategory,
  status: contentStatus,
  publishedAt: nullableDateTime,
  createdAt: dateTime,
  updatedAt: dateTime,
});
export const contentListResponse = z.object({
  content: z.array(contentBase.extend({ titleJa: z.string(), titleEn: z.string() })),
  databaseConfigured: z.boolean(),
});
const contentTranslation = z
  .object({
    title: z.string().max(200),
    summary: z.string().max(500),
    bodyMarkdown: z.string().max(100_000),
    heroImageAlt: z.string().max(500),
    heroImageCaption: z.string().max(1000),
  })
  .strict();
export const contentResponse = z.object({
  content: contentBase
    .extend({
      slug: z
        .string()
        .max(100)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .nullable(),
      heroImageAssetId: uuid.nullable(),
      heroImage: mediaAsset.nullable(),
      translations: z.object({ ja: contentTranslation, en: contentTranslation }).strict(),
    })
    .strict(),
});

const quizBase = z.object({
  id: z.string().max(100),
  category: quizCategory,
  specialDate,
  correctChoiceId: z.string().max(60).nullable(),
  sourceUrl: z
    .url()
    .regex(/^https:\/\//i)
    .nullable(),
  relatedContentId: uuid.nullable(),
  imageAssetId: uuid.nullable(),
  isPublished: z.boolean(),
  createdAt: dateTime,
  updatedAt: dateTime,
});
export const quizListResponse = z.object({
  questions: z.array(
    quizBase.extend({ questionJa: z.string(), questionEn: z.string(), choiceCount: z.number().int().min(0).max(4) }),
  ),
});
const quizTranslation = z.object({
  question: z.string(),
  explanation: z.string(),
  sourceLabel: z.string(),
  imageAlt: z.string().max(500),
  imageCaption: z.string().max(1000),
});
export const quizResponse = z.object({
  question: quizBase.extend({
    image: mediaAsset.nullable(),
    translations: z.object({ ja: quizTranslation, en: quizTranslation }),
    choices: z
      .array(
        z.object({
          id: z
            .string()
            .max(60)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          sortOrder: z.number().int().min(0),
          translations: z.object({ ja: z.string(), en: z.string() }),
        }),
      )
      .max(4),
  }),
});

const pubListItem = z.object({
  id: uuid,
  name: z.string(),
  kana: z.string().nullable(),
  prefecture: z.string().nullable(),
  city: z.string().nullable(),
  municipalityCode: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  websiteUrl: z.string().nullable(),
  googleMapsUrl: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  tags: z.array(z.string()),
  tagDisplayNames: z.record(z.string(), z.string()),
  status: z.string().nullable(),
  prefectureCode: z.number().int().nullable(),
  statusCode: z.number().int().nullable(),
  statusDisplayName: z.string().nullable(),
  tagItems: z.array(z.object({ id: uuid, key: z.string(), name: z.string() })),
  isPublished: z.boolean(),
  updatedAt: dateTime,
});
export const pubListResponse = z.object({
  pubs: z.array(pubListItem),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.literal(50),
  databaseConfigured: z.boolean(),
});
const pubTranslation = z.object({
  name: z.string(),
  nameReading: z.string().nullable(),
  address: z.string().nullable(),
});
const pubUrl = z
  .url()
  .regex(/^https?:\/\//i)
  .nullable();
export const pubResponse = z.object({
  pub: z
    .object({
      id: uuid,
      isPublished: z.boolean(),
      prefectureCode: prefectureCode.nullable(),
      municipalityCode: municipalityCode.nullable(),
      latitude: z.number().min(-90).max(90).nullable(),
      longitude: z.number().min(-180).max(180).nullable(),
      websiteUrl: pubUrl,
      googleMapsUrl: pubUrl,
      instagramUrl: pubUrl,
      status: status.nullable(),
      translations: z.object({ ja: pubTranslation, en: pubTranslation.nullable() }),
      tagIds: z.array(uuid),
      updatedAt: dateTime,
    })
    .strict(),
});
