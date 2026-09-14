import { describe, expect, it } from "vitest";
import { QUIZ_CATEGORY_DEFINITIONS } from "../../apps/web/app/lib/quiz/categories";
import { QUIZ_CATEGORIES } from "../../apps/web/app/lib/quiz/types";

describe("quiz category definitions", () => {
  it("covers every allowed category exactly once with complete labels", () => {
    expect(Object.keys(QUIZ_CATEGORY_DEFINITIONS).sort()).toEqual([...QUIZ_CATEGORIES].sort());

    for (const category of QUIZ_CATEGORIES) {
      const definition = QUIZ_CATEGORY_DEFINITIONS[category];
      expect(definition.icon.trim()).not.toBe("");
      expect(definition.label.ja.trim()).not.toBe("");
      expect(definition.label.en.trim()).not.toBe("");
    }
  });
});
