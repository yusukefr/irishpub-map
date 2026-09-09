import type { ComponentPropsWithRef, ReactNode } from "react";
import styles from "./ui.module.css";

/** 操作の重要度を表す共通variantです。 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
/** native buttonの属性・refを保持し、通信中の連打を防ぐ設定です。 */
export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
};

/**
 * ラベルの幅を保ったまま処理中状態を示す44px以上の操作ボタンです。
 * @param {ButtonProps} props - native属性、重要度、処理中状態。
 * @returns 共通ボタン。
 */
export function Button({
  variant = "primary",
  loading = false,
  loadingLabel,
  disabled,
  type = "button",
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <>
      <button
        {...props}
        type={type}
        className={`${styles.button} ${styles[variant]} ${className}`}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
      >
        <span className={styles.buttonLabel}>{children}</span>
        {loading ? (
          <span className={styles.busy} aria-hidden="true">
            …
          </span>
        ) : null}
      </button>
      {loading && loadingLabel ? (
        <span className={styles.visuallyHidden} role="status">
          {loadingLabel}
        </span>
      ) : null}
    </>
  );
}

/** Iconのみの操作にはラベルを必須とします。 */
export type IconButtonProps = Omit<ButtonProps, "children" | "aria-label"> & {
  label: string;
  children: ReactNode;
};

/**
 * accessible nameと共通アイコン寸法を備えた操作です。
 * @param {IconButtonProps} props - 読み上げラベル、装飾アイコン、button属性。
 * @returns Icon button。
 */
export function IconButton({ label, children, variant = "ghost", className = "", ...props }: IconButtonProps) {
  return (
    <Button
      {...props}
      variant={variant}
      aria-label={label}
      title={props.title ?? label}
      className={`${styles.iconButton} ${className}`}
    >
      <span className={styles.icon} aria-hidden="true">
        {children}
      </span>
    </Button>
  );
}
