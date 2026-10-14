import type { ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./Button";
import "./notice.css";

type NoticeProps = {
  children: ReactNode;
  announcement: "alert" | "status" | "passive";
  tone?: "info" | "success" | "error";
  appearance?: "panel" | "inline" | "banner";
  actions?: ReactNode;
  /** Adds a close button, kept on the message's row even when the actions wrap below. */
  onDismiss?: () => void;
  className?: string;
};

/** Announcement is explicit: saved history must not become a fresh alert. */
export default function Notice({ children, announcement, tone = "info", appearance = "panel", actions, onDismiss, className }: NoticeProps) {
  return <div
    className={["notice", `notice--${appearance}`, className].filter(Boolean).join(" ")}
    data-tone={tone}
    role={announcement === "passive" ? undefined : announcement}
    aria-atomic={announcement === "passive" ? undefined : true}
  >
    <div className="notice-content">{children}</div>
    {actions && <div className="notice-actions">{actions}</div>}
    {onDismiss && <IconButton variant="quiet" size="compact" className="notice-dismiss" aria-label="Dismiss" onClick={onDismiss}>
      <X size={16} />
    </IconButton>}
  </div>;
}
