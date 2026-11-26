import { allowedOrigins } from "../_shared/allowedOrigins.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { resolveCandidate } from "../_shared/identity.ts";
const origins = allowedOrigins(Deno.env.get("CAREERRADAR_ALLOWED_ORIGINS"),Deno.env.get("CAREERRADAR_DEPLOYMENT_ORIGINS"));
Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
  if (origin && !origins.includes(origin))
    return new Response(JSON.stringify({ error: "Origin is not allowed." }), {
      status: 403,
      headers,
    });
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers,
    });
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token)
    return new Response(JSON.stringify({ error: "Sign in to continue." }), {
      status: 401,
      headers,
    });
  const signal = AbortSignal.timeout(30000);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal }) },
    },
  );
  const userId = await resolveCandidate(admin, token, origins);
  return new Response(
    JSON.stringify(
      userId
        ? { user_id: userId }
        : { error: "Your session could not be verified. Sign in again." },
    ),
    { status: userId ? 200 : 401, headers },
  );
});
