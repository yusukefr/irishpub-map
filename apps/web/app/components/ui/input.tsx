"use client";

import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import styles from "./ui.module.css";

/** ラベル・エラーの関連付けを共通化する入力設定です。 */
export type InputProps = ComponentPropsWithRef<"input"> & {
  label: string;
  error?: string;
  hideLabel?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
};

/**
 * SSRでも一意なIDを使い、説明とエラーを入力へ関連付けます。
 * @param {InputProps} props - 入力属性、必須ラベル、任意のエラー。
 * @returns ラベルとエラー付き入力。
 */
export function Input({
  label,
  error,
  hideLabel = false,
  leading,
  trailing,
  id,
  className = "",
  "aria-describedby": descriptionId,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={hideLabel ? styles.visuallyHidden : styles.label}>
        {label}
      </label>
      <div className={styles.inputControl}>
        {leading}
        <input
          {...props}
          id={inputId}
          className={`${styles.input} ${className}`}
          aria-invalid={error ? true : props["aria-invalid"]}
          aria-describedby={[descriptionId, error ? errorId : null].filter(Boolean).join(" ") || undefined}
        />
        {trailing}
      </div>
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
