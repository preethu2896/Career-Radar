import { useEffect, useState } from "react";
import { getSession } from "../services/auth.js";
import { useSiteAccount } from "./SiteHeader.js";
import { LoadingSkeleton } from "./LoadingSkeleton.js";
import "./profileSettings.css";
import "./assistantConnections.css";
import "./personalWorkspace.css";

async function request<T>(
  userId: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const session = await getSession({ validate: true });
  if (!session || session.user.id !== userId)
    throw Error("Sign in again to continue.");
  const response = await fetch("/api/assistant" + path, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: "Bearer " + session.access_token,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const value = await response.json();
  if (!response.ok)
    throw Error(
      value.error === "request_expired"
        ? "This connection request expired. Start again from your assistant."
        : value.error === "login_required"
          ? "Sign in again to continue."
          : "Assistant connections are unavailable. Please try again later.",
    );
  return value;
}
type Connection = {
  id: string;
  client_name: string;
  created_at: string;
  expires_at: string;
};
export function ConnectedAssistants({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Connection[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    void request<{ connections: Connection[] }>(userId, "?action=connections")
      .then((v) => {
        if (active) setRows(v.connections);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [userId, revision]);
  const disconnect = async (id: string) => {
    setBusy(id);
    setError("");
    try {
      await request(userId, "", { action: "disconnect", connection_id: id });
      setRows((v) => v?.filter((c) => c.id !== id) ?? null);
      setRevision((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="cr-profile-section" id="settings-assistants">
      <h2>Connected assistants</h2>
      <p>
        Manage the AI apps you have authorised to use CareerRadar. Disconnecting
        stops their CareerRadar access.
      </p>
      {error ? (
        <>
          <p className="cr-error" role="alert">
            {error}
          </p>
          <button
            className="auth-secondary"
            onClick={() => setRevision((n) => n + 1)}
          >
            Try again
          </button>
        </>
      ) : !rows ? (
        <LoadingSkeleton label="Loading assistant connections" rows={2} />
      ) : !rows.length ? (
        <p>No assistants connected.</p>
      ) : (
        rows.map((c) => (
          <div key={c.id} className="cr-assistant-connection">
            <div>
              <strong>{c.client_name}</strong>
              <p className="sf-hint">
                Connected {new Date(c.created_at).toLocaleDateString()} ·
                Catalogue read access
              </p>
            </div>
            <button
              className="auth-secondary"
              disabled={Boolean(busy)}
              onClick={() => void disconnect(c.id)}
            >
              {busy === c.id ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        ))
      )}
      <a href="/connect" className="cr-personal-link">
        How to connect an assistant
      </a>
    </section>
  );
}
function Approval({ userId }: { userId: string }) {
  const id = new URLSearchParams(window.location.search).get("request") ?? "";
  const [data, setData] = useState<{
      client_name: string;
      redirect_uri: string;
      expires_at: string;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void request<typeof data>(
      userId,
      "?action=pending&request=" + encodeURIComponent(id),
    )
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [userId, id]);
  const decide = async (action: "approve" | "deny") => {
    setBusy(true);
    setError("");
    try {
      const result = await request<{ redirect: string }>(userId, "", {
        action,
        request_id: id,
      });
      window.location.assign(result.redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection could not finish.");
      setBusy(false);
    }
  };
  return (
    <section className="cr-profile-section">
      <h1>Connect your assistant.</h1>
      {error ? (
        <p className="cr-error" role="alert">
          {error}
        </p>
      ) : null}
      {!data && !error ? (
        <LoadingSkeleton label="Checking connection request" rows={3} />
      ) : data ? (
        <>
          <p>
            <strong>{data.client_name}</strong> wants permission to use
            CareerRadar with your account.
          </p>
          <p>
            The app name is supplied by its developer. Check that you started
            this request in the assistant you intend to connect.
          </p>
          <h2>Allow catalogue access</h2>
          <p>
            This connection can use CareerRadar’s read-only job and company
            tools. It does not grant access to your résumé, Gmail, founder
            contacts, or application submission.
          </p>
          <p className="sf-hint">
            Live catalogue access is currently unavailable. Connecting does not
            restore jobs or enable purchases.
          </p>
          <p className="sf-hint">
            Return address:{" "}
            <span className="cr-assistant-address">{data.redirect_uri}</span>
          </p>
          <p>
            You can disconnect this app in Settings. Authorisation lasts up to
            30 days.
          </p>
          <div className="cr-personal-actions">
            <button
              className="auth-secondary"
              disabled={busy}
              onClick={() => void decide("deny")}
            >
              Cancel
            </button>
            <button
              className="auth-primary"
              disabled={busy}
              onClick={() => void decide("approve")}
            >
              {busy ? "Continuing…" : "Allow connection"}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
export function AssistantApproval() {
  const account = useSiteAccount();
  const redirect = "/connect/approve" + window.location.search;
  return (
    <main className="cr-personal-page">
      <div className="cr-personal-container cr-assistant-consent">
        {account.loading ? (
          <LoadingSkeleton label="Checking your account" />
        ) : account.error ? (
          <section className="cr-profile-section">
            <p className="cr-error" role="alert">
              Your account could not be checked.
            </p>
            <button className="auth-secondary" onClick={account.retry}>
              Try again
            </button>
          </section>
        ) : account.userId ? (
          <Approval key={account.userId} userId={account.userId} />
        ) : (
          <section className="cr-profile-section">
            <h1>Connect CareerRadar.</h1>
            <p>Sign in to review this assistant’s access request.</p>
            <a
              className="auth-primary"
              href={"/login?redirect=" + encodeURIComponent(redirect)}
            >
              Sign in to continue
            </a>
          </section>
        )}
      </div>
    </main>
  );
}
export function AssistantSetup() {
  const [setup, setSetup] = useState<{
      enabled: boolean;
      endpoint: string;
    } | null>(null),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/assistant?action=setup", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((v) => {
        if (active) setSetup(v);
      })
      .catch(() => {
        if (active) setError("Connection setup is not available yet.");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="cr-personal-page">
      <div className="cr-personal-container cr-assistant-setup">
        <header className="cr-personal-heading">
          <div>
            <h1>CareerRadar in your assistant.</h1>
            <p>
              Connect once, approve access with your CareerRadar account, then
              use its tools through a compatible AI app.
            </p>
          </div>
        </header>
        <section className="cr-profile-section">
          <h2>One remote connection</h2>
          {error ? (
            <p className="cr-error" role="alert">
              {error}
            </p>
          ) : !setup ? (
            <LoadingSkeleton label="Checking availability" rows={2} />
          ) : (
            <>
              <p>
                {setup.enabled
                  ? "Account connections are enabled. The live jobs catalogue remains unavailable."
                  : "Assistant connections are being prepared. This URL is not ready to connect yet."}
              </p>
              <code className="cr-assistant-address">{setup.endpoint}</code>
              <div className="cr-personal-actions">
                <button
                  className="auth-secondary"
                  disabled={!setup.enabled}
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(setup.endpoint)
                      .then(() => {
                        setCopied(true);
                        setCopyError("");
                      })
                      .catch(() =>
                        setCopyError(
                          "Could not copy. Select and copy the URL above.",
                        ),
                      )
                  }
                >
                  {copied ? "Copied" : "Copy connection URL"}
                </button>
              </div>
              {copyError ? (
                <p className="cr-error" role="alert">
                  {copyError}
                </p>
              ) : null}
            </>
          )}
          <p>
            Add the remote MCP URL in your assistant’s connector settings, then
            sign in on CareerRadar and review the access request. Configuration
            differs between apps.
          </p>
          <p>
            No database download or local server is needed for the remote
            connection. Browser actions are separate features of your chosen
            assistant.
          </p>
          <a href="/settings#settings-assistants" className="cr-personal-link">
            Manage connected assistants
          </a>
        </section>
      </div>
    </main>
  );
}
