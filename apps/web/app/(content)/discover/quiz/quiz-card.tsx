"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import type { QuizAnswerResult } from "../../../lib/quiz/types";
import { submitQuizAnswer } from "./actions";

/** 回答前にClient Componentへ渡してよいLocale別の公開問題です。 */
export type QuizQuestionView = Readonly<{
  id: string;
  category: Readonly<{ icon: string; label: string }>;
  question: string;
  choices: readonly Readonly<{ id: string; label: string }>[];
}>;

/** 回答UIと採点結果に使用するLocale別の文言です。 */
export type QuizLabels = Readonly<{
  questionLabel: string;
  chooseAnswer: string;
  submitAnswer: string;
  submitting: string;
  answered: string;
  correct: string;
  incorrect: string;
  correctChoiceState: string;
  incorrectChoiceState: string;
  correctAnswer: string;
  explanationHeading: string;
  source: string;
  answerError: string;
}>;

type QuizCardProps = Readonly<{ question: QuizQuestionView; labels: QuizLabels }>;

function choiceLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/**
 * 公開問題だけを受け取り、Server Actionの結果が返った後に正解と解説を表示します。
 * @param {QuizCardProps} props Locale別の公開問題とUI文言。
 * @returns {JSX.Element} 一度だけ回答できる4択クイズ。
 */
export function QuizCard({ question, labels }: QuizCardProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string>();
  const [result, setResult] = useState<QuizAnswerResult>();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const isAnswered = result !== undefined;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChoiceId || isAnswered || isPending) return;

    setError(undefined);
    startTransition(async () => {
      try {
        setResult(await submitQuizAnswer(question.id, selectedChoiceId));
      } catch {
        setError(labels.answerError);
      }
    });
  };

  return (
    <section className="quiz-card" aria-labelledby="quiz-question-heading">
      <p className="quiz-category">
        <span aria-hidden="true">{question.category.icon}</span>
        {question.category.label}
      </p>
      <h2 id="quiz-question-heading">
        <span aria-hidden="true">Q. </span>
        <span className="visually-hidden">{labels.questionLabel}: </span>
        {question.question}
      </h2>

      <form className="quiz-form" onSubmit={handleSubmit}>
        <fieldset disabled={isAnswered || isPending}>
          <legend>{labels.chooseAnswer}</legend>
          <div className="quiz-choices">
            {question.choices.map((choice, index) => {
              const isCorrectChoice = result?.correctChoiceId === choice.id;
              const isSelectedIncorrect =
                result?.status === "incorrect" && selectedChoiceId === choice.id && !isCorrectChoice;

              return (
                <label
                  className={[
                    "quiz-choice",
                    isCorrectChoice ? "quiz-choice-correct" : "",
                    isSelectedIncorrect ? "quiz-choice-incorrect" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={choice.id}
                >
                  <input
                    type="radio"
                    name={"answer-" + question.id}
                    value={choice.id}
                    checked={selectedChoiceId === choice.id}
                    onChange={() => setSelectedChoiceId(choice.id)}
                  />
                  <span className="quiz-choice-letter" aria-hidden="true">
                    {choiceLetter(index)}
                  </span>
                  <span>{choice.label}</span>
                  {isCorrectChoice ? (
                    <span className="quiz-choice-state">{labels.correctChoiceState}</span>
                  ) : isSelectedIncorrect ? (
                    <span className="quiz-choice-state">{labels.incorrectChoiceState}</span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </fieldset>

        <button className="quiz-submit" type="submit" disabled={!selectedChoiceId || isAnswered || isPending}>
          {isAnswered ? labels.answered : isPending ? labels.submitting : labels.submitAnswer}
        </button>
      </form>

      {error ? (
        <p className="quiz-answer-error" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <section
          className={"quiz-result quiz-result-" + result.status}
          aria-labelledby="quiz-result-heading"
          role="status"
        >
          <h3 id="quiz-result-heading">{result.status === "correct" ? labels.correct : labels.incorrect}</h3>
          <p>
            {labels.correctAnswer}: <strong>{result.correctChoiceLabel}</strong>
          </p>
          <h4>{labels.explanationHeading}</h4>
          <p>{result.explanation}</p>
          <a href={result.source.url} target="_blank" rel="noreferrer">
            {labels.source}: {result.source.label}
          </a>
          {result.relatedGuide ? (
            <Link className="quiz-related-guide" href={"/discover/guides/" + result.relatedGuide.slug}>
              {result.relatedGuide.label} →
            </Link>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
