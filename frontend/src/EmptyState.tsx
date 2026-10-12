import type { ReactNode } from "react";
import "./empty-state.css";

export default function EmptyState({ title, children, icon, actions, presentation = "section" }: {
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  presentation?: "section" | "compact";
}) {
  const Container = presentation === "section" ? "section" : "div";
  return <Container className={`empty-state empty-state--${presentation}${presentation === "section" ? " panel" : ""}`}>
    {icon && <span className="empty-state-icon" aria-hidden="true">{icon}</span>}
    <div className="empty-state-content">
      {(title || children) && <div className="empty-state-text">
        {title && (presentation === "section" ? <h2>{title}</h2> : <strong>{title}</strong>)}
        {children && <p>{children}</p>}
      </div>}
      {actions && <div className="empty-state-actions">{actions}</div>}
    </div>
  </Container>;
}
