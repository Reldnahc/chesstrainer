import type { ReactNode } from "react";
import "./load-state.css";

type LoadStateProps = {
  children: ReactNode;
  presentation?: "compact" | "panel";
  heading?: ReactNode;
  actions?: ReactNode;
};

function LoadState({ children, presentation = "compact", heading, actions, unavailable }: LoadStateProps & { unavailable?: boolean }) {
  return <section className={`load-state load-state--${presentation}${presentation === "panel" ? " panel" : ""}`}>
    {heading}
    <p className="load-state-message" role={unavailable ? "alert" : "status"} aria-atomic="true">{children}</p>
    {actions && <div className="load-state-actions">{actions}</div>}
  </section>;
}

/** A pending content area; callers keep request and cancellation ownership. */
export function LoadingState(props: LoadStateProps) {
  return <LoadState {...props} />;
}

/** An unavailable content area with caller-owned recovery commands or links. */
export function UnavailableState(props: LoadStateProps) {
  return <LoadState {...props} unavailable />;
}
