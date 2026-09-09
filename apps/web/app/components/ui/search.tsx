"use client";

import { useRef } from "react";
import { Input, type InputProps } from "./input";
import { IconButton } from "./button";
import { Icon } from "./ui-icon";
import styles from "./ui.module.css";

/** 検索ロジックを親へ委ねるcontrolled入力です。 */
export type SearchProps = Omit<
  InputProps,
  "type" | "value" | "defaultValue" | "onChange" | "ref" | "leading" | "trailing"
> & {
  value: string;
  onValueChange: (value: string) => void;
  clearLabel: string;
};

/**
 * 検索とclearを共通化し、clear後も入力を続けられるようfocusを戻します。
 * @param {SearchProps} props - 検索文字列、変更通知、日英の操作ラベル。
 * @returns 検索欄。
 */
export function Search({ value, onValueChange, clearLabel, hideLabel = true, ...props }: SearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.search}>
      <Input
        {...props}
        hideLabel={hideLabel}
        type="search"
        ref={inputRef}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        leading={
          <span className={styles.searchIcon}>
            <Icon name="search" />
          </span>
        }
        trailing={
          value ? (
            <IconButton
              label={clearLabel}
              disabled={props.disabled || props.readOnly}
              className={styles.searchClear}
              onClick={() => {
                onValueChange("");
                inputRef.current?.focus();
              }}
            >
              <Icon name="close" />
            </IconButton>
          ) : null
        }
      />
    </div>
  );
}
