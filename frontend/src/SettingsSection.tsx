import type { ReactNode } from "react";

export default function SettingsSection({
  id, title, description, actions, className = "", children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`panel settings-section ${className}`} aria-labelledby={`${id}-title`}>
      <div className="settings-section-heading">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
