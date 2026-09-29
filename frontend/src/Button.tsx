import type { ComponentPropsWithRef } from "react";
import "./action-controls.css";

export type ActionStyle = {
  variant?: "default" | "primary" | "secondary" | "quiet" | "return";
  size?: "ordinary" | "compact";
  className?: string;
};

export function actionClassName({ variant = "default", size = "ordinary", className }: ActionStyle) {
  return ["action-control", `action-control--${variant}`, `action-control--${size}`, className].filter(Boolean).join(" ");
}

export type ButtonProps = ComponentPropsWithRef<"button"> & ActionStyle;

export default function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button {...props} type={type} className={actionClassName({ variant, size, className })} />;
}

export function IconButton({ className, ...props }: ButtonProps & { "aria-label": string }) {
  return <Button {...props} className={["action-control--icon", className].filter(Boolean).join(" ")} />;
}
