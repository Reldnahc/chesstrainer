import { createContext, useContext } from "react";
import type { Schema } from "./api";

// The signed-in account and its session commands. This module has no UI, so
// preference hooks and the development tools can read the account without
// pulling in the sign-in screens (AccountGate provides these contexts).

export type Account = Schema["Account"];
export type AccountSession = {
  user: Account;
  logout: (all?: boolean) => Promise<void>;
  busy: boolean;
  error: string;
};

export const AccountContext = createContext<AccountSession | null>(null);
// A signed-out visitor opening a shared game link; the value opens sign-in.
export const GuestContext = createContext<(() => void) | null>(null);

export const useAccount = () => useContext(AccountContext)?.user ?? null;
export const useAccountSession = () => useContext(AccountContext);
export const useGuestSignIn = () => useContext(GuestContext);
export const useGuest = () => !!useContext(GuestContext);

/** Whether this reader manages the server (courses, server settings): an
 * administrator, or the single user of a local install without accounts. It
 * follows the server's own rule, so a member never asks for an admin page. */
export function useAdministrator(): boolean {
  const account = useAccount();
  const guest = useGuest();
  return account ? !!account.admin : !guest;
}
