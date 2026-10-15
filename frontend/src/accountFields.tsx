import type { InputHTMLAttributes } from "react";

// The server's account rules, in one place for every form that asks for them.
export const USERNAME_RULES = { minLength: 3, maxLength: 32, pattern: "[a-zA-Z0-9_-]+" } as const;
export const PASSWORD_RULES = { minLength: 10, maxLength: 128 } as const;

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "minLength" | "maxLength" | "pattern">;

/** An account username: letters, digits, hyphen and underscore. */
export function UsernameInput(props: InputProps) {
  return <input autoComplete="off" required {...USERNAME_RULES} {...props} />;
}

/** A password being chosen (sign-up, a new or temporary password). */
export function NewPasswordInput(props: InputProps) {
  return <input type="password" autoComplete="new-password" required {...PASSWORD_RULES} {...props} />;
}
