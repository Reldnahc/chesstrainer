import { useState } from "react";
import { useAccountSession } from "./accountContext";
import Banner from "./Banner";
import Button from "./Button";
import ChangePasswordForm from "./ChangePasswordForm";
import SettingsSection from "./SettingsSection";
import { CommandError } from "./useQuery";

/** Settings, Account section, for a signed-in member: who they are, signing out, and
 * their password. Results are page banners, like the rest of Settings. */
export default function AccountSettings() {
  const session = useAccountSession();
  const [changed, setChanged] = useState(false);
  if (!session) return null;
  const { user, logout, busy, error, dismissError } = session;
  return (
    <>
      <CommandError command={{ error, dismiss: dismissError }} />
      {changed && (
        <Banner tone="success" onDismiss={() => setChanged(false)}>
          Password changed. Your other devices are signed out.
        </Banner>
      )}
      <SettingsSection id="account-settings" title="Account" className="account-settings">
        <p>
          Signed in as <strong>{user.username}</strong>
        </p>
        <div className="account-actions">
          <Button disabled={busy} onClick={() => logout()}>
            Sign out
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => logout(true)}>
            Sign out all devices
          </Button>
        </div>
      </SettingsSection>
      <SettingsSection
        id="password-settings"
        title="Password"
        description="Change the password you sign in with."
      >
        <ChangePasswordForm onChanged={() => setChanged(true)} />
      </SettingsSection>
    </>
  );
}
