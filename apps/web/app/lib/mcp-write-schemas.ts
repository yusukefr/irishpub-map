import { z } from "zod";
import { parseAdminPubAddress, parseAdminPubUrl } from "@irishpub-map/shared/admin-pub";
import { contentResponse, pubResponse, quizResponse, tagsResponse } from "./mcp-read-schemas";

// OpenAPI の Write input だけを通し、GET に含まれる server-managed field は受け付けない。
const uuid = z.uuid();
const slug = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const contentTranslation = z
  .object({
    title: z.string().max(200),
    summary: z.string().max(500),
    bodyMarkdown: z.string().max(100_000),
    heroImageAlt: z.string().max(500),
    heroImageCaption: z.string().max(1000),
  })
  .strict();

export const contentWrite = z
  .object({
    kind: z.enum(["story", "guide"]).nullable(),
    slug: slug.nullable(),
    category: z.enum(["history", "culture", "pub-culture", "food-drink"]).nullable(),
    heroImageAssetId: uuid.nullable(),
    translations: z.object({ ja: contentTranslation, en: contentTranslation }).strict(),
  })
  .strict();

export const contentPublicationInput = z.object({ status: z.enum(["draft", "published"]) }).strict();
export const contentCreateResponse = contentResponse.extend({
  content: contentResponse.shape.content.extend({ status: z.literal("draft"), publishedAt: z.null() }),
});
export const contentPublicationResponse = z
  .object({
    publication: z
      .object({
        id: uuid,
        status: z.enum(["draft", "published"]),
        unchanged: z.boolean(),
        publishedAt: z.iso.datetime({ offset: true }).nullable(),
      })
      .strict(),
  })
  .strict();

const quizTranslation = z
  .object({
    question: z.string().optional(),
    explanation: z.string().optional(),
    sourceLabel: z.string().optional(),
    imageAlt: z.string().max(500).optional(),
    imageCaption: z.string().max(1000).optional(),
  })
  .strict();
const choice = z
  .object({
    id: z
      .string()
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    translations: z.object({ ja: z.string().optional(), en: z.string().optional() }).strict().optional(),
  })
  .strict();

export const quizWrite = z
  .object({
    category: z
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
      .nullable()
      .optional(),
    specialDate: z
      .object({ month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) })
      .strict()
      .nullable()
      .optional(),
    correctChoiceId: z.string().max(60).nullable().optional(),
    sourceUrl: z
      .url()
      .regex(/^https:\/\//i)
      .nullable()
      .optional(),
    relatedContentId: uuid.nullable().optional(),
    imageAssetId: uuid.nullable().optional(),
    translations: z.object({ ja: quizTranslation.optional(), en: quizTranslation.optional() }).strict().optional(),
    choices: z.array(choice).max(4).optional(),
  })
  .strict();

export const quizPublicationInput = z.object({ isPublished: z.boolean() }).strict();
export const quizCreateResponse = quizResponse.extend({
  question: quizResponse.shape.question.extend({ isPublished: z.literal(false) }),
});
export const quizPublicationResponse = z
  .object({ publication: z.object({ id: uuid, isPublished: z.boolean(), unchanged: z.boolean() }).strict() })
  .strict();

const pubRequiredText = z.string().trim().min(1);
const pubAddress = z
  .string()
  .nullable()
  .superRefine((value, context) => {
    if (value === null) return;
    const result = parseAdminPubAddress(value);
    if (result.error) context.addIssue({ code: "custom", message: result.error });
  });
const pubRequiredAddress = z.string().superRefine((value, context) => {
  const result = parseAdminPubAddress(value, true);
  if (result.error) context.addIssue({ code: "custom", message: result.error });
});
const pubTranslation = z
  .object({ name: pubRequiredText, nameReading: z.string().nullable(), address: pubAddress })
  .strict();
const pubEnglishTranslation = pubTranslation.extend({ address: pubRequiredAddress });
const pubUrl = (field: "websiteUrl" | "googleMapsUrl" | "instagramUrl") =>
  z
    .string()
    .nullable()
    .superRefine((value, context) => {
      const result = parseAdminPubUrl(value, field);
      if (result.error) context.addIssue({ code: "custom", message: result.error });
    });
export const pubWrite = z
  .object({
    prefectureCode: z.number().int().min(1).max(47).nullable(),
    municipalityCode: z
      .string()
      .regex(/^\d{6}$/)
      .nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    websiteUrl: pubUrl("websiteUrl"),
    googleMapsUrl: pubUrl("googleMapsUrl"),
    instagramUrl: pubUrl("instagramUrl"),
    status: z.enum(["open", "temporarily_closed", "closed", "unknown"]).nullable(),
    pubType: z.enum(["irish", "british", "other", "unclassified"]).nullable(),
    translations: z.object({ ja: pubTranslation, en: pubEnglishTranslation.nullable() }).strict(),
    tagIds: z.array(uuid).refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();
export const pubCreateResponse = pubResponse.extend({
  pub: pubResponse.shape.pub.extend({ isPublished: z.literal(false) }),
});
export const pubPublicationInput = z.object({ isPublished: z.boolean() }).strict();
export const pubPublicationResponse = z
  .object({ publication: z.object({ id: uuid, isPublished: z.boolean(), unchanged: z.boolean() }).strict() })
  .strict();

export const tagWrite = z
  .object({
    key: z
      .string()
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    translations: z.object({ ja: z.string().trim().min(1).max(100), en: z.string().max(100).optional() }).strict(),
  })
  .strict();
export const tagResponse = z.object({ tag: tagsResponse.shape.tags.element }).strict();

export const idempotencyKey = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[^\s\x00-\x1f\x7f](?:[^\x00-\x1f\x7f]*[^\s\x00-\x1f\x7f])?$/);
