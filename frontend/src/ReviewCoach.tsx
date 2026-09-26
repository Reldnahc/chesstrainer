import type { ReactNode } from "react";

// Both review modes use these fixed slots. Long explanations scroll inside the
// bubble, so new feedback never moves the actions or the surrounding board.
export default function ReviewCoach({ title, badge, children, actions }: {
  title: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  actions: ReactNode;
}) {
  return <section className="review-coach" aria-label="Chess coach">
    <CoachAvatar />
    <div className="coach-speech">
      <div className="coach-label">{title}{badge}</div>
      <div className="coach-message" tabIndex={0} aria-label="Coach explanation">{children}</div>
      <div className="coach-actions">{actions}</div>
    </div>
  </section>;
}

function CoachAvatar() {
  return <svg className="coach-avatar" viewBox="0 0 80 100" role="img" aria-label="Your chess coach">
    <path d="M9 100V82Q10 65 30 65H50Q70 65 71 82V100" fill="#5d7770" />
    <path d="m29 67 11 15 11-15-3-9H32Z" fill="#edb38a" />
    <ellipse cx="40" cy="39" rx="24" ry="29" fill="#f2c5a0" />
    <path d="M16 37Q8 5 35 6Q67 0 65 39L57 29Q43 33 29 19L22 38Z" fill="#dad4ca" />
    <path d="M20 52Q40 73 60 52Q54 77 40 74Q24 72 20 52" fill="#dad4ca" />
    <g fill="none" stroke="#393c42" strokeWidth="2.5"><rect x="23" y="35" width="14" height="11" rx="4"/><rect x="43" y="35" width="14" height="11" rx="4"/><path d="M37 39h6M33 55q7 6 14 0"/></g>
    <circle cx="30" cy="40" r="1.5" fill="#393c42"/><circle cx="50" cy="40" r="1.5" fill="#393c42"/>
    <path d="m27 70 13 12-9 10-10-19m32-3L40 82l9 10 10-19" fill="#849e94"/>
  </svg>;
}
