import type { ComponentProps, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import Link from "./Link";
import "./resume-link.css";

type ResumeLinkProps = ComponentProps<typeof Link> & {
  children: ReactNode;
  description: ReactNode;
};

export default function ResumeLink({ children, description, className, ...props }: ResumeLinkProps) {
  return <Link {...props} className={["study-resume", className].filter(Boolean).join(" ")}>
    <span>{children}<small>{description}</small></span>
    <ArrowRight size={18} aria-hidden="true" />
  </Link>;
}
