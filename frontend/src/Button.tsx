import type { ComponentPropsWithRef } from "react";
import "./action-controls.css";

export type ActionStyle = {
  variant?: "default" | "primary" | "secondary" | "quiet" | "return";
  size?: "ordinary" | "compact" | "dense" | "toolbar";
  /** The notation's mono type, for move (SAN) buttons. */
  mono?: boolean;
  /** Label and trailing icon at opposite ends of a full-width Button. */
  spread?: boolean;
  className?: string;
};

export function actionClassName({ variant = "default", size = "ordinary", mono, spread, className }: ActionStyle) {
  return ["action-control", `action-control--${variant}`, `action-control--${size}`, mono && "action-control--mono",
    spread && "action-control--spread", className].filter(Boolean).join(" ");
}

export type ButtonProps = ComponentPropsWithRef<"button"> & ActionStyle;

export default function Button({ variant, size, mono, spread, className, type = "button", ...props }: ButtonProps) {
  return <button {...props} type={type} className={actionClassName({ variant, size, mono, spread, className })} />;
}

export function IconButton({ className, ...props }: ButtonProps & { "aria-label": string }) {
  return <Button {...props} className={["action-control--icon", className].filter(Boolean).join(" ")} />;
}
