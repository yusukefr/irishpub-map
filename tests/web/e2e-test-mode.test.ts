import { afterEach, describe, expect, it } from "vitest";
import {
  E2E_TEST_DATA,
  getE2EAdminContentList,
  getE2EAdminQuizList,
  getE2EAdminPub,
  getE2EAdminPubPage,
  getE2EAdminTags,
  getE2EPublishedContentBySlug,
  getE2EPublishedContentList,
  getE2EPublishedPubs,
  getE2EPublishedQuizQuestions,
  gradeE2EPublishedQuizAnswer,
} from "../../apps/web/app/lib/e2e-test-fixtures";
import { isDataSourceConfigured, isE2ETestMode, rejectE2ETestMutation } from "../../apps/web/app/lib/e2e-test-mode";
import { isUuid } from "@irishpub-map/shared/uuid";

const originalE2EMode = process.env.E2E_TEST_MODE;
const originalVercelEnv = process.env.VERCEL_ENV;
const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  restoreEnvironment("E2E_TEST_MODE", originalE2EMode);
  restoreEnvironment("VERCEL_ENV", originalVercelEnv);
  restoreEnvironment("DATABASE_URL", originalDatabaseUrl);
});

describe("E2E test mode", () => {
  it("returns stable localized fixtures without a database", () => {
    process.env.E2E_TEST_MODE = "1";
    delete process.env.DATABASE_URL;

    expect(isE2ETestMode()).toBe(true);
    expect(isDataSourceConfigured()).toBe(true);
    expect(getE2EPublishedPubs("ja").map((pub) => pub.name)).toEqual(["E2E Irish Pub Nagoya", "E2E Irish Pub Tokyo"]);
    expect(getE2EAdminPubPage({ statusKey: "open", page: 1 }, "en")).toMatchObject({ total: 2, page: 1 });
    expect(getE2EAdminPub("30000000-0000-4000-8000-000000000001")?.translations.en?.address).toContain("Nagoya");
    expect(getE2EAdminTags()).toHaveLength(2);
  });

  it("keeps fixture IDs, locales, and publication state production-shaped", () => {
    const fixedIds = [
      ...Object.values(E2E_TEST_DATA.content).map(({ id }) => id),
      ...Object.values(E2E_TEST_DATA.pubs).map(({ id }) => id),
      ...Object.values(E2E_TEST_DATA.tags).map(({ id }) => id),
      ...Object.values(E2E_TEST_DATA.media).map(({ id }) => id),
    ];
    expect(fixedIds.every(isUuid)).toBe(true);

    const contents = getE2EAdminContentList();
    expect(contents.map((content) => content.status).sort()).toEqual(["draft", "published"]);
    for (const content of contents) {
      expect(content.publishedAt === null).toBe(content.status === "draft");
    }
    expect(getE2EPublishedContentList("guide", "ja").map(({ title }) => title)).toEqual([
      "Split the Gを楽しむ",
      "サンプルガイド",
    ]);
    expect(getE2EPublishedContentList("guide", "en").map(({ title }) => title)).toEqual([
      "How to Enjoy Split the G",
      "Sample Guide",
    ]);

    const adminQuiz = getE2EAdminQuizList();
    expect(adminQuiz.map((question) => question.isPublished).sort()).toEqual([false, true]);
    expect(getE2EPublishedQuizQuestions("ja").map(({ question }) => question)).toEqual(["E2E 公開Quiz"]);
    expect(getE2EPublishedQuizQuestions("en").map(({ question }) => question)).toEqual(["E2E Published Quiz"]);
    expect(adminQuiz.every((question) => isUuid(question.id))).toBe(true);

    const publishedContent = contents.find((content) => content.status === "published");
    const publishedQuiz = adminQuiz.find((question) => question.isPublished);
    expect(publishedContent).toBeDefined();
    expect(publishedQuiz).toBeDefined();
    expect(publishedQuiz?.relatedContentId).toBe(publishedContent?.id);
    expect(publishedContent?.heroImageAssetId).toBe(E2E_TEST_DATA.media.landscape.id);
    expect(publishedQuiz?.imageAssetId).toBe(E2E_TEST_DATA.media.landscape.id);

    const tagIds = new Set(getE2EAdminTags().map((tag) => tag.id));
    for (const pubId of Object.values(E2E_TEST_DATA.pubs).map(({ id }) => id)) {
      const pub = getE2EAdminPub(pubId);
      expect(pub).not.toBeNull();
      expect(pub?.tagIds.every((tagId) => tagIds.has(tagId))).toBe(true);
    }

    for (const locale of ["ja", "en"] as const) {
      const publicQuestion = getE2EPublishedQuizQuestions(locale)[0];
      const answer = gradeE2EPublishedQuizAnswer(publicQuestion.id, publicQuestion.choices[0].id, locale);
      expect(answer.relatedGuide).toBeDefined();
      const relatedGuide = answer.relatedGuide
        ? getE2EPublishedContentBySlug("guide", answer.relatedGuide.slug, locale)
        : null;
      expect(relatedGuide).not.toBeNull();
      expect(answer.relatedGuide?.label).toBe(relatedGuide?.title);
    }
  });

  it("rejects fixture mutations before a database can be used", () => {
    process.env.E2E_TEST_MODE = "1";

    expect(() => rejectE2ETestMutation()).toThrow("Mutations are disabled in E2E test mode.");
  });

  it("fails closed when fixture mode is enabled in Vercel production", () => {
    process.env.E2E_TEST_MODE = "1";
    process.env.VERCEL_ENV = "production";

    expect(() => isE2ETestMode()).toThrow("E2E test mode is not available in production.");
  });

  it("uses the database configuration outside fixture mode", () => {
    delete process.env.E2E_TEST_MODE;
    delete process.env.DATABASE_URL;
    expect(isDataSourceConfigured()).toBe(false);

    process.env.DATABASE_URL = "postgres://test-only";
    expect(isDataSourceConfigured()).toBe(true);
    expect(() => rejectE2ETestMutation()).not.toThrow();
  });
});

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
