import { ClerkProvider, useClerk, useSignIn, useSignUp } from "@clerk/react";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { LoadingSkeleton } from "./LoadingSkeleton.js";
import {
  clerkEnabled,
  clerkPublishableKey,
  installClerkRuntime,
} from "../services/clerkAuth.js";
const ReadyContext = createContext(false);
export function useAuthReady() {
  const ready = useContext(ReadyContext);
  return !clerkEnabled || ready;
}
export function AuthReady({ children }: { children: ReactNode }) {
  const ready = useAuthReady();
  return ready ? (
    children
  ) : (
    <main className="cr-loading">
      <LoadingSkeleton label="Loading sign-in" rows={5} />
    </main>
  );
}
function Bridge({ children }: { children: ReactNode }) {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    if (clerk.loaded && signIn && signUp) {
      installClerkRuntime({ clerk, signIn, signUp });
      setReady(true);
    }
  }, [clerk, clerk.loaded, clerk.user?.id, clerk.session?.id, signIn, signUp]);
  // Public discovery renders immediately. Only account/auth routes wait for Clerk.
  return (
    <ReadyContext.Provider value={ready}>{children}</ReadyContext.Provider>
  );
}
export function ClerkRoot({ children }: { children: ReactNode }) {
  return clerkEnabled ? (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      signInUrl="/login"
      signUpUrl="/signup"
    >
      <Bridge>{children}</Bridge>
    </ClerkProvider>
  ) : (
    children
  );
}
