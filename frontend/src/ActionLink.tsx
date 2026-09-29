import type { ComponentProps } from "react";
import Link from "./Link";
import { actionClassName, type ActionStyle } from "./Button";

export default function ActionLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & ActionStyle) {
  return <Link {...props} className={actionClassName({ variant, size, className: ["button-link", className].filter(Boolean).join(" ") })} />;
}
