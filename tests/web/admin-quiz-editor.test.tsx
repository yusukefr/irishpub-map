import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminQuizQuestion } from "../../apps/web/app/lib/quiz/types";
import { AdminQuizEditor } from "../../apps/web/app/components/admin-quiz-editor";
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const fetchMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.stubGlobal("fetch", fetchMock);
const question: AdminQuizQuestion = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  category: "history",
  specialDate: { month: 3, day: 17 },
  correctChoiceId: "choice-1",
  sourceUrl: "https://example.com/source",
  relatedContentId: null,
  isPublished: false,
  translations: {
    ja: { question: "問題", explanation: "解説", sourceLabel: "出典" },
    en: { question: "Question", explanation: "Explanation", sourceLabel: "Source" },
  },
  choices: [1, 2, 3, 4].map((number, sortOrder) => ({
    id: "choice-" + number,
    sortOrder,
    translations: { ja: "選択肢" + number, en: "Choice " + number },
  })),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const guides = [
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    kind: "guide" as const,
    slug: "guide",
    category: "culture" as const,
    status: "draft" as const,
    titleJa: "関連Guide",
    titleEn: "Related Guide",
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    publishedAt: null,
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
});
describe("AdminQuizEditor", () => {
  it("renders bilingual fields, guide selection, and prevents deleting the correct choice", () => {
    render(<AdminQuizEditor initialQuestion={question} relatedGuides={guides} databaseConfigured locale="ja" />);
    expect(screen.getByRole("heading", { name: "Quizを編集" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /関連Guide/ })).toBeInTheDocument();
    const choices = screen.getByRole("group", { name: "選択肢" });
    expect(within(choices).getAllByRole("textbox")).toHaveLength(12);
    const correctChoice = within(choices).getAllByLabelText("Choice ID")[0];
    expect(correctChoice).toHaveValue("choice-1");
    expect(within(choices).getAllByRole("button", { name: "選択肢を削除" })[0]).toBeDisabled();
  });
  it("adds, reorders, and removes choices and includes no sortOrder in the save payload", async () => {
    render(<AdminQuizEditor initialQuestion={null} relatedGuides={guides} databaseConfigured locale="ja" />);
    expect(screen.queryByRole("textbox", { name: /Question ID/ })).not.toBeInTheDocument();
    const choices = screen.getByRole("group", { name: "選択肢" });
    fireEvent.click(within(choices).getByRole("button", { name: "選択肢を追加" }));
    fireEvent.click(within(choices).getByRole("button", { name: "選択肢を追加" }));
    expect(within(choices).getAllByRole("textbox")).toHaveLength(6);
    fireEvent.click(within(choices).getAllByRole("button", { name: "上へ" })[1]);
    fireEvent.click(within(choices).getAllByRole("button", { name: "選択肢を削除" })[0]);
    const created = {
      ...question,
      id: "550e8400-e29b-41d4-a716-446655440015",
      choices: [],
      category: null,
      correctChoiceId: null,
      sourceUrl: null,
      isPublished: false,
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ question: created }), { status: 201 }));
    fireEvent.submit(screen.getByRole("button", { name: "下書きを保存" }).closest("form")!);
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith("/admin/quiz/550e8400-e29b-41d4-a716-446655440015"),
    );
    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(payload).not.toHaveProperty("id");
    expect(payload.choices).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ sortOrder: expect.anything() })]),
    );
  });
  it("publishes only after saving and uses the confirmation dialog", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ publication: { id: question.id, isPublished: true, unchanged: false } })),
    );
    render(<AdminQuizEditor initialQuestion={question} relatedGuides={guides} databaseConfigured locale="ja" />);
    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Quizを公開しました。");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/quiz/550e8400-e29b-41d4-a716-446655440010/publication",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
  it("disables editing when the database is unavailable", () => {
    render(
      <AdminQuizEditor initialQuestion={question} relatedGuides={guides} databaseConfigured={false} locale="ja" />,
    );
    expect(screen.getByText("データベース未設定のため保存できません。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "公開する" })).toBeDisabled();
  });

  it("updates root fields, translations, and choice fields", () => {
    render(<AdminQuizEditor initialQuestion={null} relatedGuides={guides} databaseConfigured locale="ja" />);
    const comboboxes = screen.getAllByRole("combobox");
    fireEvent.change(comboboxes[0], { target: { value: "history" } });
    fireEvent.change(comboboxes[1], { target: { value: guides[0].id } });
    fireEvent.change(comboboxes[2], { target: { value: "2" } });
    fireEvent.change(comboboxes[3], { target: { value: "29" } });
    fireEvent.change(comboboxes[3], { target: { value: "" } });
    fireEvent.change(screen.getAllByLabelText("問題文")[0], { target: { value: "新しい問題" } });
    fireEvent.change(screen.getAllByLabelText("解説")[1], { target: { value: "New explanation" } });
    fireEvent.change(screen.getAllByLabelText("情報源ラベル")[0], { target: { value: "新しい出典" } });
    const choices = screen.getByRole("group", { name: "選択肢" });
    for (let index = 0; index < 4; index += 1)
      fireEvent.click(within(choices).getByRole("button", { name: "選択肢を追加" }));
    fireEvent.change(within(choices).getAllByLabelText("Choice ID")[0], { target: { value: "answer-1" } });
    fireEvent.change(within(choices).getAllByLabelText("Choiceラベル（日本語）")[0], { target: { value: "正解" } });
    fireEvent.change(within(choices).getAllByLabelText("Choiceラベル（英語）")[0], { target: { value: "Answer" } });
    fireEvent.change(screen.getAllByRole("combobox")[4], { target: { value: "answer-1" } });
    expect(within(choices).getAllByLabelText("Choice ID")[0]).toHaveValue("answer-1");
  });

  it("shows server validation feedback and handles a failed request", async () => {
    render(<AdminQuizEditor initialQuestion={null} relatedGuides={guides} databaseConfigured locale="ja" />);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errorCode: "validation_error",
          fieldErrors: {},
          missingFields: ["category"],
        }),
        { status: 422 },
      ),
    );
    fireEvent.submit(screen.getByRole("button", { name: "下書きを保存" }).closest("form")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText(/公開前に入力してください: カテゴリー/)).not.toHaveLength(0);
    fetchMock.mockRejectedValueOnce(new Error("network"));
    fireEvent.submit(screen.getByRole("button", { name: "下書きを保存" }).closest("form")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("returns a published question to draft", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const publishedQuestion = { ...question, isPublished: true };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ publication: { id: question.id, isPublished: false, unchanged: false } }), {
        status: 200,
      }),
    );
    render(
      <AdminQuizEditor initialQuestion={publishedQuestion} relatedGuides={guides} databaseConfigured locale="ja" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "下書きに戻す" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Quizを下書きに戻しました。");
  });

  it("keeps the publication state unchanged when confirmation is cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AdminQuizEditor initialQuestion={question} relatedGuides={guides} databaseConfigured locale="ja" />);
    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a publication API error and missing fields", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ errorCode: "publication_requirements_not_met", missingFields: ["category"] }), {
        status: 422,
      }),
    );
    render(<AdminQuizEditor initialQuestion={question} relatedGuides={guides} databaseConfigured locale="ja" />);
    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    expect(await screen.findByText("Quizが公開条件を満たしていません。")).toBeInTheDocument();
    expect(screen.getAllByText(/公開前に入力してください: カテゴリー/)).not.toHaveLength(0);
  });

  it("saves an existing question with PUT", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ question }), { status: 200 }));
    render(<AdminQuizEditor initialQuestion={question} relatedGuides={guides} databaseConfigured locale="ja" />);
    fireEvent.change(screen.getAllByLabelText("問題文")[0], { target: { value: "更新した問題" } });
    fireEvent.click(screen.getByRole("button", { name: "下書きを保存" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/quiz/550e8400-e29b-41d4-a716-446655440010",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("offers the correct number of days and resets an invalid day when the month changes", () => {
    render(<AdminQuizEditor initialQuestion={question} relatedGuides={guides} databaseConfigured locale="ja" />);
    const dateSelects = screen.getAllByRole("combobox");
    fireEvent.change(dateSelects[3], { target: { value: "31" } });
    fireEvent.change(dateSelects[2], { target: { value: "2" } });
    expect(dateSelects[3]).toHaveValue("29");
    expect(within(dateSelects[3]).getByRole("option", { name: "29" })).toBeInTheDocument();
    fireEvent.change(dateSelects[2], { target: { value: "4" } });
    expect(within(dateSelects[3]).getByRole("option", { name: "30" })).toBeInTheDocument();
    expect(within(dateSelects[3]).queryByRole("option", { name: "31" })).not.toBeInTheDocument();
    fireEvent.change(dateSelects[2], { target: { value: "10" } });
    expect(within(dateSelects[3]).getByRole("option", { name: "31" })).toBeInTheDocument();
  });

  it("generates an unused choice ID after a choice is deleted", () => {
    render(<AdminQuizEditor initialQuestion={question} relatedGuides={guides} databaseConfigured locale="ja" />);
    const choices = screen.getByRole("group", { name: "選択肢" });
    fireEvent.click(within(choices).getAllByRole("button", { name: "選択肢を削除" })[1]);
    fireEvent.click(within(choices).getByRole("button", { name: "選択肢を追加" }));
    expect(within(choices).getAllByLabelText("Choice ID")).toHaveLength(4);
    expect(within(choices).getAllByLabelText("Choice ID")[3]).toHaveValue("choice-2");
  });
});
