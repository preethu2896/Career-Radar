import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.18";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";
const issuer = Deno.env.get("CLERK_ISSUER") ?? "";
const jwks = issuer
  ? createRemoteJWKSet(new URL(issuer + "/.well-known/jwks.json"))
  : null;
export async function resolveCandidate(
  admin: SupabaseClient,
  token: string,
  origins: string[],
): Promise<string | null> {
  if (!token || token.length > 16384) return null;
  try {
    if (jwks) {
      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer,
          algorithms: ["RS256"],
          requiredClaims: ["exp", "iat", "sub", "iss"],
          clockTolerance: 5,
        });
        if (
          typeof payload.sub !== "string" ||
          !payload.sub ||
          payload.sub.length > 200
        )
          return null;
        if (
          payload.azp !== undefined &&
          (typeof payload.azp !== "string" || !origins.includes(payload.azp))
        )
          return null;
        const { data, error } = await admin.rpc("ensure_clerk_candidate", {
          p_issuer: issuer,
          p_subject: payload.sub,
          p_first_name:
            typeof payload.first_name === "string" ? payload.first_name : "",
          p_last_name:
            typeof payload.last_name === "string" ? payload.last_name : "",
        });
        return error || typeof data !== "string" ? null : data;
      } catch {
        /* Only independently verified legacy Supabase tokens may use the fallback. */
      }
    }
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : (data.user?.id ?? null);
  } catch {
    return null;
  }
}
