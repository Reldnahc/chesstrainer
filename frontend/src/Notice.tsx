import type { ReactNode } from "react";
import "./notice.css";

type NoticeProps = {
  children: ReactNode;
  announcement: "alert" | "status" | "passive";
  tone?: "info" | "success" | "error";
  appearance?: "panel" | "inline";
  actions?: ReactNode;
  className?: string;
};

/** Announcement is explicit: saved history must not become a fresh alert. */
export default function Notice({ children, announcement, tone = "info", appearance = "panel", actions, className }: NoticeProps) {
  return <div
    className={["notice", `notice--${appearance}`, className].filter(Boolean).join(" ")}
    data-tone={tone}
    role={announcement === "passive" ? undefined : announcement}
    aria-atomic={announcement === "passive" ? undefined : true}
  >
    <div className="notice-content">{children}</div>
    {actions && <div className="notice-actions">{actions}</div>}
  </div>;
}
