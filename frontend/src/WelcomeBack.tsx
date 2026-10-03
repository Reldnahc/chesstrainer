import { X } from "lucide-react";
import { useEffect, useState } from "react";
import ActionLink from "./ActionLink";
import { api, read } from "./api";
import { IconButton } from "./Button";
import { pagePaths } from "./navigation";
import Notice from "./Notice";

// Polling pauses after a week away; on return the learner may need older games.
export default function WelcomeBack() {
  const [awaySince, setAwaySince] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    read(api.GET("/api/welcome-back"))
      .then(value => { if (active) setAwaySince(value.away_since ?? null); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!awaySince) return null;
  async function dismiss() {
    setAwaySince(null);
    await read(api.POST("/api/welcome-back/dismiss")).catch(() => undefined);
  }
  const since = new Date(awaySince).toLocaleDateString(undefined, { month: "long", day: "numeric" });
  return (
    <Notice
      announcement="status"
      className="welcome-back"
      actions={<IconButton variant="quiet" aria-label="Dismiss welcome back" onClick={() => void dismiss()}>
        <X size={18} />
      </IconButton>}
    >
      <p><strong>Welcome back!</strong> New-game checks were paused while you were away (since {since}) and are running again.
        If any games are missing, import older games.</p>
      <p><ActionLink variant="secondary" size="compact" href={pagePaths.Settings} onClick={() => void dismiss()}>Import older games</ActionLink></p>
    </Notice>
  );
}
